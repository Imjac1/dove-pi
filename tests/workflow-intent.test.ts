import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestWorkflowSkill } from "../src/pi-adapter/workflow-intent.ts";
import { isTaskInventoryRequest } from "../src/core/request-plan.ts";

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

	it("suppresses execution-oriented advice for explicit read-only constraints", () => {
		assert.equal(suggestWorkflowSkill("检查两个文件，只做查看和说明，不要修改文件、不要运行命令"), undefined);
		assert.equal(suggestWorkflowSkill("review this file read-only without modifying or running commands"), undefined);
	});

	it("does not turn task inventory into a Trellis quality-check workflow", () => {
		assert.equal(suggestWorkflowSkill("应该还存在没完成的任务你检查一下"), undefined);
		assert.equal(suggestWorkflowSkill("list remaining project tasks"), undefined);
		assert.equal(isTaskInventoryRequest("应该还存在没完成的任务你检查一下"), true);
		assert.equal(isTaskInventoryRequest("继续未完成任务并修复测试问题"), false);
		assert.equal(isTaskInventoryRequest("逐个检查未完成任务的代码和历史"), false);
		assert.equal(isTaskInventoryRequest("continue the unfinished task and fix its tests"), false);
	});
});
