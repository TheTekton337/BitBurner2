import { homeServer, pservPrefix } from "./utils";

const delay = 2000;

/** @param {import(".").NS } ns */
export async function runAps(ns) {
	let pRam = 8; // purchased ram

	const maxRam = ns.getPurchasedServerMaxRam();

	while (true) {
		ns.print(`INFO Upgrading all servers to ${pRam}GB`);
		await autoUpgradeServers(ns, pRam);
		ns.tprintf("SUCCESS Upgraded all servers to " + pRam + "GB");
		if (pRam === maxRam) {
			ns.tprintf("SUCCESS Upgrades complete!");
			break;
		}
		// move up to next tier
		const newRam = pRam * 2;
		if (newRam > maxRam) {
			pRam = maxRam;
		} else {
			pRam = newRam;
		}

		await ns.sleep(delay);
	}
}

export let hasInitialized = false;

export const serverList = {};

/** @param {import(".").NS } ns */
export function getServerUpgradeMinCost(ns) {
	const maxServers = ns.getPurchasedServerLimit();

	const pservMaxRam = ns.getPurchasedServerMaxRam();

	let i = 0;
	while (i < maxServers) {
		const pserver = pservPrefix + i;

		serverList[pserver] = {
			serverMaxRam: ns.getServerMaxRam(pserver)
		};

		++i;
	}

	const lowestValue = Math.min(...Object.entries(serverList).map(o => o[1]));
	const nextValue = lowestValue * 2;

	if (pservMaxRam > nextValue) {
		const serverMoneyAvailable = ns.getServerMoneyAvailable(homeServer);
		const purchasedServerCost = ns.getPurchasedServerCost(nextValue);
		const isServerPurchasable = serverMoneyAvailable > purchasedServerCost;
		if (!isServerPurchasable) {
			ns.print(`INFO Need to upgrade ${pserver} to ${nextValue}GB`);
			ns.print("APS Min upgrade cost: " + nextValue + "GB - " + ns.nFormat(purchasedServerCost, '$0.00a'));
			return purchasedServerCost;
		}
	}

	return 0;
}

/** @param {import(".").NS } ns */
export function canPurchaseServer(ns, pRam) {
	return ns.getServerMoneyAvailable(homeServer) > ns.getPurchasedServerCost(pRam);
}

/** @param {import(".").NS } ns */
export async function waitForMoney(ns, pRam) {
	let isWaitNoticeDisplayed = false;
	while (!canPurchaseServer(ns, pRam)) {
		if (!isWaitNoticeDisplayed) {
			ns.print("Waiting to purchase server: " + pRam + "GB @ " + ns.nFormat(ns.getPurchasedServerCost(pRam), '$0.00a'));
		}
		isWaitNoticeDisplayed = true;
		await ns.sleep(10000); // wait 10s
	}
}

/** @param {import(".").NS } ns */
export async function upgradeServer(ns, pRam, server) {
	var sRam = ns.getServerMaxRam(server);
	if (sRam < pRam) {
		if (server === 'pserv-4') {
			ns.print(`WARN ${server} @ ${pRam}GB = ${ns.nFormat(ns.getPurchasedServerCost(pRam), '$0.00a')}`);
		}
		await waitForMoney(ns, pRam);
		ns.killall(server);
		ns.deleteServer(server);
		ns.purchaseServer(server, pRam);
		ns.print(`WARN ⬆️ UPGRADE ${server} @ ${pRam}GB`);
	}
}

/** @param {import(".").NS } ns */
export async function purchaseServer(ns, pRam, server) {
	await waitForMoney(ns, pRam);
	ns.purchaseServer(server, pRam);
	ns.print(`WARN 💰 PURCHASE ${server} @ ${pRam}GB`);
}

/** @param {import(".").NS } ns */
export async function autoUpgradeServers(ns, pRam) {
	var i = 0;
	var maxServers = ns.getPurchasedServerLimit();
	while (i < maxServers) {
		var server = pservPrefix + i;
		if (ns.serverExists(server)) {
			await upgradeServer(ns, pRam, server);
			++i;
		} else {
			await purchaseServer(ns, pRam, server);
			++i;
		}
	}
}