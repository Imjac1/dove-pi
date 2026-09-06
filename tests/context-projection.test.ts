import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { modelMessageText, projectModelMessages } from "../src/pi-adapter/context-projection.ts";

describe("model context projection", () => {
	it("keeps ordinary custom diagnostics unchanged", () => {
		const message = { role: "custom", customType: "diagnostic", content: "one useful warning" } as const;
		assert.equal(projectModelMessages([message])[0], message);
	});

	it("bounds a large background notification and retains safe metadata", () => {
		const raw = `${"STOP ".repeat(120)}\nC:\\workspace\\tools\\sqlmap\\runner.py\n${"BLIND WRITE ".repeat(120_000)}`;
		const [projected] = projectModelMessages([{ role: "custom", customType: "background-task-notification", content: raw, details: { outputPath: "C:\\workspace\\.pi\\tasks\\job\\output.log" } }], 4_000);
		const text = modelMessageText(projected!);
		assert.ok(text.length <= 4_000);
		assert.match(text, /Dove context compacted/);
		assert.match(text, /warnings=/);
		assert.match(text, /errors=/);
		assert.match(text, /scope=dependency-or-vendor/);
		assert.match(text, /artifact=output\.log/);
		assert.equal(text.includes("BLIND WRITE ".repeat(1_000)), false);
		assert.equal((projected as { details?: { doveContextProjection?: { originalChars: number } } }).details?.doveContextProjection?.originalChars, raw.length);
	});

	it("does not compact twice", () => {
		const first = projectModelMessages([{ role: "custom", content: "x".repeat(40_000) }], 2_000);
		const second = projectModelMessages(first, 2_000);
		assert.equal(second[0], first[0]);
	});
});
