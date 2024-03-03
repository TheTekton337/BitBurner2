import {
  homeServer,
  getPotentialTargets,
} from "./utils";

/** @param {import(".").NS } ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const compareField = "hackXP";
  const overrideStrategy = true;

  const startTime = Date.now();
  const startLevel = ns.getHackingLevel();
  let lastLevel = startLevel;
  const startXP = getHackingXP(ns);
  let lastReportTime = startTime;
  let lastXP = startXP;

  const maxRam = ns.getServerMaxRam(homeServer);
  var grindScript = "weaken-host.js";
  var grindScriptRam = ns.getScriptRam(grindScript);

  var tick = 10000;

  ns.disableLog("ALL"); // Disable logging to keep the terminal clean
  ns.tail();
  ns.print(`Starting hacking xp grind...`);

  while (true) {
    const usedRam = ns.getServerUsedRam(homeServer);
    const ramBuffer = grindScriptRam * 15;
    const availableRam = maxRam - usedRam - ramBuffer;

    if (availableRam < 0) {
      await ns.sleep(tick);
      continue;
    }

    var maxExecThreads = Math.floor(availableRam / grindScriptRam);

    if (maxExecThreads < 1) {
      await ns.sleep(tick);
      continue;
    }

    const targets = getPotentialTargets(ns, compareField, overrideStrategy);

    if (targets && targets.length > 0) {
      const target = targets[0].node;
      ns.exec(grindScript, homeServer, maxExecThreads, target);
    }

    // Report XP gain and rate every 5 minutes
    const currentTime = Date.now();
    if (currentTime - lastReportTime >= 300000) {
      const currentXP = getHackingXP(ns);
      const currentLevel = ns.getHackingLevel();
      const xpGained = currentXP - lastXP;
      const timeElapsed = (currentTime - lastReportTime) / 60000; // Convert to minutes
      const xpRate = xpGained / timeElapsed; // XP per minute
      ns.print(`Current hacking level: ${currentLevel}`);
      if (currentLevel > lastLevel) {
        ns.print(`Level up! ${lastLevel} -> ${currentLevel}!`);
      }
      ns.print(
        `XP Gained in last ${timeElapsed.toFixed(2)} minutes: ${xpGained}`
      );
      ns.print(`XP Rate: ${xpRate.toFixed(2)} per minute`);
      lastReportTime = currentTime;
      lastXP = currentXP;
      lastLevel = currentLevel;
    }

    await ns.sleep(tick);
  }
}

function getHackingXP(ns) {
  return ns.getPlayer().exp.hacking;
}
