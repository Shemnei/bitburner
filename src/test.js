/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {HOME, IMPLANT_PATH_GROW, IMPLANT_PATH_WEAKEN, IMPLANT_PATH_HACK} from 'const.js';
import {discoverAll} from 'libscan.js';
import {tryPwn} from 'libpwn.js';
import {score, getFreeRam} from 'libhost.js';
import {buyBestAffordableServer} from 'libserver.js';

/**
 * Entry point for script.
 *
 * Things to do manually:
 *  - Create Programs
 *  - Join Factions
 *  - Buy Arguemtens
 *
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	// TODO: When first starting game (1k money) try contiually hack the best target
	// to gain some money to buy the first servers.

	while (true) {
		const hosts = discoverAll(ns);
		// TODO: remove protected hosts (home, @stage1 n00dles)
		const rooted = tryPwn(ns, Array.from(hosts));

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
			numTimesToExecute += 2;

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
				// TODO: make better
				if (host !== HOME) {
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
			}

			// Sleep for `numTimesToExecute` executions.
			await ns.sleep(execTime * numTimesToExecute);

			// Try to buy server if the last action was hack.
			if (script === IMPLANT_PATH_HACK) {
				ns.tprint("Trying to buy new server");
				if (buyBestAffordableServer(ns)) {
					ns.tprint("bought");
				} else {
					ns.tprint("failed");
				}
			}
		} else {
			// No target

			ns.tprint("Failed to find target");
			return;
		}
	}
}
