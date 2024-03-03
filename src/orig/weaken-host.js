/** @param {import(".").NS } ns */
export async function main(ns) {
  const target = ns.args[0];
  const delay = ns.args[1] || 1000;
  ns.print("Weakening host: " + target);
  await ns.sleep(delay);
  await ns.weaken(target);
}