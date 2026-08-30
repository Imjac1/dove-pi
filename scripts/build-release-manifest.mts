import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getProfilePackages, PROFILE_PACKAGE_IDS, type ExtensionProfile } from "../src/extensions/catalog.ts";
import { DOVE_EXTENSION_ID, DOVE_EXTENSION_CONTRACT_VERSION, doveImplementationDigest } from "../src/core/extension-identity.ts";

interface PackageJson {
	readonly version: string;
	readonly dependencies: Readonly<Record<string, string>>;
}

interface PackageLock {
	readonly packages?: Readonly<Record<string, { readonly version?: string }>>;
}

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as PackageJson;
const packageLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as PackageLock;
const args = process.argv.slice(2);
let destinationArg = "release.json";
let releaseIdOverride: string | undefined;
let commitOverride: string | undefined;
for (let index = 0; index < args.length; index += 1) {
	const value = args[index];
	if (value === "--release-id" || value === "--commit") {
		const next = args[index + 1];
		if (!next) throw new Error(`${value} requires a value.`);
		if (value === "--release-id") releaseIdOverride = next;
		else commitOverride = next;
		index += 1;
	} else if (value.startsWith("--")) {
		throw new Error(`Unknown release manifest option: ${value}`);
	} else if (destinationArg === "release.json") {
		destinationArg = value;
	} else {
		throw new Error(`Unexpected release manifest argument: ${value}`);
	}
}
const version = packageJson.version;
const expectedTag = process.env.GITHUB_REF_NAME;
if (expectedTag?.startsWith("v") && expectedTag.slice(1) !== version) {
	throw new Error(`Release tag ${expectedTag} does not match package.json version ${version}.`);
}
const exactDependency = (name: string): string => {
	const value = packageJson.dependencies[name];
	if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value ?? "")) {
		throw new Error(`${name} must use an exact version before publishing; found ${value ?? "missing"}.`);
	}
	const locked = packageLock.packages?.[`node_modules/${name}`]?.version;
	if (locked !== value) {
		throw new Error(`${name} lockfile version ${locked ?? "missing"} does not match package.json ${value}.`);
	}
	return value;
};
const commit = commitOverride
	?? process.env.GITHUB_SHA
	?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const releaseId = releaseIdOverride ?? `${version}+${commit.slice(0, 7)}`;
if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(releaseId)) {
	throw new Error(`Unsafe release id: ${releaseId}`);
}
const profiles = Object.fromEntries(
	(Object.keys(PROFILE_PACKAGE_IDS) as ExtensionProfile[]).map((profile) => [
		profile,
		getProfilePackages(profile).map((entry) => `npm:${entry.packageName}@${entry.currentVersion}`),
	]),
);
const manifest = {
	schemaVersion: 1,
	version,
	releaseId,
	commit,
	platform: "windows",
	runtime: { python: ">=3.10", node: ">=22.19.0" },
	components: {
		pi: exactDependency("@earendil-works/pi-coding-agent"),
		piTui: exactDependency("@earendil-works/pi-tui"),
		trellis: exactDependency("@mindfoldhq/trellis"),
	},
	profiles,
	doveExtension: {
		extensionId: DOVE_EXTENSION_ID,
		version,
		implementationDigest: doveImplementationDigest(version),
		entryPath: ".pi/extensions/personal-agent.ts",
		contractVersion: String(DOVE_EXTENSION_CONTRACT_VERSION),
	},
};
const destination = resolve(destinationArg);
writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(destination);
