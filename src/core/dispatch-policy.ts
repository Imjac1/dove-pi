import type { DispatchDecision, DispatchEstimate } from "./contracts.ts";

export function decideDispatch(estimate: DispatchEstimate, hasLongRunningIsolation = false): DispatchDecision {
	if (estimate.hasSharedMutableState || estimate.predictedWallTimeMs < 60_000) {
		return { route: "inline", reason: "coupled or short work stays inline", estimate };
	}
	if (hasLongRunningIsolation && estimate.predictedWallTimeMs > 120_000) {
		return { route: "subagent", reason: "isolated long-running work exceeds dispatch threshold", estimate };
	}
	if (estimate.independentBranches >= 2 && estimate.predictedWallTimeMs > 60_000) {
		return { route: "parallel", reason: "independent branches have a join point and are long enough to parallelize", estimate };
	}
	if (estimate.dispatchCost <= estimate.inlineCost * 0.8 || estimate.predictedWallTimeMs * 0.75 < estimate.inlineCost) {
		return { route: "subagent", reason: "dispatch meets the 20% cost or 25% wall-time improvement threshold", estimate };
	}
	return { route: "inline", reason: "coordination overhead does not justify dispatch", estimate };
}
