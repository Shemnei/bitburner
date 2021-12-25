import {HOME} from 'const.js';

/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Returns a score for the host.
 * This score determines the "optimal" target to hack.
 * The higher the score the better.
 *
 * @param {NS} ns - Netscript API
 * @param {string} host - Host to score
 *
 * @returns {number} - Score of the host
 */
export function score(ns, host) {
	const value = ns.getServerMaxMoney(host);
	const time = ns.getWeakenTime(host) + ns.getGrowTime(host) + ns.getHackTime(host);

	return value / time;
}

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
 * Checks if the host can be used to execute common actions (e.g. not protected).
 *
 * @param {string} host - List of hosts
 *
 * @returns {boolean} - Indicates if the host is allowed for common actions
 */
export function isAllowed(host) {
	return !(host === HOME || host.startsWith("protected"));
}
