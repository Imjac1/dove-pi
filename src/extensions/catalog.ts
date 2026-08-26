export type ExtensionProfile = "minimal" | "dev" | "research" | "security" | "max";
export type ExtensionPlatform = "windows" | "cross-platform" | "unknown";

export interface ExtensionPackageDefinition {
	readonly id: string;
	readonly packageName: string;
	readonly installSpec: string;
	readonly currentVersion: string;
	readonly description: string;
	readonly platform: ExtensionPlatform;
	readonly profiles: readonly ExtensionProfile[];
	readonly minPi?: string;
	readonly minNode?: string;
	readonly requiredExecutables?: readonly string[];
	readonly conflicts?: readonly string[];
	readonly loadAfter?: readonly string[];
	readonly risk: "low" | "medium" | "high";
	readonly notes?: string;
}

export const EXTENSION_CATALOG: readonly ExtensionPackageDefinition[] = [
	{
		id: "extension-settings",
		packageName: "@juanibiapina/pi-extension-settings",
		installSpec: "npm:@juanibiapina/pi-extension-settings",
		currentVersion: "0.9.1",
		description: "Centralized settings UI for Pi extensions",
		platform: "cross-platform",
		profiles: ["minimal", "dev", "research", "security", "max"],
		minPi: "0.75.0",
		minNode: "20.0.0",
		risk: "low",
		notes: "Load before extensions that register settings.",
	},
	{
		id: "open-tui",
		packageName: "pi-open-tui",
		installSpec: "npm:pi-open-tui",
		currentVersion: "0.2.15",
		description: "Adaptive TUI footer with context, tokens, TPS, TTFT, cost, Git, and extension status",
		platform: "cross-platform",
		profiles: ["minimal", "dev", "research", "security", "max"],
		minPi: "0.80.0",
		minNode: "20.0.0",
		loadAfter: ["extension-settings"],
		risk: "medium",
		notes: "Preferred single TUI authority; uses provider-reported usage and has Nerd Font plus ASCII fallback. Refreshes telemetry at about 1 Hz.",
	},
	{
		id: "powerbar",
		packageName: "@juanibiapina/pi-powerbar",
		installSpec: "npm:@juanibiapina/pi-powerbar",
		currentVersion: "0.14.0",
		description: "Lightweight persistent bottom status bar (open-tui fallback)",
		platform: "cross-platform",
		profiles: [],
		minPi: "0.75.0",
		minNode: "20.0.0",
		loadAfter: ["extension-settings"],
		conflicts: ["open-tui", "powerline-footer", "tps-status"],
		risk: "low",
		notes: "Optional fallback only; do not load together with another footer/TUI renderer.",
	},
	{
		id: "powerline-footer",
		packageName: "pi-powerline-footer",
		installSpec: "npm:pi-powerline-footer",
		currentVersion: "0.16.0",
		description: "Alternative powerline footer renderer",
		platform: "cross-platform",
		profiles: [],
		minPi: "0.80.0",
		conflicts: ["open-tui", "powerbar", "tps-status"],
		risk: "medium",
		notes: "Optional alternative; not part of Dove Pi defaults because it takes over footer rendering.",
	},
	{
		id: "tps-status",
		packageName: "pi-tps-status",
		installSpec: "npm:pi-tps-status",
		currentVersion: "1.0.5",
		description: "Provider-reconciled token-per-second status indicator",
		platform: "cross-platform",
		profiles: [],
		minPi: "0.80.0",
		conflicts: ["open-tui", "powerbar", "powerline-footer"],
		risk: "low",
		notes: "Use only as a TPS-focused fallback when open-tui is unavailable.",
	},
	{
		id: "raw-paste",
		packageName: "@tmustier/pi-raw-paste",
		installSpec: "npm:@tmustier/pi-raw-paste",
		currentVersion: "0.1.3",
		description: "One-shot raw paste command",
		platform: "cross-platform",
		profiles: ["minimal", "dev", "research", "security", "max"],
		minPi: "0.75.0",
		risk: "low",
	},
	{
		id: "caffeinate",
		packageName: "@narumitw/pi-caffeinate",
		installSpec: "npm:@narumitw/pi-caffeinate",
		currentVersion: "0.49.5",
		description: "Keep the computer awake while Pi runs",
		platform: "cross-platform",
		profiles: ["minimal", "dev", "research", "security", "max"],
		minPi: "0.80.0",
		risk: "medium",
		notes: "Uses PowerShell SetThreadExecutionState on Windows.",
	},
	{
		id: "hashline-edit",
		packageName: "pi-hashline-edit-pro",
		installSpec: "npm:pi-hashline-edit-pro",
		currentVersion: "2.7.0",
		description: "Hash-anchored read and edit tools",
		platform: "cross-platform",
		profiles: ["dev"],
		minPi: "0.75.0",
		minNode: "22.19.0",
		risk: "medium",
		notes: "Replaces built-in read/edit; enable only after a canary check.",
	},
	{
		id: "pi-lsp",
		packageName: "@narumitw/pi-lsp",
		installSpec: "npm:@narumitw/pi-lsp",
		currentVersion: "0.49.5",
		description: "Targeted language-server diagnostics and fixes",
		platform: "cross-platform",
		profiles: ["dev", "max"],
		minPi: "0.80.0",
		risk: "medium",
		notes: "Starts language servers on demand; configure servers separately.",
	},
	{
		id: "cache-optimizer",
		packageName: "pi-cache-optimizer",
		installSpec: "npm:pi-cache-optimizer",
		currentVersion: "2.8.6",
		description: "Prompt and provider cache optimization",
		platform: "cross-platform",
		profiles: ["dev", "max"],
		minPi: "0.82.0",
		risk: "medium",
		notes: "The fix command changes models.json only after explicit confirmation.",
	},
	{
		id: "mcp-adapter",
		packageName: "pi-mcp-adapter",
		installSpec: "npm:pi-mcp-adapter",
		currentVersion: "2.27.0",
		description: "Lazy, token-efficient MCP discovery",
		platform: "cross-platform",
		profiles: ["research", "security", "max"],
		minPi: "0.84.1",
		minNode: "20.0.0",
		risk: "high",
		notes: "Keep MCP servers disabled until explicitly needed and scoped.",
	},
	{
		id: "web-access",
		packageName: "pi-web-access",
		installSpec: "npm:pi-web-access",
		currentVersion: "0.24.2",
		description: "Web search and content extraction",
		platform: "cross-platform",
		profiles: ["research", "max"],
		minPi: "0.80.0",
		risk: "high",
		notes: "External network access; apply SSRF, scope, and data-handling policy.",
	},
	{
		id: "agent-browser-native",
		packageName: "pi-agent-browser-native",
		installSpec: "npm:pi-agent-browser-native",
		currentVersion: "0.5.0",
		description: "Native browser automation tool",
		platform: "cross-platform",
		profiles: ["security", "max"],
		minPi: "0.80.0",
		minNode: "22.19.0",
		risk: "high",
		notes: "Browser sessions and authenticated targets require explicit scope.",
	},
	{
		id: "ask-user-question",
		packageName: "@juicesharp/rpiv-ask-user-question",
		installSpec: "npm:@juicesharp/rpiv-ask-user-question",
		currentVersion: "2.7.1",
		description: "Structured questions instead of model guessing",
		platform: "cross-platform",
		profiles: ["dev", "research", "security", "max"],
		minPi: "0.80.0",
		risk: "low",
	},
	{
		id: "plan-mode",
		packageName: "@narumitw/pi-plan-mode",
		installSpec: "npm:@narumitw/pi-plan-mode",
		currentVersion: "0.55.0",
		description: "Read-only plan collaboration mode",
		platform: "windows",
		profiles: ["max"],
		minPi: "0.80.6",
		minNode: "20.0.0",
		risk: "medium",
		notes: "Native PowerShell inspection requires Pi 0.84.3 or newer.",
	},
	{
		id: "lens",
		packageName: "pi-lens",
		installSpec: "npm:pi-lens",
		currentVersion: "4.1.2",
		description: "LSP, lint, formatting, and structural feedback pipeline",
		platform: "cross-platform",
		profiles: ["max"],
		minPi: "0.84.1",
		minNode: "20.0.0",
		conflicts: ["pi-lsp"],
		risk: "high",
		notes: "Heavier than targeted pi-lsp; may run checks after edits.",
	},
	{
		id: "background-tasks",
		packageName: "pi-background-tasks",
		installSpec: "npm:pi-background-tasks",
		currentVersion: "2.4.2",
		description: "Durable background jobs and delegated investigations",
		platform: "cross-platform",
		profiles: ["max"],
		minPi: "0.84.0",
		minNode: "22.19.0",
		risk: "high",
		notes: "Use only through a Dove Pi dispatch adapter.",
	},
	{
		id: "rtk-optimizer",
		packageName: "pi-rtk-optimizer",
		installSpec: "npm:pi-rtk-optimizer",
		currentVersion: "0.9.0",
		description: "RTK command rewriting and output compaction",
		platform: "cross-platform",
		profiles: [],
		minPi: "0.74.0",
		requiredExecutables: ["rtk"],
		risk: "medium",
		notes: "Published peer range stops at Pi 0.80; not compatible by default with 0.84.3.",
	},
	{
		id: "workspace-history",
		packageName: "pi-workspace-history",
		installSpec: "npm:pi-workspace-history",
		currentVersion: "0.2.2",
		description: "Workspace undo and rewind",
		platform: "unknown",
		profiles: [],
		minPi: "0.70.5",
		risk: "medium",
		notes: "Peer dependency targets the older @mariozechner Pi package.",
	},
] as const;

export const PROFILE_PACKAGE_IDS: Readonly<Record<ExtensionProfile, readonly string[]>> = {
	minimal: ["extension-settings", "open-tui", "raw-paste", "caffeinate"],
	dev: ["extension-settings", "open-tui", "raw-paste", "caffeinate", "hashline-edit", "pi-lsp", "cache-optimizer", "ask-user-question"],
	research: ["extension-settings", "open-tui", "raw-paste", "caffeinate", "mcp-adapter", "web-access", "ask-user-question"],
	security: ["extension-settings", "open-tui", "raw-paste", "caffeinate", "mcp-adapter", "agent-browser-native", "ask-user-question"],
	max: ["extension-settings", "open-tui", "raw-paste", "caffeinate", "hashline-edit", "lens", "cache-optimizer", "mcp-adapter", "web-access", "agent-browser-native", "ask-user-question", "plan-mode", "background-tasks"],
};

const CATALOG_BY_ID = new Map(EXTENSION_CATALOG.map((entry) => [entry.id, entry]));

export function getExtension(id: string): ExtensionPackageDefinition {
	const entry = CATALOG_BY_ID.get(id);
	if (!entry) throw new Error(`Unknown Dove Pi extension: ${id}`);
	return entry;
}

export function getProfilePackages(profile: ExtensionProfile): ExtensionPackageDefinition[] {
	return PROFILE_PACKAGE_IDS[profile].map(getExtension);
}

export function matchesConfiguredPackage(configured: string, entry: ExtensionPackageDefinition): boolean {
	return configured === entry.installSpec || configured === entry.packageName || configured.includes(entry.packageName);
}

export function isExtensionProfile(value: string): value is ExtensionProfile {
	return Object.prototype.hasOwnProperty.call(PROFILE_PACKAGE_IDS, value);
}
