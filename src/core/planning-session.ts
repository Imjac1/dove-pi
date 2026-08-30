import type { RequestIntent, WorkflowAction } from "./request-plan.ts";

export type PlanningSessionState = "collecting-direction" | "collecting-name" | "awaiting-create" | "task-created" | "planning";

export interface PlanningSessionSnapshot {
	readonly state: PlanningSessionState;
	readonly workflowAction?: WorkflowAction;
	readonly taskId?: string;
	readonly taskPath?: string;
	readonly taskTitle?: string;
	readonly questionCount: number;
}

export interface PlanningSessionQuestionResult {
	readonly state: PlanningSessionState;
	readonly affirmative: boolean;
	readonly taskTitle?: string;
	readonly directive?: string;
}

export function formatPlanningSessionGuidance(snapshot: PlanningSessionSnapshot): string {
	const card = JSON.stringify({ schemaVersion: 1, state: snapshot.state, workflowAction: snapshot.workflowAction, taskId: snapshot.taskId, taskPath: snapshot.taskPath, taskTitle: snapshot.taskTitle, questionCount: snapshot.questionCount });
	if (snapshot.state === "collecting-direction" || snapshot.state === "collecting-name") return `[PERSONAL AGENT WORKFLOW STATE]\n${card}\nAsk one structured question for task direction/title and scope. This collects data, not confirmation. Then call agent_project_task with operation=create; it owns the single native confirmation.`;
	if (snapshot.state === "awaiting-create") return `[PERSONAL AGENT WORKFLOW STATE]\n${card}\nCall agent_project_task with the workflowAction now, using the collected title/scope. Do not call ask_user_question again; the workflow tool owns the single native confirmation.`;
	if (snapshot.state === "task-created") return `[PERSONAL AGENT WORKFLOW STATE]\n${card}\nThe Trellis task was created. Continue into planning and report the task id/path and first planning step; do not create it again.`;
	if (snapshot.state === "planning") return `[PERSONAL AGENT WORKFLOW STATE]\n${card}\nContinue the existing task's planning flow. Use read-only planning tools for discovery; only an explicit implementation request can enter the execution tier.`;
	return `[PERSONAL AGENT WORKFLOW STATE]\n${card}`;
}

function text(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		return text(record.answer ?? record.answers ?? record.value ?? record.text ?? record.label);
	}
	return "";
}

function isAffirmative(value: string): boolean {
	return /^(?:yes|y|ok|okay|confirm|confirmed|approve|approved|create|continue|可以|确认|确定|同意|好|好的|是|执行|创建)$/i.test(value.trim());
}

function isNegative(value: string): boolean {
	return /^(?:no|n|cancel|取消|否|不要|暂不|拒绝)$/i.test(value.trim());
}

/**
 * Host-independent state for the one-request Trellis planning handshake.
 * Questions collect direction/name; only the workflow tool owns mutation
 * confirmation and execution.
 */
export class PlanningSession {
	private current: PlanningSessionSnapshot = { state: "planning", questionCount: 0 };
	private requestId?: string;

	public begin(input: { requestId: string; intent: RequestIntent; workflowAction?: WorkflowAction; currentTaskId?: string; currentTaskPath?: string }): PlanningSessionSnapshot {
		if (this.requestId === input.requestId) return this.snapshot();
		this.requestId = input.requestId;
		const action = input.workflowAction;
		const state: PlanningSessionState = action === "continue" || input.currentTaskId ? "planning" : action === "create-task" ? "collecting-name" : action ? "awaiting-create" : input.intent === "project-work" ? "collecting-direction" : "planning";
		this.current = {
			state,
			...(action ? { workflowAction: action } : {}),
			...(input.currentTaskId ? { taskId: input.currentTaskId } : {}),
			...(input.currentTaskPath ? { taskPath: input.currentTaskPath } : {}),
			questionCount: 0,
		};
		return this.snapshot();
	}

	public observeQuestionResult(details: unknown, observation: unknown): PlanningSessionQuestionResult {
		if (this.current.state !== "collecting-direction" && this.current.state !== "collecting-name") return { state: this.current.state, affirmative: false };
		const answers = text(details) || text(observation);
		const answerValues = Array.isArray(details) ? details.map(text).filter(Boolean) : [answers].filter(Boolean);
		const answer = answerValues.at(-1) ?? "";
		if (!answer || isNegative(answer)) {
			this.current = { ...this.current, questionCount: this.current.questionCount + 1 };
			return { state: this.current.state, affirmative: false };
		}
		const affirmative = isAffirmative(answer) || /(?:可以|确认|同意|请创建|go ahead|proceed|create it)/i.test(answer);
		const taskTitle = affirmative ? undefined : answer.slice(0, 160);
		this.current = {
			...this.current,
			state: "awaiting-create",
			questionCount: this.current.questionCount + 1,
			...(taskTitle ? { taskTitle } : {}),
		};
		return {
			state: this.current.state,
			affirmative,
			...(taskTitle ? { taskTitle } : {}),
			directive: "Planning input received. Call agent_project_task with operation=create and the collected task title/scope. Do not ask for another confirmation; that tool owns the single native confirmation.",
		};
	}

	public markTaskCreated(input: { taskId?: string; taskPath?: string; taskTitle?: string }): PlanningSessionSnapshot {
		this.current = {
			...this.current,
			state: "task-created",
			...(input.taskId ? { taskId: input.taskId } : {}),
			...(input.taskPath ? { taskPath: input.taskPath } : {}),
			...(input.taskTitle ? { taskTitle: input.taskTitle } : {}),
		};
		return this.snapshot();
	}

	public enterPlanning(): PlanningSessionSnapshot {
		this.current = { ...this.current, state: "planning" };
		return this.snapshot();
	}

	public snapshot(): PlanningSessionSnapshot {
		return Object.freeze({ ...this.current });
	}

	public reset(): void {
		this.requestId = undefined;
		this.current = { state: "planning", questionCount: 0 };
	}
}
