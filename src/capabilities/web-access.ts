import type { CapabilityDefinition } from "../core/contracts.ts";
import type { CapabilityRegistry } from "../core/capability-registry.ts";
import {
	inspectWebAccessReadiness,
	writeWebSearchConfig,
	type WebAccessReadiness,
} from "../web-access/config.ts";

export interface WebAuthSetupArgs {
	/** authFetch profile name, must start with a letter (letters, numbers, underscores, hyphens only). */
	readonly profile?: string;
	/** Hostnames to allowlist for this profile. */
	readonly hosts: readonly string[];
	/** Optional Chromium profile directory name (for example "Default" or "Profile 1"). */
	readonly chromeProfile?: string;
}

/**
 * Read-only readiness snapshot of pi-web-access's real-user authentication
 * path: config location/validity, browser-cookie opt-in, authFetch profiles,
 * and the real-browser cookie sources (Edge/Chrome) pi-web-access will read.
 */
export const webAccessStatusCapability: CapabilityDefinition<
	void,
	WebAccessReadiness
> = {
	name: "web.access_status",
	version: "0.1.0",
	description:
		"Report pi-web-access real-user auth readiness: web-search.json state, browser-cookie opt-in, authFetch profiles, and Edge/Chrome cookie sources.",
	platforms: ["any"],
	sideEffects: ["read_only"],
	idempotent: true,
	status: "stable",
	async execute(): Promise<WebAccessReadiness> {
		return inspectWebAccessReadiness();
	},
};

/**
 * Enable real-user browsing authentication: sets `allowBrowserCookies: true`
 * and merges an authFetch profile (host-scoped). Idempotent; refuses an empty
 * host list so the resulting web-search.json stays parseable by pi-web-access.
 */
export const webRealUserSetupCapability: CapabilityDefinition<
	WebAuthSetupArgs,
	WebAccessReadiness
> = {
	name: "web.real_user_setup",
	version: "0.1.0",
	description:
		"Enable real browser-cookie authentication for fetch_content by writing allowBrowserCookies and a host-scoped authFetch profile to web-search.json.",
	platforms: ["any"],
	sideEffects: ["system_change"],
	idempotent: true,
	status: "stable",
	requiredArgs: ["hosts"],
	async execute(args: WebAuthSetupArgs): Promise<WebAccessReadiness> {
		const hosts = args.hosts.map((host) => host.trim()).filter(Boolean);
		if (hosts.length === 0) {
			throw new Error(
				"web.real_user_setup requires at least one hostname in hosts",
			);
		}
		const profileName = args.profile?.trim() || "default";
		writeWebSearchConfig({
			allowBrowserCookies: true,
			profile: {
				name: profileName,
				hosts,
				...(args.chromeProfile?.trim()
					? { chromeProfile: args.chromeProfile.trim() }
					: {}),
			},
		});
		return inspectWebAccessReadiness();
	},
};

export function registerWebAccessCapabilities(
	registry: CapabilityRegistry,
): void {
	registry.register(webAccessStatusCapability);
	registry.register(webRealUserSetupCapability);
}
