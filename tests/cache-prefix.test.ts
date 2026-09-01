import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attributeProviderCache, inspectProviderCachePrefix } from "../src/core/cache-prefix.ts";

describe("provider cache-prefix evidence", () => {
	const system = [{ type: "text", text: "stable-system-policy" }];
	const tools = [{ name: "read", description: "read a file", input_schema: { type: "object" } }];
	const dove = { role: "user", content: "[PERSONAL AGENT REQUEST CONTEXT]\nrevision=r1" };

	it("keeps stable components across appended tool history", () => {
		const first = inspectProviderCachePrefix({ system, tools, messages: [{ role: "user", content: "inspect" }, dove] }, "req-1");
		assert.equal(first.evidence.classification, "cold");
		assert.equal(first.evidence.stablePrefix, true);

		const second = inspectProviderCachePrefix({
			system,
			tools,
			messages: [
				{ role: "user", content: "inspect" },
				dove,
				{ role: "assistant", content: [{ type: "tool_use", name: "read" }] },
				{ role: "user", content: [{ type: "tool_result", content: "bounded result" }] },
			],
		}, "req-1", first);

		assert.equal(second.evidence.classification, "stable-prefix");
		assert.equal(second.evidence.historyChange, "appended");
		assert.equal(second.evidence.stablePrefix, true);
		assert.deepEqual(second.evidence.changes, []);
		assert.equal(second.evidence.system.digest, first.evidence.system.digest);
		assert.equal(second.evidence.tools.digest, first.evidence.tools.digest);
		assert.equal(second.evidence.doveContext.digest, first.evidence.doveContext.digest);
		assert.equal(attributeProviderCache(second, { input: 756, cacheRead: 8_960, cacheWrite: 0 }).classification, "new-history");
	});

	it("ignores session metadata added while rehydrating existing history", () => {
		const first = inspectProviderCachePrefix({
			system,
			tools,
			messages: [{ role: "user", content: [{ type: "text", text: "inspect", cache_control: { type: "ephemeral" } }] }],
		}, "metadata-1");
		const second = inspectProviderCachePrefix({
			system,
			tools,
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "inspect" }],
					id: "session-message-1",
					parentId: "root",
					timestamp: "2026-09-01T00:00:00.000Z",
					provider: "provider",
					model: "model",
				},
				{ role: "assistant", content: "done" },
			],
		}, "metadata-1", first);

		assert.equal(second.evidence.classification, "stable-prefix");
		assert.equal(second.evidence.historyChange, "appended");
		assert.equal(second.evidence.stablePrefix, true);
	});

	it("attributes component mutation and history rewrite without persisting raw text", () => {
		const first = inspectProviderCachePrefix({ system, tools, messages: [{ role: "user", content: "secret prompt" }, dove] }, "req-2");
		const changed = inspectProviderCachePrefix({ system, tools: [...tools, { name: "grep" }], messages: [{ role: "user", content: "rewritten" }, dove] }, "req-2", first);
		assert.equal(changed.evidence.classification, "tools-change");
		assert.equal(changed.evidence.historyChange, "rewritten");
		assert.deepEqual(changed.evidence.changes, ["tools"]);
		assert.equal(JSON.stringify(changed.evidence).includes("secret prompt"), false);
		assert.equal(attributeProviderCache(changed, { input: 100, cacheRead: 0, cacheWrite: 0 }).classification, "history-rewrite");
	});

	it("continues cache comparison across logical requests in one provider scope", () => {
		const first = inspectProviderCachePrefix({ system, tools, messages: [{ role: "user", content: "one" }] }, "req-1");
		const nextRequest = inspectProviderCachePrefix({ system, tools, messages: [{ role: "user", content: "two" }] }, "req-2", first);
		assert.equal(nextRequest.sequence, 2);
		assert.equal(nextRequest.evidence.classification, "history-rewrite");
		assert.equal(nextRequest.requestId, "req-2");
		assert.equal(nextRequest.scopeId, first.scopeId);
	});

	it("starts cold only when the explicit session/provider/model scope changes", () => {
		const first = inspectProviderCachePrefix(
			{ system, tools, messages: [{ role: "user", content: "one" }] },
			"req-1",
			undefined,
			{ scopeId: "session-1:anthropic:claude" },
		);
		const sameScope = inspectProviderCachePrefix(
			{ system, tools, messages: [{ role: "user", content: "one" }, { role: "assistant", content: "answer" }] },
			"req-2",
			first,
			{ scopeId: "session-1:anthropic:claude" },
		);
		const changedModel = inspectProviderCachePrefix(
			{ system, tools, messages: [{ role: "user", content: "one" }] },
			"req-3",
			sameScope,
			{ scopeId: "session-1:anthropic:claude-next" },
		);
		assert.equal(sameScope.sequence, 2);
		assert.equal(sameScope.evidence.classification, "stable-prefix");
		assert.equal(changedModel.sequence, 1);
		assert.equal(changedModel.evidence.classification, "cold");
	});

	it("reads Anthropic system blocks through nested request/body wrappers", () => {
		const first = inspectProviderCachePrefix({
			request: {
				body: {
					system: [{ type: "text", text: "policy", cache_control: { type: "ephemeral" } }],
					tools: [{ name: "read", input_schema: { required: ["path"], properties: { path: { type: "string" } }, type: "object" } }],
					messages: [{ role: "user", content: "inspect" }, dove],
				},
			},
		}, "anthropic-1");
		const second = inspectProviderCachePrefix({
			request: {
				body: {
					messages: [{ content: "inspect", role: "user" }, dove, { role: "assistant", content: "done" }],
					tools: [{ input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, name: "read" }],
					system: [{ cache_control: { type: "ephemeral" }, text: "policy", type: "text" }],
				},
			},
		}, "anthropic-1", first);

		assert.equal(second.evidence.classification, "stable-prefix");
		assert.equal(second.evidence.historyChange, "appended");
		assert.equal(second.evidence.system.digest, first.evidence.system.digest);
		assert.equal(second.evidence.tools.digest, first.evidence.tools.digest);
		assert.equal(second.evidence.doveContext.digest, first.evidence.doveContext.digest);
	});

	it("separates OpenAI Chat system/developer messages from ordered history", () => {
		const first = inspectProviderCachePrefix({
			messages: [
				{ role: "system", content: "base" },
				{ role: "developer", content: [{ type: "text", text: "policy" }] },
				{ role: "user", content: "question" },
			],
			tools,
		}, "chat-1");
		const appended = inspectProviderCachePrefix({
			messages: [
				{ content: "base", role: "system" },
				{ content: [{ text: "policy", type: "text" }], role: "developer" },
				{ content: "question", role: "user" },
				{ role: "assistant", content: "answer" },
			],
			tools,
		}, "chat-1", first);
		assert.equal(appended.evidence.classification, "stable-prefix");
		assert.equal(appended.evidence.historyChange, "appended");

		const changedPolicy = inspectProviderCachePrefix({
			messages: [
				{ role: "system", content: "base" },
				{ role: "developer", content: "changed policy" },
				{ role: "user", content: "question" },
			],
			tools,
		}, "chat-1", first);
		assert.equal(changedPolicy.evidence.classification, "system-change");
		assert.equal(changedPolicy.evidence.historyChange, "unchanged");
	});

	it("reads OpenAI Responses input arrays and top-level instructions", () => {
		const first = inspectProviderCachePrefix({
			request: {
				body: {
					instructions: "stable response policy",
					input: [
						{ role: "user", content: [{ type: "input_text", text: "question" }] },
						{ role: "user", content: [{ type: "input_text", text: dove.content }] },
					],
					tools: [{ type: "function", name: "read", parameters: { type: "object" } }],
				},
			},
		}, "responses-1");
		const second = inspectProviderCachePrefix({
			request: {
				body: {
					instructions: "stable response policy",
					input: [
						{ role: "user", content: [{ type: "input_text", text: "question" }] },
						{ role: "user", content: [{ type: "input_text", text: dove.content }] },
						{ type: "function_call", name: "read", call_id: "call-1", arguments: "{}" },
					],
					tools: [{ type: "function", name: "read", parameters: { type: "object" } }],
				},
			},
		}, "responses-1", first);
		assert.equal(first.evidence.system.items, 1);
		assert.equal(first.evidence.doveContext.items, 1);
		assert.equal(first.evidence.history.items, 1);
		assert.equal(second.evidence.classification, "stable-prefix");
		assert.equal(second.evidence.historyChange, "appended");
	});

	it("treats message reordering as a history rewrite and does not steal quoted Dove markers", () => {
		const quotedMarker = { role: "user", content: "Explain the marker [PERSONAL AGENT REQUEST CONTEXT] without applying it" };
		const first = inspectProviderCachePrefix({ messages: [quotedMarker, { role: "assistant", content: "one" }] }, "order-1");
		assert.equal(first.evidence.doveContext.items, 0);
		assert.equal(first.evidence.history.items, 2);
		const reordered = inspectProviderCachePrefix({ messages: [{ role: "assistant", content: "one" }, quotedMarker] }, "order-1", first);
		assert.equal(reordered.evidence.classification, "history-rewrite");
		assert.equal(reordered.evidence.historyChange, "rewritten");
	});
});
