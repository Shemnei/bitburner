/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {NEW_SERVER_PREFIX} from 'const.js';

/**
 * Maximum power of 2 of ram a server can have (currently: 2^20).
 *
 * @type {number}
 */
const RAM_MAX_POW = 20;

/**
 * Cost of a server according of it's ram size.
 *
 * @type {number}
 */
const RAM_COST_PER_GB = 55000;

/**
 * Tries to buy the best server the player can afford.
 *
 * @param {NS} ns - Netscript API
 * @param {string} [name=NEW_SERVER_PREFIX] - Name of the server (will be extended by a number if already present)
 *
 * @returns {boolean} - Indicates if a server was bought
 */
export function buyBestAffordableServer(ns, name = NEW_SERVER_PREFIX) {
	for (var pow = RAM_MAX_POW; pow > 0; --pow) {
		const serverRam = Math.pow(2, pow);

		// This trial and error is intentional as the "better" approach would
		// cost more ram which is not available in the early stages.
		if (ns.purchaseServer(name, serverRam) !== "") {
			return true;
		}
	}

	return false;
}

/**
 * Returns the highest amount of ram which can be bought or `undefined` if
 * nothing can be bought.
 *
 * @param {number} [minRam] - Minimum amount of ram the server should have
 * @param {number} [maxCost] - Maximum amount of money to spend on the server
 *
 * @returns {number | undefined} - Highest amount of ram able to buy or undefined.
 */
export function highestRamPossible(minRam, maxCost) {
	const rMinRam = typeof minRam === 'undefined' ? 0 : minRam;
	const rMaxCost = typeof maxCost === 'undefined' ? Infinity : maxCost;

	for (var pow = RAM_MAX_POW; pow > 0; --pow) {
		const serverRam = Math.pow(2, pow);
		const serverCost = serverRam * RAM_COST_PER_GB;

		if (serverRam >= rMinRam && serverCost <= rMaxCost) {
			return serverRam;
		}
	}

	return undefined;
}

/**
 * Tries to buy a server with at least ram >= minRam and/or cost <= maxCost.
 *
 * @param {NS} ns - Netscript API
 * @param {number} [minRam] - Minimum amount of ram the server should have
 * @param {number} [maxCost] - Maximum amount of money to spend on the server
 * @param {string} [name=NEW_SERVER_PREFIX] - Name of the server (will be extended by a number if already present)
 *
 * @returns {boolean} - Indicates if a server was bought
 */
export function buyServer(ns, minRam, maxCost, name = NEW_SERVER_PREFIX) {
	const ramToBuy = highestRamPossible(minRam, maxCost);

	if (typeof ramToBuy !== 'undefined') {
		return ns.purchaseServer(name, ramToBuy) != "";
	}

	return false;
}

/**
 * Tries to buy a server with at least ram >= minRam and/or cost <= maxCost.
 * If all server slots are already filled, it will try to replace the worst
 * owned server if the server it can buy is better.
 *
 * @param {NS} ns - Netscript API
 * @param {number} [minRam] - Minimum amount of ram the server should have
 * @param {number} [maxCost] - Maximum amount of money to spend on the server
 * @param {string} [name=NEW_SERVER_PREFIX] - Name of the server (will be extended by a number if already present)
 * @param {string | undefined} [replaceServerName=undefined] - Name of the server to replace (if `undefined` replaces the one with the least ram).
 *
 * @returns {boolean} - Indicates if a server was bought
 */
export function buyOrUpgradeServer(ns, minRam, maxCost, name = NEW_SERVER_PREFIX, replaceServerName = undefined) {
	const limit = ns.getPurchasedServerLimit();
	const servers = ns.getPurchasedServers();

	if (servers.length >= limit) {
		ns.print('Reached server limit; Trying to replace worst server');

		var replaceName = typeof replaceServerName !== 'undefined' ?
			replaceServerName
			: servers.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))[0];
		const replaceRam = ns.getServerMaxRam(replaceName);
		const ableToBuy = highestRamPossible(minRam, maxCost);

		if (typeof ableToBuy !== 'undefined') {
			ns.print(`Trying to replace server '${replaceName}' with ${replaceRam}GB ram`);

			if (replaceRam < ableToBuy) {
				if (ns.deleteServer(replaceName)) {
					return buyServer(ns, minRam, maxCost, name);
				} else {
					ns.print(`Failed to delete worst server`);
					return false;
				}
			} else {
				ns.print(`No better server could be bought (worst is better)`);
				return false;
			}
		} else {
			ns.print(`No better server could be bought (paramter limit)`);
			return false;
		}
	} else {
		ns.print('Trying to purchase server');
		return buyServer(ns, minRam, maxCost, name);
	}
}
