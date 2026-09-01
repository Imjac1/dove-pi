import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CORE_TOOL_NAMES, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";

describe("Dove explicit tool compatibility profiles", () => {
	it("uses a representative 57-tool host catalog", () => {
		assert.equal(representativeTools.length, 57);
	});

	it("keeps every Pi tool visible in Auto regardless of request intent", () => {
		for (const [intent, prompt] of [
			["chat", "hi"],
			["lookup", "读取 package.json"],
			["project-work", "继续当前任务"],
			["execution", "修复网页并通过 MCP 委派后台测试"],
		] as const) {
			assert.deepEqual(
				selectDoveToolNames(representativeTools, "auto", intent, prompt),
				representativeTools,
				`Auto must not turn ${intent} into a tool permission tier`,
			);
		}
	});

	it("does not special-case task inventory, exact paths, Web, MCP, or background prompts", () => {
		for (const prompt of [
			"应该还存在没完成的任务你检查一下",
			"检查 src/invoice.js",
			"打开网页并截图",
			"execute this MCP operation",
			"委派后台测试",
		]) {
			assert.deepEqual(selectDoveToolNames(representativeTools, "auto", "lookup", prompt), representativeTools);
		}
	});

	it("preserves overlapping Pi edit tools instead of choosing an authority", () => {
		const tools = ["read", "edit", "grep", "replace", "insert", "undo_last_change"];
		assert.deepEqual(selectDoveToolNames(tools, "auto"), tools);
		assert.deepEqual(selectDoveToolNames(tools, "full"), tools);
	});

	it("keeps Core as an explicit compact compatibility profile", () => {
		const selected = selectDoveToolNames(representativeTools, "core", "execution", "修复问题");
		assert.deepEqual(selected, representativeTools.filter((name) => CORE_TOOL_NAMES.has(name)));
		assert.equal(selected.includes("bash"), false);
		assert.equal(selected.includes("third_party_write"), false);
	});

	it("deduplicates host tool names without reordering them", () => {
		assert.deepEqual(selectDoveToolNames(["read", "bash", "read", "write"], "auto"), ["read", "bash", "write"]);
	});
});
