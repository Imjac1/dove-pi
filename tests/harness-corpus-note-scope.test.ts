import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeCorpus, type CorpusLedger } from "../src/core/harness-corpus.ts";

/**
 * The absence note has to be about what it can see.
 *
 * `summarizeCorpus` only ever sees the ledgers its caller hands over - its own documentation says so - so a note
 * saying "no failure record" is a statement about **those ledgers**. The note that ships says something stronger:
 * that the paths producing a failure are not preserved, so the corpus cannot contain one. That is a claim about
 * the world, and it is false for real sessions: thirteen real ledgers on this machine contain three failures, and
 * real sessions resolve their state through a stable path rather than the mkdtempSync one the note describes.
 *
 * A sentence that says failure is unavailable stops a reader from looking, which is the most expensive kind of
 * wrong statement this repository keeps finding in its own declarations. So the note must be a function of what
 * it was given. These cases assert that behaviourally rather than by matching wording: a note about three ledgers
 * and a note about seven cannot be the same string.
 */
function ledger(path: string, records: CorpusLedger["records"]): CorpusLedger {
	return { path, records };
}

const mode = { id: "code-development", version: "1.0.0", governanceVersion: "1.0.0" } as unknown as CorpusLedger["records"][number]["mode"];

function received(requestId: string, at: string): CorpusLedger["records"][number] {
	return { taskId: "t-1", stepId: `request:${requestId}`, kind: "request.received", timestamp: at, mode, details: {}, correlation: { requestId } };
}

function refused(requestId: string, at: string): CorpusLedger["records"][number] {
	return { taskId: "t-1", stepId: `request:${requestId}`, kind: "gate.refused", timestamp: at, mode, details: { reason: "sandbox" }, correlation: { requestId } };
}

test("a corpus with no failures says so about the ledgers it was given, not about the world", () => {
	const three: CorpusLedger[] = [
		ledger("a", [received("req_1", "2026-10-04T00:00:00.000Z")]),
		ledger("b", [received("req_2", "2026-10-04T00:01:00.000Z")]),
		ledger("c", [received("req_3", "2026-10-04T00:02:00.000Z")]),
	];
	const seven: CorpusLedger[] = [...three, ledger("d", [received("req_4", "2026-10-04T00:03:00.000Z")]), ledger("e", [received("req_5", "2026-10-04T00:04:00.000Z")]), ledger("f", [received("req_6", "2026-10-04T00:05:00.000Z")]), ledger("g", [received("req_7", "2026-10-04T00:06:00.000Z")])];

	const a = summarizeCorpus(three);
	const b = summarizeCorpus(seven);
	assert.equal(a.failures.length, 0, "these ledgers contain no failure, so a note is expected");
	assert.equal(b.failures.length, 0, "and neither do these");
	assert.equal(a.ledgers, 3, "the summary knows how many ledgers it was handed");
	assert.equal(b.ledgers, 7, "and here, seven");
	assert.notDeepEqual(
		a.corpus,
		b.corpus,
		"the absence note must depend on what was handed over: today it is a constant, so three ledgers and seven produce the same sentence about the world instead of a statement about each input",
	);
});

/**
 * A case that was here is gone, and the reason it was here is worth keeping.
 *
 * I wrote a second case asserting that a corpus containing a failure carries no absence note, and gave it a ledger
 * with a `gate.refused` record. It failed - and it was the case that was wrong, not the code: a refusal is not a
 * failure record, so the summary was right to note the absence of one. The red reading caught my premise before I
 * wrote any implementation against it, which is the fourth time in one session that a test I wrote taught me
 * something I had assumed. The surviving case above states the rule that actually holds and can be checked from
 * the input: the note must be a function of what the caller handed over.
 */
