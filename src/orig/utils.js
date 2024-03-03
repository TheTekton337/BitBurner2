export const homeServer = "home";
export const pservPrefix = "pserv-";
export const formulasBin = "Formulas.exe";

/** @param {import(".").NS } ns */
export function getCracks(ns) {
  return {
    "BruteSSH.exe": {
      enabled: false,
      runScript: ns.brutessh
    },
    "FTPCrack.exe": {
      enabled: false,
      runScript: ns.ftpcrack
    },
    "relaySMTP.exe": {
      enabled: false,
      runScript: ns.relaysmtp
    },
    "HTTPWorm.exe": {
      enabled: false,
      runScript: ns.httpworm
    },
    "SQLInject.exe": {
      enabled: false,
      runScript: ns.sqlinject
    }
  };
}

/** @param {import(".").NS } ns */
export function getAvailableCracks(ns) {
  let availableCracks = {};

  const cracks = getCracks(ns);
  const crackNames = Object.keys(cracks);

  let dirs = ns.ls(homeServer);
  dirs.forEach((fileName, i) => {
    if (crackNames.some((crack, j) => crack === fileName)) {
      const crackName = fileName;
      
      availableCracks[crackName] = cracks[crackName];

      availableCracks[crackName].enabled = true;
    }
  });

  return availableCracks;
}

/** @param {import(".").NS } ns */
export function getNetworkNodes(ns, origin = ns.getHostname()) {
	var visited = {};
	var stack = [];
	stack.push(origin);

	while (stack.length > 0) {
		var node = stack.pop();
		if (!visited[node]) {
			visited[node] = node;
			const neighbours = ns.scan(node);
			for (var i = 0; i < neighbours.length; i++) {
				var child = neighbours[i];
				if (visited[child]) {
					continue;
				}
				stack.push(child);
			}
		}
	}
	return Object.keys(visited);
}

/** @param {import(".").NS } ns */
function getDelayForActionSeq(ns, player, seq, node) {
	const attackDelay = 50; // 50ms

	var server = ns.getServer(node);
	var wTime = ns.formulas.hacking.weakenTime(server, player);
	var gTime = ns.formulas.hacking.growTime(server, player);
	var hTime = ns.formulas.hacking.hackTime(server, player);
	var timing = {
		w: wTime,
		g: gTime,
		h: hTime
	};
	const baseTimes = seq.map((_, i) => i + (attackDelay * i));
	const actionStart = seq.map((action, i) => {
		const execTime = timing[action];
		return baseTimes[i] - execTime;
	});
	const execStart = Math.min(...actionStart);
	const delays = seq.map((_, i) => {
		return Math.abs(execStart - actionStart[i]);
	});
	return delays;
}

/** @param {import(".").NS } ns */
function getMaxThreads(ns, node) {
	var { moneyThresh, secThresh } = getThresholds(ns, node);
	var curMoney = ns.getServerMoneyAvailable(node);
	// Grow calculation
	var growThreads = 0;
	if (curMoney < 1) {
		// no money, assign a single thread to put some cash into it
		growThreads = 1;
	} else {
		var growMul = moneyThresh / curMoney;
		if (growMul >= 1) {
			growThreads = Math.round(ns.growthAnalyze(node, growMul));
		}
	}
	// Weaken calculation
	var weakenEffect = ns.weakenAnalyze(1);
	var weakenThreads = weakenEffect > 0 ? Math.round(secThresh / weakenEffect) : 0;
	// Hack calculation
	var hackEffect = ns.hackAnalyze(node);
	var hackTaken = hackEffect * curMoney;
	var hackThreads = Math.round(moneyThresh / hackTaken);

	// Guards (there's a bug with hackAnalyze I think)
	if (hackThreads === Infinity) {
		hackThreads = 0;
	}
	if (weakenThreads === Infinity) {
		weakenThreads = 0;
	}
	if (growThreads === Infinity) {
		growThreads = 1;
	}

	return {
		grow: growThreads,
		weaken: weakenThreads,
		hack: hackThreads,
		total: growThreads + weakenThreads + hackThreads
	};
}

// Strategy for thread allocation
/** @param {import(".").NS } ns */
function getStrategy(ns, node, overrideDefaultStrategy = false) {
	var { moneyThresh, secThresh } = getThresholds(ns, node);
	var type = ''; // strategy name (for logging)
	var seq = []; // action sequence
	var allocation = []; // recommended allocation
	if (overrideDefaultStrategy === true) {
			type = 'grind';
			seq = ['w'];
			allocation = [0.99];
	} else if (ns.getServerSecurityLevel(node) > secThresh) {
		type = 'flog';
		seq = ['g', 'w'];
		allocation = [0.3, 0.7];
	} else if (ns.getServerMoneyAvailable(node) < moneyThresh) {
		type = 'nourish';
		seq = ['g', 'w'];
		allocation = [0.6, 0.4];
	} else {
		type = 'plunder';
		seq = ['h', 'w', 'g', 'w'];
		allocation = [0.25, 0.25, 0.25, 0.25];
	}
	return {
		type,
		seq,
		allocation
	};
}

/** @param {import(".").NS } ns */
function getRequirements(ns, node, player, overrideDefaultStrategy = false) {
	var strategy = getStrategy(ns, node, overrideDefaultStrategy);
	var delays = getDelayForActionSeq(ns, player, strategy.seq, node);
	var maxThreads = getMaxThreads(ns, node);
	return {
		delays,
		maxThreads,
		strategy
	};
}

/** @param {import(".").NS } ns */
export function getNodeInfo(ns, node, compareField = "revYield", overrideDefaultStrategy = false) {
	var maxMoney = ns.getServerMaxMoney(node);
	var curMoney = ns.getServerMoneyAvailable(node);
	var reqHackLevel = ns.getServerRequiredHackingLevel(node);
	var security = ns.getServerSecurityLevel(node);
	var minSecurity = ns.getServerMinSecurityLevel(node);
	var moneyThresh = maxMoney * 0.75;
	var secThresh = minSecurity + 5;
	var reqPorts = ns.getServerNumPortsRequired(node);
	var hasRoot = ns.hasRootAccess(node);
	var maxRam = ns.getServerMaxRam(node);

	var so = ns.getServer(node);
	var player = ns.getPlayer();

	// const compareField = hasFormulas(ns) ? "revYield" : "maxMoney";
	// Default pre-Formulas.exe weight. minDifficulty directly affects times, so it substitutes for min security times
	let weight = so.moneyMax / so.minDifficulty;

	const hasFormulas = getHasFormulas(ns);
	const hackChance = hasFormulas ? ns.formulas.hacking.hackChance(so, player) : ns.hackAnalyzeChance(node);

	let revYield = maxMoney * hackChance;

	if (compareField === "hackChance") {
		weight = hackChance;
	} else if (compareField === "revYield" || compareField === "maxMoney") {
		if (hasFormulas) {
			weight = maxMoney / ns.formulas.hacking.weakenTime(so, player) * hackChance;
		}
	} else if (compareField === "hackXP") {
		const moneyMultiplier = so.moneyMax > 0 ? ns.getServerMoneyAvailable(node) / so.moneyMax : 0;
		const playerHackingLevel = ns.getHackingLevel();
		const levelDifferenceMultiplier = playerHackingLevel >= so.requiredHackingSkill ? 1 : playerHackingLevel / so.requiredHackingSkill;
		weight = hackChance * moneyMultiplier * levelDifferenceMultiplier;
	} else if (so.requiredHackingSkill > player.skills.hacking / 2) {
		// If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
		weight = 0;
	}

	var strategy = getStrategy(ns, node, overrideDefaultStrategy);

  // https://www.reddit.com/r/Bitburner/comments/hkbmfs/any_good_hacking_exp_scripts/
  var hackXP = (ns.getHackingLevel() - ns.getServerRequiredHackingLevel(node)) / ns.getHackingLevel();
	
	const reqs = getRequirements(ns, node, player, overrideDefaultStrategy);

	const nodeDetails = {
		node,
		maxMoney,
		maxRam,
		curMoney,
		reqHackLevel,
		security,
		minSecurity,
		secThresh,
		moneyThresh,
		reqPorts,
		hasRoot,
		hackChance,
		revYield,
    hackXP,
		reqs,
		weight,
	};
	for (var key of Object.keys(strategy)) {
		var value = strategy[key];
		nodeDetails['strategy.' + key] = value;
	}
	return nodeDetails;
}

/** @param {NS} ns **/
export function getPotentialTargets(ns, compareKey = "revYield", overrideDefaultStrategy = false, comparator) {
  const cracks = getAvailableCracks(ns);

	var networkNodes = getNetworkNodes(ns);
	var hackableNodes = networkNodes.filter(node => {
		return canHack(ns, node) && canPenetrate(ns, node, cracks) && !node.includes("pserv")
	});

	// Prepare the servers to have root access
	for (var serv of hackableNodes) {
		if (!ns.hasRootAccess(serv)) {
			getRootAccess(ns, serv, cracks);
		}
	}

	var nodeDetails = hackableNodes.map(node => getNodeInfo(ns, node, compareKey, overrideDefaultStrategy));

	let nodesDesc = nodeDetails.filter(node => compareKey === "revYield" ? node.maxMoney > 0 : true);

	if (compareKey && comparator) {
		nodesDesc = nodesDesc.sort(comparator);
	} else if (compareKey) {
		nodesDesc = nodesDesc.sort((a, b) => b.weight - a.weight);
	}
	
	return nodesDesc;
}

/** @param {import(".").NS } ns */
export function penetrate(ns, server, cracks) {
	for (var file of Object.keys(cracks)) {
    const { enabled, runScript } = cracks[file];
    if (enabled === true) {
      runScript(server);
    }
	}
}

/** @param {import(".").NS } ns */
function getNumCracks(ns, cracks) {
	return Object.keys(cracks).filter(function (file) {
		return cracks[file].enabled === true && ns.fileExists(file, homeServer);
	}).length;
}

/** @param {import(".").NS } ns */
export function canPenetrate(ns, server, cracks) {
	var numCracks = getNumCracks(ns, cracks);
	var reqPorts = ns.getServerNumPortsRequired(server);
	return numCracks >= reqPorts;
}

/** @param {import(".").NS } ns */
export function hasRam(ns, server, scriptRam, useMax = false) {
	var maxRam = ns.getServerMaxRam(server);
	var usedRam = ns.getServerUsedRam(server);
	var ramAvail = useMax ? maxRam : maxRam - usedRam;
	return ramAvail > scriptRam;
}

/** @param {import(".").NS } ns */
export function canHack(ns, server) {
	var pHackLvl = ns.getHackingLevel(); // player
	var sHackLvl = ns.getServerRequiredHackingLevel(server);
	return pHackLvl >= sHackLvl;
}

/** 
 * @param {import(".").NS } ns
 * @param {string[]} scripts
 **/
export function getTotalScriptRam(ns, scripts) {
	return scripts.reduce((sum, script) => {
		sum += ns.getScriptRam(script);
		return sum;
	}, 0)
}

/** @param {import(".").NS } ns */
export function getRootAccess(ns, server, cracks) {
	var requiredPorts = ns.getServerNumPortsRequired(server);
	if (requiredPorts > 0) {
		penetrate(ns, server, cracks);
	}
  if (!ns.hasRootAccess(server)) {
    ns.print("Gaining root access on " + server);
    // ns.tprint("Gaining root access on " + server);
    ns.nuke(server);
  }
}

/** @param {import(".").NS } ns */
export function getThresholds(ns, node) {
	var moneyThresh = ns.getServerMaxMoney(node) * 0.75;
	var secThresh = ns.getServerMinSecurityLevel(node) + 5;
	return {
		moneyThresh,
		secThresh
	}
}

// Returns a weight that can be used to sort servers by hack desirability
/** @param {import(".").NS } ns */
export function getHostWeight(ns, host, compareField = "revYield") {
	if (!host) {
		return 0;
	}

	// Don't ask, endgame stuff
	if (host.startsWith('hacknet-node') || host.startsWith(pservPrefix)) {
		return 0;
	}

	// Get the player information
	let player = ns.getPlayer();

	// Get the server information
	let so = ns.getServer(host);

	// Set security to minimum on the server object (for Formula.exe functions)
	so.hackDifficulty = so.minDifficulty;

	// We cannot hack a server that has more than our hacking skill so these have no value
	if (so.requiredHackingSkill > player.skills.hacking) {
		return 0;
	}

	// Default pre-Formulas.exe weight. minDifficulty directly affects times, so it substitutes for min security times
	let weight = so.moneyMax / so.minDifficulty;

	// If we have formulas, we can refine the weight calculation
	if (getHasFormulas(ns)) {
		// maxMoney | hackChance
		if (compareField === "hackChance") {
			weight = so.hackChance;
		} else if (compareField === "revYield" || compareField === "maxMoney") {
			// We use weakenTime instead of minDifficulty since we got access to it, 
			// and we add hackChance to the mix (pre-formulas.exe hack chance formula is based on current security, which is useless)
				weight = so.moneyMax / ns.formulas.hacking.weakenTime(so, player) * ns.formulas.hacking.hackChance(so, player);
		} else if (compareField === "hackXP") {
			const hackChance = ns.hackAnalyzeChance(host);
			const moneyMultiplier = so.moneyMax > 0 ? ns.getServerMoneyAvailable(host) / so.moneyMax : 0;
			const playerHackingLevel = ns.getHackingLevel();
			const levelDifferenceMultiplier = playerHackingLevel >= so.requiredHackingSkill ? 1 : playerHackingLevel / so.requiredHackingSkill;

			// Combine these factors into a single effectiveness score
			weight = hackChance * moneyMultiplier * levelDifferenceMultiplier
			// weight = (player.skills.hacking - so.requiredHackingSkill) / player.skills.hacking;
			// weight = (player.skills.hacking - so.requiredHackingSkill) / player.skills.hacking;
		} else if (so.hasOwnProperty(compareField)) {
			weight = so[compareField];
		}
	} else if (so.requiredHackingSkill > player.skills.hacking / 2) {
		// If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
		return 0;
	}

	return weight;
}

/** @param {import(".").NS } ns */
export function getHasFormulas(ns) {
	return ns.fileExists(formulasBin, homeServer);
}

/** @param {import(".").NS } ns */
export function getCompareField(ns, defaultCompare = "revYield") {
	let compareField = defaultCompare;
	if (defaultCompare === "revYield") {
		compareField = getHasFormulas(ns) ? "revYield" : "maxMoney";
	}
	return compareField;
}

export const getServerWeightComparator = (ns, compareField) => (a, b) => {
	const comparatorField = getCompareField(ns, compareField);
	getHostWeight(ns, b.node, comparatorField) - getHostWeight(ns, a.node, comparatorField);
}

export function getComparator(fields) {
	if (Array.isArray(fields)) {
		return compareFields(...fields);
	} else {
		return compareField;
	}
}

export const compareField = (a, b) => {
	if (a[compareField] > b[compareField]) {
		return -1;
	} else if (a[compareField] < b[compareField]) {
		return 1;
	} else {
		return 0;
	}
}

export const compareFields = orders => (a, b) => {
	const sortDirection = { asc: 1, desc: -1 };
	const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const totalOrders = orders.length;

	for (let index = 0; index < totalOrders; index++) {
			const { property, direction = 'desc' } = orders[index];
			const directionInt = sortDirection[direction];
			const compare = sortCollator.compare(a[property], b[property]);

			if (compare < 0) return directionInt;
			if (compare > 0) return -directionInt;
	}

	return 0;
};