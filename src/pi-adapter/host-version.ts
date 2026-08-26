import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export function getPiVersion(): string {
	try {
		const packagePath = findPackageJson(dirname(fileURLToPath(import.meta.url)));
		if (packagePath) {
			const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: string };
			return packageJson.version ?? "unknown";
		}
		return String(require("@earendil-works/pi-coding-agent").VERSION ?? "unknown");
	} catch {
		return "unknown";
	}
}

function findPackageJson(start: string): string | undefined {
	let current = start;
	for (;;) {
		const candidate = join(current, "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
		try {
			readFileSync(candidate, "utf8");
			return candidate;
		} catch {
			const parent = dirname(current);
			if (parent === current) return undefined;
			current = parent;
		}
	}
}
