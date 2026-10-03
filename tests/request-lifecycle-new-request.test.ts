import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestLifecycleController } from "../src/core/request-lifecycle.ts";

/**
 * A new prompt must be a new request, even when the previous one is still active.
 *
 * This is the twelve-session run's root cause, reduced to the two calls that produce it. The run opened
 * every session with the same question and seven of twelve could not answer it: the read-only project
 * tools, and in two sessions `bash` itself, came back refused as an effect that "already reached dispatch
 * in an earlier attempt of this request". The refusal is produced by the effect boundary, but only
 * because it was told `replayed: true`, and that flag is
 *
 *     const replayed = (requestLifecycle.activeLease()?.attemptCount ?? 0) > 0;
 *
 * so the question is what the lease looks like when a continued session submits its next prompt. It looks
 * like the previous one. `beginRequest` returns the active lease unchanged and reports `isNewRequest:
 * false` whenever the lease it already holds came from an input - and it never compares the prompt,
 * although the lease carries a `promptDigest` for exactly that purpose.
 *
 * **Why this is not a weakening.** A genuine retry does not come through here: it goes through
 * `startAttempt`, which increments the same counter. So the property the effect boundary depends on -
 * "a later attempt of the same request is refused when the class says a repeat is unsafe" - survives
 * unchanged, structurally rather than by agreement. The two cases below hold that down as well, so the
 * claim is checked rather than asserted.
 */
test("a different prompt while a lease is active is a new request, not a continuation of the old one", () => {
	const lifecycle = new RequestLifecycleController();

	const first = lifecycle.beginRequest({ prompt: "first prompt" });
	assert.equal(first.isNewRequest, true, "the first request should be new");
	assert.equal(first.attemptCount, 0, "a fresh lease starts at zero attempts");

	const second = lifecycle.beginRequest({ prompt: "a completely different second prompt" });
	assert.equal(
		second.isNewRequest,
		true,
		"a different prompt arriving while the previous lease is active is a new request: without this, the new turn inherits the previous attempt count and its effects are refused as replays",
	);
	assert.equal(second.attemptCount, 0, "and the new request starts with no attempts behind it");
});

test("a retry of the same request still counts as an attempt, which is what the guard exists for", () => {
	const lifecycle = new RequestLifecycleController();
	lifecycle.beginRequest({ prompt: "one prompt" });
	const attempt = lifecycle.startAttempt("provider-retry");
	assert.equal(attempt.number, 1, "the first attempt of a request is attempt one");
	const again = lifecycle.startAttempt("provider-retry");
	assert.equal(again.number, 2, "a second attempt of the same request is a later attempt, and the boundary refuses a non-idempotent effect on one");
});

/**
 * The rule the effect boundary reads, held to the boundary's own definition.
 *
 * `replayed` decides whether a non-idempotent undeclared effect is refused, and the boundary documents what it
 * means: "a dispatch on our own resumption path, where **an attempt after the first** re-issues work an earlier
 * attempt may already have performed". So the **first** attempt of a request is not a replay - and in a real
 * session the first attempt happens before every tool call, because the provider call comes first. Reading
 * `attemptCount > 0` as a replay therefore refused the first claim of every undeclared non-idempotent effect in
 * every turn, which is what seven of twelve sessions recorded.
 */
test("the first attempt of a request is not a replay; the second one is", () => {
	const lifecycle = new RequestLifecycleController();
	lifecycle.beginRequest({ prompt: "one prompt" });
	assert.equal(lifecycle.isReplay(), false, "no attempt has run yet, so nothing has been re-issued");

	lifecycle.startAttempt("initial");
	assert.equal(
		lifecycle.isReplay(),
		false,
		"the first attempt of a request is not a replay: the boundary dispatches on it by its own definition, and a tool call in a real turn always comes after that first attempt",
	);

	lifecycle.startAttempt("provider-retry");
	assert.equal(
		lifecycle.isReplay(),
		true,
		"an attempt after the first is the replay the boundary refuses a non-idempotent undeclared effect on",
	);
});

test("the lease a new request returns is the one the boundary will read", () => {
	const lifecycle = new RequestLifecycleController();
	lifecycle.beginRequest({ prompt: "first" });
	lifecycle.beginRequest({ prompt: "second" });
	const active = lifecycle.activeLease();
	assert.ok(active !== undefined, "a request must be active after beginning one");
	assert.equal(active.attemptCount, 0, "the active lease must be the new request's, with no attempts behind it");
});
