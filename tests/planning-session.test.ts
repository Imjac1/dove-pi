import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPlanningSessionGuidance, PlanningSession } from "../src/core/planning-session.ts";

describe("PlanningSession", () => {
	it("moves from one direction question to one native task mutation", () => {
		const session = new PlanningSession();
		assert.equal(session.begin({ requestId: "r1", intent: "project-work" }).state, "collecting-direction");
		const result = session.observeQuestionResult({ answers: [{ answer: "缓存命中率优化" }] }, [{ type: "text", text: "User answered" }]);
		assert.equal(result.state, "awaiting-create");
		assert.equal(result.taskTitle, "缓存命中率优化");
		assert.match(result.directive ?? "", /agent_project_task/);
		assert.match(result.directive ?? "", /Do not ask for another confirmation/);
		assert.equal(session.questionDecision().allowed, false);
		assert.match(session.questionDecision().reason ?? "", /agent_project_task/);
		assert.match(formatPlanningSessionGuidance(session.snapshot()), /"state":"awaiting-create"/);
		assert.equal(session.begin({ requestId: "r1", intent: "project-work" }).state, "awaiting-create", "retries do not reset the planning handshake");
	});

	it("turns an affirmative direction answer into a ready create action", () => {
		const session = new PlanningSession();
		session.begin({ requestId: "r2", intent: "project-work" });
		const result = session.observeQuestionResult({ answers: [{ answer: "可以" }] }, undefined);
		assert.equal(result.affirmative, true);
		assert.equal(result.state, "awaiting-create");
		assert.equal(session.markTaskCreated({ taskId: "trellis:task-1", taskPath: "C:/project/task-1", taskTitle: "缓存优化" }).state, "task-created");
		assert.equal(session.enterPlanning().state, "planning");
	});

	it("asks for a title before a bare create request", () => {
		const session = new PlanningSession();
		assert.equal(session.begin({ requestId: "r3", intent: "project-work", workflowAction: "create-task" }).state, "collecting-name");
		assert.match(formatPlanningSessionGuidance(session.snapshot()), /collecting-name/);
		assert.equal(session.observeQuestionResult({ answers: [{ answer: "缓存诊断" }] }, undefined).state, "awaiting-create");
	});

	it("makes cancellation observable and allows recollection in the same request", () => {
		const session = new PlanningSession();
		session.begin({ requestId: "r4", intent: "project-work", taskScope: "优化真实使用流程" });
		session.observeQuestionResult({ answers: [{ answer: "缓存诊断" }, { answer: "范围：审计和创建流程" }] }, undefined);
		assert.equal(session.cancelCreate().state, "cancelled");
		assert.equal(session.questionDecision().allowed, true);
		const retry = session.observeQuestionResult({ answers: [{ answer: "新的任务标题" }, { answer: "新的范围" }] }, undefined);
		assert.equal(retry.state, "awaiting-create");
		assert.equal(retry.taskTitle, "新的任务标题");
		assert.equal(retry.taskScope, "新的范围");
	});

	it("gives explicit create precedence over an existing current task and resets new requests", () => {
		const session = new PlanningSession();
		assert.equal(session.begin({ requestId: "r5", intent: "project-work", workflowAction: "create-task", currentTaskId: "trellis:old" }).state, "collecting-name");
		session.observeQuestionResult({ answers: [{ answer: "新任务" }] }, undefined);
		assert.equal(session.begin({ requestId: "r5", intent: "project-work", currentTaskId: "trellis:old" }).state, "awaiting-create");
		assert.equal(session.begin({ requestId: "r6", intent: "project-work", currentTaskId: "trellis:old" }).state, "planning");
	});
});
