import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { representativeMutationTools as mutationTools, representativeTools } from "./fixtures/representative-tool-catalog.ts";

describe("Dove intent-owned tool tiers", () => {
	it("uses a representative 57-tool host catalog", () => {
		assert.equal(representativeTools.length, 57);
	});

	it("keeps Chat empty even when its words resemble an optional domain", () => {
		assert.deepEqual(selectDoveToolNames(representativeTools, "auto", "chat", "这是缓存测试，只回复完成；mcp browser"), []);
	});

	it("keeps Lookup bounded and read-only", () => {
		const selected = selectDoveToolNames(representativeTools, "auto", "lookup", "读取 package.json");
		assert.deepEqual(selected, ["read", "grep", "find", "ls", "agent_list_capabilities", "agent_doctor", "agent_project_status", "agent_project_context", "agent_workspace_verify"]);
		assert.equal(selected.some((name) => mutationTools.has(name)), false);
		assert.equal(selected.some((name) => name.startsWith("fusion_") || name.startsWith("bg_") || name === "mcp"), false);
	});

	it("keeps real Chinese read-only prompts free of provider-visible mutation tools", () => {
		for (const prompt of [
			"分析 src/invoice.js 和测试，说明失败根因并给出修复计划，但不要修改文件、不要运行命令。",
			"现在只读说明 src/invoice.js 修复后的计算公式，别修改或运行任何命令。",
		]) {
			const plan = createRequestPlan({ message: prompt, projectAvailable: true });
			const selected = selectDoveToolNames(representativeTools, "auto", plan.intent, prompt);
			assert.equal(plan.intent, "lookup");
			assert.equal(selected.some((name) => mutationTools.has(name)), false);
		}
		const summary = "用一句话总结我们刚才完成了什么。";
		assert.deepEqual(selectDoveToolNames(representativeTools, "auto", createRequestPlan({ message: summary }).intent, summary), []);
	});

	it("exposes no generic tools after Core selects deterministic continuation", () => {
		const plan = createRequestPlan({ message: "继续当前项目任务", projectAvailable: true });
		assert.equal(plan.projectAction, "continue");
		assert.deepEqual(selectDoveToolNames(representativeTools, "auto", plan, "继续当前项目任务"), []);
		assert.deepEqual(selectDoveToolNames(representativeTools, "core", plan, "继续当前项目任务"), []);
		assert.deepEqual(selectDoveToolNames(representativeTools, "full", plan, "继续当前项目任务"), []);
	});

	it("keeps Lookup web helpers read-only and browser automation behind Execution", () => {
		const selected = selectDoveToolNames(representativeTools, "auto", "lookup", "inspect this MCP website in the browser");
		for (const name of ["web_search", "source_check", "fetch_content", "get_search_content"]) assert.ok(selected.includes(name));
		assert.equal(selected.includes("agent_browser"), false);
		assert.equal(selected.includes("mcp"), false);
		assert.equal(selected.includes("mcpScript"), false);
		assert.equal(selected.some((name) => mutationTools.has(name)), false);
	});

	it("gives Project Work diagnostics and planning without mutation", () => {
		const selected = selectDoveToolNames(representativeTools, "auto", "project-work", "plan the TypeScript module architecture");
		for (const name of ["plan_mode_question", "lsp_diagnostics", "symbol_search", "module_report"]) assert.ok(selected.includes(name));
		assert.equal(selected.some((name) => mutationTools.has(name)), false);
	});

	it("reserves mutation and background helpers for Execution", () => {
		const selected = selectDoveToolNames(representativeTools, "auto", "execution", "修复网页问题并委派后台测试");
		for (const name of ["bash", "write", "replace", "insert", "agent_project_task", "agent_workspace_patch", "agent_browser", "bg_delegate"]) assert.ok(selected.includes(name));
		assert.equal(selected.includes("edit"), false, "hashline remains the edit authority when available");
		assert.equal(selected.includes("third_party_write"), false, "unknown installed tools are never absorbed by Auto");
	});

	it("permits generic MCP only for an explicit Execution request", () => {
		const selected = selectDoveToolNames(representativeTools, "auto", "execution", "execute this MCP operation");
		assert.ok(selected.includes("mcp"));
		assert.ok(selected.includes("mcpScript"));
	});

	it("keeps explicit Core read-only even when the current request is Execution", () => {
		const selected = selectDoveToolNames(representativeTools, "core", "execution", "修复问题");
		assert.equal(selected.some((name) => mutationTools.has(name)), false);
		assert.equal(selected.includes("replace"), false);
		assert.equal(selected.includes("insert"), false);
	});
});
