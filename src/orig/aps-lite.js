import { runAps } from "./aps-utils";

/**
 * Auto purchase server (lite version)
 * Only cares about purchasing the server
 * Does not deploy scripts
 * @param {import(".").NS } ns
 * **/
 export async function main(ns) {
	ns.disableLog("ALL");

	ns.tail();
	
	await runAps(ns);
}