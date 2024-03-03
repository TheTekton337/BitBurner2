const homeServer = "home";
const rootPath = "/";
const wgetConfig = {
  protocol: "http://",
  hostname: "localhost",
  port: 7272
}

const STOP_RUNNING_SCRIPTS = false;

/** @param {NS} ns */
export async function main(ns) {
  ns.tprint("NUKING!");

  if (STOP_RUNNING_SCRIPTS) {
    ns.killall(homeServer, true);
    ns.exec("kill-network-scripts.js", homeServer);
    ns.exec("nuke.js", homeServer, undefined, "default");
  }

  // Download src root files
  // const isSrcRootDownloaded = await wgetFiles(ns, srcRootFiles);
  // if (isSrcRootDownloaded) {
  //   ns.tprint("Successfully downloaded srcRootFiles!");
  // }

  // Download orig files
  const isOrigFilesDownloaded = await wgetFiles(ns, origFiles);
  if (isOrigFilesDownloaded) {
    ns.tprint("Successfully downloaded origFiles!");
  }

  // // Download jjcark1982 files
  // const isJJCarkDownloaded = await wgetFiles(ns, jjcark1982Files);
  // if (isJJCarkDownloaded) {
  //   ns.tprint("Successfully downloaded jjcark1982Files!");
  // }
}

/** @param {NS} ns */
async function wgetFiles(ns, files, config = wgetConfig, host = homeServer) {
  let isSuccess = true;

  for (const file of files) {
    const filePath = `${rootPath}${file}`;
    const { protocol, hostname, port } = config;
    const result = await ns.wget(`${protocol}${hostname}:${port}${rootPath}` + file, filePath, host);
    if (!result) {
      ns.tprint("Failed to download " + file);
      isSuccess = false;
    }
  }

  return isSuccess;
}

// const srcRootFiles = [
//   "wgetVSCode.js",
//   "nuke.js",
//   "kill-network-scripts.js"
// ];

const origFiles = [
  "ap-hacknet-node.js",
  "aps-lite.js",
  "aps-utils.js",
  "auto-backdoor.js",
  "auto-contract-solver.js",
  "auto-deploy.js",
  "auto-infiltrate.js",
  "auto-purchase-server.js",
  "auto-starter.js",
  "best.js",
  "book-keeper.js",
  "captain.js",
  "connect-next-backdoor.js",
  "contracts/find-and-solve.js",
  "contracts/solvers.js",
  "corp-division-manager.js",
  "corp-product-manager.js",
  "corp-recruiter.js",
  "corp-researcher.js",
  "dev-tools-v2.js",
  "dev-tools.js",
  "diamond-hands.js",
  "early-hack-template.js",
  "find-server.js",
  "find-targets.js",
  "get-yt-comments.js",
  "gimme-money.js",
  "gimme-more-money.js",
  "git-download.js",
  "grow-pirate.js",
  "gtfo.js",
  "hack-pirate.js",
  "kill-network-scripts.js",
  "launch-fleets.js",
  "local-hackxp-grind.js",
  "n00dles.js",
  "network-report.txt",
  "pirate.js",
  "port-utils.js",
  "probe.js",
  "purchase-server-8gb.js",
  "queue-service.js",
  "sell-stocks.js",
  "strategist.js",
  "utils.js",
  "warmonger.js",
  "get-yt-comments.js",
  "watchtower.js",
  "weaken-host.js",
  "weaken-pirate.js",
  "wgetCS.js",
];

// const jjcark1982Files = [
//   "augmentations/buy.js",
//   "augmentations/graft.js",
//   "augmentations/info.js",
//   "augmentations/unlock.js",
//   "batch/manage.js",
//   "batch/prep.js",
//   "botnet/manager.js",
//   "botnet/prep.js",
//   "botnet/stop.js",
//   "botnet/thread-pool.js",
//   "botnet/worker-grow.js",
//   "botnet/worker-hack.js",
//   "botnet/worker-weaken.js",
//   "botnet/worker.js",
//   "contracts/find-and-solve.js",
//   "contracts/solvers.js",
//   "corporation/buyback-shares.js",
//   "corporation/init.js",
//   "exploit/dev-menu.js",
//   "exploit/console.js",
//   "exploit/printHTML.js",
//   "exploit/select-next-bitnode.js",
//   "gang/ascend.js",
//   "gang/buy-augs.js",
//   "gang/info.js",
//   "gang/manage.js",
//   "hacking/batch-model.js",
//   "hacking/batch-view.js",
//   "hacking/planner.js",
//   "hacking/worker.js",
//   "inspect/bitnode.js",
//   "inspect/get-info.js",
//   "inspect/server.js",
//   "lib/box-drawing.js",
//   "lib/port-service.js",
//   "net/auto-link.js",
//   "net/buy-server.js",
//   "net/deploy-script.js",
//   "net/register-servers.js",
//   "net/server-list.js",
//   "net/upgrade-home-server.js",
//   "old/batch-analyze.js",
//   "old/batch-manage.js",
//   "player/backdoor-servers.js",
//   "player/create-programs.js",
//   "player/crime.js",
//   "player/info.js",
//   "player/join-factions.js",
//   "player/prestige.js",
//   "player/train.js",
//   "player/tunnel.js",
//   "service/compute.js",
//   "service/hack-planning.js",
//   "service/server-info.js",
//   "share/deploy.js",
//   "share/share.js",
//   "sleeves/buy-augs.js",
//   "sleeves/crime.js",
//   "sleeves/init.js",
//   "sleeves/train.js",
//   "sleeves/work.js",
//   "stanek/charge-x-y.js",
//   "stanek/deploy.js",
//   "stanek/info.js",
//   "stanek/respec.js",
//   "stocks/companies.js",
//   "stocks/sell.js",
//   "stocks/trader.js",
//   "unmanaged-hacking/deploy.js",
//   "unmanaged-hacking/hack-grow-weaken.js",
//   "unmanaged-hacking/stop.js",
//   "init.js",
//   "wgetVSCode.js",
//   "nuke.js",
//   "kill-network-scripts.js"
// ];