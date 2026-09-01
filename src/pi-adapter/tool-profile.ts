export type DoveToolProfile = "auto" | "core" | "full";

/** Hashline replaces the built-in edit authority while retaining read/grep names. */
export function hasHashlineEditTools(allToolNames: readonly string[]): boolean {
	const names = new Set(allToolNames);
	return names.has("replace") && names.has("insert");
}

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

/**
 * Resolve explicit compatibility profiles. Auto intentionally returns Pi's
 * complete supplied set and ignores legacy request arguments; the Pi adapter
 * does not call this function in Auto mode.
 */
export function selectDoveToolNames(
	allToolNames: readonly string[],
	profile: DoveToolProfile,
	_request?: unknown,
	_prompt = "",
	_contextHint = "",
): string[] {
	const unique = [...new Set(allToolNames)];
	if (profile !== "core") return unique;
	return unique.filter((name) => CORE_TOOL_NAMES.has(name));
}

export function parseDoveToolProfile(value: string | undefined): DoveToolProfile | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "auto" || normalized === "core" || normalized === "full") return normalized;
	return undefined;
}
