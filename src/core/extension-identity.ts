/** Host-independent identity and authority selection for the bundled Dove extension. */

export const DOVE_EXTENSION_ID = "dove.personal-agent" as const;
export const DOVE_EXTENSION_CONTRACT_VERSION = 2 as const;

export type DoveExtensionOrigin = "managed" | "project" | "explicit";
export type DoveExtensionTrust = "managed" | "trusted" | "untrusted" | "unknown";
export type DoveExtensionSyncState = "in_sync" | "managed_newer" | "project_newer" | "diverged" | "managed_only" | "unknown";

export interface DoveExtensionIdentity {
	readonly extensionId: typeof DOVE_EXTENSION_ID;
	readonly version: string;
	readonly implementationDigest: string;
	readonly entryPath: string;
	readonly origin: DoveExtensionOrigin;
	readonly trust: DoveExtensionTrust;
}

export interface DoveExtensionSelection {
	readonly selected: DoveExtensionIdentity | undefined;
	readonly state: DoveExtensionSyncState;
	readonly candidates: readonly DoveExtensionIdentity[];
	readonly reason: string;
}

/** Stable, dependency-free digest for the Dove implementation contract. */
export function doveImplementationDigest(version: string, contractVersion = DOVE_EXTENSION_CONTRACT_VERSION): string {
	const input = `${DOVE_EXTENSION_ID}\u0000${version.trim()}\u0000${contractVersion}`;
	let a = 0x811c9dc5;
	let b = 0x9e3779b9;
	for (let index = 0; index < input.length; index += 1) {
		const code = input.charCodeAt(index);
		a = Math.imul(a ^ code, 0x01000193) >>> 0;
		b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
	}
	return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`.repeat(4);
}

export function canonicalizeDoveEntryPath(path: string): string {
	const normalized = path.trim().replaceAll("\\", "/").replace(/\/+/g, "/");
	const prefix = normalized.match(/^[A-Za-z]:/)?.[0]?.toLowerCase() ?? "";
	const rest = prefix ? normalized.slice(2) : normalized;
	const absolute = rest.startsWith("/");
	const parts: string[] = [];
	for (const part of rest.split("/")) {
		if (!part || part === ".") continue;
		if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") parts.pop();
		else if (part !== "..") parts.push(part);
	}
	const joined = parts.join("/");
	return `${prefix}${absolute ? "/" : ""}${joined}`.toLowerCase() || (absolute ? "/" : ".");
}

function parseVersion(value: string): number[] {
	return value.trim().replace(/^v/i, "").split(/[+-]/, 1)[0].split(".").slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

export function compareDoveVersions(left: string, right: string): number {
	const a = parseVersion(left), b = parseVersion(right);
	for (let index = 0; index < 3; index += 1) if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
	return left.localeCompare(right);
}

export function compareDoveExtensionIdentity(managed: DoveExtensionIdentity | undefined, project: DoveExtensionIdentity | undefined): DoveExtensionSyncState {
	if (!managed) return project ? "project_newer" : "unknown";
	if (!project) return "managed_only";
	if (managed.implementationDigest === project.implementationDigest && managed.version === project.version) return "in_sync";
	const versionOrder = compareDoveVersions(managed.version, project.version);
	if (versionOrder > 0) return "managed_newer";
	if (versionOrder < 0) return "project_newer";
	return "diverged";
}

export function selectDoveExtension(options: {
	readonly managed?: DoveExtensionIdentity;
	readonly project?: DoveExtensionIdentity;
	readonly explicitProject?: boolean;
	readonly projectTrusted?: boolean;
}): DoveExtensionSelection {
	const { managed, project } = options;
	const state = compareDoveExtensionIdentity(managed, project);
	if (options.explicitProject && project && options.projectTrusted) {
		return { selected: { ...project, origin: "explicit", trust: "trusted" }, state, candidates: [managed, project].filter(Boolean) as DoveExtensionIdentity[], reason: "trusted explicit project override" };
	}
	if (options.explicitProject && project && !options.projectTrusted) {
		return { selected: managed, state, candidates: [managed, project].filter(Boolean) as DoveExtensionIdentity[], reason: "project override rejected because trust was not established" };
	}
	return { selected: managed ?? project, state, candidates: [managed, project].filter(Boolean) as DoveExtensionIdentity[], reason: managed ? "managed Dove extension is authoritative by default" : "no managed Dove extension available" };
}
