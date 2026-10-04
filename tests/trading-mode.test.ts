import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluatePermission, loadWorkMode, workModeDirectory, type WorkModeFiles } from "../src/core/work-mode.ts";
import { createLimitGate } from "../src/core/gate-limit.ts";
import { createEffectLedger, createInMemoryEffectStore, deriveEffectKey, toClientOrderId } from "../src/core/effect-ledger.ts";

const FRAMEWORK = "0.2.0";
// **The runtime own resolver, not a path written by hand**, so this test cannot drift from where the host looks.
const MODE_DIR = workModeDirectory(process.cwd(), "trading");
const MODE_IDENTITY = { id: "trading", version: "1.0.0", governanceVersion: "1.0.0" };

async function loadMode() {
	const files: WorkModeFiles = {
		mode: await readFile(join(MODE_DIR, "MODE.md"), "utf8"),
		governance: await readFile(join(MODE_DIR, "governance.yaml"), "utf8"),
		permissions: await readFile(join(MODE_DIR, "permissions.yaml"), "utf8"),
	};
	return loadWorkMode(files, { frameworkVersion: FRAMEWORK });
}

/**
 * A sandbox venue that implements the documented duplicate-rejection semantics. **No network call is
 * made and no live endpoint is contacted** - the point of the test is the mechanism, not connectivity.
 */
function createSandboxVenue() {
	const fills: { clientOrderId: string; notional: number }[] = [];
	const rejections: string[] = [];
	return {
		fills,
		rejections,
		async submit(order: { readonly clientOrderId: string; readonly notional: number }) {
			if (fills.some((fill) => fill.clientOrderId === order.clientOrderId)) {
				// Binance documents this as: "Duplicate order sent." | The clOrdId is already in use.
				rejections.push(order.clientOrderId);
				throw new Error("Duplicate order sent.");
			}
			fills.push({ clientOrderId: order.clientOrderId, notional: order.notional });
			return { filled: true, clientOrderId: order.clientOrderId };
		},
	};
}

describe("trading vertical (limit gate + venue-level idempotency)", () => {
	it("loads from disk, with production out of reach by permission rather than by a list it cannot enforce", async () => {
		const mode = await loadMode();
		assert.equal(mode.id, "trading");
		const governance = mode.governance as { scope: { environment: string; exclusions?: readonly string[] } };
		assert.equal(governance.scope.environment, "non-production");
		// **Inverted.** The mode declared `exclusions: [production-venue]`, and its gate carries no `target_argument` - so
		// the list could never refuse anything: nothing could tell the boundary which target a call acts on, and this
		// case asserted the raw value rather than an enforcement. The loader refuses a list it cannot enforce now. What
		// actually keeps production out of reach is the permission list below.
		assert.equal(governance.scope.exclusions, undefined, "no exclusions list, because this gate cannot enforce one");
		assert.equal(evaluatePermission(mode.permissions, "order.submit"), "ask");
		assert.equal(evaluatePermission(mode.permissions, "production.submit"), "deny");
		assert.equal(evaluatePermission(mode.permissions, "order.withdraw_funds"), "deny");
	});

	it("blocks an over-threshold order before it reaches the venue", async () => {
		// The thresholds come from the loaded mode, not from this test. That is the difference between a
		// pre-trade limit that a reviewer can read in governance.yaml and one that exists only where a test
		// happened to write it down: the loader validates and exposes `gate.limits` now, and a mode that
		// declares an undecidable limit fails to load rather than failing later in whichever gate is built.
		const mode = await loadMode();
		assert.deepEqual(mode.limits.map((limit) => limit.id), ["notional", "quantity"], "the mode declares both thresholds");
		const gate = createLimitGate(mode.limits);
		const venue = createSandboxVenue();
		const decision = gate.evaluate({ tool: "order.submit", arguments: { order: { notional: 250_000, quantity: 10 } }, mode: MODE_IDENTITY, at: "2026-09-25T12:00:00.000Z", elapsedMs: 0, accumulatedIntensity: {} });
		assert.equal(decision.outcome, "block");
		assert.match(decision.outcome === "block" ? decision.reason : "", /exceeds limit 'notional'/);
		assert.equal(venue.fills.length, 0, "a pre-trade block means the venue never sees the order");
	});

	it("leaves an action the limits do not name alone, instead of refusing it for want of an order field", async () => {
		// This is the regression the host test found. A limit declared without `tools` is evaluated against **every**
		// action, so trading mode refused `bash` and every other ordinary tool with "argument 'order.notional' is
		// absent from the bash call" - a threshold check that had turned into a total tool block. The declaration is
		// what scopes it, and this asserts the declaration is there.
		const mode = await loadMode();
		assert.deepEqual(
			mode.limits.map((limit) => limit.tools),
			[["order.submit"], ["order.submit"]],
			"both thresholds name the action that carries the value they check",
		);
		const gate = createLimitGate(mode.limits);
		const read = gate.evaluate({ tool: "market.read", arguments: {}, mode: MODE_IDENTITY, at: "2026-09-25T12:00:00.000Z", elapsedMs: 0, accumulatedIntensity: {} });
		assert.equal(read.outcome, "allow", JSON.stringify(read));
		const shell = gate.evaluate({ tool: "bash", arguments: { command: "ls" }, mode: MODE_IDENTITY, at: "2026-09-25T12:00:00.000Z", elapsedMs: 0, accumulatedIntensity: {} });
		assert.equal(shell.outcome, "allow", "a shell command is not an order, so an order threshold has nothing to say about it");
		// The order path still refuses what it always refused.
		const over = gate.evaluate({ tool: "order.submit", arguments: { order: { notional: 250_000, quantity: 10 } }, mode: MODE_IDENTITY, at: "2026-09-25T12:00:00.000Z", elapsedMs: 0, accumulatedIntensity: {} });
		assert.equal(over.outcome, "block");
	});

	it("blocks an order whose limit cannot be evaluated, rather than letting it through", async () => {
		const gate = createLimitGate((await loadMode()).limits);
		const decision = gate.evaluate({ tool: "order.submit", arguments: { order: { quantity: 10 } }, mode: MODE_IDENTITY, at: "2026-09-25T12:00:00.000Z", elapsedMs: 0, accumulatedIntensity: {} });
		assert.equal(decision.outcome, "block", "a limit gate that passes on a missing notional is worse than no gate");
	});

	it("maps the effect identity onto a venue-safe client order id, stably", () => {
		const key = deriveEffectKey({ engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", argumentsDigest: "abc", explicitKey: "BTCUSDT-buy-1" });
		const id = toClientOrderId(key, { prefix: "dove-" });
		assert.equal(id, toClientOrderId(key, { prefix: "dove-" }), "a retry must produce the same id");
		assert.ok(id.length <= 36, "Binance allows at most 36 characters");
		assert.match(id, /^[A-Za-z0-9_.:-]+$/, "the id must be venue-safe");
		assert.notEqual(id, toClientOrderId(deriveEffectKey({ engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", argumentsDigest: "xyz" }), { prefix: "dove-" }));
	});

	it("does not double-execute when a resume resubmits the same order", async () => {
		// **Driven through the ledger's own claim, which is what the product uses.** These two cases ran through the deleted
		// `dispatchOnce` wrapper; the wrapper's only caller was a test, while the boundary's `prepare`/`complete` make the
		// same decision on the real path. What the venue sees is unchanged: a submission happens only for the claim that was
		// granted, so a resume that loses the race sends nothing.
		const venue = createSandboxVenue();
		const ledger = createEffectLedger({ engagement: "paper-1", store: createInMemoryEffectStore() });
		const effectKey = deriveEffectKey({ engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", argumentsDigest: "abc", explicitKey: "BTCUSDT-buy-1" });
		const clientOrderId = toClientOrderId(effectKey, { prefix: "dove-" });
		const record = { effectKey, engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", decision: "allowed" as const };

		const first = await ledger.begin(record);
		if (first.claimed) await venue.submit({ clientOrderId, notional: 50_000 });
		await ledger.complete(effectKey, { outcome: "completed" });
		const resumed = await ledger.begin(record);
		if (resumed.claimed) await venue.submit({ clientOrderId, notional: 50_000 });
		assert.equal(first.claimed, true);
		assert.equal(resumed.claimed, false, "a completed effect is not resubmitted");
		assert.equal(venue.fills.length, 1);
	});

	it("lets the venue reject a duplicate that the framework's own ledger did not see", async () => {
		// A fresh ledger models a different process that lost its local state: the framework cannot
		// deduplicate here, so the client order id is what prevents the second fill.
		const venue = createSandboxVenue();
		const effectKey = deriveEffectKey({ engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", argumentsDigest: "abc", explicitKey: "BTCUSDT-buy-1" });
		const clientOrderId = toClientOrderId(effectKey, { prefix: "dove-" });
		await venue.submit({ clientOrderId, notional: 50_000 });
		await assert.rejects(() => venue.submit({ clientOrderId, notional: 50_000 }), /Duplicate order sent/);
		assert.equal(venue.fills.length, 1, "the venue is the last line of defence, which is why the id must be the framework's");
		assert.deepEqual(venue.rejections, [clientOrderId]);
	});

	it("does not auto-retry a submission whose outcome is ambiguous", async () => {
		// A failed attempt is recorded as failed, and the ledger grants no second claim: a timeout may have filled, so the
		// framework must not guess. Whether a retry is safe is the effect class's question, answered on the product path in
		// `effect-boundary.ts` and asserted in `tests/effect-boundary.test.ts`.
		const ledger = createEffectLedger({ engagement: "paper-1", store: createInMemoryEffectStore() });
		const effectKey = deriveEffectKey({ engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", argumentsDigest: "abc" });
		const record = { effectKey, engagement: "paper-1", mode: MODE_IDENTITY, tool: "order.submit", decision: "allowed" as const };
		let attempts = 0;
		const claim = await ledger.begin(record);
		if (claim.claimed) {
			attempts += 1;
			await ledger.complete(effectKey, { outcome: "failed" });
		}
		const retry = await ledger.begin(record);
		if (retry.claimed) attempts += 1;
		assert.equal(retry.claimed, false, "a timeout may have filled; the framework must not guess");
		assert.equal(attempts, 1, "no automatic resubmission");
	});

	it("states the requirement instead of an account of what the framework does not do yet", async () => {
		const mode = await loadMode();
		// **The same shape `modes/pentest/MODE.md` carried until 2026-10-05**, and it is why that one was wrong for nine days: a dated
		// sentence about our own progress, inside the document whose job is to say what this mode allows. It is true when written and
		// stops being true the moment the capability lands, with nothing red to say so. The requirement it wraps stays; the account of
		// what is not built belongs in the repository's own task records, where a reader can check it.
		assert.ok(!/Not yet (performed|produced) by the/.test(mode.body), "the mode body states a requirement, not a dated account of what is missing");
	});
});
