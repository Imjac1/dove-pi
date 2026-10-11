/**
 * Plane B enforcement: the contract, as types.
 *
 * **What this module is for.** The improver must not be able to write the held-out side, nor to lift that
 * restriction. The mechanism is measured rather than assumed: a process launched with a **restricted token**
 * reaches only what its restricting SID list reaches. The reading behind it (three criteria, plus the
 * positive control that keeps "it blocked" from being confused with "the probe was blind") is in
 * `.trellis/tasks/09-30-axi-a0-base/readings.md`, section "A0.2 second half".
 *
 * **Division of labour.** The *policy* lives here in TypeScript (which paths, which SID, when to refuse);
 * the *mechanism* lives in `src/windows-runtime/jailer-host.ps1` (CreateRestrictedToken / CreateProcessAsUser / a
 * structured ACL read). Swapping the mechanism must not move the policy, which is why nothing in this file
 * knows how a token is created.
 *
 * **Two invariants, and they are ACL rules rather than a directory choice.**
 *   1. every held-out path carries **no** grant for the work SID;
 *   2. every writable path carries one **explicitly**.
 * The second is not decoration: without it the constrained process cannot do anything, which reads as a
 * refusal instead of as a broken policy.
 */

/** The restricting SID the improver is left with. `S-1-1-0` = Everyone, measured as the usable tier. */
export const DEFAULT_WORK_SID = "S-1-1-0";

export const WELL_KNOWN_SID = {
	everyone: "S-1-1-0",
	system: "S-1-5-18",
	administrators: "S-1-5-32-544",
	users: "S-1-5-32-545",
} as const;

export interface BoundarySpec {
	/** Held out: the improver's token must not reach these. */
	readonly planePaths: readonly string[];
	/** Writable: the improver works here, so these must be granted to the work SID explicitly. */
	readonly workPaths: readonly string[];
	readonly workSid: string;
	/** Absolute path of `src/windows-runtime/jailer-host.ps1`. */
	readonly hostScript: string;
	/** Directory the request/result files are written to (the helper speaks files, not stdout). */
	readonly scratchDir: string;
	/** The account that owns the boundary (`DOMAIN\user`), granted full control on both sides. */
	readonly ownerAccount: string;
}

/** One access rule as the helper reads it. `inherited` matters: an inherited grant is a live change to rule. */
export interface AceRule {
	readonly path: string;
	readonly identity: string;
	readonly sid: string;
	readonly rights: string;
	readonly type: "Allow" | "Deny" | string;
	readonly inherited: boolean;
}

export interface AclReport {
	readonly ok: boolean;
	readonly rules: readonly AceRule[];
	/** Rule violations of the two invariants. Empty means the boundary holds as declared. */
	readonly violations: readonly string[];
	/** Paths that do not exist, named rather than silently skipped. */
	readonly missing: readonly string[];
	/**
	 * Command failures from the set, kept apart from rule violations, because they are different readings: a machine that
	 * could not apply the ACLs at all is a machine the boundary cannot be tested on, while a boundary that was applied and
	 * then violated is the regression `tests/jailer.test.ts` exists to catch. `violations` carries both, concatenated, for
	 * a caller that only wants to know whether the boundary holds; this field is what lets a caller tell them apart.
	 */
	readonly setupFailures: readonly string[];
}

/** The instrument self-check, as data rather than a comment: `pass` is the only acceptable value. */
export type SelfCheck = "pass" | "empty-list" | "mismatch" | "unreadable";

export interface TokenReport {
	readonly ok: boolean;
	readonly selfCheck: SelfCheck;
	readonly restrictingSids: readonly string[];
	readonly expectedSids: readonly string[];
	readonly raw: string;
	readonly diag: string;
	/** Set when the helper itself could not report - the token may then be anything. */
	readonly failure?: string;
}

export interface LaunchReport extends TokenReport {
	readonly exitCode: number;
	readonly pid: number;
	/** 0 on success; a Win32 error code when `CreateProcessAsUser` refused. */
	readonly createProcessError: number;
}
