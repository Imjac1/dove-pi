/**
 * Capability scoping (design sections 2.1 and 4.3).
 *
 * This is the strongest *measured* control in the whole evidence base. The root vulnerability of
 * prompt injection is **ambient authority** - *"naming a resource is sufficient to act on it"*
 * (arXiv 2609.08371, "Authority Is Not a String"). The measurement: an injected effect executes in
 * **33-47 of 75 runs** under ambient-authority and global-policy baselines, and in **3 of 75** under
 * capability scoping, at roughly no task cost.
 *
 * Three properties carry that result, and all three are enforced here rather than documented:
 *
 * 1. **The ceiling is derived from trusted input, before untrusted content is read.** A scope computed
 *    after reading a repository has already been influenced by it.
 * 2. **The capability set is stored outside the model's context.** Nothing in this module renders
 *    capabilities into prompt text, and there is no accessor that would let a caller do so by accident.
 *    A capability the model can read is a capability the model can be persuaded to describe.
 * 3. **A check is made against the capabilities of the *issuing* agent.** A capability granted to one
 *    agent is not available to another, so a delegated subagent cannot borrow its parent's authority.
 *
 * A fourth rule follows from the delegation requirement: **a delegate may narrow its authority, never
 * widen it.** Anything that cannot be decided as narrowing is refused, because a guess in this
 * direction is a privilege escalation.
 */

export interface Capability {
	/** Typed identity, e.g. `repo.read`, `file.write`, `order.submit`. */
	readonly id: string;
	/** Optional resource restriction. Absent means the capability is unrestricted for its id. */
	readonly resource?: string;
	readonly expiresAt?: string;
}

export interface AgentCapabilitySet {
	readonly agentId: string;
	readonly capabilities: readonly Capability[];
}

export type CapabilityDecision =
	| { readonly outcome: "allow"; readonly capability: string }
	| { readonly outcome: "deny"; readonly reason: string; readonly remediation: string };

export interface CapabilityRequest {
	readonly agentId: string;
	readonly capability: string;
	readonly resource?: string;
}

export interface CapabilityScopeOptions {
	readonly sets: readonly AgentCapabilitySet[];
	readonly now?: () => string;
}

export class CapabilityWideningError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CapabilityWideningError";
	}
}

export interface CapabilityScope {
	authorize(request: CapabilityRequest): CapabilityDecision;
	capabilitiesOf(agentId: string): readonly Capability[];
	/** Derive a child's set from a parent's. Refuses anything it cannot decide is a narrowing. */
	narrow(parentAgentId: string, child: AgentCapabilitySet): AgentCapabilitySet;
}

function deny(reason: string, remediation: string): CapabilityDecision {
	return { outcome: "deny", reason, remediation };
}

/**
 * The resource pattern language, deliberately small enough to decide safely:
 *
 * - an exact string matches only itself;
 * - `P/**` matches `P` and anything beneath it.
 *
 * Full globs are **not** supported. Deciding containment between two arbitrary globs is where a
 * containment check silently starts guessing, and a guess in this direction is a privilege
 * escalation - so an unrecognised pattern is refused rather than interpreted.
 */
function isPrefixPattern(pattern: string): boolean {
	return pattern.endsWith("/**");
}

function matches(pattern: string, resource: string): boolean {
	if (!isPrefixPattern(pattern)) return pattern === resource;
	const prefix = pattern.slice(0, -3);
	return resource === prefix || resource.startsWith(`${prefix}/`);
}

/** Whether every resource the child could name is already nameable by the parent. */
function covers(parent: Capability, child: Capability): boolean {
	if (parent.id !== child.id) return false;
	// An unrestricted parent may be narrowed by giving the child a resource.
	if (parent.resource === undefined) return true;
	if (child.resource === undefined) return false;
	if (parent.resource === child.resource) return true;
	// `P/**` covers `C/**` or a concrete resource under P, when C is P or below it.
	if (isPrefixPattern(parent.resource)) {
		const parentPrefix = parent.resource.slice(0, -3);
		const childPrefix = isPrefixPattern(child.resource) ? child.resource.slice(0, -3) : child.resource;
		return childPrefix === parentPrefix || childPrefix.startsWith(`${parentPrefix}/`);
	}
	return false;
}

export function createCapabilityScope(options: CapabilityScopeOptions): CapabilityScope {
	const now = options.now ?? (() => new Date().toISOString());
	const byAgent = new Map<string, readonly Capability[]>();
	for (const set of options.sets) byAgent.set(set.agentId, set.capabilities);

	return {
		authorize(request) {
			const capabilities = byAgent.get(request.agentId);
			if (capabilities === undefined) {
				return deny(
					`Agent '${request.agentId}' has no capability set, so it holds no authority.`,
					"Grant the agent an explicit capability set. An unknown agent is never authorized.",
				);
			}
			const at = Date.parse(now());
			for (const capability of capabilities) {
				if (capability.id !== request.capability) continue;
				if (capability.expiresAt !== undefined) {
					const expiry = Date.parse(capability.expiresAt);
					if (!Number.isFinite(expiry) || expiry <= at) continue;
				}
				if (capability.resource === undefined) return { outcome: "allow", capability: capability.id };
				if (request.resource !== undefined && matches(capability.resource, request.resource)) {
					return { outcome: "allow", capability: capability.id };
				}
			}
			const held = capabilities.filter((c) => c.id === request.capability).map((c) => c.resource ?? "*");
			return deny(
				held.length === 0
					? `Agent '${request.agentId}' does not hold capability '${request.capability}'.`
					: `Agent '${request.agentId}' holds '${request.capability}' but not for resource '${request.resource ?? "(none given)"}' (held: ${held.join(", ")}).`,
				"Grant this capability for this resource through the mode's authority declaration, or choose an action the agent already holds.",
			);
		},
		capabilitiesOf(agentId) {
			return byAgent.get(agentId) ?? [];
		},
		narrow(parentAgentId, child) {
			const parent = byAgent.get(parentAgentId);
			if (parent === undefined) {
				throw new CapabilityWideningError(`Cannot narrow from unknown agent '${parentAgentId}'.`);
			}
			for (const capability of child.capabilities) {
				const covered = parent.some((candidate) => covers(candidate, capability));
				if (!covered) {
					throw new CapabilityWideningError(
						`Agent '${child.agentId}' requests capability '${capability.id}'${capability.resource === undefined ? "" : ` on '${capability.resource}'`}, which '${parentAgentId}' does not hold. A delegate may narrow its authority, never widen it.`,
					);
				}
			}
			byAgent.set(child.agentId, child.capabilities);
			return child;
		},
	};
}
