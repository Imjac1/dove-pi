import type { CapabilityRegistry } from "./capability-registry.ts";
import type { CapabilityResult, AgentMode } from "./contracts.ts";
import { ExecutionLedger } from "./execution-ledger.ts";
import { createCapabilityExecution, transitionCapabilityExecution, type CapabilityExecutionSnapshot } from "./capability-runtime.ts";

export interface CapabilityAuthorization {
	/** Require an explicit decision for capabilities with side effects. */
	readonly required?: boolean;
	/** Persist an explicit approval-pending transition (host integrations opt in). */
	readonly recordPending?: boolean;
	readonly authorize?: (input: { name: string; version: string; sideEffects: readonly string[]; args: Record<string, unknown> }) => Promise<boolean> | boolean;
}

export interface CapabilityExecutionOptions {
	readonly timeoutMs?: number;
	/** Retries are allowed only for idempotent capabilities. */
	readonly retries?: number;
	/** Persisted evidence references produced after a successful execution. */
	readonly captureEvidence?: (result: unknown) => readonly string[] | Promise<readonly string[]>;
}

export async function executeFastPath(
	registry: CapabilityRegistry,
	ledger: ExecutionLedger,
	name: string,
	args: Record<string, unknown>,
	context: { cwd: string; mode: AgentMode; taskId: string; stepId: string; signal?: AbortSignal; requestId?: string; sessionId?: string; toolCallId?: string; ownerPid?: number },
	authorization: CapabilityAuthorization = {},
	execution: CapabilityExecutionOptions = {},
): Promise<CapabilityResult> {
	const capability = registry.require(name);
	const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	let executionState: CapabilityExecutionSnapshot = createCapabilityExecution({ executionId, capability: name, version: capability.version });
	for (const required of capability.requiredArgs ?? []) {
		if (args[required] === undefined || args[required] === null || args[required] === "") {
			throw new Error(`Missing required capability argument: ${required}`);
		}
	}
	if (capability.validateArgs) {
		const validation = capability.validateArgs(args);
		if (typeof validation === "string") throw new Error(validation);
	}
	const hasSideEffects = capability.sideEffects.some((effect) => effect !== "read_only");
	if (authorization.required && hasSideEffects) {
		if (authorization.recordPending && authorization.authorize) {
			executionState = transitionCapabilityExecution(executionState, "approval_pending");
			await ledger.appendCapabilityApprovalPending({ taskId: context.taskId, stepId: context.stepId, mode: context.mode, requestId: context.requestId, sessionId: context.sessionId, toolCallId: context.toolCallId, executionId, capability: name, version: capability.version });
		}
		const approved = authorization.authorize ? await authorization.authorize({ name, version: capability.version, sideEffects: capability.sideEffects, args }) : false;
		if (!approved) {
			executionState = transitionCapabilityExecution(executionState, "blocked", "approval_required");
			await ledger.append({
				taskId: context.taskId,
				stepId: context.stepId,
				kind: "capability.blocked",
				timestamp: new Date().toISOString(),
				mode: context.mode,
				correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId },
				details: { capability: name, version: capability.version, executionId, reason: "approval_required" },
			});
			return { status: "blocked", capability: name, version: capability.version, error: "Capability approval was not granted.", durationMs: 0, evidenceRefs: [] };
		}
		if (authorization.recordPending && authorization.authorize) await ledger.appendCapabilityApproved({ taskId: context.taskId, stepId: context.stepId, mode: context.mode, requestId: context.requestId, sessionId: context.sessionId, toolCallId: context.toolCallId, executionId, capability: name, version: capability.version });
		executionState = transitionCapabilityExecution(executionState, "approved");
	}

	const started = Date.now();
	const maxRetries = execution.retries === undefined ? 0 : Math.max(0, Math.floor(execution.retries));
	const retryLimit = capability.idempotent ? maxRetries : 0;
	executionState = transitionCapabilityExecution(executionState, "started");
	await ledger.append({
		taskId: context.taskId,
		stepId: context.stepId,
		kind: "capability.started",
		timestamp: new Date().toISOString(),
		mode: context.mode,
		correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId },
		details: { capability: name, version: capability.version, executionId, state: "started", ownerPid: context.ownerPid },
	});

	try {
		let attempts = 0;
		let result: unknown;
		while (true) {
			attempts++;
			const controller = new AbortController();
			const parentAbort = (): void => controller.abort();
			if (context.signal) {
				if (context.signal.aborted) controller.abort();
				else context.signal.addEventListener("abort", parentAbort, { once: true });
			}
			const timer = execution.timeoutMs && execution.timeoutMs > 0 ? setTimeout(() => controller.abort(), execution.timeoutMs) : undefined;
			try {
				result = await capability.execute(args, { cwd: context.cwd, mode: context.mode, signal: controller.signal });
				if (timer) clearTimeout(timer);
				if (context.signal) context.signal.removeEventListener("abort", parentAbort);
				break;
			} catch (error) {
				if (timer) clearTimeout(timer);
				if (context.signal) context.signal.removeEventListener("abort", parentAbort);
				if (attempts > retryLimit || controller.signal.aborted) {
					const interrupted = controller.signal.aborted;
					const durationMs = Date.now() - started;
					const message = interrupted ? "Capability execution was cancelled or timed out." : error instanceof Error ? error.message : String(error);
					if (interrupted) {
						const terminal = execution.timeoutMs && !context.signal?.aborted ? "timed_out" as const : "cancelled" as const;
						executionState = transitionCapabilityExecution(executionState, terminal, message);
						await ledger.appendCapabilityTerminal({ taskId: context.taskId, stepId: context.stepId, mode: context.mode, requestId: context.requestId, sessionId: context.sessionId, toolCallId: context.toolCallId, executionId, capability: name, status: terminal, reason: message });
					}
					if (!interrupted) executionState = transitionCapabilityExecution(executionState, "failed", message);
					await ledger.append({ taskId: context.taskId, stepId: context.stepId, kind: "capability.completed", timestamp: new Date().toISOString(), mode: context.mode, correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId }, details: { capability: name, version: capability.version, executionId, status: "failed", durationMs, error: message, interrupted, retries: attempts - 1 } });
					return { status: "failed", capability: name, version: capability.version, error: message, durationMs, evidenceRefs: [], interrupted, retries: attempts - 1 };
				}
			}
		}
		const durationMs = Date.now() - started;
		if (capability.verify) {
			const verification = await capability.verify(result, args, { cwd: context.cwd, mode: context.mode, signal: context.signal });
			if (verification !== true && verification !== undefined) {
				const message = typeof verification === "string" ? verification : "Capability postcondition verification failed.";
				executionState = transitionCapabilityExecution(executionState, "failed", message);
				await ledger.append({ taskId: context.taskId, stepId: context.stepId, kind: "capability.completed", timestamp: new Date().toISOString(), mode: context.mode, correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId }, details: { capability: name, version: capability.version, executionId, status: "failed", durationMs, error: message, verified: false } });
				return { status: "failed", capability: name, version: capability.version, error: message, durationMs, evidenceRefs: [], retries: Math.max(0, attempts - 1) };
			}
		}
		executionState = transitionCapabilityExecution(executionState, "completed");
		let evidenceRefs: string[] = [];
		let evidenceError: string | undefined;
		if (execution.captureEvidence) {
			try { evidenceRefs = [...await execution.captureEvidence(result)]; }
			catch (error) { evidenceError = error instanceof Error ? error.message : String(error); }
		}
		await ledger.append({
			taskId: context.taskId,
			stepId: context.stepId,
			kind: "capability.completed",
			timestamp: new Date().toISOString(),
			mode: context.mode,
		correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId },
		details: { capability: name, version: capability.version, executionId, status: "success", durationMs, evidenceRefs, ...(evidenceError ? { evidenceError } : {}) },
		});
		return { status: "success", capability: name, version: capability.version, result, durationMs, evidenceRefs, retries: Math.max(0, attempts - 1) };
	} catch (error) {
		const durationMs = Date.now() - started;
		const message = error instanceof Error ? error.message : String(error);
		if (executionState.state === "started") executionState = transitionCapabilityExecution(executionState, "failed", message);
		await ledger.append({
			taskId: context.taskId,
			stepId: context.stepId,
			kind: "capability.completed",
			timestamp: new Date().toISOString(),
			mode: context.mode,
			correlation: { requestId: context.requestId, sessionId: context.sessionId, executionId, toolCallId: context.toolCallId, taskId: context.taskId },
			details: { capability: name, version: capability.version, executionId, status: "failed", durationMs, error: message },
		});
		return { status: "failed", capability: name, version: capability.version, error: message, durationMs, evidenceRefs: [] };
	}
}
