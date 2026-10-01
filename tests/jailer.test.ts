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
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
		// **Every rule, not only the count of one shape**: a count of work-SID grants cannot see a tamper that removed
		// something else, and the reading this criterion is credited with is that the ACL is the one it was. **What a
		// rule list cannot attribute is the exit code below**: `icacls "<writable path>"` read from the same token also
		// exits 1 (measured), so "it refused" is read from the ACL and from the write that still fails, not from that
		// code - an exit status alone would not tell a refused tamper from an instrument that cannot run at all.
		const rulesBefore = readAcl(spec, "criterion-2-before").rules;
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
		assert.deepEqual(readAcl(spec, "criterion-2-after").rules, rulesBefore, "the held-out ACL changed, so the restriction was lifted");
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

	it("holds the invariant for the tree a held-out entry names, and not only for the entry itself", () => {
		// **The reading that found this, before it was fixed.** `/inheritance:r` on the root removes what a child
		// *inherited*, but an explicit ACE on a child survives it: with `plane\held-out-set` carrying
		// `Everyone:(OI)(CI)M` - the shape a copy tool or an installer can leave - `ensureBoundary` reported no
		// violation, the read never looked inside, and the constrained child wrote into that directory. A boundary
		// that reports green while the side it holds out is reachable is the failure this file exists against, and
		// the invariant is about the tree the declaration names, not about its top-level entry.
		const held = join(plane, "held-out-set");
		rmSync(held, { recursive: true, force: true });
		mkdirSync(held, { recursive: true });
		writeFileSync(join(held, "answer-key.txt"), "HELD OUT\n");
		const preseeded = runCommandLine(`icacls "${held}" /grant "*${DEFAULT_WORK_SID}:(OI)(CI)M"`);
		assert.equal(preseeded, 0, "the child grant has to exist before the boundary is set, or this case reads nothing");

		// **Set again rather than reasoned about, and the second run is idempotent** (measured: the two rule lists
		// come back equal), so this case can run after the others without moving the boundary they assert on.
		const report = ensureBoundary(spec, "tree-invariant");
		assert.deepEqual(report.violations, [], `setting the boundary failed: ${describeBoundary(report)}`);

		const childRules = readAcl({ ...spec, planePaths: [held], workPaths: [] }, "tree-invariant-readback").rules;
		const grants = childRules.filter((rule) => rule.type === "Allow" && rule.sid === DEFAULT_WORK_SID);
		assert.deepEqual(grants, [], "a child of the held-out tree still carries a work-SID grant, so the tree is reachable");

		// The invariant itself, and not only the ACL shape: the same constrained child that works on the writable
		// side must not be able to write here.
		const target = join(held, "from-child.txt");
		rmSync(target, { force: true });
		const write = launchJailed(spec, { command: `cmd.exe /c echo PROBE-INNER> "${target}"`, cwd: work, tag: "tree-invariant-write" });
		assert.equal(write.ok, true, `the mechanism did not report honestly: ${write.failure ?? ""}`);
		assert.notEqual(write.exitCode, 0, "the constrained child wrote into a child of the held-out tree");
		assert.equal(existsSync(target), false, "the constrained child wrote into a child of the held-out tree");
	});
});
