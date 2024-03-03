import { getStrategy } from "./find-targets.js";
import {
  getAvailableCracks,
	getNetworkNodes,
	canPenetrate,
	getRootAccess,
	hasRam,
	getThresholds,
	getCompareField,
	getPotentialTargets,
} from "./utils.js";

/** 
 * Launches a coordinated attack on the network to
 * maximise the usage of our resources
 * (pirate themed)
 * 
 * @param {import(".").NS } ns
 **/
export async function main(ns) {
	ns.disableLog("ALL");
  ns.print("Running launch-fleets");
  const compareField = getCompareField(ns, ns.args[0] || "hackXP");
  const sortByHackXP = compareField === "hackXP" ? true : false;
	const overrideStrategy = sortByHackXP;
	var player = ns.getPlayer();
	var homeServ = ns.getHostname();
	var attackDelay = 50; // time (ms) between attacks

	var virus = "pirate.js";
	var virusRam = ns.getScriptRam(virus);

	var actions = {
		w: 'weaken',
		h: 'hack',
		g: 'grow'
	};

  var cracks = getAvailableCracks(ns);

	// Returns potentially controllable servers mapped to RAM available
	async function getShips() {
		var nodes = getNetworkNodes(ns);
    // ns.print("Nodes count:" + nodes.length);
		var servers = nodes.filter(node => {
			if (node === homeServ || node.includes('hacknet-server-')) {
				return false;
			}
      const isPenetrable = canPenetrate(ns, node, cracks);
      const hasSufficientRam = hasRam(ns, node, virusRam);
      // ns.print("Node:" + node + " | isPenetrable: " + isPenetrable + " | hasSufficientRam: " + hasSufficientRam);
			return isPenetrable && hasSufficientRam;
		});

    // ns.print("Server count:" + servers.length);

		// Prepare the servers to have root access and scripts
		for (var serv of servers) {
			if (!ns.hasRootAccess(serv)) {
				getRootAccess(ns, serv, cracks);
			}
			await ns.scp(virus, serv);
		}

		// Add purchased server
		var i = 0;
		var servPrefix = "pserv-";
		while(ns.serverExists(servPrefix + i)) {
			servers.push(servPrefix + i);
			++i;
		}

		return servers.reduce((acc, node) => {
			var maxRam = ns.getServerMaxRam(node);
			var curRam = ns.getServerUsedRam(node);
      // https://www.reddit.com/r/Bitburner/comments/hkbmfs/any_good_hacking_exp_scripts/
      var hackXP = (ns.getHackingLevel() - ns.getServerRequiredHackingLevel(node)) / ns.getHackingLevel();
			acc[node] = {
        availableRam: maxRam - curRam,
        hackXP
      };
			return acc;
		}, {});
	}

	function getDelayForActionSeq(seq, node) {
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

	function getMaxThreads(node) {
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
		const weakenEffect = ns.weakenAnalyze(1);
		const secToDecrease = Math.abs(ns.getServerSecurityLevel(node) - secThresh);
		const weakenThreads = weakenEffect > 0 ? Math.round(secToDecrease / weakenEffect) : 0;
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

	function getRequirements(node) {
		var strategy = getStrategy(ns, node, overrideStrategy);
		var delays = getDelayForActionSeq(strategy.seq, node);
		var maxThreads = getMaxThreads(node);
		return {
			delays,
			maxThreads,
			strategy
		};
	}

	// FLEET HELPER FUNCTIONS

	function getTotalThreads(servers) {
		return Object.values(servers).reduce((sum, nodeRam) => {
			var threads = Math.floor(nodeRam / virusRam);
			sum += threads;
			return sum;
		}, 0);
	}

	function getAllocation(reqs, ships) {
		var totalThreads = getTotalThreads(ships);
		var {
			maxThreads,
			strategy
		} = reqs;
		var numWeaken = 0;
		var numGrow = 0;
		var numHack = 0;
		if (maxThreads.total < totalThreads) {
			numWeaken = maxThreads.weaken;
			numGrow = maxThreads.grow;
			numHack = maxThreads.hack;
		} else {
			var { seq, allocation } = strategy;
			for (var i = 0; i < seq.length; i++) {
				var action = seq[i];
				var portion = allocation[i];
				if (action === 'w') {
					numWeaken = Math.floor(totalThreads * portion);
				} else if (action === 'g') {
					numGrow = Math.floor(totalThreads * portion);
				} else {
					numHack = Math.floor(totalThreads * portion);
				}
			}
		}
		return {
			numWeaken,
			numGrow,
			numHack
		};
	}

	function readyFleets(reqs, contract, ships, sortByXP = false) {
		var { strategy, delays } = reqs;
		var { seq } = strategy;
		// allocates tasks to servers with the largest ram first
		var ramSortedShips = Object.keys(ships).sort((a, b) => ships[b].availableRam - ships[a].availableRam);

    var sortedShips;
    if (sortByXP === true) {
      // allocates tasks to servers with the highest hack XP first
      sortedShips = ramSortedShips.sort((a, b) => ships[b].hackXP - ships[a].hackXP);
    } else {
      sortedShips = ramSortedShips;
    }

		var assigned = {};
		var fleets = [];
		for (var i = 0; i < seq.length; i++) {
			var delay = delays[i];
			var sym = seq[i]; // symbol
			var action = actions[sym];
			var maxThreads = contract[sym];
			var fleet = {
				action,
				ships: []
			}
			var usedThreads = 0;
			for (var serv of sortedShips) {
				if (usedThreads >= maxThreads) {
					break;
				}
				if (assigned[serv]) {
					continue; // skip assigned
				}
				var ram = ships[serv].availableRam;
				var maxExecThreads = Math.floor(ram / virusRam);
				var newUsedThreads = usedThreads + maxExecThreads;
				var threads = maxExecThreads;
				if (newUsedThreads > maxThreads) {
					threads = maxThreads - usedThreads; // only use subset
				}
				usedThreads += threads;
				assigned[serv] = {
					used: threads,
					left: maxExecThreads - threads
				};

				fleet.ships.push({
					serv,
					threads,
					delay
				});
			}
			fleets.push(fleet);
		}
		return {
			fleets,
			assigned
		};
	}

	// Create a fleet of servers that can be launched to target
	function createFleets(reqs, ships, sortByXP = false) {
		var { numWeaken, numGrow, numHack } = getAllocation(reqs, ships);
		// specifies how many threads we will allocate per operation
		var contract = {
			w: numWeaken,
			g: numGrow,
			h: numHack
		};
		// Assign fleets based on the contract
		return readyFleets(reqs, contract, ships, sortByXP);
	}

	function logShipAction(ship, action, target) {
		let variant = "INFO";
		let icon = "💵";
		if (action === "weaken") {
			variant = "ERROR";
			icon = "☠️";
		} else if (action === "grow") {
			variant = "SUCCESS";
			icon = "🌱";
		}
		ns.print(`${variant}\t ${icon} ${action} @ ${ship.serv} (${ship.threads}) -> ${target}`);
	}

	var tick = 1000;

	while (true) {
		var ships = await getShips();
		var availShips = Object.keys(ships).length;
		if (availShips === 0) {
			await ns.sleep(tick);
			continue;
		}
    // ns.print("Available Ships Count:" + availShips);
		var targets = getPotentialTargets(ns, compareField, overrideStrategy);
    // ns.print("Targets Count:" + targets.length);
    // ns.print("Targets:");
    // ns.print(targets);
		for (var target of targets) {
			var targetNode = target.node;
			var reqs = getRequirements(targetNode);
			var { fleets, assigned } = createFleets(reqs, ships, sortByHackXP);
			// SET SAIL!
      // ns.print("Fleet Count:" + fleets.length);
			for (var fleet of fleets) {
				var action = fleet.action;
				for (var ship of fleet.ships) {
          // ns.print("Ship threads:" + ship.threads.length);
					if (ship.threads < 1) {
						continue; // skip
					}
					var pid = 0;
					while (ns.exec(virus, ship.serv, ship.threads, action, targetNode, ship.delay, pid) === 0) {
						pid++;
					}
					logShipAction(ship, action, targetNode);
				}
        // ns.print("Fleet:");
        // ns.print(fleet);
        // ns.print("Ships Count:" + fleet.ships.length);
			}
			// Delete assigned from list of fleets
			for (var ship of Object.keys(assigned)) {
				var usage = assigned[ship];
				if (usage.left <= 1) { // useless if only 1 thread left
					delete ships[ship];
				} else {
					ships[ship].availableRam = usage.left;
				}
			}
			// Early exit if no more ships to assign
			if (Object.keys(ships).length <= 0) {
				break;
			}
		}
		await ns.sleep(tick);
	}
}