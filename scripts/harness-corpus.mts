import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseHarnessSurface } from "../src/core/harness-surface.ts";
import type { ExecutionRecord } from "../src/core/contracts.ts";
import { parseLedgerLines } from "../src/core/execution-ledger.ts";
import { summarizeCorpus, type CorpusLedger } from "../src/core/harness-corpus.ts";
import type { ClientAccount } from "../src/core/failure-reading.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";

/**
 * **What the recorded corpus contains, printed.**
 *
 *     node --import tsx scripts/harness-corpus.mts [root ...]
 *
 * Four rounds of this work asked this question by hand and answered it slightly differently each time, because the
 * answer depends on which ledgers you happen to find. This asks it once, over every ledger under the roots it walked,
 * and prints the counts the other instruments define - the axis terminal classes, the failure reading, the refusal
 * split - so the corpus summary cannot disagree with them.
 *
 * It prints and never asserts, exit 0 in every case including a root that does not exist: a corpus reading that dies on
 * a bad path is a reading nobody runs.
 */

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2).map((root) => resolve(root)) : [resolve(tmpdir()), resolveDoveStateDir(process.cwd())];

function walk(root: string, out: string[], depth: number): void {
	if (depth > 6 || !existsSync(root)) return;
	let entries;
	try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			walk(join(root, entry.name), out, depth + 1);
			continue;
		}
		if (entry.name === "execution.jsonl") out.push(join(root, entry.name));
	}
}

/** A ledger this script cannot parse counts as empty rather than stopping the walk. */
function readRecords(file: string): readonly ExecutionRecord[] {
	try {
		return parseLedgerLines(readFileSync(file, "utf8"));
	} catch { return []; }
}

const found = new Map<string, string[]>();
for (const root of roots) {
	const files: string[] = [];
	walk(root, files, 0);
	found.set(root, files);
}
/**
 * The client account of a run, when the runner layout puts one beside the ledger.
 *
 * The relation is the runner own: it writes the summary at `basename(outputPath) + ".summary.json"` and the ledger
 * under a sibling directory named `basename(outputPath) + "-" + case + "-" + nonce`. So the longest summary prefix that
 * the scenario directory starts with is the one for this run - and when nothing matches, the failure simply has no
 * client account, which the summary reports by omission rather than by a guess.
 */
function clientAccountsFor(ledgerPath: string): ReadonlyMap<string, ClientAccount> | undefined {
	const scenarioDir = dirname(dirname(ledgerPath));
	const base = dirname(scenarioDir);
	const scenarioName = ledgerPath.slice(base.length + 1).split(sep)[0] ?? "";
	let summary: Record<string, unknown> | undefined;
	try {
		const prefixes = readdirSync(base).filter((name) => name.endsWith(".summary.json")).map((name) => name.slice(0, -".summary.json".length)).filter((prefix) => scenarioName.startsWith(prefix + "-")).sort((a, b) => b.length - a.length);
		const chosen = prefixes[0];
		if (chosen === undefined) return undefined;
		summary = JSON.parse(readFileSync(join(base, chosen + ".summary.json"), "utf8")) as Record<string, unknown>;
	} catch { return undefined; }
	const ledgerCode = ((summary.ledgerTerminal as { terminal?: { code?: string } } | undefined)?.terminal)?.code;
	const clientCode = ((summary.rpcFailure as { terminal?: { code?: string } } | undefined)?.terminal)?.code;
	if (ledgerCode === undefined || clientCode === undefined) return undefined;
	const accounts = new Map<string, ClientAccount>();
	const records = readRecords(ledgerPath);
	const matching = records.filter((record) => record.kind === "request.terminal" && ((record.details?.terminal as { code?: string } | undefined)?.code) === ledgerCode);
	// Exactly one, or nothing: an account that could belong to more than one request is not evidence about either.
	if (matching.length !== 1) return undefined;
	const requestId = String((matching[0]?.details as { logicalRequestId?: string } | undefined)?.logicalRequestId ?? "");
	if (requestId === "") return undefined;
	accounts.set(requestId, { code: clientCode, source: "the black-box client classified the provider error text" });
	return accounts;
}

const ledgers: CorpusLedger[] = [...found.values()].flat().map((file) => {
	const clientAccounts = clientAccountsFor(file);
	return { path: file, records: readRecords(file), ...(clientAccounts === undefined ? {} : { clientAccounts }) };
});
// The declared behaviours to preserve, per component: the harness own statement of what verifies what.
let verifiedBy: ReturnType<typeof parseHarnessSurface>["verifiedBy"] | undefined;
const surfaceFile = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), ".trellis", "harness-surface.yaml");
if (existsSync(surfaceFile)) {
	try { verifiedBy = parseHarnessSurface(readFileSync(surfaceFile, "utf8")).verifiedBy; } catch { verifiedBy = undefined; }
}
const summary = summarizeCorpus(ledgers.map((ledger) => (verifiedBy === undefined ? ledger : { ...ledger, verifiedBy })));

console.log("Harness corpus");
console.log("");
console.log("  roots walked:");
for (const [root, files] of found) console.log("    " + root + "  (" + files.length + " ledger(s))");
console.log("");
if (summary.ledgers === 0) {
	console.log("  No execution ledger under any root. Nothing to summarise - which is a fact about the walk, not about the harness.");
	process.exit(0);
}
console.log("  ledgers ......................... " + summary.ledgers);
console.log("  records ......................... " + summary.records);
console.log("  requests ........................ " + summary.requests);
console.log("");
console.log("  terminals by class:");
for (const [name, count] of Object.entries(summary.terminalClasses)) console.log("    " + name.padEnd(14, ".") + " " + count);
console.log("");
console.log("  refusals by control label: " + (summary.refusals.total === 0 ? "(none recorded)" : ""));
for (const [label, count] of Object.entries(summary.refusals.byLabel).sort()) console.log("    " + label.padEnd(16, ".") + " " + count);
console.log("");
console.log("  failures: " + summary.failures.length);
for (const failure of summary.failures.slice(0, 20)) {
	console.log("    " + failure.requestId + "  " + failure.reason + " / " + failure.mechanism.code + "  -> " + failure.component);
	console.log("      because: " + failure.componentEvidence);
	if (failure.provider !== undefined) console.log("      provider: " + failure.provider.stopReason + (failure.provider.httpStatus === undefined ? "" : " (http " + failure.provider.httpStatus + ")"));
	if (failure.client !== undefined) console.log("      client:   " + failure.client.code + "  (" + failure.client.source + ")");
	console.log("      cite:     " + failure.evidenceRef);
	if (failure.preserve.length > 0) console.log("      preserve: " + failure.preserve.join(", "));
	if (failure.unseen !== undefined) console.log("      unseen:   " + failure.unseen);
}
if (summary.failures.length > 20) console.log("    ... and " + (summary.failures.length - 20) + " more");
console.log("");
console.log("  records by kind:");
for (const [kind, count] of Object.entries(summary.kinds).sort((a, b) => b[1] - a[1])) console.log("    " + kind.padEnd(30, ".") + " " + count);
console.log("");
console.log("What this corpus does not contain:");
if (summary.corpus.length === 0) console.log("  (nothing missing)");
for (const note of summary.corpus) console.log("  - " + note);
console.log("");
console.log("A reading, not a gate: nothing here asserts a threshold and no exit status depends on these numbers.");
