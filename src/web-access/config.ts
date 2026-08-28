/**
 * Web-access configuration management for pi-web-access.
 *
 * pi-web-access reads its configuration from `~/.pi/web-search.json`
 * (or `${PI_CODING_AGENT_DIR}/web-search.json`, or `$XDG_CONFIG_HOME/pi`).
 * Dove owns the "simulate a real user" part of that file: enabling real
 * browser-cookie authentication (`allowBrowserCookies`) and maintaining
 * scoped `authFetch` profiles whose hosts are always validated before write.
 *
 * This module is pure Node (no Pi import) so it is keepable in core/test
 * boundaries. Validation mirrors pi-web-access's own rules: profile names
 * start with a letter, hosts are DNS hostnames, cache is "session"|"off",
 * and a profile must never be written with an empty host list.
 */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const WEB_SEARCH_CONFIG_FILE = "web-search.json";

export interface AuthFetchProfileConfig {
	readonly name: string;
	readonly hosts: readonly string[];
	readonly chromeProfile?: string;
	readonly cache: "session" | "off";
}

export interface WebAccessConfig {
	readonly path: string;
	readonly allowBrowserCookies: boolean;
	readonly profiles: readonly AuthFetchProfileConfig[];
}

export interface WebAccessReadiness {
	readonly configPath: string;
	readonly configExists: boolean;
	readonly configValid: boolean;
	readonly configError?: string;
	readonly allowBrowserCookies: boolean;
	readonly profiles: readonly AuthFetchProfileConfig[];
	readonly edgeProfiles: readonly string[];
	readonly chromeProfiles: readonly string[];
	readonly cookieSourceReady: boolean;
}

const PROFILE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const HOSTNAME_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Resolve the web-search.json path the same way pi-web-access does. */
export function getWebSearchConfigPath(): string {
	const dir =
		process.env.PI_CODING_AGENT_DIR ??
		(process.env.XDG_CONFIG_HOME
			? join(process.env.XDG_CONFIG_HOME, "pi")
			: join(homedir(), ".pi"));
	return join(dir, WEB_SEARCH_CONFIG_FILE);
}

export function parseHostname(value: string): string {
	const host = value.trim().toLowerCase().replace(/\.$/, "");
	if (
		!host ||
		host.startsWith(".") ||
		host.endsWith(".") ||
		/\s|[\\/?:#@*]/.test(host)
	) {
		throw new Error(`Invalid hostname: ${JSON.stringify(value)}`);
	}
	if (host.length > 253 || !HOSTNAME_PATTERN.test(host)) {
		throw new Error(`Invalid hostname: ${JSON.stringify(value)}`);
	}
	return host;
}

export function parseProfileName(value: string): string {
	const name = value.trim();
	if (!PROFILE_NAME_PATTERN.test(name)) {
		throw new Error(
			`Profile name ${JSON.stringify(name)} must start with a letter and contain only letters, numbers, underscores, or hyphens`,
		);
	}
	return name;
}

interface RawAuthFetchProfile {
	hosts?: unknown;
	chromeProfile?: unknown;
	redirects?: unknown;
	cache?: unknown;
}

function parseRawProfile(
	name: string,
	raw: RawAuthFetchProfile,
): AuthFetchProfileConfig {
	if (!Array.isArray(raw.hosts) || raw.hosts.length === 0) {
		throw new Error(
			`authFetch.${name}.hosts in web-search.json must be a non-empty array of hostnames`,
		);
	}
	const hosts = raw.hosts.map((entry) => {
		if (typeof entry !== "string")
			throw new Error(`authFetch.${name}.hosts must contain only hostnames`);
		return parseHostname(entry);
	});
	const chromeProfile =
		raw.chromeProfile === undefined || raw.chromeProfile === null
			? undefined
			: String(raw.chromeProfile).trim();
	const redirects = raw.redirects ?? "same-origin";
	if (redirects !== "same-origin")
		throw new Error(`authFetch.${name}.redirects must be "same-origin"`);
	const cache = raw.cache ?? "session";
	if (cache !== "session" && cache !== "off")
		throw new Error(`authFetch.${name}.cache must be "session" or "off"`);
	return {
		name,
		hosts: [...new Set(hosts)],
		...(chromeProfile ? { chromeProfile } : {}),
		cache,
	};
}

/** Read and validate the current config. Missing or invalid configs are reported, not thrown. */
export function readWebSearchConfig(): WebAccessConfig {
	const path = getWebSearchConfigPath();
	const fallback: WebAccessConfig = {
		path,
		allowBrowserCookies: false,
		profiles: [],
	};
	if (!existsSync(path)) return fallback;
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return fallback;
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
	const root = raw as Record<string, unknown>;
	const allowBrowserCookies = root.allowBrowserCookies === true;
	const profiles: AuthFetchProfileConfig[] = [];
	const authFetch = root.authFetch;
	if (authFetch && typeof authFetch === "object" && !Array.isArray(authFetch)) {
		for (const [name, value] of Object.entries(
			authFetch as Record<string, unknown>,
		)) {
			if (!value || typeof value !== "object" || Array.isArray(value)) continue;
			try {
				profiles.push(parseRawProfile(name, value as RawAuthFetchProfile));
			} catch {
				// Skip a broken profile; readiness will report configValid=false.
			}
		}
	}
	return { path, allowBrowserCookies, profiles };
}

/**
 * Merge authentication preferences into web-search.json without clobbering
 * unrelated keys (providers, ssrf, proxies). Never writes an invalid profile:
 * a profile with an empty host list is rejected before any write happens.
 */
export function writeWebSearchConfig(update: {
	allowBrowserCookies?: boolean;
	profile?: {
		name: string;
		hosts: readonly string[];
		chromeProfile?: string;
		cache?: "session" | "off";
	};
}): WebAccessConfig {
	if (update.profile && update.profile.hosts.length === 0) {
		throw new Error(
			"authFetch requires at least one hostname; add hosts before enabling a profile",
		);
	}
	const path = getWebSearchConfigPath();
	const root: Record<string, unknown> = {};
	if (existsSync(path)) {
		try {
			const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
				Object.assign(root, parsed);
		} catch {
			// Malformed existing file: rebuild it from this update.
		}
	}
	if (update.allowBrowserCookies !== undefined)
		root.allowBrowserCookies = update.allowBrowserCookies;
	if (update.profile) {
		const authFetch = (
			root.authFetch &&
			typeof root.authFetch === "object" &&
			!Array.isArray(root.authFetch)
				? root.authFetch
				: {}
		) as Record<string, unknown>;
		const name = parseProfileName(update.profile.name);
		const hosts = [...new Set(update.profile.hosts.map(parseHostname))];
		const existing = (
			authFetch[name] &&
			typeof authFetch[name] === "object" &&
			!Array.isArray(authFetch[name])
				? authFetch[name]
				: {}
		) as Record<string, unknown>;
		const mergedHosts = Array.isArray(existing.hosts)
			? [...new Set([...existing.hosts, ...hosts])]
			: hosts;
		if (mergedHosts.length === 0)
			throw new Error("authFetch requires at least one hostname");
		const chromeProfile =
			update.profile.chromeProfile?.trim() ||
			(typeof existing.chromeProfile === "string"
				? existing.chromeProfile
				: undefined);
		const cache =
			update.profile.cache ??
			(existing.cache === "off" || existing.cache === "session"
				? existing.cache
				: "session");
		authFetch[name] = {
			hosts: mergedHosts,
			...(chromeProfile ? { chromeProfile } : {}),
			redirects: "same-origin",
			cache,
		};
		root.authFetch = authFetch;
	}
	const directory = path.slice(0, -WEB_SEARCH_CONFIG_FILE.length - 1);
	if (!existsSync(directory)) {
		mkdirSync(directory, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(root, null, 2) + "\n", "utf-8");
	return readWebSearchConfig();
}

/** Light read-only probe of the real-browser cookie sources pi-web-access uses. */
export function inspectCookieSources(): {
	edgeProfiles: string[];
	chromeProfiles: string[];
} {
	const edgeProfiles: string[] = [];
	const chromeProfiles: string[] = [];
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA ?? "";
		if (localAppData) {
			edgeProfiles.push(
				...listProfiles(join(localAppData, "Microsoft", "Edge", "User Data")),
			);
			chromeProfiles.push(
				...listProfiles(join(localAppData, "Google", "Chrome", "User Data")),
			);
		}
	} else if (process.platform === "darwin") {
		edgeProfiles.push(
			...listProfiles(
				join(homedir(), "Library", "Application Support", "Microsoft Edge"),
			),
		);
		chromeProfiles.push(
			...listProfiles(
				join(homedir(), "Library", "Application Support", "Google", "Chrome"),
			),
		);
	} else {
		edgeProfiles.push(
			...listProfiles(join(homedir(), ".config", "microsoft-edge")),
		);
		chromeProfiles.push(
			...listProfiles(join(homedir(), ".config", "google-chrome")),
		);
	}
	return { edgeProfiles, chromeProfiles };
}

export function inspectWebAccessReadiness(): WebAccessReadiness {
	const config = readWebSearchConfig();
	let configValid = true;
	let configError: string | undefined;
	const profileNames = new Set<string>();
	for (const profile of config.profiles) {
		if (profileNames.has(profile.name)) {
			configValid = false;
			configError = `Duplicate authFetch profile name: ${profile.name}`;
			break;
		}
		profileNames.add(profile.name);
	}
	const sources = inspectCookieSources();
	const cookieSourceReady =
		sources.edgeProfiles.length > 0 || sources.chromeProfiles.length > 0;
	return {
		configPath: config.path,
		configExists: existsSync(config.path),
		configValid,
		...(configError ? { configError } : {}),
		allowBrowserCookies: config.allowBrowserCookies,
		profiles: config.profiles,
		edgeProfiles: sources.edgeProfiles,
		chromeProfiles: sources.chromeProfiles,
		cookieSourceReady,
	};
}

function listProfiles(userDataDir: string): string[] {
	if (!existsSync(userDataDir)) return [];
	try {
		return readdirSync(userDataDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((name) => name === "Default" || /^Profile\s*\d+$/i.test(name))
			.sort();
	} catch {
		return [];
	}
}
