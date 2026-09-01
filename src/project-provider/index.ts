import { resolve } from "node:path";
import { discoverProject } from "./discovery.ts";
import { readProjectManifest } from "./manifest.ts";
import { NativeProvider } from "./native-provider.ts";
import type { ProjectManifest, ProjectProvider } from "./contracts.ts";

export * from "./contracts.ts";
export * from "./discovery.ts";
export * from "./manifest.ts";
export * from "./native-provider.ts";
export * from "./native-state.ts";
export * from "./native-artifacts.ts";
export * from "./lock.ts";
export * from "./continuation.ts";

/** Deterministically select a provider; an explicit manifest wins over discovery. */
export function createProjectProvider(startPath = process.cwd()): ProjectProvider {
	const discovery = discoverProject(startPath);
	const manifest = discovery.manifest ?? readProjectManifest(discovery.projectRoot);
	if (manifest) return new NativeProvider(resolve(manifest.projectRoot));
	return new NativeProvider(discovery.projectRoot);
}

export function manifestForProvider(provider: ProjectProvider): ProjectManifest {
	const health = provider.getHealth();
	return {
		provider: provider.kind,
		projectRoot: provider.projectRoot,
		adapterContract: health.adapterContract,
		...(health.trellisVersion ? { lastKnownTrellisVersion: health.trellisVersion } : {}),
	};
}
