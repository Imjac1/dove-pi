import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentMode, DispatchActual, DispatchDecision, ExecutionRecord } from "./contracts.ts";

export class ExecutionLedger {
	public constructor(private readonly filePath: string) {}

	public async append(record: ExecutionRecord): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
	}

	public async appendDispatchDecision(taskId: string, stepId: string, mode: AgentMode, dispatchId: string, decision: DispatchDecision): Promise<void> {
		await this.append({
			taskId,
			stepId,
			kind: "dispatch.decided",
			timestamp: new Date().toISOString(),
			mode,
			details: {
				dispatchId,
				route: decision.route,
				reason: decision.reason,
				estimate: decision.estimate,
			},
		});
	}

	public async appendDispatchCompletion(taskId: string, stepId: string, mode: AgentMode, actual: DispatchActual): Promise<void> {
		await this.append({
			taskId,
			stepId,
			kind: "dispatch.completed",
			timestamp: actual.completedAt,
			mode,
			details: { ...actual },
		});
	}

	public async appendProjectMutationStarted(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.started", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision } });
	}

	public async appendProjectMutationCompleted(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.completed", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision } });
	}

	public async appendProjectMutationFailed(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string, error: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.failed", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision, error } });
	}

	public async appendProjectMutationReconciled(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string, outcome: "unknown" | "observed"): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.reconciled", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision, outcome, incomplete: true } });
	}

	/** Read the append-only ledger for startup recovery and diagnostics. */
	public async read(): Promise<readonly ExecutionRecord[]> {
		try {
			const content = await readFile(this.filePath, "utf8");
			return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
				try {
					const record = JSON.parse(line) as ExecutionRecord;
					return record && typeof record === "object" ? [record] : [];
				} catch {
					return [];
				}
			});
		} catch (error) {
			if (isMissing(error)) return [];
			throw error;
		}
	}

	public async findIncompleteProjectMutations(): Promise<readonly ProjectMutationIntent[]> {
		const intents = new Map<string, ProjectMutationIntent>();
		for (const record of await this.read()) {
			if (!record.kind.startsWith("project.mutation.")) continue;
			const details = record.details as { mutationId?: unknown; operation?: unknown; provider?: unknown; revision?: unknown };
			if (typeof details.mutationId !== "string") continue;
			if (record.kind === "project.mutation.started") {
				intents.set(details.mutationId, { mutationId: details.mutationId, taskId: record.taskId, stepId: record.stepId, mode: record.mode, operation: String(details.operation ?? "unknown"), provider: String(details.provider ?? "unknown"), revision: String(details.revision ?? "unknown") });
			} else {
				intents.delete(details.mutationId);
			}
		}
		return [...intents.values()];
	}
}

export interface ProjectMutationIntent {
	readonly mutationId: string;
	readonly taskId: string;
	readonly stepId: string;
	readonly mode: AgentMode;
	readonly operation: string;
	readonly provider: string;
	readonly revision: string;
}

function isMissing(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
