import { resolve } from "node:path";
import { discoverProject } from "./discovery.ts";
import { readProjectManifest } from "./manifest.ts";
import { LightweightProvider } from "./lightweight-provider.ts";
import { TrellisProvider } from "./trellis-provider.ts";
import type { ProjectManifest, ProjectProvider } from "./contracts.ts";

export * from "./contracts.ts";
export * from "./discovery.ts";
export * from "./manifest.ts";
export * from "./lightweight-provider.ts";
export * from "./trellis-provider.ts";
export * from "./trellis-cli.ts";
export * from "./lock.ts";

/** Deterministically select a provider; an explicit manifest wins over discovery. */
export function createProjectProvider(startPath = process.cwd()): ProjectProvider {
	const discovery = discoverProject(startPath);
	const manifest = discovery.manifest ?? readProjectManifest(discovery.projectRoot);
	if (manifest?.provider === "lightweight") return new LightweightProvider(resolve(manifest.projectRoot));
	if (manifest?.provider === "trellis") return new TrellisProvider(resolve(manifest.projectRoot));
	if (discovery.trellisRoot) return new TrellisProvider(discovery.projectRoot);
	return new LightweightProvider(discovery.projectRoot);
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
