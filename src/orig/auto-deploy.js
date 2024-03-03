import {
  homeServer,
  getAvailableCracks,
	getNetworkNodes,
	canPenetrate,
	hasRam,
	getRootAccess,
	getServerWeightComparator,
} from "./utils.js";

const isSorted = true;
const compareType = "revYield";
// const compareType = "hackXP";
const fallbackTarget = "n00dles";
const killNetworkScript = "kill-network-scripts.js";
// var virus = "gimme-money.js";
const virus = "early-hack-template.js";

let hasInitialized = false;
let autoSelectTarget = true;
let autoSelectEnabled = true;
let playerLevel = 0;

let servers = {};

/** @param {import(".").NS } ns **/
export async function main(ns) {
	let target;

	playerLevel = ns.getHackingLevel();

  let availableCracks = getAvailableCracks(ns);

	function selectTarget(allowAllTargets = false) {
		let target = fallbackTarget;

		let targetOptions = getTargetServers(allowAllTargets);

		if (isSorted) {
			targetOptions = targetOptions.sort(
				getServerWeightComparator(ns, compareType)
			);
		}

		if (targetOptions && targetOptions.length > 0) {
			target = targetOptions[0];
		}

		return target;
	}

	var virusRam = ns.getScriptRam(virus);

	async function copyAndRunVirus(server) {
		await ns.scp(virus, server, homeServer);
		
		var maxThreads = Math.floor(ns.getServerMaxRam(server) / virusRam);

		if (!servers.hasOwnProperty(server)) {
			servers[server] = maxThreads;
		} else if (servers[server] !== maxThreads) {
			servers[server] = maxThreads;
		}
		
    if (maxThreads > 0) {
		  ns.exec(virus, server, maxThreads, target);
    }
	}

	function getTargetServers(allowAllTargets = true) {
		var networkNodes = getNetworkNodes(ns);
		var hackableNodes = networkNodes.filter(function (node) {
			if (node === ns.getHostname()) {
				return false;
			}
			return canPenetrate(ns, node, availableCracks);
		});

		// Penetrate and gain root access if necessary
		for (const node of hackableNodes) {
      getRootAccess(ns, node, availableCracks);
		}

		// Filter ones we can run scripts on
		var targets = hackableNodes.filter(function (node) {
      if (!hasInitialized) {
        ns.killall(node);
      }
			return hasRam(ns, node, virusRam, true);
		});

		if (allowAllTargets) {
			// Add purchased servers
			var i = 0;
			var servPrefix = "pserv-";
			while(ns.serverExists(servPrefix + i)) {
				targets.push(servPrefix + i);
				++i;
			}
		}
		
		return targets;
	}

	async function deployHacks(targets) {
    if (!hasInitialized) {
		  ns.tprint("Gonna deploy virus to these servers " + targets);
    }
		for (var serv of targets) {
			await copyAndRunVirus(serv);
		}
	}

	function updateTarget() {
		if (autoSelectTarget) {
			const nextTarget = selectTarget();

			if (nextTarget !== target) {
				target = nextTarget;
				ns.exec(killNetworkScript, homeServer);
				ns.tprint("New target: " + target);
			}
		}
	}

	var curTargets = [];
	var waitTime = 20000;

	while (true) {
		if (!target) {
			autoSelectTarget = true;
		}

		const nextPlayerLevel = ns.getHackingLevel();

		if (nextPlayerLevel !== playerLevel) {
			playerLevel = nextPlayerLevel;
			
			updateTarget();
		}

		if (autoSelectTarget && autoSelectEnabled) {
			target = selectTarget();
			ns.tprint("Target chosen: " + target);
			autoSelectEnabled = false;
		}

		if (!target) {
			ns.tprint("Target not found! " + target);
			return;
		}

		var newTargets = getTargetServers();
		if (newTargets.length !== curTargets.length) {
			await deployHacks(newTargets);
			curTargets = newTargets;
		}

    if (!hasInitialized) {
      hasInitialized = true;
    }

		await ns.sleep(waitTime);
	}
}