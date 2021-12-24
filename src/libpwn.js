import {HOME} from 'const.js';

/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Tries to pwn each host by first opening all available ports and then
 * `nuke`ing them.
 *
 * @param {NS} ns - Netscript API
 * @param {string[]} hosts - Hosts to pwn.
 *
 * @returns {Map<string, boolean>} - List of all servers with root access with the boolean value indicating if the host was pwned during this function call.
 */
export function tryPwn(ns, hosts) {
	const numPortScripts = portOpenScripts(ns);
	const pwned = new Map();

	for (const host of hosts) {
		if (ns.hasRootAccess(host)) {
			pwned.set(host, false);
		} else if (numPortScripts >= ns.getServerNumPortsRequired(host)) {
			// No root access; Try to pwn

			if (ns.fileExists("BruteSSH.exe", HOME)) {
				ns.brutessh(host);
			}
			if (ns.fileExists("FTPCrack.exe", HOME)) {
				ns.ftpcrack(host);
			}
			if (ns.fileExists("RelaySMTP.exe", HOME)) {
				ns.relaysmtp(host);
			}
			if (ns.fileExists("HTTPWorm.exe", HOME)) {
				ns.httpworm(host);
			}
			if (ns.fileExists("SQLInject.exe", HOME)) {
				ns.sqlinject(host);
			}

			ns.nuke(host);

			pwned.set(host, true);
		}
	}

	return pwned;
}

/**
 * Returns the number of scripts which can open ports on hosts.
 *
 * @param {NS} ns - Netscript API
 *
 * @returns {number} - Number of scripts to open ports
 */
function portOpenScripts(ns) {
	var scripts = 0;

	if (ns.fileExists("BruteSSH.exe", HOME)) {
		scripts += 1;
	}
	if (ns.fileExists("FTPCrack.exe", HOME)) {
		scripts += 1;
	}
	if (ns.fileExists("RelaySMTP.exe", HOME)) {
		scripts += 1;
	}
	if (ns.fileExists("HTTPWorm.exe", HOME)) {
		scripts += 1;
	}
	if (ns.fileExists("SQLInject.exe", HOME)) {
		scripts += 1;
	}

	return scripts;
}
