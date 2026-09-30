/**
 * The boundary, as a regression test rather than as a design claim.
 *
 * **Where this comes from.** `09-30-axi-a0-base/readings.md`, section "A0.2 second half": a probe proved three
 * criteria and one control in one session. A probe is a reading, not a guarantee - this file is what turns it
 * into something that fails when it stops being true.
 *
 * **The three criteria and why each is separate.**
 *   1. the constrained process cannot write the held-out side;
 *   2. it cannot lift that by rewriting the ACL - the criterion that separates a boundary from a
 *      same-identity restriction, since the process is still the owner of the held-out tree;
 *   3. it can still work on the writable side - a policy that refuses everything is broken, not safe.
 *
 * **And one control that is not optional.** Without the positive control, "the file is absent" cannot be told
 * apart from "the test is blind". The control grants the work SID on the held-out path *from the unrestricted
 * process*, shows the same constrained child now writes, then removes it and shows it stops.
 *
 * The scratch tree lives under the OS temporary directory and is removed afterwards, so this test leaves no
 * ACL behind on anything that belongs to the repository.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeBoundary, ensureBoundary, invariantViolations, readAcl } from "../src/jailer/acl.ts";
import { launchJailed } from "../src/jailer/launch.ts";
import { probeToken } from "../src/jailer/token.ts";
import { DEFAULT_WORK_SID, type BoundarySpec } from "../src/jailer/types.ts";
import { runCommandLine } from "../src/jailer/host.ts";

const root = join(tmpdir(), `axi-jailer-${String(process.pid)}`);
const work = join(root, "work");
const plane = join(root, "plane");
const scratch = join(root, "scratch");

const spec: BoundarySpec = {
	planePaths: [plane],
	workPaths: [work],
	workSid: DEFAULT_WORK_SID,
	hostScript: join(process.cwd(), "src", "windows-runtime", "jailer-host.ps1"),
	scratchDir: scratch,
	ownerAccount: `${process.env.USERDOMAIN ?? ""}\\${process.env.USERNAME ?? ""}`,
};

const everyoneGrantCountOnPlane = (): number =>
	readAcl(spec, "acl-readback").rules.filter((rule) => rule.path === plane && rule.type === "Allow" && rule.sid === DEFAULT_WORK_SID).length;

describe("the plane B boundary", () => {
	before(() => {
		rmSync(root, { recursive: true, force: true });
		mkdirSync(work, { recursive: true });
		mkdirSync(plane, { recursive: true });
		mkdirSync(scratch, { recursive: true });
	});

	after(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("sets and then checks both invariants, and finds no violation", () => {
		const report = ensureBoundary(spec);
		assert.deepEqual(report.violations, [], `the boundary does not hold: ${describeBoundary(report)}`);
		assert.deepEqual(report.missing, []);
		// The check is the reading, not the set: it re-reads the rules and applies the invariants to them.
		assert.deepEqual(invariantViolations(spec, report.rules, report.missing), []);
	});

	it("verifies the restricting SID list instead of assuming it took effect", () => {
		const token = probeToken(spec);
		assert.equal(token.selfCheck, "pass", `the instrument self-check did not pass: ${token.failure ?? ""} raw=${token.raw}`);
		assert.deepEqual([...token.restrictingSids].sort(), [DEFAULT_WORK_SID]);
	});

	it("criterion 3: the constrained process does normal work on the writable side", () => {
		const target = join(work, "from-child.txt");
		rmSync(target, { force: true });
		const report = launchJailed(spec, { command: `cmd.exe /c echo PROBE-JAIL> "${target}"`, cwd: work, tag: "criterion-3" });
		assert.equal(report.ok, true, `the mechanism did not report honestly: ${report.failure ?? ""}`);
		assert.equal(report.exitCode, 0, `the constrained child failed to work: exit ${String(report.exitCode)}`);
		assert.equal(existsSync(target), true, "the child reported success but wrote nothing");
	});

	it("criterion 1: the constrained process cannot write the held-out side", () => {
		const target = join(plane, "from-child.txt");
		rmSync(target, { force: true });
		const report = launchJailed(spec, { command: `cmd.exe /c echo PROBE-PLANE> "${target}"`, cwd: work, tag: "criterion-1" });
		assert.equal(report.ok, true, `the mechanism did not report honestly: ${report.failure ?? ""}`);
		assert.notEqual(report.exitCode, 0, "the child exited successfully writing a held-out path");
		assert.equal(existsSync(target), false, "the constrained process wrote the held-out side");
	});

	it("criterion 2: the constrained process cannot lift the restriction, and the ACL is unchanged", () => {
		const before = everyoneGrantCountOnPlane();
		assert.equal(before, 0, "the held-out path already carries a work-SID grant, so criterion 2 cannot be read");
		const tamper = launchJailed(spec, {
			command: `cmd.exe /c icacls "${plane}" /grant "*${DEFAULT_WORK_SID}:(OI)(CI)M"`,
			cwd: work,
			tag: "criterion-2-tamper",
		});
		assert.equal(tamper.ok, true, `the mechanism did not report honestly: ${tamper.failure ?? ""}`);
		assert.notEqual(tamper.exitCode, 0, "the constrained process granted itself access to the held-out path");

		const target = join(plane, "after-grant.txt");
		const retry = launchJailed(spec, { command: `cmd.exe /c echo PROBE-AFTER> "${target}"`, cwd: work, tag: "criterion-2-retry" });
		assert.equal(retry.ok, true);
		assert.equal(existsSync(target), false, "the write succeeded after the tamper attempt");
		assert.equal(everyoneGrantCountOnPlane(), before, "the held-out ACL changed, so the restriction was lifted");
	});

	it("positive control: the same test can see a write when the boundary is absent", () => {
		const granted = runCommandLine(`icacls "${plane}" /grant "*${DEFAULT_WORK_SID}:(OI)(CI)M"`);
		assert.equal(granted, 0, `could not grant the work SID from the unrestricted process (exit ${String(granted)})`);
		try {
			const target = join(plane, "positive.txt");
			rmSync(target, { force: true });
			const report = launchJailed(spec, { command: `cmd.exe /c echo PROBE-POSITIVE> "${target}"`, cwd: work, tag: "control-positive" });
			assert.equal(report.ok, true);
			assert.equal(report.exitCode, 0, "with the grant present the write should succeed; the test may be blind");
			assert.equal(existsSync(target), true, "the control failed to produce a write, so criterion 1 proves nothing");
		} finally {
			const removed = runCommandLine(`icacls "${plane}" /remove:g "*${DEFAULT_WORK_SID}"`);
			assert.equal(removed, 0, "the control could not remove its own grant");
		}
		const after = join(plane, "negative.txt");
		rmSync(after, { force: true });
		const report = launchJailed(spec, { command: `cmd.exe /c echo PROBE-NEG> "${after}"`, cwd: work, tag: "control-negative" });
		assert.equal(report.ok, true);
		assert.equal(existsSync(after), false, "removing the grant did not restore the boundary");
	});
});
