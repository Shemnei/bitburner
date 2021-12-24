/**
 * This script will initialize Bitburner.
 *
 * # Requirements
 *  - <= 8 GB Ram
 *
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * @type {string}
 */
const HOME = "home";

/**
 * @type {string}
 */
const SERVER_ROOT = "http://localhost:8080/";

/**
 * @type {string[]}
 */
const FILES = [
	// libs
	"const.js",
	"libscan.js",
	"libpwn.js",
	"libhost.js",
	"libserver.js",
	// scripts
	"test.js",
	// implants
	"grow.js",
	"weaken.js",
	"hack.js",
];

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	for (const file of FILES) {
		const url = SERVER_ROOT + file;
		if (!await ns.wget(url, file, HOME)) {
			ns.tprintf("Failed to retrieve/save file `%s` from `%s`", file, url);
			return;
		}
	}

	// TODO: put into const
	ns.spawn("test.js");
}
