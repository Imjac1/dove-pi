import type { GateDecision, GateInvocation, SynchronousActionGate } from "./loop.ts";
import { evaluateAuthority, type AuthorityDecision, type AuthorityDocument, type AuthorityRequest } from "./authority.ts";

/**
 * The **conformance** gate: allow iff the proposed action is inside the pre-established authority
 * contract, block otherwise.
 *
 * This is the semantics an authorized penetration test needs. NIST SP 800-115 defines Rules of
 * Engagement as granting authority *"without the need for additional permissions"* - so the gate is a
 * **contract checker**, not an approval prompt. What it stops is *deviation from the agreed scope*,
 * not *every action*.
 *
 * Contrast with {@link createLimitGate}: a limit gate blocks anything over a threshold, always. A
 * conformance gate allows everything the contract covers. A framework offering only one of the two
 * forces the other vertical to bypass it.
 *
 * **Fail-closed rules.** A mapping that cannot produce a request, a target that does not resolve, and
 * an evidence reference with no supplied digest are all **blocks**. An absent authority boundary is
 * never a permissive default.
 */
export interface ConformanceGateOptions {
	readonly document: AuthorityDocument;
	/**
	 * Map a proposed action to an authority request. Returning `undefined` is a **block**: the gate
	 * cannot tell whether the action is in scope, and "cannot tell" is not "allowed".
	 */
	readonly toRequest: (invocation: GateInvocation) => AuthorityRequest | undefined;
	readonly externalStateMaxAgeMs?: number;
}

function toDecision(decision: AuthorityDecision): GateDecision {
	if (decision.outcome === "allow") {
		return { outcome: "allow", reason: `Authorized by ${decision.grantIds.join(", ")}` };
	}
	return { outcome: "block", reason: decision.reason, remediation: decision.remediation };
}

export function createConformanceGate(options: ConformanceGateOptions): SynchronousActionGate {
	return {
		id: "conformance",
		evaluate(invocation: GateInvocation): GateDecision {
			let request: AuthorityRequest | undefined;
			try {
				request = options.toRequest(invocation);
			} catch (error) {
				return {
					outcome: "block",
					reason: `Could not derive an authority request from the ${invocation.tool} call: ${error instanceof Error ? error.message : String(error)}`,
					remediation: "Fix the action-to-request mapping. An unmappable action is never in scope.",
				};
			}
			if (request === undefined) {
				return {
					outcome: "block",
					reason: `The ${invocation.tool} call could not be mapped to an action and target, so its scope cannot be established.`,
					remediation: "Map this tool to an action and a target in the authority document before using it.",
				};
			}
			return toDecision(evaluateAuthority(options.document, request, { externalStateMaxAgeMs: options.externalStateMaxAgeMs }));
		},
	};
}
