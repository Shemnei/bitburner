/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const target = ns.args[0];
	const amount = ns.args[1];

	if (typeof target === 'string') {
		if (typeof amount === 'number') {
			for (var i = 0; i < amount; ++i) {
				await ns.hack(target);
			}
		} else {
			while (true) {
				await ns.hack(target);
			}
		}
	}
}
