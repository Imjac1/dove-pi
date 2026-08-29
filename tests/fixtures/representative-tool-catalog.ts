/** Representative installed Pi catalog captured by the middleware E2E probe. */
export const representativeTools = [
	"read", "grep", "find", "ls", "bash", "powershell", "edit", "write", "replace", "insert", "undo_last_change",
	"ask_user_question", "plan_mode_question", "plan_mode_complete",
	"agent_run_capability", "agent_list_capabilities", "agent_run_recipe", "agent_doctor", "agent_project_status", "agent_project_context", "agent_project_task",
	"agent_workspace_snapshot", "agent_workspace_verify", "agent_workspace_restore", "agent_workspace_patch",
	"agent_browser", "web_search", "source_check", "fetch_content", "get_search_content", "mcp", "mcpScript",
	"lens_diagnostics", "lsp_diagnostics", "symbol_search", "project_report", "module_report", "read_symbol", "read_enclosing", "pi_lens_activate_tools",
	"fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate", "bg_delegate", "bg_result", "bg_run", "bg_run_pi_attested", "bg_status", "bg_logs", "bg_kill",
	"third_party_write", "third_party_shell", "third_party_restore", "third_party_patch", "third_party_task_mutate", "third_party_unknown",
] as const;

export const representativeMutationTools = new Set([
	"bash", "powershell", "edit", "write", "replace", "insert", "undo_last_change",
	"agent_run_capability", "agent_run_recipe", "agent_project_task", "agent_workspace_snapshot", "agent_workspace_restore", "agent_workspace_patch",
	"third_party_write", "third_party_shell", "third_party_restore", "third_party_patch", "third_party_task_mutate",
]);
