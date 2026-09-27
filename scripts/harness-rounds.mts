import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { ExecutionRecord } from "../src/core/contracts.ts";
import { parseLedgerLines } from "../src/core/execution-ledger.ts";
import { parseHarnessSurface } from "../src/core/harness-surface.ts";
import { surfaceFit, verifierFit } from "../src/core/harness-round.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";
import { decodeTaskConvergenceSnapshot, type PredictedMovement } from "../src/core/task-convergence.ts";
import type { TaskChange } from "../src/core/task-convergence.ts";

/**
 * **One turn of the loop, printed.**
 *
 *     node --import tsx scripts/harness-rounds.mts [workspace]
 *
 * For every change a formal task carries: the failure evidence that motivated it, the surface it claimed, the fix,
 * the prediction, **the commit that embodies the edit and whether it stayed inside the declared paths of that
 * surface**, and the decision the round after it recorded.
 *
 * **Why the check lives here and not in the runtime.** The runtime cannot reach git, and putting a process spawn on
 * the request path to check one claim would be a control where a reading belongs. The runtime records the claim
 * (operation=applied); this is the reading, where git and this project evidence readings already live. It prints and
 * never asserts, exit 0 in every case.
 *
 * **Why the check is against the surface declaration.** The manifest says which component the change touches, and
 * that claim is only checkable if something states which files belong to the component - which is what
 * `.trellis/harness-surface.yaml` is for. Without it this would be a claim about a claim.
 */

/** A movement as text, by its arm: `to` for a status, `direction` for a refusal count. */
function movementText(movement: PredictedMovement): string {
	const target = movement.observable === "gate-refusals" ? movement.direction : movement.to;
	return movement.observable + ":" + movement.subject + "=" + target;
}

const workspace = resolve(process.argv[2] ?? process.cwd());
const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readChanges(): { readonly changes: readonly { readonly taskId: string; readonly change: TaskChange }[]; readonly unreadable: readonly string[] } {
	const tasksDir = join(workspace, ".dove", "tasks");
	if (!existsSync(tasksDir)) return { changes: [], unreadable: [] };
	const changes: { taskId: string; change: TaskChange }[] = [];
	const unreadable: string[] = [];
	for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const file = join(tasksDir, entry.name, "convergence.json");
		if (!existsSync(file)) continue;
		try {
			// **The decoder that owns this format, not a cast.** A cast is satisfied by values that only look like the shape: a
			// record carrying `changes: "none"` passed one, and because a string is iterable the reading counted four characters
			// as four changes and then died on the first of them. The decoder is total and typed, and a record it refuses is
			// **reported** rather than silently dropped - a reading that hides a task is a reading whose output cannot be trusted
			// to be complete.
			const snapshot = decodeTaskConvergenceSnapshot(JSON.parse(readFileSync(file, "utf8")));
			for (const change of snapshot.changes ?? []) changes.push({ taskId: entry.name, change });
		} catch {
			unreadable.push(entry.name);
		}
	}
	return { changes, unreadable };
}

function readLedger(): readonly ExecutionRecord[] {
	const file = join(resolveDoveStateDir(workspace), "execution.jsonl");
	if (!existsSync(file)) return [];
	return parseLedgerLines(readFileSync(file, "utf8"));
}

/** The files a commit touched, or undefined when git cannot answer - a third answer, not an empty one. */
function touchedFiles(commit: string): readonly string[] | undefined {
	const result = spawnSync("git", ["show", "--name-only", "--format=", commit], { cwd: harnessRoot, encoding: "utf8" });
	if (result.status !== 0 || typeof result.stdout !== "string") return undefined;
	return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
}

const surfacePath = join(harnessRoot, ".trellis", "harness-surface.yaml");
const declaredByComponent = new Map<string, readonly string[]>();
let declaredVerifier: ReturnType<typeof parseHarnessSurface>["verifier"] | undefined;
let surfaceIssue: string | undefined;
if (existsSync(surfacePath)) {
	try {
		const parsed = parseHarnessSurface(readFileSync(surfacePath, "utf8"));
		for (const component of parsed.components) declaredByComponent.set(component.name, component.paths);
		declaredVerifier = parsed.verifier;
	} catch (error) {
		surfaceIssue = error instanceof Error ? error.message : String(error);
	}
} else surfaceIssue = "no declaration at .trellis/harness-surface.yaml";

const { changes, unreadable } = readChanges();
const records = readLedger();
const appliedByChange = new Map(records.filter((record) => record.kind === "change.applied").map((record) => [String(record.details?.changeId ?? ""), String(record.details?.commit ?? "")]));
const decisions = records.filter((record) => record.kind === "change.decided");

console.log("Harness rounds - " + workspace);
console.log("");
if (surfaceIssue !== undefined) console.log("  surface declaration: " + surfaceIssue);
if (changes.length === 0) {
	if (unreadable.length > 0) {
		// **Saying "no turn has been recorded" here would be false**, and this is the difference the report exists for: a record
		// exists and this build cannot read it, so the reading cannot say whether a turn was recorded. Those are different
		// facts, and only one of them is about the workspace.
		console.log("  A task record exists that this build cannot read, so this reading cannot say whether a turn was recorded: " + unreadable.join(", "));
		process.exit(0);
	}
	console.log("  No change manifest in this workspace: no turn of the loop has been recorded here.");
	console.log("");
	console.log("  A turn begins with operation=change on agent_task_convergence, which pre-registers the prediction an");
	console.log("  edit has to earn. Nothing to print is a fact about the workspace, not about this reading.");
	process.exit(0);
}
console.log("  changes recorded: " + changes.length);
if (unreadable.length > 0) {
	// **Reported rather than dropped.** A task record this build cannot decode is not a turn it can print, and saying so is what
	// keeps the count above honest: silent skipping is how a reading becomes incomplete without looking incomplete.
	console.log("  task records that could not be read: " + unreadable.join(", "));
}
// **A decision the record no longer carries still happened.** The record is bounded and drops a change whose verdict is still
// pending, while the ledger is append-only and keeps it - so the two are supposed to disagree, and this state is designed rather
// than corrupt. Saying nothing would let an operator read "the next round has not been observed" on a turn whose decision is
// sitting in the file they were told to read.
const carried = new Set(changes.map((entry) => entry.change.id));
const orphanDecisions = [...new Set(decisions.map((record) => String(record.details?.changeId ?? "")))].filter((id) => id !== "" && !carried.has(id));
if (orphanDecisions.length > 0) {
	console.log("  decisions the record does not carry: " + orphanDecisions.join(", ") + "   (the ledger keeps what a bounded record drops)");
}
console.log("");
for (const { change } of changes) {
	const commit = appliedByChange.get(change.id);
	console.log("  " + change.id + "   surface " + change.surface);
	console.log("    evidence:   " + change.failureEvidenceRef);
	console.log("    fix:        " + change.fix);
	// **A movement is printed by its arm.** The union names the target `to` for the two status observables and `direction` for
			// a refusal count, and reading `.to` for every arm printed `gate-refusals:fence=undefined` - in every turn output, for
			// the observable the whole verdict machinery was built around. The type system said so the moment this file entered
			// the gate.
			console.log("    predicted:  " + change.predictedFixes.map(movementText).join(", "));
	if (commit === undefined) {
		console.log("    applied:    (none recorded) - no commit names this edit, so nothing can be reverted by id");
	} else {
		const declared = declaredByComponent.get(change.surface);
		const files = touchedFiles(commit);
		if (declared === undefined) {
			console.log("    applied:    " + commit + "   surface not declared, so inside-or-outside cannot be decided");
		} else {
			const fit = surfaceFit({ touchedFiles: files, declaredPaths: declared, workspaceRoot: harnessRoot });
			console.log("    applied:    " + commit + "   " + fit.fit + " " + change.surface + (files === undefined ? " (git could not resolve the commit)" : ""));
			if (fit.outside.length > 0) console.log("    outside:    " + fit.outside.join(", "));
			// Whether this edit is a verifier change: such a change is not a loop turn, and it is judged by its suites and a
			// person rather than by the observables.
			if (declaredVerifier !== undefined) {
				const verifier = verifierFit({ touchedFiles: files, verifier: declaredVerifier, workspaceRoot: harnessRoot });
				const atStake = verifier.paths.length > 0 ? verifier.paths.join(", ") : verifier.embedded.map((entry) => entry.path + " (" + entry.symbols.join(", ") + ")").join(" | ");
				console.log("    verifier:   " + verifier.fit + (verifier.fit === "none" ? " (this edit is not a verifier change)" : " - " + atStake));
			}
		}
	}
	const decision = decisions.filter((record) => String(record.details?.changeId ?? "") === change.id).at(-1);
	if (decision === undefined) {
		console.log("    decision:   (none yet) - the next round has not been observed");
	} else {
		console.log("    decision:   " + String(decision.details?.verdict ?? "") + " at revision " + String(decision.details?.decidedAtRevision ?? ""));
		const observed = decision.details?.observed;
		if (Array.isArray(observed)) for (const line of observed) console.log("                " + String(line));
	}
	console.log("");
}
console.log("A reading, not a gate: nothing here asserts a threshold, and keeping or reverting an edit is a decision");
console.log("for a person with this output in front of them.");
