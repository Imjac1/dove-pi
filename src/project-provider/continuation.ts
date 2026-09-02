import type { ProjectContextSnapshot, ProjectTask, ProjectTaskIdentity } from "./contracts.ts";

export interface ProjectContinuationTask extends ProjectTaskIdentity {
	readonly path: string;
	readonly title: string;
	readonly status: string;
	readonly priority?: string;
}

export type ProjectContinuation =
	| { readonly kind: "current"; readonly task: ProjectContinuationTask; readonly nextStep: string }
	| { readonly kind: "selected"; readonly task: ProjectContinuationTask; readonly nextStep: string }
	| { readonly kind: "single_candidate"; readonly task: ProjectContinuationTask; readonly nextStep: string }
	| { readonly kind: "ambiguous"; readonly candidates: readonly ProjectContinuationTask[] }
	| { readonly kind: "none" };

const CONTINUABLE_STATUSES = new Set(["active", "in_progress", "in-progress", "started", "working"]);

function continuationStep(task: ProjectTask): string {
	return `Continue ${task.stableId} from its public ProjectProvider task artifacts and current implementation plan.`;
}

function summarizeTask(task: ProjectTask): ProjectContinuationTask {
	return {
		stableId: task.stableId,
		provider: task.provider,
		providerTaskId: task.providerTaskId,
		path: task.path,
		title: task.title,
		status: task.status,
		...(task.priority ? { priority: task.priority } : {}),
	};
}

/**
 * ProjectProvider-neutral continuation state. This projection deliberately
 * treats task IDs and statuses as opaque provider data and never probes a
 * provider's private runtime/session directories.
 */
export function summarizeProjectContinuation(context: ProjectContextSnapshot, selector?: string): ProjectContinuation {
	if (selector?.trim()) {
		const normalized = selector.trim();
		const matches = context.tasks.filter((candidate) => candidate.stableId === normalized || candidate.path === normalized || candidate.providerTaskId === normalized || candidate.title === normalized || candidate.path.endsWith(normalized));
		if (matches.length === 1 && CONTINUABLE_STATUSES.has(matches[0].status.trim().toLowerCase())) {
			const task = matches[0] as ProjectTask;
			return { kind: "selected", task: summarizeTask(task), nextStep: continuationStep(task) };
		}
		if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map(summarizeTask) };
		return { kind: "none" };
	}
	if (context.currentTask) return { kind: "current", task: summarizeTask(context.currentTask), nextStep: continuationStep(context.currentTask) };
	const candidates = context.tasks
		.filter((task) => CONTINUABLE_STATUSES.has(task.status.trim().toLowerCase()))
		.sort((left, right) => left.stableId.localeCompare(right.stableId));
	if (candidates.length === 1) {
		const task = candidates[0] as ProjectTask;
		return { kind: "single_candidate", task: summarizeTask(task), nextStep: continuationStep(task) };
	}
	if (candidates.length > 1) return { kind: "ambiguous", candidates: candidates.map(summarizeTask) };
	return { kind: "none" };
}
