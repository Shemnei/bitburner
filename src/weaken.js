/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const target = ns.args[0];

	if (typeof target === 'string') {
		while (true) {
			await ns.weaken(target);
		}
	}
}
