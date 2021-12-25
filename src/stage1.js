/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {HOME, IMPLANT_PATH_GROW, IMPLANT_PATH_WEAKEN, IMPLANT_PATH_HACK} from 'const.js';
import {discoverAll} from 'libscan.js';
import {tryPwn} from 'libpwn.js';
import {getFreeRam, isAllowed} from 'libhost.js';

/**
 * Amount of ram required on the home server to advance to this stage.
 * @type {number}
 */
export const HOME_RAM_REQUIRED = 32;

/**
 * Checks if the requirements for this stage are met.
 *
 * @param {NS} ns - Netscript API
 *
 * @returns {boolean} - Boolean indicating if the stages requirements are met
 */
export function hasRequirements(ns) {
	return ns.getServerMaxRam(HOME) >= HOME_RAM_REQUIRED;
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
	const value = ns.getServerMaxMoney(host);
	const time = ns.getWeakenTime(host) + ns.getGrowTime(host) + ns.getHackTime(host);

	return value / time;
}

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	// Lauch supporting scripts.
	ns.run("stage1_hacknet.js");

	ns.tprint("---- MESSAGE ----");
	ns.tprint("To kickstart this stage buy the darknet upgrade and as many port opening software as possible.");
	ns.tprint("After that try to gain favor with the tech factions.");
	ns.tprint("-----------------");

	while (true) {
		const allowedHosts = Array.from(discoverAll(ns)).filter(isAllowed);
		const rooted = tryPwn(ns, allowedHosts);

		const playerHackingLevel = ns.getHackingLevel();
		let target = undefined;
		let targetScore = undefined;

		for (const host of rooted.keys()) {
			if (playerHackingLevel >= ns.getServerRequiredHackingLevel(host)) {
				const hostScore = score(ns, host);

				if (typeof targetScore === 'undefined' || targetScore < hostScore) {
					target = host;
					targetScore = hostScore;
				}
			}
		}

		if (typeof target !== 'undefined') {
			ns.tprint("Next Target: " + target);

			const moneyThreshold = ns.getServerMaxMoney(target) * 0.9;
			const securityTreshold = ns.getServerMinSecurityLevel(target) + 3;

			var numTimesToExecute = 0.05;
			// TODO: Keep value at 2 for stage 1
			numTimesToExecute += 1;

			/**
			 * @type {string}
			 */
			var script;

			/**
			 * @type {number}
			 */
			var execTime;

			if (ns.getServerSecurityLevel(target) > securityTreshold) {
				ns.tprint("weakening");
				script = IMPLANT_PATH_WEAKEN;
				execTime = ns.getWeakenTime(target);
			} else if (ns.getServerMoneyAvailable(target) < moneyThreshold) {
				ns.tprint("growing");
				script = IMPLANT_PATH_GROW;
				execTime = ns.getGrowTime(target);
			} else {
				ns.tprint("hacking");
				script = IMPLANT_PATH_HACK;
				execTime = ns.getHackTime(target);
			}

			if (typeof script === 'undefined' || typeof execTime === 'undefined') {
				ns.tprint("Script error: `script` or `execTime` not defined");
				return;
			}

			for (const host of rooted.keys()) {
				// Copy over required script
				await ns.scp(script, HOME, host);

				// Kill all running scripts
				ns.killall(host);

				// Calculate max amount of threads for script and host.
				// Floor is used as `exec` will round to the nearest integer
				// value which could exceed the ram, causing `exec` to fail.
				var numThreads = Math.floor(getFreeRam(ns, host) / ns.getScriptRam(script, HOME));

				if (numThreads > 0) {
					ns.exec(script, host, numThreads, target);
				}
			}

			ns.tprint("Wleeping " + ((execTime * numTimesToExecute) / 1000) + "s for action to finish");

			// Sleep for `numTimesToExecute` executions.
			await ns.sleep(execTime * numTimesToExecute);

			// Try to buy server if the last action was hack.
			//if (script === IMPLANT_PATH_HACK) {
			//	ns.tprint("Trying to buy new server");
			//	if (buyBestAffordableServer(ns)) {
			//		ns.tprint("bought");
			//	} else {
			//		ns.tprint("failed");
			//	}
			//}
		} else {
			// No target

			ns.tprint("Failed to find target");
			return;
		}
	}
}
