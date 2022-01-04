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
	['info', false],
	['replace', false],
	['forceReplace', false],
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
	--help                        Will print this help message
	--dryRun                      Won't buy a server but will print information about it
	--info                        Prints information about servers and exits without buying
	--replace                     If all server slots are filled it will try to replace the worst one
	--forceReplace                Same as '--replace' but will kill all script on the server to be replaced
	--minRam=MIN_RAM              Sets the lower bound on memory a new server needs. Anything below won't be purchased
	--maxMoneyFrac=[0.0 - 1.0]    Limits the amount of money to spend on a server [0.0 - 1.0] (playerMoney * max-money-frac)
	--namePrefix=NAME             Hostname prefix for the server

EXAMPLES:
	> run ${ns.getScriptName()} --dry-run --max-money-frac=0.6
`;

	ns.tprint(message);
}

/**
 * Checks the arguments.
 *
 * @typedef {{valid: boolean, dryRun: boolean, info: boolean, replace: boolean, forceReplace: boolean, minRam: number, maxMoneyFrac: number, namePrefix: string}} Args
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
		info: false,
		replace: false,
		forceReplace: false,
		minRam: 32,
		maxMoneyFrac: 1.0,
		namePrefix: 'server',
	};

	const dryRun = flags.dryRun;
	if (typeof dryRun === 'boolean') {
		vArgs.dryRun = dryRun;
	} else {
		ns.tprint("ERROR Argument `dryRun` not of type boolean");
		vArgs.valid = false;
	}

	const info = flags.info;
	if (typeof info === 'boolean') {
		vArgs.info = info;
	} else {
		ns.tprint("ERROR Argument `info` not of type boolean");
		vArgs.valid = false;
	}

	const replace = flags.replace;
	if (typeof replace === 'boolean') {
		vArgs.replace = replace;
	} else {
		ns.tprint("ERROR Argument `replace` not of type boolean");
		vArgs.valid = false;
	}

	const forceReplace = flags.forceReplace;
	if (typeof forceReplace === 'boolean') {
		vArgs.forceReplace = forceReplace;
	} else {
		ns.tprint("ERROR Argument `forceReplace` not of type boolean");
		vArgs.valid = false;
	}

	const minRam = flags.minRam;
	if (typeof minRam === 'number') {
		if (minRam < 1 || minRam > MAX_RAM) {
			ns.tprint(`ERROR Argument 'minRam' must in in bounds [1 - ${MAX_RAM}]`);
			vArgs.valid = false;
		} else {
			vArgs.minRam = minRam;
		}
	} else {
		ns.tprint("ERROR Argument `minRam` not of type number");
		vArgs.valid = false;
	}

	const maxMoneyFrac = flags.maxMoneyFrac;
	if (typeof maxMoneyFrac === 'number') {
		if (maxMoneyFrac < 0 || maxMoneyFrac > 1) {
			ns.tprint(`ERROR Argument 'maxMoneyFrac' must in in bounds [0.0 - 1.0]`);
			vArgs.valid = false;
		} else {
			vArgs.maxMoneyFrac = maxMoneyFrac;
		}
	} else {
		ns.tprint("ERROR Argument `maxMoneyFrac` not of type number");
		vArgs.valid = false;
	}

	const namePrefix = flags.namePrefix;
	if (typeof namePrefix === 'string') {
		if (namePrefix.length === 0) {
			ns.tprint(`ERROR Argument 'namePrefix' can not be empty`);
			vArgs.valid = false;
		} else {
			vArgs.namePrefix = namePrefix;
		}
	} else {
		ns.tprint("ERROR Argument `namePrefix` not of type string");
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

	if (args.info) {
		const servers = new Map();

		for (const host of ns.getPurchasedServers()) {
			const ram = ns.getServerMaxRam(host);
			const value = servers.get(ram);
			servers.set(ram, typeof value === 'undefined' ? 1 : value + 1);
		}

		var message = (`
Owned:
	Servers: ${ns.getPurchasedServers().length} / ${ns.getPurchasedServerLimit()}
`);

		for (const [ram, count] of servers) {
			if (count > 0) {
				message += `\t${ram}: ${count}\n`;
			}
		}

		message += '\nCosts:\n';

		for (var i = 0; i <= MAX_RAM_POW; ++i) {
			const ram = Math.pow(2, i);
			message += `\t${ram}: ${ns.nFormat(ns.getPurchasedServerCost(ram), "$0.000a")}\n`;
		}

		ns.tprint(message);
	} else {
		const moneyLimit = ns.getServerMoneyAvailable('home') * args.maxMoneyFrac;
		const minRamPow = Math.ceil(Math.log2(args.minRam));

		ns.tprint(`INFO Trying to buy server for ${ns.nFormat(moneyLimit, "$0.000a")} with at least ${args.minRam}GB ram`);

		const serverLimit = ns.getPurchasedServerLimit();
		const serverPurchased = ns.getPurchasedServers();
		var replaceName = undefined;

		if (serverPurchased.length >= serverLimit) {
			if (args.replace || args.forceReplace) {
				ns.tprint("INFO No free server slot. Trying to replace worst one");

				replaceName = serverPurchased.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))[0];
			} else {
				ns.tprint("ERROR No free server slot. Try running with `--replace` enabled");
				return;
			}
		}

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

					if (typeof replaceName !== 'undefined') {
						const replaceRam = ns.getServerMaxRam(replaceName);
						ns.tprint(`Trying to replace server '${replaceName}' with ${replaceRam}GB ram`);

						if (replaceRam < serverRam) {
							if (args.forceReplace) {
								ns.tprint('INFO Killing scripts on worst server');
								ns.killall(replaceName);
							}

							if (!ns.deleteServer(replaceName)) {
								ns.tprint(`Failed to delete worst server`);
								return;
							}
						} else {
							ns.tprint(`No better server could be bought (worst is better)`);
							return;
						}
					}

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

		ns.tprint("ERROR Failed find server for requirements");
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
