import type { ExecutionRecord } from "./contracts.ts";
import { readFailures, type ClientAccount, type FailureRecord } from "./failure-reading.ts";
import { classifyTerminal, gateRefusalCounts, TERMINAL_CLASSES, type TerminalClass } from "./harness-axes.ts";
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
 * reading, and the refusal labels are the axis refusal split - so a corpus summary cannot disagree with the instrument
 * it is summarising, and a reader never has to work out which of two numbers is the right one.
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
 * The absence note, stated with its cause.
 *
 * "No failure record" on its own reads as a healthy harness, and this corpus note is a statement about what was
 * **kept**. The measured cause: the paths that produce a failure are driven by host tests, whose state directories are
 * created with mkdtempSync and go away with the run, while the blackbox runner keeps its state under a scenario root.
 * So the ledgers that survive are the ones from runs that did not fail. A reading that says "zero" and stops is the
 * kind of statement this project keeps having to correct.
 */
const EMPTY_FAILURE_NOTE = "no failure record in the corpus: the paths that produce one are driven by host tests whose state directories are not preserved, while the blackbox runner keeps the ledgers of runs that did not fail";

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
		for (const [label, count] of Object.entries(gateRefusalCounts(ledger.records))) byLabel[label] = (byLabel[label] ?? 0) + count;
		const reading = readFailures(ledger.records, { ...(ledger.clientAccounts === undefined ? {} : { clientAccounts: ledger.clientAccounts }), ...(ledger.verifiedBy === undefined ? {} : { verifiedBy: ledger.verifiedBy }) });
		requests += reading.requests;
		unrefused += reading.unrefused;
		failures.push(...reading.failures);
	}
	const refusalTotal = Object.values(byLabel).reduce((sum, count) => sum + count, 0);
	const corpus: string[] = [];
	if (ledgers.length === 0) corpus.push("no ledger at all: nothing to read, which is a fact about the walk rather than about the harness");
	if (failures.length === 0 && ledgers.length > 0) corpus.push(EMPTY_FAILURE_NOTE);
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
