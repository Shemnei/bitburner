/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 * @typedef { import('./typedef/bitburner.t').Server } Server
 */

import {HOME, IMPLANT_PATH_GROW, IMPLANT_PATH_WEAKEN, IMPLANT_PATH_HACK} from 'const.js';
import {discoverAll} from 'libscan.js';
import {tryPwn} from 'libpwn.js';
import {getFreeRam, retainSources, retainTargets} from 'libhost.js';

/**
 * Amount of ram required on the home server to advance to this stage.
 *
 * @type {number}
 */
export const HOME_RAM_REQUIRED = 32;

/**
 * Indicates if hacknet should be upgraded (can be enabled for offline income).
 *
 * @type {boolean}
 */
const UPGRADE_HACKNET = false;

/**
 * Additional amount of ram to keep reserved on the home server.
 * This is in addition to the ram already occupied by running scripts.
 *
 * @type {number}
 */
const HOME_RAM_RESERVED = 16;

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
	const maxMoney = ns.getServerMaxMoney(host);

	if (maxMoney > 0) {
		const growthMultiplier = Math.ceil(maxMoney / (ns.getServerMoneyAvailable(host) + 0.001));
		const threadsGrowFull = ns.growthAnalyze(host, growthMultiplier);
		const timeGrowFull = ns.getGrowTime(host) * threadsGrowFull;

		const securityLevelAfter = ns.getServerSecurityLevel(host) + ns.growthAnalyzeSecurity(threadsGrowFull);
		const threadsSecurityMin = (securityLevelAfter - ns.getServerMinSecurityLevel(host)) / ns.weakenAnalyze(1);
		const timeSecurityMin = ns.getWeakenTime(host) * threadsSecurityMin;

		const threadsHack = 1.0 / ns.hackAnalyze(host);
		const timeHack = ns.getHackTime(host) * threadsHack;

		return maxMoney / (timeGrowFull + timeSecurityMin + timeHack);
	} else {
		return 0;
	}
}

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	// TODO: Check
	// Apparently classes have ram cost when a function from here is imported.
	// The classes are defined inside the main function so that importing
	// `hasRequirements` does not cost the ram of the classes.

	class ChangeSet {
		/**
		 * @param {number} security - change in security level
		 * @param {number} money - change in money
		 */
		constructor(security, money) {
			this.security = security;
			this.money = money;
		}
	}

	class Action {
		static WEAKEN = 'weaken';
		static GROW = 'grow';
		static HACK = 'hack';

		/**
		 * @param {string} type - type of the action (grow, weaken, hack)
		 * @param {string} source - source (host) of the action
		 * @param {string} target - target (host) of the action
		 * @param {Date} startTime - time when the action was started
		 * @param {number} execTime - execution time of the action in milliseconds
		 * @param {number} threads - amount of threads
		 * @param {ChangeSet} predictedChange - predicted change in target values
		 */
		constructor(type, source, target, startTime, execTime, threads, predictedChange) {
			this.type = type;
			this.source = source;
			this.target = target;
			this.startTime = startTime;
			this.execTime = execTime;
			this.threads = threads;
			this.predictedChange = predictedChange;
		}

		isRunning() {
			return !this.hasFinishedIn(0);
		}

		/**
		 * @param {number} ms - Milliseconds
		 */
		hasFinishedIn(ms) {
			const future = new Date().getTime() + ms;
			const execEnd = this.startTime.getTime() + this.execTime;

			return future >= execEnd;
		}
	}

	class HostManager {
		/**
		 * @type {Map<string, Action[]>}
		 */
		actions = new Map();

		constructor(maxHackFrac = 0.3, maxMoneyGrowFrac = 0.9) {
			this.maxHackFrac = maxHackFrac;
			this.maxMoneyGrowFrac = maxMoneyGrowFrac;
		}

		/**
		 * @param {NS} ns - Netscript API
		 */
		async run(ns) {
			const hosts = retainSources(Array.from(discoverAll(ns)));

			const sources = Array.from(tryPwn(ns, hosts).keys());
			const targets = retainTargets(ns, sources)
				.sort((a, b) => score(ns, b) - score(ns, a));
			ns.print("Targets: " + targets);

			if (targets.length === 0) {
				ns.tprint("No targets found");
				return;
			}

			const weakenAmount = ns.weakenAnalyze(1);

			for (const target of targets) {
				this.pruneActions();
				const targetInfo = ns.getServer(target);

				const actionOptions = [
					{
						type: Action.HACK,
						execTime: ns.getHackTime(target),
					},
					{
						type: Action.GROW,
						execTime: ns.getGrowTime(target),
					},
					{
						type: Action.WEAKEN,
						execTime: ns.getWeakenTime(target),
					},
				].sort((a, b) => a.execTime - b.execTime);

				for (const actionOption of actionOptions) {
					var actions = this.actions.get(target);
					if (typeof actions === 'undefined') {
						actions = [];
					}

					const finishedActions = actions
						.filter((action) => action.hasFinishedIn(actionOption.execTime))
						.map((action) => action.predictedChange);
					const appliedInfo = applyChanges({...targetInfo}, finishedActions);

					if (actionOption.type === Action.GROW) {
						const money = appliedInfo.moneyAvailable;
						const moneyMaxCalc = appliedInfo.moneyMax * this.maxMoneyGrowFrac;

						if (money < moneyMaxCalc) {
							const growthMultiplier = Math.ceil(moneyMaxCalc / (money + 0.001));
							const threads = Math.ceil(ns.growthAnalyze(target, growthMultiplier));

							const change = new ChangeSet(ns.growthAnalyzeSecurity(threads), money * growthMultiplier);

							if (await this.trySchedule(ns, actionOption, target, threads, sources, change) < threads) {
								return;
							}
						}
					} else if (actionOption.type === Action.WEAKEN) {
						const security = appliedInfo.hackDifficulty;
						const securityMin = appliedInfo.minDifficulty;

						if (security > securityMin) {
							const securityDiff = security - securityMin;
							const threads = Math.ceil(securityDiff / weakenAmount);

							const change = new ChangeSet(-ns.weakenAnalyze(threads), 0);

							if (await this.trySchedule(ns, actionOption, target, threads, sources, change) < threads) {
								return;
							}
						}
					} else if (actionOption.type === Action.HACK) {
						const security = appliedInfo.hackDifficulty;
						const securityMin = appliedInfo.minDifficulty;

						const money = appliedInfo.moneyAvailable;
						const moneyMaxCalc = appliedInfo.moneyMax * this.maxMoneyGrowFrac;

						if (security <= securityMin && money >= moneyMaxCalc) {
							const hackMoney = money * this.maxHackFrac;
							const threads = Math.ceil(ns.hackAnalyzeThreads(target, hackMoney));

							const change = new ChangeSet(ns.hackAnalyzeSecurity(threads), -hackMoney);

							if (await this.trySchedule(ns, actionOption, target, threads, sources, change) < threads) {
								return;
							}
						}
					} else {
						throw new Error(`Invalid action type: ${actionOption.type}`);
					}
				}
			}
		}

		pruneActions() {
			for (var actions of this.actions.values()) {
				actions = actions.filter((action) => action.isRunning());
			}
		}

		/**
		 * @param {NS} ns - Netscript API
		 * @param {{type: string, execTime: number}} actionTiming - action type with timing
		 * @param {string} target - target of the attack
		 * @param {number} threads - amount of threads
		 * @param {string[]} sources - list of source hosts for the attack
		 * @param {ChangeSet} totalChange - total change for all threads
		 *
		 * @returns {Promise<number>} - number of threads scheduled
		 */
		async trySchedule(ns, actionTiming, target, threads, sources, totalChange) {
			var scheduledThreads = 0;
			var script = undefined;

			switch (actionTiming.type) {
				case Action.GROW:
					script = IMPLANT_PATH_GROW;
					break;
				case Action.WEAKEN:
					script = IMPLANT_PATH_WEAKEN;
					break;
				case Action.HACK:
					script = IMPLANT_PATH_HACK;
					break;
			}

			if (typeof script === 'string') {
				const scriptSize = ns.getScriptRam(script, HOME);

				for (const source of sources) {
					const threadsNeeded = (threads - scheduledThreads);

					if (threadsNeeded <= 0) {
						break;
					}

					var freeRam = getFreeRam(ns, source);
					if (source === HOME) {
						freeRam = Math.max(freeRam - HOME_RAM_RESERVED, 0);
					}

					const possibleThreads = Math.min(Math.floor(freeRam / scriptSize), threadsNeeded);

					if (possibleThreads > 0) {
						if (await ns.scp(script, HOME, source)) {
							// getTime is used as args to make the process unique.
							// If the same process would start on a host it would fail.
							if (ns.exec(script, source, possibleThreads, target, 1, new Date().getTime()) !== 0) {
								ns.tprint(`\tScheduled ${possibleThreads} threads on ${source} to ${actionTiming.type} ${target}`);

								const threadFrac = possibleThreads / threads;
								const change = new ChangeSet(totalChange.security * threadFrac, totalChange.money * threadFrac);

								ns.tprint(`\t\tChange: ${JSON.stringify(change)}`);

								if (typeof change === 'undefined') {
									throw new Error("No change found for action type: " + actionTiming.type);
								} else {
									const newAction = new Action(actionTiming.type, source, target, new Date(), actionTiming.execTime, possibleThreads, change);

									const targetActions = this.actions.get(target);
									if (typeof targetActions === 'undefined') {
										this.actions.set(target, [newAction]);
									} else {
										targetActions.push(newAction);
									}

									scheduledThreads += possibleThreads;
								}
							}
						}
					}
				}

				return scheduledThreads;
			} else {
				throw new Error("No script found for action type: " + actionTiming.type);
			}
		}
	}

	/**
	 * @param {Server } server - server information
	 * @param {ChangeSet[]} changes - list of changes to apply
	 *
	 * @returns {Server} - server information with changes applied
	 */
	function applyChanges(server, changes) {
		for (const change of changes) {
			server.moneyAvailable += change.money;
			server.hackDifficulty += change.security;
		}

		return server;
	}

	// --- START MAIN ---

	const hostManager = new HostManager();

	while (true) {
		await hostManager.run(ns);
		await ns.sleep(100);
	}
}
