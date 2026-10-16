import type { CapabilityRegistry } from "./capability-registry.ts";
import type { RecipeRegistry } from "./recipe-registry.ts";

/**
 * **One question, asked in one place: what is this invocation?**
 *
 * Two consumers used to answer it separately, with two name tables and two vocabularies. The freeze gate asked
 * "is this a product mutation?" of a table of mutating tool names plus `isReadOnlyShellCommand`, and the replay path
 * asked "is this safe to replay?" of a different table of read-only tool names. Measured, they disagreed about the
 * same unknown tool: the gate treated a tool nobody declared as *not a mutation* (so it ran), while the replay path
 * treated the same tool as *not replay-safe* (so it refused). Two answers to one question, and nothing in the code
 * said which was intended.
 *
 * So this module answers once and lets each consumer read the part it needs. What is **not** collapsed is the
 * disagreement itself: `unknown` is returned as its own disposition, and each consumer decides separately what to
 * do about it, in its own words, at its own call site. Collapsing those decisions would have been a behaviour
 * change dressed as a refactor.
 *
 * **`replaySafe` answers the replay path's question, and its source is this repository's own name table** -
 * `DECLARED_TOOLS` below, whose entries carry `replaySafe` beside `readOnly` for every tool this build knows. It is
 * deliberately not `idempotent`: the question is not whether running a tool twice is harmless in general, but whether
 * *this* invocation can be re-issued from the record without deciding it again.
 *
 * **Earlier revisions of this paragraph said the name was borrowed from the host and held open for it** - from
 * `HarnessTool.replay` in `pi-agent-core`, so that adopting the host's vocabulary later would be a replacement rather
 * than a rewrite. Measured 2026-10-17 against the installed Pi `1.0.0`: none of the four `@earendil-works` packages
 * carries `HarnessTool` or a `replay` field, and `pi-agent-core` does not contain the string `harness` at all - so the
 * stub that sentence described is gone rather than changed. There is no host vocabulary to hold a place open for, and
 * none is claimed here. The name is this repository's, and this paragraph names the declaration it comes from rather
 * than a line number, because nothing walks the line numbers inside a source comment.
 */

/** What an invocation is, as far as this repository can tell before running it. */
export type InvocationDisposition = "read-only" | "mutating" | "unknown";

/**
 * What the answer rested on, which matters as much as the answer.
 *
 * `command-text` is the one to watch: it means the answer came from reading a shell command's text, which is enough
 * for a workflow gate and **never** enough to call an invocation replay-safe - three false positives are measured
 * below. A caller that wants to treat a `read-only` answer as authorization can therefore see, from the type,
 * whether the answer was strong enough to carry it.
 */
export type DispositionBasis = "name-table" | "command-text" | "declared";

export interface InvocationClassification {
	readonly disposition: InvocationDisposition;
	readonly replaySafe: boolean;
	readonly basis: DispositionBasis;
}

/**
 * **The one declaration table.** Each entry states both facts about a tool this repository has reviewed, so the gate
 * and the replay path cannot drift apart about it: a tool is listed here either because it only reads or because it
 * changes something, and the two facts are stated rather than derived from which of two tables the name appears in.
 *
 * A tool absent from this table is not assumed to be either: see `classifyInvocation`.
 */
const DECLARED_TOOLS: Readonly<Record<string, { readonly readOnly: boolean; readonly replaySafe: boolean; readonly network?: boolean }>> = {
	read: { readOnly: true, replaySafe: true },
	grep: { readOnly: true, replaySafe: true },
	find: { readOnly: true, replaySafe: true },
	ls: { readOnly: true, replaySafe: true },
	agent_list_capabilities: { readOnly: true, replaySafe: true },
	agent_doctor: { readOnly: true, replaySafe: true },
	agent_project_status: { readOnly: true, replaySafe: true },
	agent_project_context: { readOnly: true, replaySafe: true },
	agent_workspace_verify: { readOnly: true, replaySafe: true },
	lens_diagnostics: { readOnly: true, replaySafe: true },
	lsp_diagnostics: { readOnly: true, replaySafe: true },
	symbol_search: { readOnly: true, replaySafe: true },
	project_report: { readOnly: true, replaySafe: true },
	module_report: { readOnly: true, replaySafe: true },
	read_symbol: { readOnly: true, replaySafe: true },
	read_enclosing: { readOnly: true, replaySafe: true },
	web_search: { readOnly: true, replaySafe: true, network: true },
	source_check: { readOnly: true, replaySafe: true, network: true },
	fetch_content: { readOnly: true, replaySafe: true, network: true },
	get_search_content: { readOnly: true, replaySafe: true, network: true },
	write: { readOnly: false, replaySafe: false },
	edit: { readOnly: false, replaySafe: false },
	replace: { readOnly: false, replaySafe: false },
	insert: { readOnly: false, replaySafe: false },
	delete: { readOnly: false, replaySafe: false },
	mkdir: { readOnly: false, replaySafe: false },
	agent_workspace_patch: { readOnly: false, replaySafe: false },
	agent_workspace_restore: { readOnly: false, replaySafe: false },
};

/**
 * The host tools that reach the network through a **bridge**, so their reach is a fact this repository knows while their
 * disposition is one it has not decided.
 *
 * A tool that forwards to an MCP server or drives a browser can do anything the server or the page can, so there is no
 * honest `readOnly` to write for it: calling it read-only would let it through a gate that only admits reads, and calling
 * it mutating would put an MCP read behind the freeze gate. They are **not** in the disposition table for that reason, and
 * they are here so the network axis still covers them - the list they used to live in was a hand-maintained set inside
 * `action-policy.ts`, and the sandbox axis reading a second list is exactly how the two came to disagree.
 */
const NETWORK_BRIDGE_TOOLS: readonly { readonly name: string; readonly reason: string }[] = [
	{ name: "browser", reason: "drives a page, which can fetch and can act" },
	{ name: "agent_browser", reason: "the same, through the agent's own browser" },
	{ name: "mcp", reason: "forwards to an MCP server; what it reaches is the server's business" },
	{ name: "mcpScript", reason: "the same, through a script" },
];

/**
 * Every host tool name this repository knows can reach the network, from the one place that classifies host tools.
 *
 * **A view, not a list.** `action-policy.ts` carried its own `NETWORK_TOOLS` set of eight names while this file carried
 * four of them with different spellings of the same fact, and `tests/fixtures/representative-tool-catalog.ts` carried a
 * third set - three lists, no reconciliation, which is the defect the audit recorded against this axis. The sandbox's
 * `network: none` axis is a boundary claim, so it now reads the declaration instead of repeating it.
 */
export function declaredNetworkToolNames(): readonly string[] {
	const declared = Object.entries(DECLARED_TOOLS).filter(([, declaration]) => declaration.network === true).map(([toolName]) => toolName);
	return [...declared, ...NETWORK_BRIDGE_TOOLS.map((bridge) => bridge.name)];
}

// **The verification half of the list, and it was one language wide.** `go test` / `go vet` are here because
// verification has to be able to run before an acceptance contract is frozen, which is the intent the function's own
// doc states. Measured 2026-10-11, eleventh field run: the graded project is Python, the model's first act was to run
// its suite, and there was no Python entry - so the gate refused a *measurement* as a product mutation and ended the
// request, while the same command in Go would have been allowed. Only a test runner is admitted: `-m` names a module
// and the set is closed, so a server or a `-c` program stays a mutation.
const READ_ONLY_SHELL_SEGMENT = /^(?:(?:cd\s+(?:"[^"]*"|'[^']*'|\S+))|(?:env\s+)?(?:git(?:\s+-C\s+(?:"[^"]*"|'[^']*'|\S+))?\s+(?:status|log|diff|show|ls-files|rev-parse|branch|describe|remote|tag|blame|shortlog|cat-file)\b|go\s+(?:test|vet|list|version|env)\b|pytest\b|(?:python3?|py)\s+-m\s+(?:pytest|unittest)\b|(?:ls|dir|find|rg|grep|sed|awk|cat|head|tail|wc|pwd|echo|env|printenv)\b|(?:Get-ChildItem|Get-Content|Select-String|Test-Path)\b).*)$/i;
const READ_ONLY_SHELL_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:\$\?|\d+)$/;

/**
 * Shell is a general-purpose Pi tool, so its name alone cannot establish a product mutation. Keep the formal
 * mutation gate conservative while allowing common read-only inspection and verification commands to run before an
 * acceptance contract is frozen.
 *
 * **It answers the gate's question and only the gate's.** Its three measured false positives -
 * `git branch -D feature`, `find . -name '*.tmp' -delete` and `sed -n 'w out.txt' in.txt` all read as read-only -
 * are why a `command-text` answer is never allowed to claim replay safety: refusing to replay a read-only command is
 * harmless, replaying a mutation is not, and this pattern cannot tell them apart.
 */
export function isReadOnlyShellCommand(toolName: string, input: Readonly<Record<string, unknown>>): boolean {
	if (toolName !== "bash" && toolName !== "powershell") return false;
	const command = typeof input.command === "string" ? input.command : typeof input.script === "string" ? input.script : undefined;
	if (!command?.trim()) return false;
	const normalized = command
		.replace(/\s+\d?>&\d+/g, "")
		.replace(/\s+\d?>\s*(?:\/dev\/null|nul|\$null|(?:\/tmp\/|\/var\/tmp\/|\$TEMP[\\/]|%TEMP%[\\/]|\$env:TEMP[\\/])[^\s;|&]+)/gi, "")
		.replace(/\s+\d?<\s*(?:\/tmp\/|\/var\/tmp\/|\$TEMP[\\/]|%TEMP%[\\/]|\$env:TEMP[\\/])[^\s;|&]+/gi, "")
		.trim();
	if (/[<>]/.test(normalized)) return false;
	if (/\b(?:rm|del|erase|mv|move|cp|copy|mkdir|rmdir|touch|tee|sed\s+-i|Set-Content|Out-File|Add-Content|Remove-Item|Move-Item|Copy-Item|New-Item|git\s+(?:apply|checkout|reset|clean|restore|commit|merge|rebase|switch|add|rm)|git\s+diff\b[^;|]*--output(?:=|\s)|npm\s+(?:install|ci)|go\s+(?:generate|env\s+-w))\b/i.test(normalized)) return false;
	const segments = normalized.split(/(?<!\\)\s*(?:&&|\|\||[;|])\s*/).map((segment) => segment.trim()).filter(Boolean);
	return segments.length > 0 && segments.every((segment) => READ_ONLY_SHELL_SEGMENT.test(segment) || READ_ONLY_SHELL_ASSIGNMENT.test(segment));
}

export interface Invocation {
	readonly toolName: string;
	readonly input: Readonly<Record<string, unknown>>;
	readonly registry: CapabilityRegistry;
	readonly recipes: RecipeRegistry;
}

/**
 * The name-only reading of the same table, for the consumer that has no invocation to classify: the character budget
 * for a model-facing tool result is decided from the tool name alone. It reads the one table rather than a second
 * list of the same names, so the two cannot drift; `undefined` means the tool is not declared here at all.
 */
export function declaredReadOnly(toolName: string): boolean | undefined {
	return DECLARED_TOOLS[toolName]?.readOnly;
}

/**
 * The names the one table declares as product mutations, for the consumer that keeps its own list of them.
 *
 * `FENCE_MUTATION_TOOLS` in `action-policy.ts` is the union of the policy's filesystem mutators and this repository's
 * product-mutation names, maintained by hand because `core` takes no Pi imports. `tests/fence-drift.test.ts` is the
 * coupling that fails when the two drift apart, and it used to read the second set as a second exported set. It reads
 * this view instead, so the fence is compared against the declaration table rather than against a copy of it.
 */
export function declaredMutatingToolNames(): readonly string[] {
	return Object.entries(DECLARED_TOOLS).filter(([, declaration]) => !declaration.readOnly).map(([toolName]) => toolName);
}

/**
 * Classify one tool invocation. Both consumers call this and read different fields of the answer.
 *
 * **`unknown` is a real answer, not a failure.** It means the invocation names nothing this repository can evaluate:
 * a tool in neither table, a capability whose name the registry does not hold, a capability or recipe invocation that
 * does not name its target at all, or a shell command whose text cannot be read. What to do about that is the
 * caller's decision, and the two callers decide differently on purpose:
 *
 * - The freeze gate **admits** an unknown tool. It is a workflow gate over a formal task, not a second Pi tool
 *   permission firewall (`personal-agent-framework-core.md`), so an undeclared tool is not a product mutation and
 *   does not need frozen acceptance criteria to run. It is no longer silent about it either: it names the tool.
 * - The replay path **refuses** to call an unknown tool replay-safe. Its question is the opposite one - not "may this
 *   run" but "may this run twice" - and an undeclared side effect that runs twice is exactly the failure it exists to
 *   prevent. Being wrong in this direction costs a recorded effect; being wrong in the other costs a duplicated one.
 *
 * **One asymmetry is preserved rather than tidied**, because it is pre-existing and deliberate: a named capability
 * the registry does not hold classifies as `unknown` (its `sideEffects` are simply absent, which the gate reads as
 * "not a mutation"), while a named recipe the registry cannot read classifies as `mutating` (its loader throws, and
 * the gate fails closed). `tests/invocation-disposition.test.ts` asserts both, so a later reader meets the difference
 * as a decision instead of as an accident.
 */
export function classifyInvocation(invocation: Invocation): InvocationClassification {
	const { toolName, input, registry, recipes } = invocation;
	if (toolName === "bash" || toolName === "powershell") {
		return {
			disposition: isReadOnlyShellCommand(toolName, input) ? "read-only" : "mutating",
			replaySafe: false,
			basis: "command-text",
		};
	}
	if (toolName === "agent_run_capability") {
		const name = typeof input.name === "string" ? input.name : undefined;
		const declared = name === undefined ? undefined : registry.get(name);
		if (declared === undefined) return { disposition: "unknown", replaySafe: false, basis: "declared" };
		return {
			disposition: declared.sideEffects.some((effect) => effect !== "read_only") ? "mutating" : "read-only",
			replaySafe: declared.idempotent === true,
			basis: "declared",
		};
	}
	if (toolName === "agent_run_recipe") {
		const name = typeof input.name === "string" ? input.name : undefined;
		if (name === undefined) return { disposition: "unknown", replaySafe: false, basis: "declared" };
		let steps: readonly { readonly capability: string }[];
		try {
			steps = recipes.require(name).steps;
		} catch {
			// The declaration exists but cannot be read. Fail closed on both answers: this is the one place where
			// `unknown` is not the honest classification, because the gate's older reading of an unreadable recipe was
			// already "treat it as a mutation".
			return { disposition: "mutating", replaySafe: false, basis: "declared" };
		}
		return {
			disposition: steps.some((step) => registry.get(step.capability)?.sideEffects.some((effect) => effect !== "read_only")) ? "mutating" : "read-only",
			replaySafe: steps.every((step) => registry.get(step.capability)?.idempotent === true),
			basis: "declared",
		};
	}
	const declared = DECLARED_TOOLS[toolName];
	if (declared === undefined) return { disposition: "unknown", replaySafe: false, basis: "name-table" };
	return { disposition: declared.readOnly ? "read-only" : "mutating", replaySafe: declared.replaySafe, basis: "name-table" };
}
