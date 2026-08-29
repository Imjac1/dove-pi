import { EXTENSION_CATALOG, matchesConfiguredPackage, type ExtensionCapabilityDeclaration } from "./catalog.ts";

export type HostCapabilityStatus = "available" | "configured" | "degraded";

export interface HostCapabilityProjection extends ExtensionCapabilityDeclaration {
	readonly provider: "pi-extension";
	readonly packageId: string;
	readonly packageName: string;
	readonly status: HostCapabilityStatus;
	readonly missingTools: readonly string[];
}

/**
 * Project host-owned plugin abilities without registering them as Core
 * capabilities. This keeps plugin UX reusable while Core remains the sole
 * owner of policy, capability execution, evidence, and ledger semantics.
 */
export function projectExtensionCapabilities(
	configuredPackages: readonly unknown[],
	availableToolNames?: readonly string[],
): readonly HostCapabilityProjection[] {
	const available = availableToolNames ? new Set(availableToolNames) : undefined;
	return EXTENSION_CATALOG.flatMap((entry) => {
		if (!entry.provides || !configuredPackages.some((item) => matchesConfiguredPackage(item, entry))) return [];
		return entry.provides.map((capability) => {
			const missingTools = available
				? (capability.toolNames ?? []).filter((name) => !available.has(name))
				: [];
			const status: HostCapabilityStatus = missingTools.length > 0
				? "degraded"
				: available ? "available" : "configured";
			return Object.freeze({
				...capability,
				provider: "pi-extension" as const,
				packageId: entry.id,
				packageName: entry.packageName,
				status,
				missingTools: Object.freeze(missingTools),
			});
		});
	});
}
