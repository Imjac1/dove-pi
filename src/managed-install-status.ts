import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { compareDoveExtensionIdentity, doveImplementationDigest, type DoveExtensionSyncState } from "./core/extension-identity.ts";

export interface ManagedInstallStatus {
	readonly installed: boolean;
	readonly root?: string;
	readonly currentRelease?: string;
	readonly previousRelease?: string;
	readonly profile?: string;
	readonly extensions: readonly {
		readonly identity: string;
		readonly spec: string;
		readonly status: string;
	}[];
	readonly doveExtension?: {
		readonly extensionId: string;
		readonly version: string;
		readonly implementationDigest: string;
		readonly entryPath: string;
		readonly syncState?: DoveExtensionSyncState;
	};
}

type ManagedDoveExtensionStatus = NonNullable<ManagedInstallStatus["doveExtension"]>;

function defaultRoot(env: NodeJS.ProcessEnv): string | undefined {
	if (env.DOVE_PI_HOME?.trim()) return resolve(env.DOVE_PI_HOME);
	if (process.platform === "win32" && env.LOCALAPPDATA?.trim()) {
		return resolve(env.LOCALAPPDATA, "DovePi");
	}
	if (process.platform !== "win32") return resolve(homedir(), ".local", "share", "dove-pi");
	return undefined;
}

export function inspectManagedInstall(env: NodeJS.ProcessEnv = process.env): ManagedInstallStatus {
	const root = defaultRoot(env);
	if (!root) return { installed: false, extensions: [] };
	try {
		const parsed = JSON.parse(readFileSync(join(root, "state", "install.json"), "utf8")) as Record<string, unknown>;
		if (Number(parsed.schemaVersion) !== 2) return { installed: false, root, extensions: [] };
		const releaseId = (value: unknown): string | undefined => {
			if (!value || typeof value !== "object") return undefined;
			const id = (value as { releaseId?: unknown }).releaseId;
			return typeof id === "string" && id ? id : undefined;
		};
		const readDoveExtension = (value: unknown): ManagedDoveExtensionStatus | undefined => {
			if (!value || typeof value !== "object") return undefined;
			const entry = value as Record<string, unknown>;
			if (["extensionId", "version", "implementationDigest", "entryPath"].every((key) => typeof entry[key] === "string" && Boolean(entry[key]))) {
				return { extensionId: entry.extensionId as string, version: entry.version as string, implementationDigest: entry.implementationDigest as string, entryPath: entry.entryPath as string };
			}
			return undefined;
		};
		let doveExtension = readDoveExtension(parsed.doveExtension);
		const currentPath = parsed.current && typeof parsed.current === "object" && typeof (parsed.current as Record<string, unknown>).installPath === "string" ? String((parsed.current as Record<string, unknown>).installPath) : undefined;
		if (!doveExtension && currentPath) {
			try {
				const versionsRoot = resolve(root, "app", "versions");
				const candidate = resolve(currentPath);
				const boundary = versionsRoot.endsWith("\\") || versionsRoot.endsWith("/") ? versionsRoot : `${versionsRoot}${process.platform === "win32" ? "\\" : "/"}`;
				if (candidate.toLowerCase().startsWith(boundary.toLowerCase())) {
					doveExtension = readDoveExtension(JSON.parse(readFileSync(join(candidate, "release.json"), "utf8")).doveExtension);
				}
			} catch { /* legacy/partial install */ }
		}
		if (doveExtension) {
			try {
				const projectEntry = join(process.cwd(), ".pi", "extensions", "personal-agent.ts");
				readFileSync(projectEntry, "utf8");
				const packagePath = join(process.cwd(), "package.json");
				const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
				const projectVersion = typeof packageJson.version === "string" ? packageJson.version : doveExtension.version;
				const projectIdentity = { extensionId: "dove.personal-agent" as const, version: projectVersion, implementationDigest: doveImplementationDigest(projectVersion), entryPath: projectEntry, origin: "project" as const, trust: "unknown" as const };
				doveExtension = { ...doveExtension, syncState: compareDoveExtensionIdentity({ ...doveExtension, extensionId: "dove.personal-agent" as const, origin: "managed", trust: "managed" }, projectIdentity) };
			} catch {
				doveExtension = { ...doveExtension, syncState: "managed_only" };
			}
		}
		const extensions = Array.isArray(parsed.managedExtensions)
			? parsed.managedExtensions.flatMap((value) => {
				if (!value || typeof value !== "object") return [];
				const entry = value as Record<string, unknown>;
				if (typeof entry.identity !== "string" || typeof entry.spec !== "string") return [];
				return [{
					identity: entry.identity,
					spec: entry.spec,
					status: typeof entry.status === "string" ? entry.status : "unknown",
				}];
			})
			: [];
		return {
			installed: Boolean(releaseId(parsed.current)),
			root,
			currentRelease: releaseId(parsed.current),
			previousRelease: releaseId(parsed.previous),
			profile: typeof parsed.profile === "string" ? parsed.profile : undefined,
			extensions,
			doveExtension,
		};
	} catch {
		return { installed: false, root, extensions: [] };
	}
}
