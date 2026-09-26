/**
 * What action a host tool call *is*, in the vocabulary a mode's permission list and its authority document use.
 *
 * **Why this exists, as a finding rather than a design preference.** A mode's `never_allow` names Dove actions
 * (`shell.exec`, `network.*`, `report.write`), while Pi names tools (`bash`, `read`, `edit`), and the umbrella
 * capability tool carries its real action in `args.name`. So evaluating the permission list against the *tool*
 * name matches nothing: `never_allow: [shell.exec]` never fires for `bash`, no tool resolves to the action the
 * list names, and the control reads as present while being inert.
 *
 * The examples are names that resolve. A permission list is matched against action names, so an entry that is
 * not one - `read_*`, which matches neither the `repo.read` capability nor the host's `read` tool - is a
 * declaration that grants or denies nothing while looking like both.
 *
 * **One mapping, one place.** M2's conformance gate needs the same action to build its authority request from,
 * and two mappings of one concept is the failure this task exists to fix.
 */
export interface ActionIdentity {
	/** The action name a permission list or an authority document names. */
	readonly action: string;
	/**
	 * The arguments a policy should read. **A capability's own arguments, not the envelope that carries them**:
	 * a mode declares a limit as a path into the action's payload (`order.notional`), and the envelope's shape
	 * (`{name, args}`) is the transport's business rather than the action's.
	 */
	readonly arguments: unknown;
	/** True when the action came from a capability invocation rather than from a direct host tool. */
	readonly viaCapability: boolean;
}

/** The one tool whose action is not its own name. */
export const CAPABILITY_TOOL = "agent_run_capability";

export function resolveActionIdentity(toolName: string, input: unknown): ActionIdentity {
	if (toolName !== CAPABILITY_TOOL) return { action: toolName, arguments: input, viaCapability: false };
	const envelope = input as { name?: unknown; args?: unknown } | undefined;
	// A capability call with no arguments is an empty payload, not an absent one: a limit that reads into it must
	// find nothing and say so, rather than the policy being skipped.
	const args = envelope?.args ?? {};
	const name = envelope?.name;
	if (typeof name === "string" && name.trim() !== "") return { action: name, arguments: args, viaCapability: true };
	// A capability call whose name cannot be read is not "no action": it is an action that cannot be named, and
	// a permission list cannot permit or deny what it cannot name. The sentinel keeps it inside the
	// `agent_run_capability.*` namespace, so a mode can still deny every capability invocation.
	return { action: `${CAPABILITY_TOOL}.<unnamed>`, arguments: args, viaCapability: true };
}
