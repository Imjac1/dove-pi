import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { admit, isNonActionablePath, type AdmissionChannel, type ArtifactSink } from "../src/core/context-admission.ts";

/** A distinctive marker placed well past the head, so its presence or absence is unambiguous. */
const DEEP_MARKER = "UNIQUE-MARKER-DEEP-IN-THE-PAYLOAD-9f3a";

function largePayload(size: number): string {
	const filler = "diagnostic line about a downloaded third-party tool tree\n".repeat(Math.ceil(size / 55));
	return filler + DEEP_MARKER + filler;
}

function recordingSink(): ArtifactSink & { readonly writes: { source: string; channel: AdmissionChannel; content: string; digest: string }[] } {
	const writes: { source: string; channel: AdmissionChannel; content: string; digest: string }[] = [];
	return {
		writes,
		async write(input) {
			writes.push(input);
			return `artifact://${input.digest.slice(0, 12)}`;
		},
	};
}

describe("context admission", () => {
	it("compacts the recorded 2.8 MB background diagnostic and keeps the raw payload out of model-visible content", async () => {
		const sink = recordingSink();
		const payload = largePayload(2_865_326);
		const result = await admit({ channel: "background_notification", source: "pi-lens scan", content: payload }, { sink });

		assert.equal(result.originalCharacters, payload.length);
		// The bound is the contract: `maxCharacters` is what the admitted form fits inside, and the retained slice is
		// whatever is left of it after the marker. The old number here (3000) came from a *separate* retention
		// default, and keeping two knobs let the admitted form exceed the budget it claimed to respect.
		assert.ok(result.admittedCharacters <= 8000, `the compacted form must fit the budget, was ${result.admittedCharacters}`);
		assert.ok(result.admittedCharacters / payload.length < 0.01, "and it must be a small fraction of the original, not a truncation of it");
		assert.equal(result.omittedCharacters, payload.length);
		assert.match(result.admitted, /digest: sha256:[0-9a-f]{64}/, "the digest must be retained");
		assert.match(result.admitted, new RegExp(`omitted: ${payload.length} characters`), "the omitted size must be retained");
		assert.match(result.admitted, /channel: background_notification/);
		assert.match(result.admitted, /source: pi-lens scan/);
		assert.ok(result.artifactRef, "the full text must remain reachable by reference");
		assert.ok(!result.admitted.includes(DEEP_MARKER), "the raw payload must be absent, not merely truncated");
		assert.equal(sink.writes.length, 1, "the full payload goes to the artifact sink, not the transcript");
		assert.equal(sink.writes[0]?.content.length, payload.length);
	});

	it("applies to every channel, because the incident came through the one that was exempt", async () => {
		const channels: AdmissionChannel[] = ["tool_result", "extension_message", "background_notification"];
		for (const channel of channels) {
			const result = await admit({ channel, source: "s", content: largePayload(50_000) });
			assert.ok(!result.admitted.includes(DEEP_MARKER), `${channel} must be admitted through the same boundary`);
			assert.match(result.admitted, /compacted/);
		}
	});

	it("passes small actionable content through unchanged", async () => {
		const result = await admit({ channel: "tool_result", source: "read", content: "42 lines, no issues" });
		assert.equal(result.admitted, "42 lines, no issues");
		assert.equal(result.omittedCharacters, 0);
		assert.equal(result.nonActionable, false);
	});

	it("keeps the tail, because the tail is where a failure is reported", async () => {
		// A head-only boundary compacts away the stack trace, the exit status and the `FAIL` line. The host's own
		// compaction chose head-and-tail for that reason, and the policy must not be a regression against it.
		const payload = "x".repeat(20_000) + "\nTAIL-MARKER-failure-reported-here\n";
		const result = await admit({ channel: "tool_result", source: "bash", content: payload }, { maxCharacters: 2_000 });
		assert.match(result.admitted, /TAIL-MARKER-failure-reported-here/, "the end of the output survives");
		assert.equal(result.strategy, "head-tail");
		assert.ok(result.admitted.length <= 2_000, "and the whole admitted form still fits the budget");
		const headOnly = await admit({ channel: "tool_result", source: "bash", content: payload }, { maxCharacters: 2_000, strategy: "head" });
		assert.ok(!headOnly.admitted.includes("TAIL-MARKER"), "head-only is available where the tail carries nothing");
	});

	it("does not deliver generated or dependency content as actionable context, even when it is small", async () => {
		const result = await admit({ channel: "tool_result", source: "scan", content: "3 problems in a dependency", path: "project/node_modules/left-pad/index.js" });
		assert.equal(result.nonActionable, true);
		assert.match(result.admitted, /not delivered as actionable task context/);
		assert.equal(result.admittedCharacters < 2000, true);
	});

	it("classifies generated trees without over-reaching on authored paths", () => {
		for (const path of ["a/node_modules/b", "x/vendor/y", "p/.venv/lib", "q/site-packages/z", "r/dist/app.js", "s/target/debug/t"]) {
			assert.equal(isNonActionablePath(path), true, path);
		}
		for (const path of ["src/core/loop.ts", "docs/distribution.md", "tests/target.test.ts"]) {
			assert.equal(isNonActionablePath(path), false, path);
		}
	});

	it("still omits the payload when no artifact sink is configured", async () => {
		const result = await admit({ channel: "tool_result", source: "bash", content: largePayload(20_000) });
		assert.ok(!result.admitted.includes(DEEP_MARKER));
		assert.equal(result.artifactRef, undefined);
		assert.match(result.admitted, /digest: sha256:/);
	});
});
