/**
 * The restricted token, and the self-check that makes its reading trustworthy.
 *
 * **`CreateRestrictedToken` returning true does not mean the restriction took effect.** An empty restricting
 * SID list looks exactly like a working boundary from the outside - the child simply starts and writes
 * wherever it is allowed, and a reader concludes "it blocked" from a file that was never created. So the
 * readback is part of this module's contract: `selfCheck` must be `pass`, and every caller fails closed
 * otherwise.
 *
 * The measured configurations (`.trellis/tasks/09-30-axi-a0-base/readings.md`, "A0.2 second half"):
 *   - restricting list = `Everyone` (S-1-1-0) -> the child starts and the boundary holds;
 *   - restricting list = `BUILTIN\Users` (S-1-5-32-545) -> the child dies at initialisation (0xC0000022),
 *     so that tier is not usable here. The reason is not diagnosed; it is recorded as a reading.
 */

import { callHost } from "./host.ts";
import type { BoundarySpec, SelfCheck, TokenReport } from "./types.ts";

const SELF_CHECKS: readonly SelfCheck[] = ["pass", "empty-list", "mismatch", "unreadable"];

function asSelfCheck(value: unknown): SelfCheck {
	return typeof value === "string" && (SELF_CHECKS as readonly string[]).includes(value) ? (value as SelfCheck) : "unreadable";
}

function asStrings(value: unknown): string[] {
	return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function toTokenReport(payload: Record<string, unknown> | undefined, failure: string | undefined): TokenReport {
	if (payload === undefined) {
		return { ok: false, selfCheck: "unreadable", restrictingSids: [], expectedSids: [], raw: "", diag: "", failure: failure ?? "no result" };
	}
	const selfCheck = payload.ok === true ? asSelfCheck(payload.selfCheck) : "unreadable";
	return {
		ok: payload.ok === true && selfCheck === "pass",
		selfCheck,
		restrictingSids: asStrings(payload.restrictingSids),
		expectedSids: asStrings(payload.expectedSids),
		raw: String(payload.restrictingRaw ?? ""),
		diag: String(payload.diag ?? ""),
		...(selfCheck === "pass" ? {} : { failure: failure ?? `self-check reported '${selfCheck}'` }),
	};
}

/** Create the restricted token and read its restricting SID list back. Nothing is launched. */
export function probeToken(spec: BoundarySpec, tag = "token"): TokenReport {
	const reply = callHost(spec, { verb: "probe", restrictSids: [spec.workSid] }, tag);
	return toTokenReport(reply.payload, reply.failure);
}
