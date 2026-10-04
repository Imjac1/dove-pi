import type { ExecutionRecord } from "./contracts.ts";
import { readFailures, type ClientAccount, type FailureRecord } from "./failure-reading.ts";
import { classifyTerminal, TERMINAL_CLASSES, type TerminalClass } from "./harness-axes.ts";
import { countGateRefusals } from "./harness-verifier.ts";
import type { RequestTerminalReason } from "./request-lifecycle.ts";
import type { ChangeSurface } from "./task-convergence.ts";

/**
 * **What the recorded corpus contains, as one summary.**
 *
 * Four rounds of this work asked that question by hand and answered it slightly differently each time, because the
 * answer depends on which ledgers you happen to find. This is the same question asked once, in a place that can be
 * re-run: every ledger the caller hands over is counted, and the counts come from the rules that already exist.
 *
 * **Nothing here is derived twice.** The terminal classes are the SSM axis classification, the failures are the failure
 * reading, and the refusal labels are the refusal split the verifier read path owns (`countGateRefusals`, which the axis
 * reads as well) - so a corpus summary cannot disagree with the instrument it is summarising, and a reader never has to
 * work out which of two numbers is the right one. **That sentence was false until 2026-10-05**: the axis carried a
 * byte-identical copy of the split, so there were two, and the only reason they agreed was that nobody had edited one.
 */

/**
 * A ledger, plus whatever account of a failure the caller could pair with it - keyed by request id, exactly as the
 * reading takes it. The caller pairs, because pairing two artifacts is a decision about them.
 */
export interface CorpusLedger {
	readonly path: string;
	readonly records: readonly ExecutionRecord[];
	readonly clientAccounts?: ReadonlyMap<string, ClientAccount>;
	/** The declared behaviours to preserve, per component - the same option the reading takes. */
	readonly verifiedBy?: Readonly<Partial<Record<ChangeSurface, readonly string[]>>>;
}

export interface CorpusSummary {
	readonly ledgers: number;
	readonly records: number;
	readonly kinds: Readonly<Record<string, number>>;
	readonly terminalClasses: Readonly<Record<TerminalClass, number>>;
	readonly requests: number;
	readonly refusals: { readonly total: number; readonly byLabel: Readonly<Record<string, number>> };
	readonly failures: readonly FailureRecord[];
	readonly unrefused: number;
	/** What this corpus does **not** contain, and - where it is known - why it does not. */
	readonly corpus: readonly string[];
}

/**
 * The absence notes, each scoped to what this function can see.
 *
 * **What replaced the constant that stood here.** It said "no failure record in the corpus: the paths that produce
 * one are driven by host tests whose state directories are not preserved" - a true statement about the host tests'
 * mkdtempSync directories, and a false one about sessions, whose state resolves through a stable path and whose
 * ledgers do survive. Thirteen real ledgers on this machine happen to contain three failures, so the sentence was
 * not only wrong but contradicted by what the tool it sits in reports. The part worth keeping is the contrast that
 * makes the true half true: the blackbox runner keeps its state under a scenario root, so its ledgers survive where
 * the host tests' do not. The part to state is the size of the input, as its two neighbouring notes already do.
 */

export function summarizeCorpus(ledgers: readonly CorpusLedger[]): CorpusSummary {
	const kinds: Record<string, number> = {};
	const terminalClasses: Record<TerminalClass, number> = { clean: 0, recovered: 0, interrupted: 0, failure: 0 };
	const byLabel: Record<string, number> = {};
	const failures: FailureRecord[] = [];
	let records = 0;
	let requests = 0;
	let unrefused = 0;
	for (const ledger of ledgers) {
		records += ledger.records.length;
		for (const record of ledger.records) {
			kinds[record.kind] = (kinds[record.kind] ?? 0) + 1;
			if (record.kind !== "request.terminal") continue;
			const reason = record.details?.reason;
			if (typeof reason === "string" && reason in TERMINAL_CLASSES) terminalClasses[classifyTerminal(reason as RequestTerminalReason)] += 1;
		}
		for (const [label, count] of Object.entries(countGateRefusals(ledger.records))) byLabel[label] = (byLabel[label] ?? 0) + count;
		const reading = readFailures(ledger.records, { ...(ledger.clientAccounts === undefined ? {} : { clientAccounts: ledger.clientAccounts }), ...(ledger.verifiedBy === undefined ? {} : { verifiedBy: ledger.verifiedBy }) });
		requests += reading.requests;
		unrefused += reading.unrefused;
		failures.push(...reading.failures);
	}
	const refusalTotal = Object.values(byLabel).reduce((sum, count) => sum + count, 0);
	const corpus: string[] = [];
	if (ledgers.length === 0) corpus.push("no ledger at all: nothing to read, which is a fact about the walk rather than about the harness");
	// Scoped like its two neighbours: it states what was handed over and how much of it, and it separates the cause it
	// can speak for from the one it cannot. The old wording said failures are not preserved, which is true of the host
	// tests' mkdtempSync directories and false of real sessions, whose state resolves through a stable path and whose
	// ledgers are still on disk. A sentence that says failure is unavailable stops a reader from looking.
	if (failures.length === 0 && ledgers.length > 0) {
		corpus.push(`no failure record in the ${ledgers.length} ledger(s) and ${requests} request(s) handed over: host tests drive failures into state directories that are not preserved, while the blackbox runner keeps its state under a scenario root and a real session's ledger lives under a stable path, so theirs do survive`);
	}
	if (unrefused > 0) corpus.push(unrefused + " refusal(s) carry no request id and are counted rather than attributed");
	return {
		ledgers: ledgers.length,
		records,
		kinds,
		terminalClasses,
		requests,
		refusals: { total: refusalTotal, byLabel },
		failures,
		unrefused,
		corpus,
	};
}
