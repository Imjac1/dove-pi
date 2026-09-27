/**
 * **The verifier read paths: the code that produces the evidence the loop is judged by.**
 *
 * These lived inside the adapter, which is why a commit that touched the adapter could only be called a *possible*
 * verifier change. They move here verbatim - no behaviour changes - so the boundary can answer **definite** about
 * them, and so a reader looking for the verifier finds it in one place rather than in a tool-registration file.
 *
 * **Why one step is safe here**: the two functions the repository uses outside the adapter were used by exactly two
 * test files, whose assertions are the regression net, and the other three are reached only from the adapter own call
 * sites.
 *
 * **The one change inside the move**: the four functions that were module-private are now exported, because their new
 * home is a module rather than the file that called them. Their bodies are untouched.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionRecord } from "./contracts.ts";
import { movementKey, verificationStateOf, type ChangeObservables, type PredictedMovement, type TaskConvergenceSnapshot } from "./task-convergence.ts";

/**
 * Resolve acceptance evidence refs against what the harness actually wrote.
 *
 * The companion to the shape rule in the tool-argument layer: that one refuses a ref the agent could have authored,
 * and this one refuses a well-shaped ref whose record does not exist. Neither is sufficient alone - a well-shaped ref
 * to a record that was never written is the assertion in the right costume.
 *
 * What resolves:
 * - `ledger:<stepId>` - a step the execution ledger wrote. Every tool call now writes one (`tool:<toolCallId>`) and
 *   the result names it, so this is the kind a model can actually produce.
 * - `effect:<effectKey>` - a claim file in the effect store, whose existence is the claim.
 */
export async function unresolvedAcceptanceEvidence(
	evidenceRefs: readonly string[],
	options: { readonly readLedger: () => Promise<readonly { readonly stepId: string }[]>; readonly effectsDirectory: string },
): Promise<readonly string[]> {
	const needsLedger = evidenceRefs.some((ref) => ref.startsWith("ledger:"));
	const stepIds = needsLedger ? new Set((await options.readLedger()).map((record) => record.stepId)) : new Set<string>();
	const unresolved: string[] = [];
	for (const ref of evidenceRefs) {
		const separator = ref.indexOf(":");
		const kind = separator < 0 ? "" : ref.slice(0, separator);
		const id = separator < 0 ? "" : ref.slice(separator + 1);
		if (kind === "ledger" && !stepIds.has(id)) unresolved.push(ref);
		else if (kind === "effect" && !existsSync(join(options.effectsDirectory, id + ".json"))) unresolved.push(ref);
		else if (kind !== "ledger" && kind !== "effect") unresolved.push(ref);
	}
	return unresolved;
}

/**
 * The counts, per **atom**, of the refusals the ledger holds.
 *
 * **A recorded label may be composite.** The refusal path falls back to `gates.join("+")` when a reason carries no
 * `[label]` prefix, so a prediction naming one atom would never see such an entry. Splitting here is what makes this
 * a count of refusals rather than a count of the ways a refusal was labelled.
 */
export function countGateRefusals(records: readonly ExecutionRecord[]): Readonly<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const record of records) {
		if (record.kind !== "gate.refused") continue;
		const gate = record.details?.gate;
		if (typeof gate !== "string") continue;
		for (const atom of gate.split("+")) {
			const label = atom.trim();
			if (label !== "") counts[label] = (counts[label] ?? 0) + 1;
		}
	}
	return counts;
}

/**
 * The observable read, from a snapshot whose evidence refs the caller has **already resolved**.
 *
 * Taking the resolution as an argument rather than doing it here is deliberate: the status read resolves every
 * criterion's refs for its own audit, and resolving them a second time for the same answer would be one rule applied
 * twice with two chances to differ.
 */
export function changeObservables(
	snapshot: TaskConvergenceSnapshot,
	unresolvedByCriterion: readonly (readonly string[])[],
	gateRefusals: Readonly<Record<string, number>>,
): ChangeObservables {
	const criterionStatus: Record<string, string> = {};
	const verificationState: Record<string, string> = {};
	snapshot.criteria.forEach((criterion, index) => {
		criterionStatus[criterion.id] = criterion.status;
		verificationState[criterion.id] = verificationStateOf(criterion.status, (unresolvedByCriterion[index] ?? []).length);
	});
	return { currentRevision: snapshot.revision, criterionStatus, verificationState, gateRefusals };
}

/**
 * The observables a verdict is read against, assembled **once** for both of its consumers.
 *
 * The status read reports verdicts and the round boundary records them, and both need the same three inputs: the
 * snapshot, the per-criterion unresolved refs, and the refusal counts. Assembling them twice is how a field comes to be
 * added to one and forgotten in the other - the drift this record has already paid for once, when a decoder served two
 * doors. The I/O is injected rather than closed over so the rule stays in one place and the caller owns the filesystem.
 */
export async function convergenceObservables(
  snapshot: TaskConvergenceSnapshot,
  readLedger: () => Promise<readonly ExecutionRecord[]>,
  effectsDirectory: string,
): Promise<{ readonly observables: ChangeObservables; readonly unresolvedByCriterion: readonly (readonly string[])[] }> {
  const unresolvedByCriterion = await Promise.all(snapshot.criteria.map((criterion) => unresolvedAcceptanceEvidence(criterion.evidenceRefs, { readLedger, effectsDirectory })));
  return { observables: changeObservables(snapshot, unresolvedByCriterion, countGateRefusals(await readLedger())), unresolvedByCriterion };
}

/**
 * The values a verdict will compare against: read now, for the keys this manifest predicts over, and stored with it.
 *
 * A key left out is a baseline the harness did not have, which `verdictFor` reports as `unobserved` rather than as
 * a zero - the difference between "it did not move" and "nobody looked".
 */
export function changeBaseline(
	manifest: { readonly predictedFixes: readonly PredictedMovement[]; readonly predictedRegressions: readonly PredictedMovement[] },
	observed: ChangeObservables,
): Readonly<Record<string, string | number>> {
	const baseline: Record<string, string | number> = {};
	for (const movement of [...manifest.predictedFixes, ...manifest.predictedRegressions]) {
		const value = movement.observable === "criterion-status"
			? observed.criterionStatus[movement.subject]
			: movement.observable === "verification-state"
				? observed.verificationState[movement.subject]
				: observed.gateRefusals[movement.subject];
		if (value !== undefined) baseline[movementKey(movement)] = value;
	}
	return baseline;
}
