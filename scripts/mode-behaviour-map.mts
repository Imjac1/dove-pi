import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * **The behaviour-to-code map, as a report.**
 *
 *     node --import tsx scripts/mode-behaviour-map.mts
 *
 * One question: for each behaviour the mode format declares, is there a reader somewhere in `src/` outside the
 * parser that fills it? A declared control with no consumer is this project's founding defect class, and this is the
 * cheapest instrument for it.
 *
 * **Why this reports instead of asserting.** It was first written as a test (2026-09-27, D5(c)'s "detector half")
 * and then measured, and the measurement is the reason it moved here:
 *
 *   - It reported two orphans and **both were false**. `permissions.unlisted`'s consumer is
 *     `src/core/work-mode.ts:704` (`evaluatePermission`) and `authority.grant`'s is `:847` - both inside the one
 *     file the scan excludes, because that file both fills and consumes. Dropping the exclusion makes every row
 *     match trivially, so the file cannot simply be included either.
 *   - Three rows are **vacuous**: `sandbox`, `limits` and `capabilities` match unrelated code
 *     (`src/core/model-gateway.ts:166` for `limits`, `src/runtime.ts:15` for `capabilities`), so deleting the real
 *     consumer would leave them green.
 *
 * A gate that reports coverage it does not have is worse than no gate, so this prints and never asserts. Exit status
 * is always 0.
 *
 * **What it is not.** The field's answer to the same question is not a reader scan: AHE's component observability is
 * a *declared* file-level surface (`2604.25850`), with the evidence mined from trajectories and every change
 * carrying a prediction verified next round. See `decisions.md` Round 11 delta 1 in the harness-scaffold task.
 */

const PARSER = join("src", "core", "work-mode.ts");

function walk(dir: string, into: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === "node_modules" || entry.startsWith(".")) continue;
			walk(full, into);
		} else if (entry.endsWith(".ts")) into.push(full);
	}
	return into;
}

const sources = walk("src").filter((file) => !file.endsWith(PARSER));

/** Each declared field paired with the `WorkMode` member a consumer would read. */
const DECLARED: readonly { readonly label: string; readonly member: string }[] = [
	{ label: "permissions.unlisted", member: "permissions.unlisted" },
	{ label: "permissions.always_allow", member: "permissions.always_allow" },
	{ label: "permissions.ask_before", member: "permissions.ask_before" },
	{ label: "permissions.never_allow", member: "permissions.never_allow" },
	{ label: "gate.semantics", member: "gateSemantics" },
	{ label: "gate.target_argument", member: "targetArgument" },
	{ label: "gate.intensity", member: "intensityCeilings" },
	{ label: "gate.excluded_techniques", member: "excludedTechniques" },
	{ label: "authority.grant", member: "authorityGrant" },
	{ label: "authority.capabilities", member: "capabilities" },
	{ label: "sandbox.network", member: "sandbox" },
	{ label: "sandbox.filesystem", member: "sandbox" },
	{ label: "fence.paths", member: "fence" },
	{ label: "effects.classes", member: "effectClasses" },
	{ label: "gate.limits", member: "limits" },
];

/**
 * Rows measured as vacuous, with the file that makes them pass for the wrong reason. Kept here rather than fixed:
 * the honest fix is scope-aware resolution, which needs a parser rather than a grep.
 */
const VACUOUS: Readonly<Record<string, string>> = {
	"authority.capabilities": "matches src/runtime.ts:15 (CapabilityRegistry), not the mode's own list",
	"sandbox.network": "matches the refusal strings in src/core/action-policy.ts, not mode.sandbox",
	"sandbox.filesystem": "same row as sandbox.network - one member covers both axes",
	"gate.limits": "matches src/core/model-gateway.ts:166 (provider token limits), not mode.limits",
};

console.log("mode behaviour map - declared behaviour to reader, outside the parser that fills it\n");

let orphans = 0;
for (const { label, member } of DECLARED) {
	const files = sources.filter((source) => readFileSync(source, "utf8").includes(member));
	const verdict = files.length === 0 ? "NO READER" : `${files.length} file(s)`;
	if (files.length === 0) orphans++;
	const weak = VACUOUS[label] === undefined ? "" : "  [vacuous: " + VACUOUS[label] + "]";
	console.log(`  ${(label + " ").padEnd(30, ".")} ${(member + " ").padEnd(22, ".")} ${verdict}${weak}`);
}

console.log("");
console.log(
	orphans === 0
		? "No orphan found by this heuristic - which is not the same as no orphan: see the vacuous rows above."
		: `${orphans} declared behaviour(s) with no reader. Check by hand before believing it: \`permissions.unlisted\` and \`authority.grant\` are the two this scan reports as false orphans.`,
);
console.log("Known false orphans: permissions.unlisted (src/core/work-mode.ts:704), authority.grant (src/core/work-mode.ts:847).");
