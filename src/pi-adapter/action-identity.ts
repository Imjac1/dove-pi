/**
 * What action a host tool call *is*, in the vocabulary a mode's permission list and its authority document use.
 *
 * **Why this exists, as a finding rather than a design preference.** A mode's `never_allow` names Dove actions
 * (`shell.exec`, `network.*`, `read_*`), while Pi names tools (`bash`, `read`, `edit`), and the umbrella
 * capability tool carries its real action in `args.name`. So evaluating the permission list against the *tool*
 * name matches nothing: `never_allow: [shell.exec]` never fires for `bash`, and every tool resolves to the
 * `ask` default - a control that reads as present and is inert.
 *
 * **One mapping, one place.** M2's conformance gate needs the same action to build its authority request from,
 * and two mappings of one concept is the failure this task exists to fix.
 */
export interface ActionIdentity {
	/** The action name a permission list or an authority document names. */
	readonly action: string;
	/** True when the action came from a capability invocation rather than from a direct host tool. */
	readonly viaCapability: boolean;
}

/** The one tool whose action is not its own name. */
export const CAPABILITY_TOOL = "agent_run_capability";

export function resolveActionIdentity(toolName: string, input: unknown): ActionIdentity {
	if (toolName !== CAPABILITY_TOOL) return { action: toolName, viaCapability: false };
	const name = (input as { name?: unknown } | undefined)?.name;
	if (typeof name === "string" && name.trim() !== "") return { action: name, viaCapability: true };
	// A capability call whose name cannot be read is not "no action": it is an action that cannot be named, and
	// a permission list cannot permit or deny what it cannot name. The sentinel keeps it inside the
	// `agent_run_capability.*` namespace, so a mode can still deny every capability invocation.
	return { action: `${CAPABILITY_TOOL}.<unnamed>`, viaCapability: true };
}
