import { attemptAllContracts } from "./contracts/find-and-solve.js";

const isDebug = false;

/** @param {import(".").NS } ns */
export async function main(ns) {
  ns.disableLog("scan");
  ns.disableLog("sleep");

  const delay = ns.args[0] || 60 * 1000;

  ns.tail();
  
  while (true) {
    await attemptAllContracts(ns, isDebug);

    ns.print(`Sleeping for ${delay / 60 / 1000}m...`);

    await ns.sleep(delay);
  }
}