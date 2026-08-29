import type { RequestIntent, RequestPlan } from "../core/request-plan.ts";

export type DoveToolProfile = "auto" | "core" | "full";

/** Hashline replaces the built-in edit authority while retaining read/grep names. */
export function hasHashlineEditTools(allToolNames: readonly string[]): boolean {
	const names = new Set(allToolNames);
	return names.has("replace") && names.has("insert");
}

const HASHLINE_EDIT_TOOL_NAMES = ["replace", "insert", "undo_last_change"] as const;

/** Explicit `core` is a compact, read-only inspection profile. */
export const CORE_TOOL_NAMES = new Set([
	"read",
	"grep",
	"find",
	"ls",
	"agent_list_capabilities",
	"agent_doctor",
	"agent_project_status",
	"agent_project_context",
	"agent_workspace_verify",
]);

const PROJECT_WORK_TOOL_NAMES = new Set([
	...CORE_TOOL_NAMES,
	"ask_user_question",
	"plan_mode_question",
	"plan_mode_complete",
	"lens_diagnostics",
	"lsp_diagnostics",
	"symbol_search",
	"project_report",
	"module_report",
	"read_symbol",
	"read_enclosing",
]);

const EXECUTION_TOOL_NAMES = new Set([
	...PROJECT_WORK_TOOL_NAMES,
	"bash",
	"powershell",
	"edit",
	"write",
	"agent_run_capability",
	"agent_run_recipe",
	"agent_project_task",
	"agent_workspace_snapshot",
	"agent_workspace_restore",
	"agent_workspace_patch",
]);

const WEB_PATTERN = /(browser|website|web page|网页|浏览器|网站|页面|截图|点击|登录页面)/i;
const MCP_PATTERN = /(mcp|model context protocol)/i;
const BACKGROUND_PATTERN = /(background|delegate|delegat(e|ion)|后台任务|委派|并行调查)/i;
const READ_ONLY_WEB_TOOL_NAMES = ["web_search", "source_check", "fetch_content", "get_search_content"] as const;
const MCP_TOOL_NAMES = ["mcp", "mcpScript"] as const;
const BACKGROUND_TOOL_NAMES = ["fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate", "bg_delegate", "bg_result", "bg_run", "bg_run_pi_attested", "bg_status", "bg_logs", "bg_kill"] as const;

function baseNamesForIntent(intent: RequestIntent): ReadonlySet<string> {
	switch (intent) {
		case "chat": return new Set();
		case "lookup": return CORE_TOOL_NAMES;
		case "project-work": return PROJECT_WORK_TOOL_NAMES;
		case "execution": return EXECUTION_TOOL_NAMES;
	}
}

/**
 * Select tools from the immutable request intent. Prompt matching is limited to
 * optional domains and can never promote a read-only request into a mutation
 * tier. `full` remains the user's explicit escape hatch.
 */
export function selectDoveToolNames(
	allToolNames: readonly string[],
	profile: DoveToolProfile,
	request: RequestIntent | Pick<RequestPlan, "intent" | "projectAction"> = "lookup",
	prompt = "",
	contextHint = "",
): string[] {
	const plan = typeof request === "string" ? { intent: request } : request;
	const intent = plan.intent;
	const hashline = hasHashlineEditTools(allToolNames);
	// The Pi request boundary has already resolved and injected the public
	// ProjectProvider continuation projection. Giving the model generic read or
	// search tools here would only reopen guessed-path archaeology.
	if (plan.projectAction === "continue") return [];
	if (profile === "full") return [...new Set(allToolNames)].filter((name) => !(hashline && name === "edit"));

	const selected = new Set(profile === "core" ? CORE_TOOL_NAMES : baseNamesForIntent(intent));
	if (profile === "auto" && intent !== "chat") {
		const domainText = `${prompt}\n${contextHint}`;
		if (WEB_PATTERN.test(domainText)) {
			for (const name of READ_ONLY_WEB_TOOL_NAMES) selected.add(name);
			// One agent_browser schema combines reading with click/fill/script and
			// its host does not enforce Dove's tier, so expose it only in Execution.
			if (intent === "execution") selected.add("agent_browser");
		}
		// Generic MCP dispatch can reach mutating server tools, so it is not a
		// read-only helper unless a future server-specific contract proves that.
		if (intent === "execution" && MCP_PATTERN.test(domainText)) for (const name of MCP_TOOL_NAMES) selected.add(name);
		if (intent === "execution" && BACKGROUND_PATTERN.test(domainText)) {
			for (const name of BACKGROUND_TOOL_NAMES) selected.add(name);
		}
	}

	if (profile === "auto" && intent === "execution" && hashline) {
		selected.delete("edit");
		for (const name of HASHLINE_EDIT_TOOL_NAMES) selected.add(name);
	}
	return [...new Set(allToolNames.filter((name) => selected.has(name)))];
}

export function parseDoveToolProfile(value: string | undefined): DoveToolProfile | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "auto" || normalized === "core" || normalized === "full") return normalized;
	return undefined;
}
