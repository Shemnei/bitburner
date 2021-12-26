/**
 * Inspired by <https://github.com/Hedrauta/bitburner-scripts/blob/master/analyze_server.js>.
 *
 * @typedef { import('../typedef/bitburner.t').NS } NS
 */

/**
 * Schema for the argument parser.
 *
 * @type {[string, string | number | boolean | string[]][]}
 */
const FLAG_SCHEMA = [
	['help', false],
];

/**
 * Will print the help message for this script.
 *
 * @param {NS} ns - Netscript API
 */
function printHelp(ns) {
	const message = `
This script prints detailed information about a host.

USAGE:
	run ${ns.getScriptName()} [OPTIONS] [HOST]

OPTIONS:
	--help              Will print this help message

HOST:
	The hostname of a server. If not provided the name of the server
	executing this script will be used.

EXAMPLES:
	> run ${ns.getScriptName()} n00dles
`;

	ns.tprint(message);
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
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const args = ns.flags([["help", false]]);

	if (args.help) {
		printHelp(ns);
		return;
	}

	const host = ns.args[0] ? ns.args[0] : ns.getHostname();

	if (typeof host === 'string') {
		const ramMax = ns.getServerMaxRam(host);
		const ramUsed = ns.getServerUsedRam(host);
		const money = ns.getServerMoneyAvailable(host);
		const maxMoney = ns.getServerMaxMoney(host);
		const minSec = ns.getServerMinSecurityLevel(host);
		const sec = ns.getServerSecurityLevel(host);
		ns.tprint(`
${host}:
    RAM        : ${ramUsed} / ${ramMax} (${ramUsed / ramMax * 100}%)
    money      : ${ns.nFormat(money, "$0.000a")} / ${ns.nFormat(maxMoney, "$0.000a")} (${(money / maxMoney * 100).toFixed(2)}%)
    security   : ${sec.toFixed(2)} / ${minSec.toFixed(2)}
    growth     : ${ns.getServerGrowth(host)}
    hack time  : ${ns.tFormat(ns.getHackTime(host))}
    grow time  : ${ns.tFormat(ns.getGrowTime(host))}
    weaken time: ${ns.tFormat(ns.getWeakenTime(host))}
    grow x2    : ${(ns.growthAnalyze(host, 2)).toFixed(2)} threads
    grow x3    : ${(ns.growthAnalyze(host, 3)).toFixed(2)} threads
    grow x4    : ${(ns.growthAnalyze(host, 4)).toFixed(2)} threads
    grow (full): ${(ns.growthAnalyze(host, (ns.getServerMaxMoney(host) / ns.getServerMoneyAvailable(host)))).toFixed(2)} threads
    hack 10%   : ${(.10 / ns.hackAnalyze(host)).toFixed(2)} threads
    hack 25%   : ${(.25 / ns.hackAnalyze(host)).toFixed(2)} threads
    hack 50%   : ${(.50 / ns.hackAnalyze(host)).toFixed(2)} threads
    hack (cur) : ${((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) / ns.hackAnalyze(host)).toFixed(2)} threads
    hackChance : ${(ns.hackAnalyzeChance(host) * 100).toFixed(2)}%
    score      : ${score(ns, host).toFixed(2)}
`);
	}
}

/**
 * Provides autocompletion for the script.
 *
 * @param {{servers: string[], txts: string[], script: string[], flags: object}} data - general data about the game you might want to autocomplete
 * @param {string[]} args - current arguments
 *
 * @returns {string[]} - list of values for autocompletion
 */
export function autocomplete(data, args) {
	return [...data.servers];
}
