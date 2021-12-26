/**
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
This is an example description.

USAGE:
	run ${ns.getScriptName()} [OPTIONS]

OPTIONS:
	--help              Will print this help message

EXAMPLES:
	> run ${ns.getScriptName()} --help
`;

	ns.tprint(message);
}

/**
 * Checks the arguments.
 *
 * @typedef {{valid: boolean}} Args
 *
 * @param {NS} ns - Netscript API
 * @param {any} flags - Parsed flags
 *
 * @returns {Args} - Validated arguments
 */
function checkFlags(ns, flags) {
	/**
	 * @type {Args}
	 */
	var vArgs = {
		valid: true,
	};

	return vArgs;
}

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const flags = ns.flags(FLAG_SCHEMA);

	if (flags.help) {
		printHelp(ns);
		return;
	}

	const args = checkFlags(ns, flags);
	if (!args.valid) {
		printHelp(ns);
		return;
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
	return [];
}
