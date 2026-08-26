import type { CapabilityRegistry } from "./capability-registry.ts";
import type { CapabilityResult, AgentMode } from "./contracts.ts";
import { ExecutionLedger } from "./execution-ledger.ts";

export async function executeFastPath(
	registry: CapabilityRegistry,
	ledger: ExecutionLedger,
	name: string,
	args: Record<string, unknown>,
	context: { cwd: string; mode: AgentMode; taskId: string; stepId: string; signal?: AbortSignal },
): Promise<CapabilityResult> {
	const capability = registry.require(name);
	for (const required of capability.requiredArgs ?? []) {
		if (args[required] === undefined || args[required] === null || args[required] === "") {
			throw new Error(`Missing required capability argument: ${required}`);
		}
	}

	const started = Date.now();
	await ledger.append({
		taskId: context.taskId,
		stepId: context.stepId,
		kind: "capability.started",
		timestamp: new Date().toISOString(),
		mode: context.mode,
		details: { capability: name, version: capability.version },
	});

	try {
		const result = await capability.execute(args, {
			cwd: context.cwd,
			mode: context.mode,
			signal: context.signal,
		});
		const durationMs = Date.now() - started;
		await ledger.append({
			taskId: context.taskId,
			stepId: context.stepId,
			kind: "capability.completed",
			timestamp: new Date().toISOString(),
			mode: context.mode,
			details: { capability: name, version: capability.version, status: "success", durationMs },
		});
		return { status: "success", capability: name, version: capability.version, result, durationMs, evidenceRefs: [] };
	} catch (error) {
		const durationMs = Date.now() - started;
		const message = error instanceof Error ? error.message : String(error);
		await ledger.append({
			taskId: context.taskId,
			stepId: context.stepId,
			kind: "capability.completed",
			timestamp: new Date().toISOString(),
			mode: context.mode,
			details: { capability: name, version: capability.version, status: "failed", durationMs, error: message },
		});
		return { status: "failed", capability: name, version: capability.version, error: message, durationMs, evidenceRefs: [] };
	}
}
