/**
 * Plane B enforcement, public surface.
 *
 * A caller uses three things and nothing else: `ensureBoundary` (set and check the ACL invariants),
 * `probeToken` (create the restricted token and verify its restricting list), and `launchJailed` (start the
 * improver under that token). Everything else here exists so those three can be read.
 */

export {
	DEFAULT_WORK_SID,
	WELL_KNOWN_SID,
	type AceRule,
	type AclReport,
	type BoundarySpec,
	type LaunchReport,
	type SelfCheck,
	type TokenReport,
} from "./types.ts";

export { describeBoundary, ensureBoundary, invariantViolations, readAcl } from "./acl.ts";
export { probeToken } from "./token.ts";
export { launchJailed, type LaunchRequest } from "./launch.ts";
export { callHost, powershellPath, runCommandLine } from "./host.ts";
