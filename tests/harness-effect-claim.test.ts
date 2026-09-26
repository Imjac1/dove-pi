import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentLoop } from "../src/core/loop-runner.ts";
import { createScriptedProvider } from "../src/adapters/loop-scripted.ts";
import {
	createEffectLedger,
	deriveEffectKey,
	dispatchOnce,
	effectClassOf,
	isAutomaticallyRetryable,
	EffectKeyConflictError,
	EffectRetryRefusedError,
	type EffectRecord,
} from "../src/core/effect-ledger.ts";
import { createFileEffectStore, UnreadableClaimError } from "../src/core/effect-store-file.ts";

const MODE = { id: "code-audit", version: "1.0.0", governanceVersion: "1" };
const SECOND_PROCESS = join(process.cwd(), "tests", "fixtures", "harness", "claim-in-second-process.ts");

function freshDirectory(): string {
	return mkdtempSync(join(tmpdir(), "dove-effect-"));
}

function keyFor(digest = "d1", explicitKey?: string): string {
	return deriveEffectKey({ engagement: "eng-1", mode: MODE, tool: "write_report", argumentsDigest: digest, ...(explicitKey === undefined ? {} : { explicitKey }) });
}

const NOW = "2026-09-26T12:00:00.000Z";

/**
 * A complete record, `startedAt` included, because the store takes what it is given and does not invent a
 * timestamp - the ledger's `begin` is what fills that in for a real call.
 */
function recordFor(effectKey: string, overrides: Partial<Omit<EffectRecord, "startedAt">> = {}): EffectRecord {
	return {
		effectKey,
		engagement: "eng-1",
		mode: MODE,
		tool: "write_report",
		decision: "allowed",
		argumentsDigest: "d1",
		startedAt: NOW,
		...overrides,
	};
}

describe("the claim store: exclusive create, not read-then-write", () => {
	it("claims once, then refuses and returns the first record", async () => {
		const store = createFileEffectStore({ directory: join(freshDirectory(), "effects") });
		const key = keyFor();
		const first = await store.claim(recordFor(key));
		assert.equal(first.claimed, true);
		const second = await store.claim(recordFor(key));
		assert.equal(second.claimed, false, "the second claim must not be granted");
		assert.equal(second.existing?.effectKey, key, "and it must carry the first attempt's record");
		assert.equal(second.unreadable, undefined);
	});

	it("refuses a claim made by a second process, which is the failure this exists for", async () => {
		const directory = join(freshDirectory(), "effects");
		const store = createFileEffectStore({ directory });
		const key = keyFor();
		assert.equal((await store.claim(recordFor(key))).claimed, true);

		const stdout = execFileSync(process.execPath, ["--import", "tsx", SECOND_PROCESS, directory, key], {
			cwd: process.cwd(),
			encoding: "utf8",
		});
		const fromSecondProcess = JSON.parse(stdout) as { claimed: boolean; existing?: { effectKey?: string } };
		assert.equal(fromSecondProcess.claimed, false, "another process must not be able to claim a claimed effect");
		assert.equal(fromSecondProcess.existing?.effectKey, key, "and it must see the claim that already exists");
	});

	it("reports an unreadable claim rather than resolving it in either direction", async () => {
		const directory = join(freshDirectory(), "effects");
		const store = createFileEffectStore({ directory });
		const key = keyFor();
		// The window exclusive create leaves open: the claim file exists, the record never landed.
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, `${key}.json`), "");

		const claim = await store.claim(recordFor(key));
		assert.equal(claim.claimed, false);
		assert.equal(claim.unreadable, true, "reading it as unclaimed would re-run the effect; as completed would invent a result");
		await assert.rejects(() => store.get(key), UnreadableClaimError, "get must not report an unreadable claim as absent");
	});

	it("refuses an effect key that could name a file outside the store", async () => {
		const store = createFileEffectStore({ directory: join(freshDirectory(), "effects") });
		await assert.rejects(() => store.claim(recordFor("..\\escape")), /must not carry a path/);
	});
});

describe("the three states, and why two are not enough", () => {
	it("reads a claimed-but-uncompleted effect as unknown, not as absent and not as failed", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory: join(freshDirectory(), "effects") }) });
		const key = keyFor();
		assert.equal(await ledger.outcomeOf(key), undefined, "nothing claimed: undefined is the honest answer");
		await ledger.begin(recordFor(key));
		assert.equal(await ledger.outcomeOf(key), "unknown", "claimed with no outcome written is unknown");
		await ledger.complete(key, { outcome: "completed" });
		assert.equal(await ledger.outcomeOf(key), "completed");
	});

	it("does not dispatch an effect whose claim is unreadable, even with a retry opted in", async () => {
		const directory = join(freshDirectory(), "effects");
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory }) });
		const key = keyFor();
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, `${key}.json`), "");
		let executions = 0;
		const result = await dispatchOnce(ledger, recordFor(key), async () => { executions += 1; return "x"; }, { retryPriorAttempt: true, effectClass: "key-idempotent" });
		assert.equal(result.executed, false);
		assert.equal(result.unreadableClaim, true, "the ambiguity is surfaced, not resolved");
		assert.equal(executions, 0, "an unreadable claim is never a permission, not even for a retryable class");
	});
});

describe("effect class decides whether a retry is allowed", () => {
	it("defaults an undeclared tool to non-idempotent and says it was not declared", () => {
		const undeclared = effectClassOf("write_report");
		assert.equal(undeclared.effectClass, "non-idempotent", "an omitted tool must not silently acquire the right to retry");
		assert.equal(undeclared.declared, false, "a default presented as a declaration is the defect, so the caller can see which it got");
		const declared = effectClassOf("read_file", { read_file: "idempotent" });
		assert.equal(declared.effectClass, "idempotent");
		assert.equal(declared.declared, true);
	});

	it("only the two classes whose second run is harmless are automatically retryable", () => {
		assert.equal(isAutomaticallyRetryable("idempotent"), true);
		assert.equal(isAutomaticallyRetryable("key-idempotent"), true);
		assert.equal(isAutomaticallyRetryable("non-idempotent"), false);
	});

	it("refuses a retry that declares no class, rather than quietly not retrying", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory: join(freshDirectory(), "effects") }) });
		await ledger.begin(recordFor(keyFor()));
		await assert.rejects(
			() => dispatchOnce(ledger, recordFor(keyFor()), async () => "x", { retryPriorAttempt: true }),
			EffectRetryRefusedError,
		);
		await assert.rejects(
			() => dispatchOnce(ledger, recordFor(keyFor()), async () => "x", { retryPriorAttempt: true, effectClass: "non-idempotent" }),
			EffectRetryRefusedError,
		);
	});

	it("allows the retry an idempotent class justifies", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory: join(freshDirectory(), "effects") }) });
		await ledger.begin(recordFor(keyFor()));
		const result = await dispatchOnce(ledger, recordFor(keyFor()), async () => "recovered", { retryPriorAttempt: true, effectClass: "idempotent" });
		assert.equal(result.executed, true);
		assert.equal(result.value, "recovered");
	});
});

describe("one key may not carry two payloads", () => {
	it("refuses a second payload under a reused explicit key instead of replaying the first answer", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory: join(freshDirectory(), "effects") }) });
		const key = keyFor("d1", "client-order-42");
		await ledger.begin(recordFor(key, { argumentsDigest: "d1" }));
		await assert.rejects(
			() => ledger.begin(recordFor(key, { argumentsDigest: "d2" })),
			EffectKeyConflictError,
			"the same key with a different payload is a client error, not a replay",
		);
	});
});

describe("the dispatch line is where the claim lives", () => {
	const script = [
		{ kind: "tools" as const, calls: [{ name: "write_report", arguments: { path: "out.txt" } }] },
		{ kind: "tools" as const, calls: [{ name: "write_report", arguments: { path: "out.txt" } }] },
		{ kind: "text" as const, text: "done" },
	];

	it("runs a repeated tool call once, refuses the second, and reports the refusal", async () => {
		const directory = join(freshDirectory(), "effects");
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory }) });
		let executions = 0;
		const outcome = await createAgentLoop({
			provider: createScriptedProvider({ steps: script }),
			model: "test-model",
			mode: MODE,
			systemPrompt: "test",
			tools: [{ name: "write_report", description: "write a report" }],
			maxTurns: 5,
			executeTool: async () => { executions += 1; return { content: "wrote" }; },
			effects: { ledger, recordOf: (call) => (call.name === "write_report" ? recordFor(keyFor(), { tool: call.name }) : undefined) },
		}).run("go");

		assert.equal(executions, 1, "the effect reached the tool once, not twice");
		assert.equal(outcome.executedActions, 1);
		assert.equal(outcome.refusedEffects.length, 1, "the refusal is reported, not silently skipped");
		assert.match(outcome.refusedEffects[0]?.reason ?? "", /already claimed/);
		const refusal = outcome.messages.filter((m) => m.role === "toolResult").find((m) => m.role === "toolResult" && m.isError === true);
		assert.ok(refusal && refusal.role === "toolResult");
		assert.match(refusal.content, /do not re-run/, "the model is told to report the ambiguity rather than retry it");
		const effects = outcome.messages.filter((m) => m.role === "toolResult");
		assert.equal(effects.length, 2, "both calls are answered, so the transcript cannot show an unanswered tool call");
	});

	it("records unknown, not failed, when the run is aborted mid-effect", async () => {
		const directory = join(freshDirectory(), "effects");
		const ledger = createEffectLedger({ engagement: "eng-1", store: createFileEffectStore({ directory }) });
		const controller = new AbortController();
		const key = keyFor();
		const loop = createAgentLoop({
			provider: createScriptedProvider({ steps: [{ kind: "tools" as const, calls: [{ name: "write_report", arguments: { path: "out.txt" } }] }] }),
			model: "test-model",
			mode: MODE,
			systemPrompt: "test",
			tools: [{ name: "write_report", description: "write a report" }],
			maxTurns: 5,
			executeTool: async () => { controller.abort(); throw new Error("process interrupted mid-effect"); },
			effects: { ledger, recordOf: () => recordFor(key) },
		});

		await assert.rejects(() => loop.run("go", controller.signal));
		assert.equal(await ledger.outcomeOf(key), "unknown", "an abort says nothing about whether the effect landed, so failed would be an assertion the code cannot make");
	});
});
