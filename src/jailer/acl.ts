/**
 * The two boundary invariants, as ACL rules.
 *
 * **Invariant 1 - held out.** Every path in `planePaths` carries no grant for the work SID. Not "is in
 * another directory": the constrained process keeps whatever the work SID reaches, so a held-out path that
 * happens to be granted to that SID is reachable no matter where it lives.
 *
 * **Invariant 2 - writable.** Every path in `workPaths` carries an explicit grant for the work SID. Without
 * it the constrained process cannot do anything at all, and that failure is indistinguishable from a
 * functioning boundary unless it is checked separately - which is why it is a test and not a comment.
 *
 * **Setting is `icacls`; reading is structured.** Setting returns an exit code, which is all the caller
 * needs. Reading goes through the helper's `acl-read` verb and `Get-Acl`, because parsing the localised text
 * `icacls` prints would make the reading depend on the machine's display language.
 */

import { callHost, runCommandLine } from "./host.ts";
import { WELL_KNOWN_SID, type AceRule, type AclReport, type BoundarySpec } from "./types.ts";

function parseAceRules(payload: Record<string, unknown>): { rules: AceRule[]; missing: string[] } {
	const rules: AceRule[] = [];
	const missing: string[] = [];
	const raw = payload.rules;
	if (!Array.isArray(raw)) return { rules, missing };
	for (const entry of raw) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry as Record<string, unknown>;
		if (record.missing === true) {
			missing.push(String(record.path));
			continue;
		}
		rules.push({
			path: String(record.path),
			identity: String(record.identity),
			sid: String(record.sid ?? ""),
			rights: String(record.rights),
			type: String(record.type),
			inherited: record.inherited === true,
		});
	}
	return { rules, missing };
}

/** Read the access rules for every path a boundary cares about. */
export function readAcl(spec: BoundarySpec, tag = "acl"): AclReport {
	const paths = [...spec.planePaths, ...spec.workPaths];
	const reply = callHost(spec, { verb: "acl-read", paths }, tag);
	if (!reply.ok || reply.payload === undefined) {
		return { ok: false, rules: [], violations: [reply.failure ?? "the ACL read failed"], missing: [] };
	}
	const { rules, missing } = parseAceRules(reply.payload);
	return { ok: true, rules, violations: [], missing };
}

/** Check both invariants against a set of rules. Pure, so a test can drive it with fixtures. */
export function invariantViolations(spec: BoundarySpec, rules: readonly AceRule[], missing: readonly string[]): string[] {
	const violations: string[] = [];
	const workSid = spec.workSid;
	const grantsToWork = (path: string): AceRule[] =>
		rules.filter((rule) => rule.path === path && rule.type === "Allow" && rule.sid === workSid);

	for (const path of spec.planePaths) {
		if (missing.includes(path)) {
			violations.push(`held-out path does not exist, so nothing is held out: ${path}`);
			continue;
		}
		const granted = grantsToWork(path);
		if (granted.length > 0) {
			violations.push(`held-out path is granted to the work SID ${workSid}: ${path} (${granted.map((rule) => rule.rights).join(", ")})`);
		}
	}
	for (const path of spec.workPaths) {
		if (missing.includes(path)) {
			violations.push(`writable path does not exist, so the constrained process has nowhere to work: ${path}`);
			continue;
		}
		if (grantsToWork(path).length === 0) {
			violations.push(`writable path has no explicit grant for the work SID ${workSid}, so the constrained process cannot work here: ${path}`);
		}
	}
	return violations;
}

/** Set the boundary, then read it back and check it. Returns the report of the *check*, never of the set. */
export function ensureBoundary(spec: BoundarySpec, tag = "boundary"): AclReport {
	const failures: string[] = [];
	const owner = spec.ownerAccount;
	for (const path of spec.planePaths) {
		// No work-SID grant on the held-out side; the owner, SYSTEM and Administrators keep full control so a
		// person and the machine can still administer it.
		const code = runCommandLine(
			`icacls "${path}" /inheritance:r /grant:r "${owner}:(OI)(CI)F" "*${WELL_KNOWN_SID.system}:(OI)(CI)F" "*${WELL_KNOWN_SID.administrators}:(OI)(CI)F"`,
		);
		if (code !== 0) failures.push(`icacls failed (${String(code)}) on held-out path ${path}`);
		// **The invariant is about the tree the entry names, and this is the measured reason.** `/inheritance:r` on the
		// root removes what a child *inherited*, but an explicit ACE on a child survives it: with a child carrying
		// `Everyone:(OI)(CI)M` the check below reported no violation and the constrained process wrote into that child.
		// `/T` is what makes "no grant for the work SID" true of everything the declaration holds.
		// **What remains open, stated rather than implied**: the read below reads the declared paths, not their
		// contents, so a child that gains an explicit grant *after* this runs is not seen.
		const tree = runCommandLine(`icacls "${path}" /remove:g "*${spec.workSid}" /T`);
		if (tree !== 0) failures.push(`icacls /remove:g failed (${String(tree)}) under held-out path ${path}`);
	}
	for (const path of spec.workPaths) {
		const code = runCommandLine(
			`icacls "${path}" /inheritance:r /grant:r "${owner}:(OI)(CI)F" "*${WELL_KNOWN_SID.system}:(OI)(CI)F" "*${WELL_KNOWN_SID.administrators}:(OI)(CI)F" "*${spec.workSid}:(OI)(CI)M"`,
		);
		if (code !== 0) failures.push(`icacls failed (${String(code)}) on writable path ${path}`);
		// The same shape on the writable side, for the same reason and with the opposite symptom: an item under the
		// writable tree whose own ACE protects it keeps the work SID out, and the constrained process then cannot work
		// where the declaration says it can - a refusal that reads like a boundary instead of like a broken policy.
		const tree = runCommandLine(`icacls "${path}" /grant "*${spec.workSid}:(OI)(CI)M" /T`);
		if (tree !== 0) failures.push(`icacls /grant /T failed (${String(tree)}) under writable path ${path}`);
	}

	const read = readAcl(spec, tag);
	const violations = invariantViolations(spec, read.rules, read.missing);
	return { ok: failures.length === 0 && violations.length === 0, rules: read.rules, violations: [...failures, ...violations], missing: read.missing };
}

/** A human-readable one-line summary of the boundary, for a reading rather than for a decision. */
export function describeBoundary(report: AclReport): string {
	const allowed = report.rules.filter((rule) => rule.type === "Allow" && rule.sid === "S-1-1-0");
	return `rules=${String(report.rules.length)} everyone-allow=${String(allowed.length)} violations=${String(report.violations.length)} missing=${String(report.missing.length)}`;
}
