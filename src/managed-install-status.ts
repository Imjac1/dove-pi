import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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
}

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
		};
	} catch {
		return { installed: false, root, extensions: [] };
	}
}
