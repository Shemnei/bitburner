/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 * @typedef { import('./typedef/bitburner.t').Server } Server
 */

import {HOME, IMPLANT_PATH_GROW, IMPLANT_PATH_WEAKEN, IMPLANT_PATH_HACK} from 'const.js';
import {retainSources, retainTargets} from 'libhost.js';
import {tryPwn} from 'libpwn.js';
import {discoverAll} from 'libscan.js';
import {buyOrUpgradeServer} from 'libserver.js';

/**
 * Amount of ram required on the home server to advance to this stage.
 *
 * @type {number}
 */
export const HOME_RAM_REQUIRED = 32;

/**
 * Additional amount of ram to keep reserved on the home server.
 * This is in addition to the ram already occupied by running scripts.
 *
 * @type {number}
 */
const HOME_RAM_RESERVED = 16;

/**
 * Additional amount of time (in milliseconds) to have as threshold when
 * calculating the time when a script will have finished.
 *
 * @type {number}
 */
const END_TIME_THREASHOLD_MS = 50;

/**
 * Amount of milliseconds to sleep between each execution of this scripts
 * main loop.
 *
 * @type {number}
 */
const SLEEP_MS = 500;

/**
 * Decides if new server should be purchased automatically.
 *
 * @type {boolean}
 */
const BUY_SERVERS = true;

/**
 * Amount of milliseconds to wait between each try to purchase a new server.
 *
 * @type {number}
 */
const BUY_SERVER_INTERVAL_MS = 5 * 60 * 1000; // 5 min

/**
 * Actives debug prints.
 *
 * @type {boolean}
 */
const DEBUG = false;

/**
 * Checks if the requirements for this stage are met.
 *
 * @param {NS} ns - Netscript API
 *
 * @returns {boolean} - Boolean indicating if the stages requirements are met
 */
export function hasRequirements(ns) {
	return ns.getServerMaxRam(HOME) >= HOME_RAM_REQUIRED
		// Level 100 allows for better hack targets.
		// If we switch before we would re-target after 100 before we get the hack
		// value on the old target.
		&& ns.getHackingLevel() >= 100;
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
function score(ns, host) {
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
 * Returns the grow multiplier for the given target, threads and cores.
 *
 * References:
 *	- https://github.com/danielyxie/bitburner/blob/master/src/Server/formulas/grow.ts
 * 	- https://github.com/danielyxie/bitburner/blob/master/src/Constants.ts#L155
 *
 * @param {NS} ns - Netscript API
 * @param {import('./typedef/bitburner.t').Server} targetInfo - host name of the target
 * @param {number} threadCount - number of threads
 * @param {number} cores - amount of cores on the source host
 *
 * @returns {number} - growth multiplier
 */
function growPercent(ns, targetInfo, threadCount, cores) {
	const SERVER_BASE_GROWTH_RATE = 1.03;
	const SERVER_MAX_GROWTH_RATE = 1.0035;
	// TODO: check way to get the multiplier (`ns.getBitNodeMultipliers()` but only with source file)
	const BITNODEMULTIPLIERS_SERVER_GROWTH_RATE = 1;

	const player = ns.getPlayer();

	const numServerGrowthCycles = Math.max(Math.floor(threadCount), 0);

	const growthRate = SERVER_BASE_GROWTH_RATE;
	const adjGrowthRate = Math.min(1 + (growthRate - 1) / targetInfo.hackDifficulty, SERVER_MAX_GROWTH_RATE);

	const serverGrowthPercentage = targetInfo.serverGrowth / 100;
	const numServerGrowthCyclesAdjusted = numServerGrowthCycles * serverGrowthPercentage * BITNODEMULTIPLIERS_SERVER_GROWTH_RATE;

	const coreBonus = 1 + (cores - 1) / 16;
	return Math.pow(adjGrowthRate, numServerGrowthCyclesAdjusted * player.hacking_grow_mult * coreBonus);
}

/**
 * Returns the amount of threads needed to decrease the security for the given cores.
 *
 * @param {NS} ns - Netscript API
 * @param {number} securityDecrease - decrease in security
 * @param {number} cores - amount of cores on the source host
 *
 * @returns {number} - amount of threads needed
 */
function weakenThreads(ns, securityDecrease, cores) {
	const decreaseSingle = ns.weakenAnalyze(1, cores);
	return securityDecrease / decreaseSingle;
}


/**
 * Calculates the free ram of a server.
 *
 * @param {import('./typedef/bitburner.t').Server} server - server information
 */
function calcFreeRam(server) {
	const reserved = server.hostname === HOME ? HOME_RAM_RESERVED : 0;
	return Math.max((server.maxRam - server.ramUsed) - reserved, 0);
}

/**
 * Sort function to sort sources depending on their free ram and amount of cores.
 * This will sort descending, meaning the "best" source is first.
 *
 * @param {import('./typedef/bitburner.t').Server} a
 * @param {import('./typedef/bitburner.t').Server} b
 *
 * @returns {number} comparison score
 */
function scoreSourceCoreDependant(a, b) {
	return (b.cpuCores * (b.maxRam - b.ramUsed)) - (a.cpuCores * (a.maxRam - a.ramUsed));
}

/**
 * Sort function to sort sources depending on their free ram.
 * This will sort descending, meaning the "best" source is first.
 *
 * @param {import('./typedef/bitburner.t').Server} a
 * @param {import('./typedef/bitburner.t').Server} b
 *
 * @returns {number} comparison score
 */
function scoreSourceRamDependant(a, b) {
	return (b.maxRam - b.ramUsed) - (a.maxRam - a.ramUsed);
}


/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	class Action {
		static HACK = 'hack';
		static GROW = 'grow';
		static WEAKEN = 'weaken';

		/**
		 * @param {string} kind - action kind (see static class variables)
		 * @param {string} source - Source host of the action
		 * @param {string} target - Target host of the action
		 * @param {number} threadCount - Number of threads executing the action
		 * @param {number} endTime - Unix timestamp in milliseconds when this action will be done (@see new Date().getTime())
		 */
		constructor(kind, source, target, threadCount, endTime) {
			this.kind = kind;
			this.source = source;
			this.target = target;
			this.threadCount = threadCount;
			this.endTime = endTime;
		}

		/**
		 * Tries to spawn the action. Will return `undefined` if it failed.
		 *
		 * Spawning Steps:
		 *	1) Copy over corresponding implant
		 *	2) Execute implant with `threadCount` threads
		 *
		 * @param {NS} ns - Netscript API
		 * @param {string} kind - action kind (see static class variables)
		 * @param {string} source - Source host of the action
		 * @param {string} target - Target host of the action
		 * @param {number} threadCount - Number of threads executing the action
		 *
		 * @returns {Promise<Action | undefined>} - the action if it was successfully spawned, `undefined` otherwise
		 */
		static async trySpawn(ns, kind, source, target, threadCount) {
			var implant = undefined;
			var execTime = undefined;

			switch (kind) {
				case Action.GROW:
					implant = IMPLANT_PATH_GROW;
					execTime = ns.getGrowTime(target);
					break;
				case Action.WEAKEN:
					implant = IMPLANT_PATH_WEAKEN;
					execTime = ns.getWeakenTime(target);
					break;
				case Action.HACK:
					implant = IMPLANT_PATH_HACK;
					execTime = ns.getHackTime(target);
					break;
				default:
					ns.print(`ERROR No implant found for action '${kind}'`);
					return undefined;
			};

			if (await ns.scp(implant, HOME, source)) {
				const now = new Date().getTime();

				// Used so that if the script get's restarted the running actions
				// can be scanned and imported.
				const endTime = now + execTime + END_TIME_THREASHOLD_MS;
				// Used so that each running implant is considered to be unique as
				// there can only be one "same" process running on a host
				const uniqueArg = now;

				if (ns.exec(implant, source, threadCount, target, 1, endTime, uniqueArg) > 0) {
					return new Action(kind, source, target, threadCount, endTime);
				} else {
					ns.print(`ERROR Failed to execute implant '${implant}' on target '${target}'`);
					return undefined;
				}
			} else {
				ns.print(`ERROR Failed to copy implant '${implant}' to target '${target}'`);
				return undefined;
			}
		}

		/**
		 * Tries to create an action from a running process of a host.
		 *
		 * @param {string} host - host running the process `ps`
		 * @param {import('./typedef/bitburner.t').ProcessInfo} ps - process information
		 *
		 * @returns {Action | undefined} - an action if the process is an running action, `undefined` otherwise
		 */
		static tryFromProcess(host, ps) {
			var kind = undefined;

			switch (ps.filename) {
				case IMPLANT_PATH_GROW:
					kind = Action.GROW;
					break;
				case IMPLANT_PATH_WEAKEN:
					kind = Action.WEAKEN;
					break;
				case IMPLANT_PATH_HACK:
					kind = Action.HACK;
					break;
				default:
					return undefined;
			}

			if (typeof kind === 'string') {
				var target = ps.args[0];
				if (typeof target === 'string') {
					var endTime = ps.args[2];
					if (typeof endTime === 'number') {
						return new Action(kind, host, target, ps.threads, endTime);
					}
				}
			}

			return undefined;
		}

		/**
		 * Applies the effects of the action to the server information.
		 *
		 * @param {NS} ns - Netscript API
		 * @param {import('./typedef/bitburner.t').Server} targetInfo - information about a server
		 *
		 * @returns {import('./typedef/bitburner.t').Server} - server information with the actions effects applied
		 */
		applyTo(ns, targetInfo) {
			if (targetInfo.hostname !== this.target) {
				ns.tprint(`ERROR Trying to apply action to invalid target`);
				return targetInfo;
			}

			const sourceInfo = ns.getServer(this.source);

			if (this.kind === Action.GROW) {
				// Security
				const securityChange = ns.growthAnalyzeSecurity(this.threadCount);

				// Money
				const moneyMultiplier = growPercent(ns, targetInfo, this.threadCount, sourceInfo.cpuCores);
				const moneyChange = (targetInfo.moneyAvailable * moneyMultiplier) - targetInfo.moneyAvailable;

				// Apply
				targetInfo.hackDifficulty += securityChange;
				targetInfo.moneyAvailable += moneyChange;
			} else if (this.kind === Action.WEAKEN) {
				// Security
				const securityChange = ns.weakenAnalyze(this.threadCount, sourceInfo.cpuCores);

				// Apply
				targetInfo.hackDifficulty -= securityChange;
			} else if (this.kind === Action.HACK) {
				// Security
				const securityChange = ns.hackAnalyzeSecurity(this.threadCount);

				// Money
				const moneyChangeSinglePercent = ns.hackAnalyze(this.target);
				const moneyChange = targetInfo.moneyAvailable * (moneyChangeSinglePercent * this.threadCount);

				// Apply
				targetInfo.hackDifficulty += securityChange;
				targetInfo.moneyAvailable -= moneyChange;
			} else {
				ns.print(`WARNING Invalid kind '${this.kind}' on action`);
			}

			// Clamp
			targetInfo.hackDifficulty = Math.max(targetInfo.hackDifficulty, targetInfo.minDifficulty);
			targetInfo.moneyAvailable = Math.min(targetInfo.moneyAvailable, targetInfo.moneyMax);

			return targetInfo;
		}

		/**
		 * Checks if the action is running.
		 *
		 * @returns {boolean} - indicating if the action is running
		 */
		isRunning() {
			return new Date().getTime() <= this.endTime;
		}

		/**
		 * Checks if the action is finished in `ms` milliseconds.
		 *
		 * @param {number} ms - milliseconds
		 *
		 * @returns {boolean} - indicating if the action is finished
		 */
		isFinishedIn(ms) {
			return (new Date().getTime() + ms) > this.endTime;
		}
	}

	class Actions {
		/**
		 * @type {Map<string, Action[]>}
		 */
		actions = new Map();

		/**
		 * Removes all actions which have finished.
		 */
		prune() {
			for (const [key, value] of this.actions) {
				this.actions.set(key, value.filter((action) => action.isRunning()));
			}
		}

		/**
		 * Applies the effects of all action on the host to the server information.
		 *
		 * @param {NS} ns - Netscript API
		 * @param {import('./typedef/bitburner.t').Server} targetInfo - information about a server
		 * @param {number} ms - only actions which will finish in `ms` milliseconds will be applied
		 *
		 * @returns {import('./typedef/bitburner.t').Server} - server information with the effects applied
		 */
		applyTo(ns, targetInfo, ms) {
			const targetActions = this.actions.get(targetInfo.hostname);

			if (typeof targetActions !== 'undefined' && targetActions.length > 0) {
				const applicableActions = targetActions
					.filter((action) => action.isFinishedIn(ms))
					.sort((a, b) => a.endTime - b.endTime);

				for (const action of applicableActions) {
					targetInfo = action.applyTo(ns, targetInfo);
				}
			} else {
				ns.print(`INFO No actions to apply for target '${targetInfo.hostname}'`);
			}

			return targetInfo;
		}

		/**
		 * Add an action.
		 *
		 * @param {Action} action - action to add
		 */
		add(action) {
			if (action.isRunning()) {
				var targetActions = this.actions.get(action.target);
				if (typeof targetActions === 'undefined') {
					targetActions = [];
				}
				targetActions.push(action);

				this.actions.set(action.target, targetActions);
			}
		}
	}


	class HostManager {
		actions = new Actions();
		loaded = false;

		/**
		 * @param {number} maxHackFrac - maximum fraction of money to hack [0.0 - 1.0]
		 * @param {number} minMoneyGrowFrac - minimum fraction of maxMoney a host needs before it should be hacked [0.0 - 1.0]
		 */
		constructor(maxHackFrac = 0.3, minMoneyGrowFrac = 1.0) {
			this.maxHackFrac = maxHackFrac;
			this.minMoneyGrowFrac = minMoneyGrowFrac;
		}

		/**
		 * Tries to load actions from all hosts.
		 * Should only be called once at the start.
		 *
		 * @param {NS} ns - Netscript API
		 */
		load(ns) {
			if (this.loaded) {
				return;
			}

			const hosts = retainSources(Array.from(discoverAll(ns)));
			const sources = Array.from(tryPwn(ns, hosts).keys());

			for (const host of sources) {
				for (const ps of ns.ps(host)) {
					const action = Action.tryFromProcess(host, ps);
					if (typeof action !== 'undefined') {
						if (DEBUG) {
							ns.tprint(`Adding action: ${JSON.stringify(action, undefined, 4)}`);
						}
						this.actions.add(action);
					}
				}
			}

			this.loaded = true;
		}

		/**
		 * Executes the manager once.
		 *
		 * @param {NS} ns - Netscript API
		 */
		async run(ns) {
			const hosts = retainSources(Array.from(discoverAll(ns)));

			const sources = Array.from(tryPwn(ns, hosts).keys());
			const targets = retainTargets(ns, sources)
				// sort in reverse order
				.sort((a, b) => score(ns, b) - score(ns, a));

			// TODO: for debugging
			//const targets = ['phantasy'];

			if (targets.length === 0) {
				ns.print('No targets');
				return;
			}


			for (const target of targets) {
				// The order in which they appear matters as it indicates the
				// priority of the action.
				const actionKinds = [
					{
						kind: Action.HACK,
						execTime: ns.getHackTime(target),
					},
					{
						kind: Action.WEAKEN,
						execTime: ns.getWeakenTime(target),
					},
					{
						kind: Action.GROW,
						execTime: ns.getGrowTime(target),
					},
				];

				for (const actionKind of actionKinds) {
					this.actions.prune();
					const targetInfo = this.actions.applyTo(ns, ns.getServer(target), actionKind.execTime);

					if (DEBUG) {
						ns.print(JSON.stringify(targetInfo, undefined, 4));
					}

					if (actionKind.kind === Action.GROW) {
						const money = targetInfo.moneyAvailable;
						const moneyMaxCalc = targetInfo.moneyMax * this.minMoneyGrowFrac;

						if (money < moneyMaxCalc) {
							const growthMultiplier = Math.max(moneyMaxCalc / Math.max(money, 1), 1);
							const [reached, _] = await this._tryScheduleGrow(ns, targetInfo, growthMultiplier, sources);

							if (!reached) {
								return;
							}
						}
					} else if (actionKind.kind === Action.WEAKEN) {
						const security = targetInfo.hackDifficulty;
						const securityMin = targetInfo.minDifficulty;

						if (security > securityMin) {
							const securityDecrease = security - securityMin;

							const [reached, _] = await this._tryScheduleWeaken(ns, target, securityDecrease, sources);

							if (!reached) {
								return;
							}
						}
					} else if (actionKind.kind === Action.HACK) {
						const money = targetInfo.moneyAvailable;
						const moneyMaxCalc = targetInfo.moneyMax * this.minMoneyGrowFrac;

						const security = targetInfo.hackDifficulty;
						const securityMin = targetInfo.minDifficulty + 1; // TODO: Better +3 Threshold

						if (money >= moneyMaxCalc && security <= securityMin) {
							const moneyToKeep = moneyMaxCalc - (moneyMaxCalc * this.maxHackFrac);
							const moneyToHack = money - moneyToKeep;

							const [reached, _] = await this._tryScheduleHack(ns, target, moneyToHack, sources);

							if (!reached) {
								return;
							}
						}
					} else {
						ns.print(`ERROR Invalid action '${actionKind.kind}'`);
					}
				}
			}
		}

		/**
		 * Tries to schedule grow actions to reach `growthMultiplier`.
		 *
		 * @param {NS} ns - Netscript API
		 * @param {import('./typedef/bitburner.t').Server} targetInfo - target of the attack
		 * @param {number} growthMultiplier - growth multiplier to reach
		 * @param {string[]} sources - list of source hosts for the attack
		 *
		 * @returns {Promise<[boolean, number]>} - boolean indicates if `growthMultiplier` will be reached, number of threads scheduled
		 */
		async _tryScheduleGrow(ns, targetInfo, growthMultiplier, sources) {
			const scriptRam = ns.getScriptRam(IMPLANT_PATH_GROW, HOME);
			if (scriptRam === 0) {
				throw new Error('Grow script implant does not exist on HOME');
			}

			const servers = sources
				.map((host) => ns.getServer(host))
				.sort(scoreSourceCoreDependant);

			var threadsScheduled = 0;
			var growthMultiplierReached = 1;

			for (const server of servers) {
				if (growthMultiplierReached >= growthMultiplier) {
					return [true, threadsScheduled];
				}

				//const growthMultiplierNeeded = 1 + (growthMultiplier - growthMultiplierReached);
				const growthMultiplierNeeded = growthMultiplier / growthMultiplierReached;
				if (!Number.isFinite(growthMultiplierNeeded)) {
					ns.tprint(`ERROR GROW: ${growthMultiplier} / ${growthMultiplierReached}`);
				}

				const threadsNeeded = Math.max(Math.ceil(ns.growthAnalyze(targetInfo.hostname, growthMultiplierNeeded, server.cpuCores)), 1);
				const serverRamFree = calcFreeRam(server);
				const threadsToSpawn = Math.min(Math.floor(serverRamFree / scriptRam), threadsNeeded);

				if (threadsToSpawn > 0) {
					if (DEBUG) {
						ns.tprint(`
GROW @ ${targetInfo.hostname}:
	Multi    : ${growthMultiplier}
	MultiR   : ${growthMultiplierReached}
	MultiN   : ${growthMultiplierNeeded}

	Scheduled: ${threadsScheduled}
	Needed   : ${threadsNeeded}
	ToSpawn  : ${threadsToSpawn} @ ${growPercent(ns, targetInfo, threadsToSpawn, server.cpuCores)}

	RAM free : ${serverRamFree}
`);
					}

					const action = await Action.trySpawn(ns, Action.GROW, server.hostname, targetInfo.hostname, threadsToSpawn);

					if (typeof action !== 'undefined') {
						threadsScheduled += threadsToSpawn;
						//growthMultiplierReached += Math.max((growPercent(ns, targetInfo, threadsToSpawn, server.cpuCores) - 1), 1);
						growthMultiplierReached *= growPercent(ns, targetInfo, threadsScheduled, server.cpuCores);

						this.actions.add(action);
					}
				}
			}

			return [false, threadsScheduled];
		}

		/**
		 * Tries to schedule weaken actions to decrease security by `securityDecrease`.
		 *
		 * @param {NS} ns - Netscript API
		 * @param {string} target - target of the attack
		 * @param {number} securityDecrease - decrease in security
		 * @param {string[]} sources - list of source hosts for the attack
		 *
		 * @returns {Promise<[boolean, number]>} - boolean indicates if `securityDecrease` will be reached, number of threads scheduled
		 */
		async _tryScheduleWeaken(ns, target, securityDecrease, sources) {
			const scriptRam = ns.getScriptRam(IMPLANT_PATH_WEAKEN, HOME);
			if (scriptRam === 0) {
				throw new Error('Weaken script implant does not exist on HOME');
			}

			const servers = sources
				.map((host) => ns.getServer(host))
				.sort(scoreSourceCoreDependant);

			var threadsScheduled = 0;
			var securityDecreaseReached = 0;

			for (const server of servers) {
				if (securityDecreaseReached >= securityDecrease) {
					return [true, threadsScheduled];
				}

				const securityDecreaseNeeded = securityDecrease - securityDecreaseReached;
				const threadsNeeded = Math.max(Math.ceil(weakenThreads(ns, securityDecreaseNeeded, server.cpuCores)), 1);

				const serverRamFree = calcFreeRam(server);
				const threadsToSpawn = Math.min(Math.floor(serverRamFree / scriptRam), threadsNeeded);

				if (threadsToSpawn > 0) {
					if (DEBUG) {
						ns.tprint(`
WEAKEN @ ${target}:
	Dec      : ${securityDecrease}
	DecReach : ${securityDecreaseReached}
	DecNeed  : ${securityDecreaseNeeded}

	Scheduled: ${threadsScheduled}
	Needed   : ${threadsNeeded}
	ToSpawn  : ${threadsToSpawn} @ ${ns.weakenAnalyze(threadsScheduled, server.cpuCores)}

	RAM free : ${serverRamFree}
`);
					}

					const action = await Action.trySpawn(ns, Action.WEAKEN, server.hostname, target, threadsToSpawn);

					if (typeof action !== 'undefined') {
						threadsScheduled += threadsToSpawn;
						securityDecreaseReached += ns.weakenAnalyze(threadsScheduled, server.cpuCores);

						this.actions.add(action);
					}
				}
			}

			return [false, threadsScheduled];
		}

		/**
		 * Tries to schedule hack actions to gain `money`.
		 *
		 * @param {NS} ns - Netscript API
		 * @param {string} target - target of the attack
		 * @param {number} money - absolute money to hack
		 * @param {string[]} sources - list of source hosts for the attack
		 *
		 * @returns {Promise<[boolean, number]>} - boolean indicates if `money` will be reached, number of threads scheduled
		 */
		async _tryScheduleHack(ns, target, money, sources) {
			const scriptRam = ns.getScriptRam(IMPLANT_PATH_HACK, HOME);
			if (scriptRam === 0) {
				throw new Error('Hack script implant does not exist on HOME');
			}

			const servers = sources
				.map((host) => ns.getServer(host))
				.sort(scoreSourceRamDependant);

			const threadsNeeded = Math.max(Math.ceil(ns.hackAnalyzeThreads(target, money)), 1);

			var threadsScheduled = 0;

			for (const server of servers) {
				if (threadsScheduled >= threadsNeeded) {
					return [true, threadsScheduled];
				}

				const serverRamFree = calcFreeRam(server);
				const threadsToSpawn = Math.min(Math.floor(serverRamFree / scriptRam), (threadsNeeded - threadsScheduled));

				if (threadsToSpawn > 0) {
					if (DEBUG) {
						ns.tprint(`
HACK @ ${target}:
	Money     : ${money}

	Scheduled : ${threadsScheduled}
	Needed    : ${threadsNeeded}
	ToSpawn   : ${threadsToSpawn}

	RAM free : ${serverRamFree}
`);
					}
					const action = await Action.trySpawn(ns, Action.HACK, server.hostname, target, threadsToSpawn);

					if (typeof action !== 'undefined') {
						threadsScheduled += threadsToSpawn;

						this.actions.add(action);
					}
				}
			}

			return [false, threadsScheduled];
		}
	}

	const manager = new HostManager();
	manager.load(ns);

	var sleepMs = 0;

	while (true) {
		await manager.run(ns);

		if (BUY_SERVERS && sleepMs >= BUY_SERVER_INTERVAL_MS) {
			ns.print('Trying to buy server');
			buyOrUpgradeServer(ns, 32);
			sleepMs = 0;
		}

		await ns.sleep(SLEEP_MS);

		if (BUY_SERVERS) {
			sleepMs += SLEEP_MS;
		}
	}
}
