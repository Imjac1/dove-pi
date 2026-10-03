import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadWorkMode, workModeDirectory, type WorkModeFiles } from "../src/core/work-mode.ts";
import { createEffectBoundary } from "../src/core/effect-boundary.ts";
import { createInMemoryEffectStore, effectClassOf } from "../src/core/effect-ledger.ts";

// **The runtime's own resolver, not a path written by hand** - the same reason code-audit-mode.test.ts gives: a test that
// spelled `modes/<name>` itself would keep passing if the resolver changed, and would then be validating a directory the
// runtime does not read.
const MODE_DIR = workModeDirectory(process.cwd(), "code-development");
const FRAMEWORK = "0.2.0";

async function loadMode() {
	const files: WorkModeFiles = {
		mode: await readFile(join(MODE_DIR, "MODE.md"), "utf8"),
		governance: await readFile(join(MODE_DIR, "governance.yaml"), "utf8"),
		permissions: await readFile(join(MODE_DIR, "permissions.yaml"), "utf8"),
	};
	return loadWorkMode(files, { frameworkVersion: FRAMEWORK });
}

/**
 * The tools this mode must let a retry through, and the ones it must not.
 *
 * The defect the twelve-session run found was fixed at its source - `replayed` was read as `attemptCount > 0`, which made
 * every tool call in a turn look like a replay of the request's first attempt. What remains, and is correct, is that an
 * **undeclared** effect is non-idempotent by default: on a genuine retry the boundary refuses it, because a default must not
 * grant a retry. That default is right for anything that changes something and wrong for anything that only reads it, so a
 * mode that ships a read-only tool has to say so - and this mode shipped four read-only project tools without saying so.
 *
 * The second case holds the line in the other direction. `agent_task_convergence` writes the task record and `bash` can do
 * anything, so neither may be declared here: declaring them would turn a correct refusal into a silent repeat, which is the
 * failure the whole default exists to prevent.
 */
const READ_ONLY = ["agent_project_status", "agent_project_context", "agent_list_capabilities", "agent_doctor"] as const;
const MUST_STAY_UNDECLARED = ["agent_task_convergence", "bash"] as const;

test("the development mode declares its read-only project tools idempotent, and says nothing about the writing ones", async () => {
	const mode = await loadMode();
	for (const tool of READ_ONLY) {
		const { effectClass, declared } = effectClassOf(tool, mode.effectClasses);
		assert.equal(declared, true, `${tool} only reads, and an undeclared effect is non-idempotent, so a retry of it is refused for no reason`);
		assert.equal(effectClass, "idempotent", `${tool} cannot duplicate anything by running twice`);
	}
	for (const tool of MUST_STAY_UNDECLARED) {
		const { declared } = effectClassOf(tool, mode.effectClasses);
		assert.equal(
			declared,
			false,
			`${tool} is not read-only, and declaring it would let a retry repeat something that must not be repeated`,
		);
	}
});

test("and the boundary therefore lets a retry of a read-only project tool through, while still refusing the writing one", async () => {
	const mode = await loadMode();
	const now = () => "2026-10-04T00:00:00.000Z";
	const boundary = createEffectBoundary({ engagement: "eng-1", mode, store: createInMemoryEffectStore(), now });

	const first = await boundary.prepare({ action: "agent_project_status", arguments: { taskId: "t-1" }, replayed: false });
	assert.equal(first.dispatch, true, "the first attempt of a request always dispatches");

	const replayed = await boundary.prepare({ action: "agent_project_status", arguments: { taskId: "t-1" }, replayed: true });
	assert.equal(
		replayed.dispatch,
		true,
		"a retry of a request may ask for the project state again: reading it twice cannot duplicate anything, which is what idempotent means here",
	);

	const writeFirst = await boundary.prepare({ action: "agent_task_convergence", arguments: { taskId: "t-1" }, replayed: false });
	assert.equal(writeFirst.dispatch, true, "the first attempt dispatches even for a writing tool - there is no earlier attempt to duplicate");

	const writeReplayed = await boundary.prepare({ action: "agent_task_convergence", arguments: { taskId: "t-1" }, replayed: true });
	assert.equal(
		writeReplayed.dispatch,
		false,
		"a retry must not re-run the tool that writes the task record: undeclared means non-idempotent, and this is the refusal that default is for",
	);
});
