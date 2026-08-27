export type DoveToolProfile = "auto" | "core" | "full";

/** Hashline replaces the built-in edit authority while retaining read/grep names. */
export function hasHashlineEditTools(allToolNames: readonly string[]): boolean {
	const names = new Set(allToolNames);
	return names.has("replace") && names.has("insert");
}

const HASHLINE_EDIT_TOOL_NAMES = ["replace", "insert", "undo_last_change"] as const;

/**
 * Tools that are useful for ordinary coding and conversation. Third-party
 * extensions remain installed, but their larger schemas are not sent to the
 * model until the user explicitly asks for the full tool set.
 */
export const CORE_TOOL_NAMES = new Set([
	"read",
	"bash",
	"powershell",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"ask_user_question",
	"plan_mode_question",
	"plan_mode_complete",
	"agent_project_task",
	"agent_run_capability",
	"agent_list_capabilities",
	"agent_run_recipe",
	"agent_doctor",
	"agent_project_status",
	"agent_project_context",
	"agent_workspace_snapshot",
	"agent_workspace_verify",
	"agent_workspace_restore",
	"agent_workspace_patch",
]);

const INTENT_TOOL_NAMES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
	[/(browser|website|web page|网页|浏览器|网站|页面|截图|点击|登录页面)/i, ["agent_browser", "web_search", "source_check", "fetch_content", "get_search_content"]],
	[/(mcp|model context protocol)/i, ["mcp", "mcpScript"]],
	[/(?:\bplan(?:ning)?\b|计划|规划|只读方案|方案设计)/i, ["plan_mode_question", "plan_mode_complete"]],
	[/(lsp|ast-grep|ast grep|symbol|语法树|符号|诊断|diagnostic|lint|compile|build|test|debug|e2e|protocol|state machine|实现|修复|测试|调试|协议|状态机|\.(c|cc|cpp|h|hpp|go|rs|py|ts|tsx|js|jsx|java|cs|rb|php|swift|kt|kts)\b)/i, ["lens_diagnostics", "lsp_diagnostics", "symbol_search", "project_report", "module_report", "read_symbol", "read_enclosing", "pi_lens_activate_tools"]],
	[/(background|delegate|delegat(e|ion)|后台任务|委派|并行调查)/i, ["fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate", "bg_delegate", "bg_result", "bg_run", "bg_run_pi_attested", "bg_status", "bg_logs", "bg_kill"]],
];

export function selectDoveToolNames(allToolNames: readonly string[], profile: DoveToolProfile, prompt = "", contextHint = ""): string[] {
	const hashline = hasHashlineEditTools(allToolNames);
	if (profile === "full") return [...new Set(allToolNames)].filter((name) => !(hashline && name === "edit"));
	const selected = new Set(allToolNames.filter((name) => CORE_TOOL_NAMES.has(name)));
	if (hashline) {
		selected.delete("edit");
		for (const name of HASHLINE_EDIT_TOOL_NAMES) if (allToolNames.includes(name)) selected.add(name);
	}
	if (profile === "auto") {
		const intentText = `${prompt}\n${contextHint}`;
		for (const [intent, names] of INTENT_TOOL_NAMES) {
			if (intent.test(intentText)) for (const name of names) selected.add(name);
		}
	}
	return [...new Set(allToolNames.filter((name) => selected.has(name)))];
}

export function parseDoveToolProfile(value: string | undefined): DoveToolProfile | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "auto" || normalized === "core" || normalized === "full") return normalized;
	return undefined;
}
