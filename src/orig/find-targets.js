import {
	getThresholds,
	getCompareField,
	getPotentialTargets,
} from "./utils.js";

/** @param {import(".").NS } ns */
function getNodeInfo(ns, node, compareField = "revYield", overrideDefaultStrategy = false) {
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

	var server = ns.getServer(node);
	var player = ns.getPlayer();

	// const compareField = hasFormulas(ns) ? "revYield" : "maxMoney";

	let revYield;
	let hackChance = 0;

	if (compareField === "revYield") {
		hackChance = ns.formulas.hacking.hackChance(server, player);
		revYield = maxMoney * hackChance;
	}

	var strategy = getStrategy(ns, node, overrideDefaultStrategy);

  // https://www.reddit.com/r/Bitburner/comments/hkbmfs/any_good_hacking_exp_scripts/
  var hackXP = (ns.getHackingLevel() - ns.getServerRequiredHackingLevel(node)) / ns.getHackingLevel();

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
	};
	for (var key of Object.keys(strategy)) {
		var value = strategy[key];
		nodeDetails['strategy.' + key] = value;
	}
	return nodeDetails;
}

// Strategy for thread allocation
export function getStrategy(ns, node, overrideDefaultStrategy = false) {
	var { moneyThresh, secThresh } = getThresholds(ns, node);
	var type = ''; // strategy name (for logging)
	var seq = []; // action sequence
	var allocation = []; // recommended allocation
	// TODO: Add more strategies and get rid of override
	if (overrideDefaultStrategy === true) {
    type = 'grind';
		seq = ['w'];
		allocation = [1];
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

/** @param {NS} ns **/
export async function main(ns) {
	const compareField = getCompareField(ns, ns.args[0] || undefined);
	var filename = "network-report.txt";

	async function writeNodesToFile(nodes) {
		var lines = [];
		for (var node of nodes) {
			for (var field of Object.keys(node)) {
				var value = node[field];
				lines.push(field + ": " + value);
			}
			lines.push("");
		}
		var fileContent = lines.join("\n");
		await ns.write(filename, fileContent, 'w');
		ns.alert(fileContent);
		ns.toast("Wrote targets to " + filename, "info", 3000);
	}
  const overrideStrategy = compareField === "hackXP" ? true : false;
	var potentialTargets = getPotentialTargets(ns, compareField, overrideStrategy);
	await writeNodesToFile(potentialTargets);
}