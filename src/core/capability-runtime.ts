/** Host-independent capability execution state machine. */
export type CapabilityExecutionState =
	| "planned"
	| "approval_pending"
	| "approved"
	| "blocked"
	| "started"
	| "completed"
	| "failed"
	| "cancelled"
	| "timed_out"
	| "recovered";

export interface CapabilityExecutionSnapshot {
	readonly executionId: string;
	readonly capability: string;
	readonly version: string;
	readonly state: CapabilityExecutionState;
	readonly updatedAt: string;
	readonly reason?: string;
}

const transitions: Readonly<Record<CapabilityExecutionState, readonly CapabilityExecutionState[]>> = {
	planned: ["approval_pending", "approved", "blocked", "started"],
	approval_pending: ["approved", "blocked", "cancelled"],
	approved: ["started", "cancelled", "blocked"],
	blocked: [],
	started: ["completed", "failed", "cancelled", "timed_out", "recovered"],
	completed: [],
	failed: ["recovered"],
	cancelled: ["recovered"],
	timed_out: ["recovered"],
	recovered: [],
};

export function createCapabilityExecution(input: { executionId: string; capability: string; version: string; now?: string }): CapabilityExecutionSnapshot {
	return Object.freeze({ executionId: input.executionId, capability: input.capability, version: input.version, state: "planned" as const, updatedAt: input.now ?? new Date().toISOString() });
}

export function transitionCapabilityExecution(current: CapabilityExecutionSnapshot, next: CapabilityExecutionState, reason?: string, now = new Date().toISOString()): CapabilityExecutionSnapshot {
	if (!transitions[current.state].includes(next)) throw new Error(`Invalid capability transition: ${current.state} -> ${next}`);
	return Object.freeze({ ...current, state: next, updatedAt: now, ...(reason ? { reason } : {}) });
}

export function canTransitionCapabilityExecution(current: CapabilityExecutionState, next: CapabilityExecutionState): boolean {
	return transitions[current].includes(next);
}
