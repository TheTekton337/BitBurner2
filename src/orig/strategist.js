import {
	getCompareField,
	getPotentialTargets,
} from "./utils.js";
import { pushToInputPort, checkForEvent } from "./port-utils.js";

/** @param {import(".").NS } ns */
export async function main(ns) {
	ns.disableLog("ALL");

	const port = ns.args[0];
	const delay = ns.args[1];
	const compareField = getCompareField(ns, ns.args[2] || undefined);

  const overrideStrategy = compareField === "hackXP" ? true : false;

	const reqEvent = "reqTargets"; // request event
	const resEvent = "resTargets"; // response event

	async function respondToRequest(reqId, overrideDefaultStrategy = false) {
		const targets = await getPotentialTargets(ns, compareField, overrideDefaultStrategy);
		pushToInputPort(ns, resEvent, reqId, targets, port);
	}

	while (true) {
		const event = checkForEvent(ns, reqEvent);
		if (event) {
			const reqId = event.reqId;
			ns.print("WARN\tReceived request with request ID: " + reqId)
			await respondToRequest(reqId, overrideStrategy);
		}
		await ns.sleep(delay);
	}
}