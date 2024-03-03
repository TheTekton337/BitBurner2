const homeServer = "home";

/** @param {NS} ns */
export async function main(ns) {
  let isBackedUp = false;

  const mode = ns.args[0] || "default";

  const nukeFiles = ns.ls(homeServer, ".js").filter((file) => {
    return !file.includes("backup_") && file !== 'nuke.js' && file !== 'wgetVSCode.js' && file !== 'kill-network-scripts.js';
  });
  const backupDir = "/backup_" + Date.now() + "/";

  if(mode === "backup") {
    isBackedUp = true;
  }

  for (const file of nukeFiles) {
    if (ns.fileExists(file, homeServer)) {
      if (!isBackedUp) {
        ns.rm(file, homeServer);
      } else {
        const nextFile = `${backupDir}${file}`;
        ns.mv(homeServer, file, nextFile);
      }
    }
  }

  if (isBackedUp) {
    ns.tprint(`MOVED ALL ROOT SCRIPTS TO ${backupDir}`);
  } else {
    ns.tprint("DELETED ALL ROOT SCRIPTS");
  }
}