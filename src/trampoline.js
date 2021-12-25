/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

import {hasRequirements as hasStage0Requirements} from 'stage0.js';
import {hasRequirements as hasStage1Requirements} from 'stage1.js';

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	if (hasStage1Requirements(ns)) {
		ns.tprint("Lauching stage 1");
		ns.spawn("reset.js", 1, "stage1.js");
	} else if (hasStage0Requirements(ns)) {
		ns.tprint("Lauching stage 0");
		ns.spawn("reset.js", 1, "stage0.js");
	} else {
		ns.tprint("No requirements for any stage met");
	}
}
