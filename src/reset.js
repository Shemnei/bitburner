/**
 * @typedef { import('./typedef/bitburner.t').NS } NS
 */

/**
 * Entry point for script.
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {
	const script = ns.args[0];
	const host = ns.getHostname();

	const ps = ns.ps(host);

	for (const p of ps) {
		ns.tprint("Killing all scripts");
		if (p.filename !== ns.getScriptName()) {
			ns.kill(p.filename, host, ...p.args);
		}
	}

	if (typeof script === "string") {
		ns.tprint("Lauching script " + script);
		ns.spawn(script);
	}
}
