import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { projectManifestPath, readProjectManifest } from "./manifest.ts";
import type { ProjectManifest } from "./contracts.ts";

export interface ProjectDiscovery {
	readonly projectRoot: string;
	readonly manifest?: ProjectManifest;
	readonly trellisRoot?: string;
}

/**
 * Find the nearest explicit project marker. A manifest wins over a Trellis
 * directory at the same level and its canonical root is validated before use.
 */
export function discoverProject(startPath = process.cwd()): ProjectDiscovery {
	const requestedRoot = resolve(startPath);
	let current = requestedRoot;
	while (true) {
		const manifestPath = projectManifestPath(current);
		const hasExplicitManifest = existsSync(manifestPath);
		const manifest = readProjectManifest(current);
		if (manifest) {
			const canonicalRoot = resolve(manifest.projectRoot);
			// A project-local manifest may bind to itself or an ancestor, but it
			// must not redirect a nested workspace to an unrelated path.
			const fromManifest = relative(canonicalRoot, current);
			if (existsSync(canonicalRoot) && (fromManifest === "" || (fromManifest !== ".." && !fromManifest.startsWith(`..${sep}`)))) {
				const trellisRoot = isDirectory(join(canonicalRoot, ".trellis")) ? join(canonicalRoot, ".trellis") : undefined;
				return { projectRoot: canonicalRoot, manifest, ...(trellisRoot ? { trellisRoot } : {}) };
			}
			// Ignore an invalid manifest and continue normal marker discovery.
		}
		// A malformed explicit manifest is still a project boundary. Do not
		// silently bind a nested workspace to a parent Trellis project.
		if (hasExplicitManifest) return { projectRoot: current };
		const trellisRoot = join(current, ".trellis");
		if (isDirectory(trellisRoot)) return { projectRoot: current, trellisRoot };
		const parent = dirname(current);
		if (parent === current) return { projectRoot: requestedRoot };
		current = parent;
	}
}

export function isProjectRoot(path: string): boolean {
	return isDirectory(join(resolve(path), ".trellis")) || existsSync(join(resolve(path), ".dove", "project.json"));
}

export function projectTrellisRoot(projectRoot: string): string | undefined {
	const root = join(resolve(projectRoot), ".trellis");
	return isDirectory(root) ? root : undefined;
}

function isDirectory(path: string): boolean {
	try { return statSync(path).isDirectory(); } catch { return false; }
}
