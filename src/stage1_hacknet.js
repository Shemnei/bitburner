/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {upgradeLevelsBlocking, upgradeRamBlocking, upgradeCoresBlocking} from './libhacknet.js';

const MAX_NODES = 8;
const MAX_LEVEL = 80;
const MAX_RAM = 16;
const MAX_CORES = 8;

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	ns.tprint("Upgrading hacknet nodes");

	while (ns.hacknet.numNodes() < MAX_NODES) {
		const index = ns.hacknet.purchaseNode();
		if (index === -1) {
			// Failed to buy
			await ns.sleep(3000);
		} else {
			await setupNode(ns, index);
		}
	}

	for (var i = 0; i < MAX_NODES; i++) {
		await upgradeLevelsBlocking(ns, i, MAX_LEVEL);
	}

	for (var i = 0; i < MAX_NODES; i++) {
		await upgradeRamBlocking(ns, i, MAX_RAM);
	}

	for (var i = 0; i < MAX_NODES; i++) {
		await upgradeCoresBlocking(ns, i, MAX_CORES);
	}
}

/**
 * @param {NS} ns - Netscript API
 * @param {number} index - Index of the hacknet node
 */
async function setupNode(ns, index) {
	await upgradeLevelsBlocking(ns, index, 30, 2);
}

