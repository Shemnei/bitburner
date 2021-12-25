/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {HOME} from 'const.js';

/**
 * Returns the amount of money the player has.
 *
 * @param {NS} ns - Netscript API
 *
 * @returns {number} - Money
 */
export function getPlayerMoney(ns) {
	return ns.getServerMoneyAvailable(HOME);
}
