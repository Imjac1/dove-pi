import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDsmlContent } from "../src/pi-adapter/dsml-tool-calls.ts";

describe("DSML tool-call compatibility", () => {
	it("converts DeepSeek text calls while preserving thinking and typed parameters", () => {
		const dsml = [
				"<｜DSML｜tool_calls>",
				'<｜DSML｜invoke name="read">',
				'<｜DSML｜parameter name="path" string="true">.trellis/tasks/demo.md</｜DSML｜parameter>',
				"</｜DSML｜invoke>",
				'<｜DSML｜invoke name="find">',
				'<｜DSML｜parameter name="pattern" string="true">research/**</｜DSML｜parameter>',
				'<｜DSML｜parameter name="limit" string="false">60</｜DSML｜parameter>',
				"</｜DSML｜invoke>",
				"</｜DSML｜tool_calls>",
		].join("\n");
		const result = normalizeDsmlContent([{ type: "thinking", thinking: `先分析\n${dsml}`, thinkingSignature: "" }]);

		assert.equal(result.converted, true);
		assert.equal(result.content.length, 3);
		assert.equal(result.content[0]?.type, "thinking");
		assert.match(String((result.content[0] as { thinking: string }).thinking), /先分析/);
		assert.deepEqual(result.content[1], {
			type: "toolCall",
			id: (result.content[1] as { id: string }).id,
			name: "read",
			arguments: { path: ".trellis/tasks/demo.md" },
		});
		assert.equal((result.content[2] as { name: string }).name, "find");
		assert.equal((result.content[2] as { arguments: { limit: number } }).arguments.limit, 60);
	});

	it("leaves incomplete or unrelated text unchanged", () => {
		const incomplete = "<｜DSML｜tool_calls><｜DSML｜invoke name=\"read\">";
		const result = normalizeDsmlContent([{ type: "text", text: incomplete }, { type: "text", text: "ordinary" }]);
		assert.equal(result.converted, false);
		assert.deepEqual(result.content, [{ type: "text", text: incomplete }, { type: "text", text: "ordinary" }]);
	});
});
