import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { ExecutionRecord } from "../src/core/contracts.ts";
import { parseHarnessSurface } from "../src/core/harness-surface.ts";
import { surfaceFit } from "../src/core/harness-round.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";
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

const workspace = resolve(process.argv[2] ?? process.cwd());
const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readChanges(): { readonly taskId: string; readonly change: TaskChange }[] {
	const tasksDir = join(workspace, ".dove", "tasks");
	if (!existsSync(tasksDir)) return [];
	const out: { taskId: string; change: TaskChange }[] = [];
	for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const file = join(tasksDir, entry.name, "convergence.json");
		if (!existsSync(file)) continue;
		try {
			const parsed = JSON.parse(readFileSync(file, "utf8")) as { changes?: readonly TaskChange[] };
			for (const change of parsed.changes ?? []) out.push({ taskId: entry.name, change });
		} catch { /* a record this script cannot read is not a turn it can print */ }
	}
	return out;
}

function readLedger(): readonly ExecutionRecord[] {
	const file = join(resolveDoveStateDir(workspace), "execution.jsonl");
	if (!existsSync(file)) return [];
	return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
		try { return [JSON.parse(line) as ExecutionRecord]; } catch { return []; }
	});
}

/** The files a commit touched, or undefined when git cannot answer - a third answer, not an empty one. */
function touchedFiles(commit: string): readonly string[] | undefined {
	const result = spawnSync("git", ["show", "--name-only", "--format=", commit], { cwd: harnessRoot, encoding: "utf8" });
	if (result.status !== 0 || typeof result.stdout !== "string") return undefined;
	return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
}

const surfacePath = join(harnessRoot, ".trellis", "harness-surface.yaml");
const declaredByComponent = new Map<string, readonly string[]>();
let surfaceIssue: string | undefined;
if (existsSync(surfacePath)) {
	try {
		for (const component of parseHarnessSurface(readFileSync(surfacePath, "utf8")).components) declaredByComponent.set(component.name, component.paths);
	} catch (error) {
		surfaceIssue = error instanceof Error ? error.message : String(error);
	}
} else surfaceIssue = "no declaration at .trellis/harness-surface.yaml";

const changes = readChanges();
const records = readLedger();
const appliedByChange = new Map(records.filter((record) => record.kind === "change.applied").map((record) => [String(record.details?.changeId ?? ""), String(record.details?.commit ?? "")]));
const decisions = records.filter((record) => record.kind === "change.decided");

console.log("Harness rounds - " + workspace);
console.log("");
if (surfaceIssue !== undefined) console.log("  surface declaration: " + surfaceIssue);
if (changes.length === 0) {
	console.log("  No change manifest in this workspace: no turn of the loop has been recorded here.");
	console.log("");
	console.log("  A turn begins with operation=change on agent_task_convergence, which pre-registers the prediction an");
	console.log("  edit has to earn. Nothing to print is a fact about the workspace, not about this reading.");
	process.exit(0);
}
console.log("  changes recorded: " + changes.length);
console.log("");
for (const { change } of changes) {
	const commit = appliedByChange.get(change.id);
	console.log("  " + change.id + "   surface " + change.surface);
	console.log("    evidence:   " + change.failureEvidenceRef);
	console.log("    fix:        " + change.fix);
	console.log("    predicted:  " + change.predictedFixes.map((movement) => movement.observable + ":" + movement.subject + "=" + movement.to).join(", "));
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
