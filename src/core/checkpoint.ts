import { createHash } from "node:crypto";
import type { EffectRecord, ModeIdentity } from "./effect-ledger.ts";

/**
 * Action-boundary checkpointing (design section 5.3).
 *
 * The checkpoint unit is **an effect that was admitted and completed**, not a model turn. A turn is a
 * transcript boundary; an effect is the thing that must not be replayed. Checkpointing on turns is why
 * the surveyed frameworks end up re-running side effects: their resume unit does not line up with the
 * unit that has consequences.
 *
 * Two guards are copied from the strongest precedent found in the wild (Microsoft's
 * `WorkflowCheckpoint`), because both catch a real class of mistake:
 *
 * - **a graph signature** - a hash of the orchestration shape. A checkpoint taken under one tool set,
 *   mode version, or gate must not be resumed under another, because the resumed run would then be a
 *   different program continuing someone else's work.
 * - **explicit lineage** - each checkpoint names its predecessor, so a chain can be verified rather
 *   than assumed from timestamps.
 */

export interface ActionCheckpoint {
	readonly checkpointId: string;
	readonly previousCheckpointId?: string;
	readonly mode: ModeIdentity;
	/** Hash of the orchestration shape the checkpoint was taken under. */
	readonly graphSignature: string;
	readonly sequence: number;
	/** Effects already admitted and completed. The unit that must not be replayed. */
	readonly completedEffectKeys: readonly string[];
	readonly createdAt: string;
}

export interface CheckpointStore {
	save(checkpoint: ActionCheckpoint): Promise<void>;
	load(checkpointId: string): Promise<ActionCheckpoint | undefined>;
	latest(): Promise<ActionCheckpoint | undefined>;
}

export function createInMemoryCheckpointStore(): CheckpointStore {
	const checkpoints = new Map<string, ActionCheckpoint>();
	let newest: ActionCheckpoint | undefined;
	return {
		async save(checkpoint) {
			checkpoints.set(checkpoint.checkpointId, checkpoint);
			if (newest === undefined || checkpoint.sequence >= newest.sequence) newest = checkpoint;
		},
		async load(checkpointId) {
			return checkpoints.get(checkpointId);
		},
		async latest() {
			return newest;
		},
	};
}

export interface GraphShape {
	readonly mode: ModeIdentity;
	readonly toolNames: readonly string[];
	readonly gateId?: string;
}

/** A stable hash of the orchestration shape. Sorted so tool registration order cannot change it. */
export function computeGraphSignature(shape: GraphShape): string {
	const material = [
		"dove-graph/v1",
		shape.mode.id,
		shape.mode.version,
		shape.mode.governanceVersion,
		[...shape.toolNames].sort().join(","),
		shape.gateId ?? "",
	].join("\u0000");
	return createHash("sha256").update(material).digest("hex");
}

export interface CaptureCheckpointInput {
	readonly mode: ModeIdentity;
	readonly shape: GraphShape;
	readonly effects: readonly EffectRecord[];
	readonly previous?: ActionCheckpoint;
	readonly now?: () => string;
}

/**
 * Capture a checkpoint from the effects that have **completed**. Blocked and failed effects are not
 * part of it: a blocked action never ran, and a failed one is ambiguous (see `dispatchOnce`), so
 * neither may be recorded as done.
 */
export function captureCheckpoint(input: CaptureCheckpointInput): ActionCheckpoint {
	const now = input.now ?? (() => new Date().toISOString());
	const completedEffectKeys = input.effects
		.filter((effect) => effect.outcome === "completed")
		.map((effect) => effect.effectKey)
		.sort();
	const sequence = (input.previous?.sequence ?? 0) + 1;
	const checkpointId = createHash("sha256")
		.update([computeGraphSignature(input.shape), String(sequence), completedEffectKeys.join(",")].join("\u0000"))
		.digest("hex")
		.slice(0, 32);
	return {
		checkpointId,
		...(input.previous === undefined ? {} : { previousCheckpointId: input.previous.checkpointId }),
		mode: input.mode,
		graphSignature: computeGraphSignature(input.shape),
		sequence,
		completedEffectKeys,
		createdAt: now(),
	};
}

export type RestoreResult =
	| { readonly ok: true; readonly completedEffectKeys: readonly string[] }
	| { readonly ok: false; readonly reason: string; readonly remediation: string };

/**
 * Validate a checkpoint against the shape that is about to resume from it.
 *
 * Both checks are refusals rather than warnings. Resuming a checkpoint whose graph has changed means
 * running a different program from where another one stopped, and the failure that produces is a
 * side effect replayed under assumptions that no longer hold.
 */
export function restoreCheckpoint(checkpoint: ActionCheckpoint, shape: GraphShape): RestoreResult {
	if (checkpoint.mode.id !== shape.mode.id || checkpoint.mode.version !== shape.mode.version || checkpoint.mode.governanceVersion !== shape.mode.governanceVersion) {
		return {
			ok: false,
			reason: `Checkpoint ${checkpoint.checkpointId} was taken under mode ${checkpoint.mode.id}@${checkpoint.mode.version} (governance ${checkpoint.mode.governanceVersion}), but the resuming shape is ${shape.mode.id}@${shape.mode.version} (governance ${shape.mode.governanceVersion}).`,
			remediation: "Resume with the same mode version, or start a new run rather than continuing another mode's work.",
		};
	}
	const signature = computeGraphSignature(shape);
	if (checkpoint.graphSignature !== signature) {
		return {
			ok: false,
			reason: `Checkpoint ${checkpoint.checkpointId} was taken under a different orchestration shape (tools or gate changed).`,
			remediation: "Restore the tools and gate the checkpoint was taken under, or start a new run.",
		};
	}
	return { ok: true, completedEffectKeys: checkpoint.completedEffectKeys };
}
