/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {HOME, IMPLANT_PATH_HACK} from 'const.js';
import {discoverAll} from 'libscan.js';
import {tryPwn} from 'libpwn.js';
import {getFreeRam, retainSources, retainTargets} from 'libhost.js';
import {HOME_RAM_REQUIRED, hasRequirements as hasStage1Requirements} from 'stage1.js';

// TODO: const list of requirements/dependencies

/**
 * Indicates if hacknet should be upgraded (can be enabled for offline income).
 *
 * @type {boolean}
 */
const UPGRADE_HACKNET = false;

/**
 * Checks if the requirements for this stage are met.
 *
 * @param {NS} ns - Netscript API
 *
 * @returns {boolean} - Boolean indicating if the stages requirements are met
 */
export function hasRequirements(ns) {
	return true;
}

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
	return ns.getServerMoneyAvailable(host) / ns.getHackTime(host);
}

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	ns.tprint("---- MESSAGE ----");
	ns.tprint("To advance to the next stage upgrade the ram of the home server in the city.");
	ns.tprint("RAM required: " + HOME_RAM_REQUIRED);
	ns.tprint("Hacking level required: 100");
	ns.tprint("");
	ns.tprint("TIP: First buy the darknet upgrade and then the first two port opening softwares.");
	ns.tprint("-----------------");

	while (!hasStage1Requirements(ns)) {
		const hosts = retainSources(Array.from(discoverAll(ns)));
		const sources = Array.from(tryPwn(ns, hosts).keys());
		const targets = retainTargets(ns, sources)
			.sort((a, b) => score(ns, b) - score(ns, a));

		sources.push(HOME);

		ns.print("Targets: " + targets);

		if (targets.length === 0) {
			ns.tprint("No targets found");
			return;
		}

		const target = targets[0];

		if (typeof target !== 'undefined') {
			ns.tprint("Next Target: " + target);

			const numTimesToExecute = 1.001;
			const script = IMPLANT_PATH_HACK;
			const execTime = ns.getHackTime(target);

			for (const host of sources) {
				if (host !== HOME) {
					// Copy over required script
					await ns.scp(script, HOME, host);
				}

				// Calculate max amount of threads for script and host.
				// Floor is used as `exec` will round to the nearest integer
				// value which could exceed the ram, causing `exec` to fail.
				var numThreads = Math.floor(getFreeRam(ns, host) / ns.getScriptRam(script, HOME));

				if (numThreads > 0) {
					ns.exec(script, host, numThreads, target, 1);
				}
			}

			ns.tprint("Waiting " + ((execTime * numTimesToExecute) / 1000) + "s for hack to finish");

			// Sleep for `numTimesToExecute` executions.
			await ns.sleep(execTime * numTimesToExecute);
		} else {
			// No target

			ns.tprint("Failed to find target");
			return;
		}
	}

	ns.tprint("Re-checking requirements");
	ns.spawn("trampoline.js");
}
