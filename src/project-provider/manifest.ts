import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { PROJECT_PROVIDER_CONTRACT, type ProjectManifest, type ProjectProviderKind } from "./contracts.ts";

export function projectManifestPath(projectRoot: string): string {
	return join(resolve(projectRoot), ".dove", "project.json");
}

/** Read a manifest without making startup fail on an interrupted or old write. */
export function readProjectManifest(projectRoot: string): ProjectManifest | undefined {
	const path = projectManifestPath(projectRoot);
	if (!existsSync(path)) return undefined;
	try {
		const value = JSON.parse(readFileSync(path, "utf8")) as Partial<ProjectManifest>;
		if ((value.provider !== "native" && value.provider !== "trellis" && value.provider !== "lightweight") || typeof value.projectRoot !== "string" || value.projectRoot.trim() === "") return undefined;
		const canonicalRoot = resolve(value.projectRoot);
		// A manifest is scoped to the directory that contains it. Refusing
		// redirects prevents a nested workspace from silently selecting an
		// unrelated project outside the current boundary.
		if (canonicalRoot !== resolve(projectRoot) || !isDirectory(canonicalRoot)) return undefined;
		return {
			provider: value.provider,
			projectRoot: canonicalRoot,
			adapterContract: typeof value.adapterContract === "string" ? value.adapterContract : PROJECT_PROVIDER_CONTRACT,
			...(typeof value.lastKnownTrellisVersion === "string" ? { lastKnownTrellisVersion: value.lastKnownTrellisVersion } : {}),
		};
	} catch {
		return undefined;
	}
}

export async function writeProjectManifest(manifest: ProjectManifest): Promise<string> {
	const path = projectManifestPath(manifest.projectRoot);
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
	const payload = JSON.stringify({
		provider: manifest.provider,
		projectRoot: normalize(resolve(manifest.projectRoot)),
		adapterContract: manifest.adapterContract,
		...(manifest.lastKnownTrellisVersion ? { lastKnownTrellisVersion: manifest.lastKnownTrellisVersion } : {}),
	}, null, 2) + "\n";
	await writeFile(temporaryPath, payload, "utf8");
	await rename(temporaryPath, path);
	return path;
}

export async function updateProjectManifest(projectRoot: string, provider: ProjectProviderKind, lastKnownTrellisVersion?: string): Promise<string> {
	return writeProjectManifest({
		provider,
		projectRoot: resolve(projectRoot),
		adapterContract: PROJECT_PROVIDER_CONTRACT,
		...(lastKnownTrellisVersion ? { lastKnownTrellisVersion } : {}),
	});
}

/** Async counterpart for callers that already operate on promises. */
export async function readProjectManifestAsync(projectRoot: string): Promise<ProjectManifest | undefined> {
	const path = projectManifestPath(projectRoot);
	try {
		const raw = await readFile(path, "utf8");
		const value = JSON.parse(raw) as Partial<ProjectManifest>;
		if ((value.provider !== "native" && value.provider !== "trellis" && value.provider !== "lightweight") || typeof value.projectRoot !== "string" || value.projectRoot.trim() === "") return undefined;
		const canonicalRoot = resolve(value.projectRoot);
		if (canonicalRoot !== resolve(projectRoot) || !isDirectory(canonicalRoot)) return undefined;
		return {
			provider: value.provider,
			projectRoot: canonicalRoot,
			adapterContract: typeof value.adapterContract === "string" ? value.adapterContract : PROJECT_PROVIDER_CONTRACT,
			...(typeof value.lastKnownTrellisVersion === "string" ? { lastKnownTrellisVersion: value.lastKnownTrellisVersion } : {}),
		};
	} catch {
		return undefined;
	}
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
