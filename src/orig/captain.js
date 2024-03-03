import { pushToInputPort, checkForEvent, createUUID } from "./port-utils.js";
import { getCompareField, homeServer } from "./utils.js";

// Constants
const SINGLE_THREAD = 1;
const DEFAULT_DEPENDENCY_DELAY = 50;

// Service ports
const STRATEGIST_PORT = 1;
const BOOK_KEEPER_PORT = 2;
const WARMONGER_PORT = 3;

// Virus script
const VIRUS = "pirate.js";

// Captain fields
const CAPTAIN_PORT = 19;
const MAX_TICKS = 5;
const REQ_DURATION = 250;

/** @param {import(".").NS } ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const uuid = createUUID();

	const optionalCompareField = ns.args[0];

	let compareField = undefined;
	if (optionalCompareField) {
		compareField = getCompareField(ns, optionalCompareField);
	}

	// Type of data we can request from our services
	const dataType = {
		// Network nodes request/response prefix
		ships: "Ships",
		// Targets request/response prefix
		targets: "Targets",
		// Attack request/response prefix
		attack: 'Attack'
	}

	// Services that need to be running before the captain
	const dependencies = {
		'watchtower.js': compareField || undefined,
		'queue-service.js': undefined,
		'diamond-hands.js': undefined,
		'strategist.js': optionalCompareField ? {
			port: STRATEGIST_PORT,
			delay: DEFAULT_DEPENDENCY_DELAY,
			compareField: compareField || undefined
		} : {
			port: STRATEGIST_PORT,
			delay: DEFAULT_DEPENDENCY_DELAY
		},
		'book-keeper.js': {
			port: BOOK_KEEPER_PORT,
			delay: DEFAULT_DEPENDENCY_DELAY
		},
		'warmonger.js': {
			port: WARMONGER_PORT,
			delay: DEFAULT_DEPENDENCY_DELAY
		},
		'local-hackxp-grind.js': undefined,
		// 'auto-contract-solver.js': undefined,
	}

	var actions = {
		w: 'weaken',
		h: 'hack',
		g: 'grow'
	};

	var virusRam = ns.getScriptRam(VIRUS);

	async function requestData(type, payload = {}) {
		const reqEvent = `req${type}`;
		const resEvent = `res${type}`;
		pushToInputPort(ns, reqEvent, uuid, payload, CAPTAIN_PORT);
		let curTicks = 0;
		while (true) {
			if (curTicks > MAX_TICKS) {
				ns.print("ERROR Request time out for " + type);
				return;
			}
			const event = checkForEvent(ns, resEvent, uuid);
			if (event) {
				return event.data;
			}
			curTicks++;
			await ns.sleep(REQ_DURATION);
		}
	}

	function runDependencies() {
		for (const service of Object.keys(dependencies)) {
			const args = dependencies[service];
			if (!ns.scriptRunning(service, homeServer)) {
				if (args && Array.isArray(args)) {
					ns.run(service, SINGLE_THREAD, ...args);
				} else if (args && typeof args === 'object' && args !== null) {
					ns.run(service, SINGLE_THREAD, ...Object.values(args));
				} else if (args) {
					ns.run(service, SINGLE_THREAD, args);
				} else {
					ns.run(service, SINGLE_THREAD);
				}
			}
		}
	}

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

	function readyFleets(reqs, contract, ships) {
		var { strategy, delays } = reqs;
		var { seq } = strategy;
		// allocates tasks to servers with the largest ram first
		var sortedShips = Object.keys(ships).sort((a, b) => ships[b] - ships[a]);
		// var sortedShips = Object.keys(ships);
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
				var ram = ships[serv];
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
	function createFleets(reqs, ships) {
		var { numWeaken, numGrow, numHack } = getAllocation(reqs, ships);
		// specifies how many threads we will allocate per operation
		var contract = {
			w: numWeaken,
			g: numGrow,
			h: numHack
		};
		// Assign fleets based on the contract
		return readyFleets(reqs, contract, ships);
	}

	async function launchAttack(target, fleets) {
		const res = await requestData(dataType.attack, { target, fleets });
		if (res) {
			ns.print("SUCCESS\tAttacking " + target);
			// ns.tprint("SUCCESS\tAttacking " + target);
		} else {
			ns.print("ERROR\tFailed to attack " + target);
			// ns.tprint("ERROR\tFailed to attack " + target);
		}
	}

	runDependencies();

  // ns.tprint("Dependencies loaded");

	const tick = 1000;

	while (true) {
    // ns.tprint("Requesting ships...");
		const ships = await requestData(dataType.ships);
    // ns.tprint("Ships:");
    // ns.tprint(ships);
		if (!ships || Object.keys(ships).length === 0) {
			await ns.sleep(tick);
			continue;
		}
    // ns.tprint("Requesting targets...");
		const targets = await requestData(dataType.targets);
    // ns.tprint("Targets:");
    // ns.tprint(targets);
		if (!targets) {
			continue;
		}
		for (const target of targets) {
			if (Object.keys(ships).length === 0) {
				break; // no ships available
			}
			const targetNode = target.node;
			const reqs = target.reqs;
      // ns.tprint("Creating fleets...");
			var { fleets, assigned } = createFleets(reqs, ships);
      // ns.tprint("Fleets:");
      // ns.tprint(fleets);
			await launchAttack(targetNode, fleets);
			// Delete assigned from list of fleets
			for (var ship of Object.keys(assigned)) {
				var usage = assigned[ship];
				if (usage.left <= SINGLE_THREAD) { // useless if only 1 thread left
					delete ships[ship];
				} else {
					ships[ship] = usage.left;
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