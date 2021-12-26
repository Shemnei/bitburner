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
	['dryRun', false],
	['minRam', 32],
	['maxMoneyFrac', 1.0],
	['namePrefix', 'server'],
];

/**
 * Maximum power of 2 a server can have as ram.
 * @type {number}
 */
const MAX_RAM_POW = 20;

/**
 * Maximum amount a server can have as ram.
 * @type {number}
 */
const MAX_RAM = Math.pow(2, MAX_RAM_POW);

/**
 * Will print the help message for this script.
 *
 * @param {NS} ns - Netscript API
 */
function printHelp(ns) {
	const message = `
This script will try to buy a new server.

USAGE:
	run ${ns.getScriptName()} [OPTIONS]

OPTIONS:
	--help            Will print this help message
	--dryRun          Won't buy a server but will print information about it
	--minRam          Sets the lower bound on memory a new server needs. Anything below won't be purchased
	--maxMoneyFrac    Limits the amount of money to spend on a server [0.0 - 1.0] (playerMoney * max-money-frac)
	--namePrefix      Hostname prefix for the server

EXAMPLES:
	> run ${ns.getScriptName()} --dry-run --max-money-frac=0.6
`;

	ns.tprint(message);
}

/**
 * Checks the arguments.
 *
 * @typedef {{valid: boolean, dryRun: boolean, minRam: number, maxMoneyFrac: number, namePrefix: string}} Args
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
		dryRun: false,
		minRam: 32,
		maxMoneyFrac: 1.0,
		namePrefix: 'server',
	};

	const dryRun = flags.dryRun;
	if (typeof dryRun === 'boolean') {
		vArgs.dryRun = dryRun;
	} else {
		ns.tprint("Argument `dryRun` not of type boolean");
		vArgs.valid = false;
	}

	const minRam = flags.minRam;
	if (typeof minRam === 'number') {
		if (minRam < 1 || minRam > MAX_RAM) {
			ns.tprint(`Argument 'minRam' must in in bounds [1 - ${MAX_RAM}]`);
			vArgs.valid = false;
		} else {
			vArgs.minRam = minRam;
		}
	} else {
		ns.tprint("Argument `minRam` not of type number");
		vArgs.valid = false;
	}

	const maxMoneyFrac = flags.maxMoneyFrac;
	if (typeof maxMoneyFrac === 'number') {
		if (maxMoneyFrac < 0 || maxMoneyFrac > 1) {
			ns.tprint(`Argument 'maxMoneyFrac' must in in bounds [0.0 - 1.0]`);
			vArgs.valid = false;
		} else {
			vArgs.maxMoneyFrac = maxMoneyFrac;
		}
	} else {
		ns.tprint("Argument `maxMoneyFrac` not of type number");
		vArgs.valid = false;
	}

	const namePrefix = flags.namePrefix;
	if (typeof namePrefix === 'string') {
		if (namePrefix.length === 0) {
			ns.tprint(`Argument 'namePrefix' can not be empty`);
			vArgs.valid = false;
		} else {
			vArgs.namePrefix = namePrefix;
		}
	} else {
		ns.tprint("Argument `namePrefix` not of type string");
		vArgs.valid = false;
	}

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

	const moneyLimit = ns.getServerMoneyAvailable('home') * args.maxMoneyFrac;
	const minRamPow = Math.ceil(Math.log2(args.minRam));

	ns.tprint(`INFO Trying to buy server for ${ns.nFormat(moneyLimit, "$0.000a")} with at least ${args.minRam}GB ram`);

	const serverLimit = ns.getPurchasedServerLimit();
	const serverPurchased = ns.getPurchasedServers();

	if (serverPurchased.length >= serverLimit) {
		// TODO: replace flag with replace logic
		ns.tprint("ERROR No free server slot");
		return;
	} else {
		ns.tprint("INFO Trying to find server to purchase");

		for (var pow = MAX_RAM_POW; pow >= minRamPow; --pow) {
			const serverRam = Math.pow(2, pow);
			const serverCost = ns.getPurchasedServerCost(serverRam);

			if (serverCost <= moneyLimit) {
				if (args.dryRun) {
					ns.tprint(`INFO Would have bought server with ${serverRam}GB ram for ${ns.nFormat(serverCost, "$0.000a")}`);
					return;
				} else {
					ns.tprint(`INFO Trying to buy server with ${serverRam}GB ram for ${ns.nFormat(serverCost, "$0.000a")}`);

					const serverName = ns.purchaseServer(args.namePrefix, serverRam);
					if (serverName !== '') {
						ns.tprint(`INFO Bought server '${serverName}'`);
					} else {
						ns.tprint(`ERROR Failed to buy server`);
					}

					return;
				}
			}
		}
	}

	ns.tprint("Failed find server for requirements");
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
