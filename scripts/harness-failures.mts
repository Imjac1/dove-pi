import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionRecord } from "../src/core/contracts.ts";
import { readFailures } from "../src/core/failure-reading.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";

/**
 * **The failure reading, printed.**
 *
 *     node --import tsx scripts/harness-failures.mts [execution.jsonl]
 *
 * What an unsuccessful request left behind: its class, the mechanism the class collapses, the refusals that
 * preceded it, the convergence state it ended in, what it cost, and a **stated** component attribution. The mining
 * half of the loop, in the smallest form this harness can support - it reads, clusters nothing, and proposes nothing.
 *
 * **It prints and never asserts**, like the axis and the behaviour map: a reading that could pass or fail would be a
 * gate, and a gate needs a threshold someone chose. Exit status is 0 in every case, including "no ledger found".
 *
 * **An empty reading is a finding.** When the corpus contains no failure, this prints how many requests it examined
 * and what the corpus does *not* contain, so "nothing failed" cannot be confused with "the reader is broken".
 */

const requested = process.argv[2];
const ledgerPath = requested ?? join(resolveDoveStateDir(process.cwd()), "execution.jsonl");
if (!existsSync(ledgerPath)) {
	console.log("No execution ledger at " + ledgerPath + ".");
	console.log("Pass one explicitly: node --import tsx scripts/harness-failures.mts <execution.jsonl>");
	process.exit(0);
}

const records = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ExecutionRecord);
const reading = readFailures(records);

console.log("Failures - " + ledgerPath);
console.log("");
console.log("  requests examined .......... " + reading.requests);
console.log("  failures ................... " + reading.failures.length);
console.log("  refusals with no request id  " + reading.unrefused);
console.log("");
if (reading.failures.length === 0) {
	console.log("  No request in this ledger ended in a failure class.");
}
for (const failure of reading.failures) {
	console.log("  " + failure.requestId + "  " + failure.reason + " / " + failure.mechanism.code + " (" + failure.mechanism.origin + (failure.mechanism.retryable ? ", retryable" : "") + ")");
	if (failure.mechanism.summary !== undefined) console.log("    summary:    " + failure.mechanism.summary);
	// The declared limit, printed where the mechanism is: a reader of the record needs to know the name is not the cause.
	if (failure.unseen !== undefined) console.log("    unseen:     " + failure.unseen);
	// The second place the mechanism lives: the provider own account of the same failure, printed beside Dove own.
	if (failure.provider !== undefined) console.log("    provider:   " + failure.provider.stopReason + (failure.provider.httpStatus === undefined ? "" : " (http " + failure.provider.httpStatus + ")") + (failure.provider.diagnostic === undefined ? "" : " - " + failure.provider.diagnostic));
	console.log("    refusals:   " + (failure.refusals.length === 0 ? "(none)" : failure.refusals.map((entry) => entry.gate + ": " + entry.reason).join(" | ")));
	if (failure.convergence !== undefined) console.log("    convergence: " + JSON.stringify(failure.convergence));
	if (failure.resources !== undefined) console.log("    cost:       " + JSON.stringify(failure.resources));
	console.log("    component:  " + failure.component);
	console.log("    because:    " + failure.componentEvidence);
	console.log("");
}
console.log("What this corpus does not contain:");
if (reading.corpus.length === 0) console.log("  (nothing missing)");
for (const note of reading.corpus) console.log("  - " + note);
console.log("");
console.log("A reading, not a gate: nothing here asserts a threshold and no exit status depends on these numbers.");
