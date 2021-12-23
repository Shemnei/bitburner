/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import { discoverAll } from './scan.js';

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const hosts = discoverAll(ns);

	for (const host of hosts) {
		ns.tprint("Host: " + host);
	}
}
