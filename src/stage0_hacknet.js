/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {tryUpgradeRam, tryUpgradeLevels, tryUpgradeCores} from './libhacknet.js';

// The index indicates the amount of nodes
const UPGRADE_PLAN = [
	// 0
	{
		levels: 0,
		ram: 0,
		cores: 0,
	},
	// 1
	{
		levels: 33,
		ram: 0,
		cores: 0,
	},
	// 2
	{
		levels: 49,
		ram: 0,
		cores: 0,
	},
	// 3
	{
		levels: 64,
		ram: 0,
		cores: 0,
	},
	// 4
	{
		levels: 80,
		ram: 0,
		cores: 0,
	},
	// 5
	//{
	//	levels: 96,
	//	ram: 1,
	//	cores: 0,
	//},
];

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	ns.tprint("Upgrading hacknet nodes");

	var doLoop = true;

	while (doLoop) {
		const node_count = ns.hacknet.numNodes();
		const plan = UPGRADE_PLAN[node_count];

		if (node_count >= UPGRADE_PLAN.length) {
			break;
		}

		// First upgrade levels on all nodes
		for (var index = 0; index < node_count; ++index) {
			for (var target = 1; target < plan.levels; ++target) {
				const current = ns.hacknet.getNodeStats(index).level;

				if (current < target) {
					const bought = tryUpgradeLevels(ns, index, target);
					if (current + bought < target) {
						doLoop = false;
						break;
					}
				}
			}
		}

		// Second upgrade ram on all nodes
		for (var index = 0; index < node_count; ++index) {
			for (var target = 1; target < plan.ram; ++target) {
				const current = ns.hacknet.getNodeStats(index).ram;

				if (current < target) {
					const bought = tryUpgradeRam(ns, index, target);
					if (current + bought < target) {
						doLoop = false;
						break;
					}
				}
			}
		}

		// Third upgrade cores on all nodes
		for (var index = 0; index < node_count; ++index) {
			for (var target = 1; target < plan.cores; ++target) {
				const current = ns.hacknet.getNodeStats(index).cores;

				if (current < target) {
					const bought = tryUpgradeCores(ns, index, target);
					if (current + bought < target) {
						doLoop = false;
						break;
					}
				}
			}
		}

		// Try to buy new node
		if (node_count < UPGRADE_PLAN.length - 1) {
			doLoop = ns.hacknet.purchaseNode() !== -1;
		} else {
			doLoop = false;
		}
	}

	ns.spawn("trampoline.js");
}

