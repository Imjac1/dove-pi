/**
 * Launching the improver under the boundary.
 *
 * **The structural constraint this module exists to keep**: the improver is launched *by the helper process*
 * and never by itself, so it can never be its own jailer. The `launchJailed` API enforces that shape - a
 * caller can only ask for a child, never for a token it could pass along.
 *
 * **What `ok` means here.** Not "the child succeeded" - a blocked write is a *success* for criterion 1 and
 * arrives as a non-zero exit code. `ok` means **the mechanism reported honestly and the token's restricting
 * list was verified**, i.e. the reading may be trusted. A caller that treats `ok` as "the child worked" will
 * read every refusal as a failure, which is the over-refusal failure mode this project measured at 88/120.
 */

import { callHost } from "./host.ts";
import type { BoundarySpec, LaunchReport, SelfCheck } from "./types.ts";

export interface LaunchRequest {
	/** A full `cmd.exe`-style command line, run by the constrained child. */
	readonly command: string;
	/** Working directory of the child. Must be inside a writable path for ordinary work to succeed. */
	readonly cwd: string;
	readonly timeoutMs?: number;
	readonly tag: string;
}

const SELF_CHECKS: readonly SelfCheck[] = ["pass", "empty-list", "mismatch", "unreadable"];

function asSelfCheck(value: unknown): SelfCheck {
	return typeof value === "string" && (SELF_CHECKS as readonly string[]).includes(value) ? (value as SelfCheck) : "unreadable";
}

export function launchJailed(spec: BoundarySpec, request: LaunchRequest): LaunchReport {
	const reply = callHost(
		spec,
		{
			verb: "run",
			restrictSids: [spec.workSid],
			command: request.command,
			cwd: request.cwd,
			timeoutMs: request.timeoutMs ?? 60_000,
		},
		request.tag,
	);

	const payload = reply.payload;
	if (payload === undefined) {
		return {
			ok: false,
			selfCheck: "unreadable",
			restrictingSids: [],
			expectedSids: [],
			raw: "",
			diag: "",
			failure: reply.failure ?? "no result",
			exitCode: -1,
			pid: 0,
			createProcessError: 0,
		};
	}

	const selfCheck = payload.ok === true ? asSelfCheck(payload.selfCheck) : "unreadable";
	const restrictings = Array.isArray(payload.restrictingSids) ? payload.restrictingSids.map((entry) => String(entry)) : [];
	return {
		ok: payload.ok === true && selfCheck === "pass",
		selfCheck,
		restrictingSids: restrictings,
		expectedSids: Array.isArray(payload.expectedSids) ? payload.expectedSids.map((entry) => String(entry)) : [],
		raw: String(payload.restrictingRaw ?? ""),
		diag: String(payload.diag ?? ""),
		...(selfCheck === "pass" ? {} : { failure: `self-check reported '${selfCheck}'` }),
		exitCode: Number(payload.exitCode ?? -1),
		pid: Number(payload.pid ?? 0),
		createProcessError: Number(payload.createProcessError ?? 0),
	};
}
