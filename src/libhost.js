import {HOME} from 'const.js';

/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Returns the amount of free ram for a host.
 *
 * @param {NS} ns - Netscript API
 * @param {string} host - Host to get free ram for
 *
 * @returns {number} - Amount of free ram
 */
export function getFreeRam(ns, host) {
	return ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
}

/**
 * Retains all hosts which are allowed to be the source of an attack.
 *
 * @param {string[]} hosts - List of hosts (@see discoverAll)
 *
 * @returns {string[]} - hosts for an attack
 */
export function retainSources(hosts) {
	return hosts.filter((host) =>
		!host.startsWith("protected")
	);
}

/**
 * Retains all hosts which are allowed to be the target of an attack.
 *
 * @param {NS} ns - Netscript API
 * @param {string[]} hosts - List of hosts (@see discoverAll)
 *
 * @returns {string[]} - hosts for a target
 */
export function retainTargets(ns, hosts) {
	const playerHackingLevel = ns.getHackingLevel();

	return hosts.filter((host) =>
		ns.getServerMaxMoney(host) > 0 // should filter out all player owned servers
		&& playerHackingLevel >= ns.getServerRequiredHackingLevel(host)
	);
}
