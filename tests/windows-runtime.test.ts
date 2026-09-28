import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPowerShell } from "../src/windows-runtime/powershell.ts";
import { inspectWindowsEnvironment } from "../src/windows-runtime/doctor.ts";
import { applyWorkspacePatch, createWorkspaceSnapshot, restoreWorkspaceSnapshot, verifyWorkspaceSnapshot } from "../src/windows-runtime/workspace.ts";

describe("PowerShell runtime", () => {
	it("returns structured output for a read-only command", async () => {
		const result = await runPowerShell("Write-Output 'personal-agent-ok'", { timeoutMs: 10_000 });
		assert.equal(result.exitCode, 0);
		assert.match(result.stdout, /personal-agent-ok/);
		assert.equal(result.interrupted, false);
	});
});

describe("Windows doctor", () => {
	it("marks a pre-aborted run interrupted, and does not when nothing aborts it", async () => {
		// **What this holds and what it does not.** It holds the cancellation half of the shell boundary: an already-aborted signal is
		// checked before the child produces anything, so `interrupted` is set deterministically rather than by a race. **It is also
		// the regression test for a defect**: this case found `kill EINVAL` escaping asynchronously, because killing a process that
		// has not started throws on Windows, and the abort path called `kill` unguarded.
		// It does not hold an abort arriving mid-run - that needs a live process and timing - and it does not hold the timeout,
		// which shares the abort path.
		const controller = new AbortController();
		controller.abort();
		const aborted = await runPowerShell("Write-Output 'personal-agent-ok'", { signal: controller.signal, timeoutMs: 10_000 });
		assert.equal(aborted.interrupted, true, "a pre-aborted signal marks the run interrupted");
		// The control, in place: the same call with no signal is not interrupted, so the assertion is about the signal and not about a
		// field that is always true.
		const clean = await runPowerShell("Write-Output 'personal-agent-ok'", { timeoutMs: 10_000 });
		assert.equal(clean.interrupted, false, "the control: nothing aborted it");
		assert.equal(clean.exitCode, 0, "and it ran to completion");
	});
	it("interrupts a run that outlives its timeout, and the duration says which ended it", async () => {
		// **What this holds and what it does not.** It holds the timeout half of the shell boundary: a one-millisecond timeout
		// beside a script that sleeps for three seconds has a margin of thousands, so the timeout always wins and `interrupted`
		// is set. **The duration is the part that proves it** - a completed sleep would report three seconds, so a duration
		// under a second and a half is evidence that the timeout ended the run rather than the script.
		// It does not hold cancellation, which has its own case, and it does not hold a timeout that fires mid-output.
		const timedOut = await runPowerShell("Start-Sleep -Seconds 3", { timeoutMs: 1 });
		assert.equal(timedOut.interrupted, true, "the timeout marks the run interrupted");
		assert.ok(timedOut.durationMs < 1_500, `the run ended in ${timedOut.durationMs}ms, not after the three-second sleep`);
		// The mirror control: a short sleep with a long timeout completes, so the assertion above is about the timeout and not
		// about a field that is true whenever a child is killed by anything.
		const allowed = await runPowerShell("Start-Sleep -Milliseconds 100", { timeoutMs: 5_000 });
		assert.equal(allowed.interrupted, false, "the control: the timeout did not fire");
		assert.ok(allowed.durationMs >= 100, "and the script was allowed to finish its sleep");
	});
	it("carries what the shell wrote to stderr, and a non-zero exit code, separately from stdout", async () => {
		// **What this holds and what it does not.** It holds the `stderr` and `exitCode` fields together, which is what a caller needs to
		// tell *what ran* from *what it complained about*: the script writes to stderr and exits non-zero, and stdout stays empty.
		// It does not hold the `interrupted` flag, which has its own case, and it does not hold the executable fallback - see the
		// note below the suite.
		const failed = await runPowerShell("Write-Error 'a complaint'; exit 3", { timeoutMs: 10_000 });
		assert.equal(failed.exitCode, 3, "the exit code is the process own, not a normalised one");
		assert.match(failed.stderr, /a complaint/, "stderr carries what the script said");
		assert.equal(failed.stdout.trim(), "", "and stdout does not, so the two are not merged");
		// The control, in place: the same call without the error writes to stdout and exits zero, so the assertions above are about
		// the script rather than about fields that are always populated.
		const fine = await runPowerShell("Write-Output 'all good'", { timeoutMs: 10_000 });
		assert.equal(fine.exitCode, 0, "the control: a script that succeeds exits zero");
		assert.equal(fine.stderr.trim(), "", "and says nothing on stderr");
	});
	it("reports runtime and tool availability", async () => {
		const report = await inspectWindowsEnvironment(process.cwd());
		assert.equal(report.available, true);
		assert.equal(typeof report.version, "string");
		assert.equal(typeof report.isAdministrator, "boolean");
		assert.ok("git" in report.tools);
	});
});

describe("Workspace transactions", () => {
	it("snapshots, detects drift, and restores files plus additions", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-"));
		await writeFile(join(temporary, "a.txt"), "before", "utf8");
		await writeFile(join(temporary, "b.txt"), "keep", "utf8");
		const snapshot = await createWorkspaceSnapshot(temporary, ["."]);
		await writeFile(join(temporary, "a.txt"), "changed", "utf8");
		await writeFile(join(temporary, "new.txt"), "new", "utf8");
		const drift = await verifyWorkspaceSnapshot(temporary, snapshot.id);
		assert.equal(drift.ok, false);
		assert.ok(drift.changed.includes("a.txt"));
		assert.ok(drift.extra.includes("new.txt"));
		const restored = await restoreWorkspaceSnapshot(temporary, snapshot.id);
		assert.equal(restored.ok, true);
		assert.equal(await readFile(join(temporary, "a.txt"), "utf8"), "before");
		await assert.rejects(() => readFile(join(temporary, "new.txt"), "utf8"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("rolls back a patch when an operation fails", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-patch-"));
		await writeFile(join(temporary, "state.txt"), "original", "utf8");
		await assert.rejects(() => applyWorkspacePatch(temporary, [
			{ kind: "write", path: "state.txt", content: "temporary" },
			{ kind: "unsupported" as "write", path: "ignored", content: "x" },
		]), /Unsupported workspace patch operation/);
		assert.equal(await readFile(join(temporary, "state.txt"), "utf8"), "original");
		await rm(temporary, { recursive: true, force: true });
	});

	it("rejects traversal and reserved snapshot paths", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-paths-"));
		await assert.rejects(() => createWorkspaceSnapshot(temporary, [".."]), /escapes root/);
		await assert.rejects(() => createWorkspaceSnapshot(temporary, [".agent-data/workspace-snapshots"]), /reserved/);
		await rm(temporary, { recursive: true, force: true });
	});
});