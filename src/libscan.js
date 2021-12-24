import {HOME} from 'const.js';

/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Creates a set of all hosts on the network.
 *
 * @param {NS} ns - Netscript API
 * @param {string} [rootHost=HOME] - Root server from which to start the scan
 *
 * @returns {Set<string>} - List of all servers on the same network as rootHost
 */
export function discoverAll(ns, rootHost = HOME) {
	const discovered = new Set();
	const queue = new Array();

	queue.push(rootHost);

	while (queue.length > 0) {
		const host = queue.pop();

		// Only continue if the server has not been processed
		if (!discovered.has(host)) {
			discovered.add(host);

			const peers = ns.scan(host);
			queue.push(...peers);
		}
	}

	return discovered;
}
