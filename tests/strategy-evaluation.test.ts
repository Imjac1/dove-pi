import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContextCompiler } from "../src/core/context-compiler.ts";

describe("strategy evaluation", () => {
	it("expands context only as the policy becomes more capable", () => {
		const compiler = new ContextCompiler();
		compiler.add({ id: "active-task", kind: "task", content: "current task", required: true });
		compiler.add({ id: "runtime-spec", kind: "spec", content: "runtime rules" });
		compiler.add({ id: "historical-memory", kind: "memory", content: "previous decision" });
		const fast = compiler.compile("", "fast");
		const standard = compiler.compile("", "standard");
		const ultra = compiler.compile("", "ultra");
		assert.deepEqual(fast.items.map((item) => item.id), ["active-task"]);
		assert.deepEqual(standard.items.map((item) => item.id), ["active-task"]);
		// An empty prompt must not turn Ultra into a full-project dump. Optional
		// documents are retrieved only when the user gives a meaningful query.
		assert.deepEqual(ultra.items.map((item) => item.id), ["active-task"]);
		console.log(JSON.stringify({ scenario: "context policy", fast: fast.items.length, standard: standard.items.length, ultra: ultra.items.length }));
	});

	it("compacts oversized documents and exposes a local token estimate", () => {
		const compiler = new ContextCompiler();
		compiler.add({ id: "runtime", kind: "spec", content: `${"runtime contract\n".repeat(2_000)}`, required: true });
		const context = compiler.compile("runtime", "fast");
		assert.ok(context.items[0]!.content.length < 6_100);
		assert.match(context.items[0]!.content, /context compacted from/);
		assert.equal(context.charCount, context.text.length);
		assert.ok(context.estimatedTokens > 0);
	});
});
