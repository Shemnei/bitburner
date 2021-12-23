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
	"script/test.js",
];

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	for (const file of FILES) {
		const url = SERVER_ROOT + file;
		const filePath = "/" + file;
		if (!await ns.wget(url, filePath, HOME)) {
			ns.tprintf("Failed to retrieve/save file `%s` from `%s` at `%s`", file, url, filePath);
			return;
		}
	}

	// TODO: call next script
}
