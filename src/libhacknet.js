/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {getPlayerMoney} from 'libutil.js';

/**
 * Purchases level upgrades for a hacknet node in steps of `step` until
 * the target value is reached.
 * This function call will block until the target is reached.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 * @param {number} [step=10] - Target value to reach
 * @param {number} [sleep=3000] - Amount of ms to sleep between each check
 */
export async function upgradeLevelsBlocking(ns, index, target, step = 10, sleep = 3000) {
	var current = ns.hacknet.getNodeStats(index).level;

	while (current < target) {
		const purchaseAmount = Math.min(step, target - current);
		const cost = ns.hacknet.getLevelUpgradeCost(index, purchaseAmount);

		while (getPlayerMoney(ns) < cost) {
			await ns.sleep(sleep);
		}

		if (ns.hacknet.upgradeLevel(index, purchaseAmount)) {
			current += purchaseAmount;
		}
	}
}

/**
 * Purchases ram upgrades for a hacknet node in steps of `step` until
 * the target value is reached.
 * This function call will block until the target is reached.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 * @param {number} [step=10] - Target value to reach
 * @param {number} [sleep=3000] - Amount of ms to sleep between each check
 */
export async function upgradeRamBlocking(ns, index, target, step = 2, sleep = 3000) {
	var current = ns.hacknet.getNodeStats(index).ram;

	while (current < target) {
		const purchaseAmount = Math.min(step, target - current);
		const cost = ns.hacknet.getRamUpgradeCost(index, purchaseAmount);

		while (getPlayerMoney(ns) < cost) {
			await ns.sleep(sleep);
		}

		if (ns.hacknet.upgradeRam(index, purchaseAmount)) {
			current += purchaseAmount;
		}
	}
}

/**
 * Purchases cores upgrades for a hacknet node in steps of `step` until
 * the target value is reached.
 * This function call will block until the target is reached.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 * @param {number} [step=10] - Target value to reach
 * @param {number} [sleep=3000] - Amount of ms to sleep between each check
 */
export async function upgradeCoresBlocking(ns, index, target, step = 2, sleep = 3000) {
	var current = ns.hacknet.getNodeStats(index).cores;

	while (current < target) {
		const purchaseAmount = Math.min(step, target - current);
		const cost = ns.hacknet.getCoreUpgradeCost(index, purchaseAmount);

		while (getPlayerMoney(ns) < cost) {
			await ns.sleep(sleep);
		}

		if (ns.hacknet.upgradeCore(index, purchaseAmount)) {
			current += purchaseAmount;
		}
	}
}

/**
 * Tries to upgrade the level of a hacknet node. If not enough money is present
 * it will buy as many as possible.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 *
 * @returns {number} - Amount of upgrades bought
 */
export function tryUpgradeLevels(ns, index, target) {
	const current = ns.hacknet.getNodeStats(index).level;
	const required = target - current;

	for (var req = required; req > 0; --req) {
		if (ns.hacknet.upgradeLevel(index, req)) {
			return req;
		}
	}

	return 0;
}

/**
 * Tries to upgrade the ram of a hacknet node. If not enough money is present
 * it will buy as many as possible.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 *
 * @returns {number} - Amount of upgrades bought
 */
export function tryUpgradeRam(ns, index, target) {
	const current = ns.hacknet.getNodeStats(index).ram;
	const required = target - current;

	for (var req = required; req > 0; --req) {
		if (ns.hacknet.upgradeRam(index, req)) {
			return req;
		}
	}

	return 0;
}

/**
 * Tries to upgrade the cores of a hacknet node. If not enough money is present
 * it will buy as many as possible.
 *
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 * @param {number} target - Target value to reach
 *
 * @returns {number} - Amount of upgrades bought
 */
export function tryUpgradeCores(ns, index, target) {
	const current = ns.hacknet.getNodeStats(index).cores;
	const required = target - current;

	for (var req = required; req > 0; --req) {
		if (ns.hacknet.upgradeCore(index, req)) {
			return req;
		}
	}

	return 0;
}
