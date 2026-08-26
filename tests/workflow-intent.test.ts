import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestWorkflowSkill } from "../src/pi-adapter/workflow-intent.ts";

describe("workflow intent suggestions", () => {
	it("suggests implementation and checking workflows from natural language", () => {
		assert.equal(suggestWorkflowSkill("修复登录超时问题")?.skill, "trellis-before-dev");
		assert.equal(suggestWorkflowSkill("请验证一下测试")?.skill, "trellis-check");
	});

	it("does not duplicate explicit skill invocations", () => {
		assert.equal(suggestWorkflowSkill("/skill:trellis-brainstorm 设计一个功能"), undefined);
	});

	it("keeps ordinary conversation advisory-free", () => {
		assert.equal(suggestWorkflowSkill("今天天气怎么样"), undefined);
	});
});
