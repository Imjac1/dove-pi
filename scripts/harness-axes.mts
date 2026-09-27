import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionRecord } from "../src/core/contracts.ts";
import { parseLedgerLines } from "../src/core/execution-ledger.ts";
import { safetyAndStability, UNCOMPUTABLE_AXES } from "../src/core/harness-axes.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";

/**
 * **D6's first axis, as a reading.**
 *
 *     node --import tsx scripts/harness-axes.mts [execution.jsonl]
 *
 * Prints the field's Safety & Stability axis - crash-free ratio and sandbox violations - computed **only** from
 * records the harness wrote, plus the axes that cannot be computed and why. With no argument it looks in the resolved
 * Dove state directory.
 *
 * **It prints and never asserts.** A threshold is a decision about what a good rate is, and that decision belongs to
 * whoever makes it. The same disposition as `scripts/mode-behaviour-map.mts`, for the same reason: a reading that
 * cannot be mistaken for coverage. Exit status is 0 in every case, including "no ledger found".
 */

const requested = process.argv[2];
const ledgerPath = requested ?? join(resolveDoveStateDir(process.cwd()), "execution.jsonl");
if (!existsSync(ledgerPath)) {
	console.log("No execution ledger at " + ledgerPath + ".");
	console.log("Pass one explicitly: node --import tsx scripts/harness-axes.mts <execution.jsonl>");
	process.exit(0);
}

const records = parseLedgerLines(readFileSync(ledgerPath, "utf8"));
const reading = safetyAndStability(records);
const percent = (value: number | undefined): string => (value === undefined ? "no data" : (value * 100).toFixed(1) + "%");
const count = (label: string, value: number | string): void => console.log("  " + label.padEnd(48, ".") + " " + value);

console.log("Safety & Stability (SSM) - " + ledgerPath);
console.log("");
count("requests (request.terminal records)", reading.requests);
count("  clean (completed)", reading.terminals.clean);
count("  recovered (interrupted, then brought back)", reading.terminals.recovered);
count("  interrupted (cancelled or superseded)", reading.terminals.interrupted);
count("  failure", reading.terminals.failure);
if (reading.unclassifiedTerminals > 0) count("  unclassified (reason outside the nine)", reading.unclassifiedTerminals);
console.log("");
count("crash-free ratio (clean / clean + failure)", percent(reading.crashFreeRatio));
count("recovered rate (beside the ratio, never folded in)", percent(reading.recoveredRate));
console.log("");
console.log("  refusals by control label:");
const labels = Object.keys(reading.refusals.byLabel).sort();
if (labels.length === 0) console.log("    (none recorded)");
for (const label of labels) console.log("    " + label.padEnd(16, ".") + " " + reading.refusals.byLabel[label]);
count("isolation refusals (sandbox + fence)", reading.isolationRefusals + " (" + percent(reading.isolationRefusalsPerRequest) + " per request)");
console.log("");
console.log("Axes this harness cannot read:");
for (const entry of UNCOMPUTABLE_AXES) {
	console.log("  " + entry.axis + " - " + entry.metric);
	console.log("    why:        " + entry.reason);
	console.log("    evidence:   " + entry.evidence);
	console.log("    would need: " + entry.wouldNeed);
}
console.log("");
console.log("A reading, not a gate: nothing here asserts a threshold and no exit status depends on these numbers.");
