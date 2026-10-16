import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * **A version reading carries where it looked, because one word answered two different questions.**
 *
 * `getPiVersion()` returns a string and several call sites read it as identity. What it could not say is *why* it is
 * `"unknown"`: a host package that was found and declares no `version` is a different fact from a search that found no
 * package at all, and only the second is something a reader can act on. Measured 2026-10-17 against Pi 1.0: with the
 * host package unreachable, the previous revision returned `"unknown"` and said nothing else - no warning, no log line,
 * no record - in a repository that has cleared that defect class twice.
 */
export interface PiVersionReading {
	/** The host's version, or `"unknown"` when neither the manifest nor the resolved module produced one. */
	readonly version: string;
	/** The `package.json` the reading came from, when a host package was found at all. */
	readonly foundAt?: string;
	/**
	 * True **only** when no host package was found anywhere the search walked.
	 *
	 * A package that was found and carries no `version` field is `false` here with `foundAt` set - a different fact, and
	 * collapsing the two is what made the old reading unreadable rather than merely unknown.
	 */
	readonly unreadable: boolean;
	/** Every path the search tried, in order. A sentence about a failure has to name what was searched. */
	readonly searched: readonly string[];
}

/**
 * Read the host's version, walking up from `start` - or from this module's own directory when none is given.
 *
 * **The walk is the whole reading**: a bundled copy, a relocated module or a different install shape all land on
 * `unreadable: true` with the paths that were tried, instead of on a bare `"unknown"` that cannot be told from a host
 * that is merely old. `start` exists so the walk can be pointed somewhere the host is absent, which is how the failure
 * path is held by a case rather than described in a comment.
 */
export function readPiVersion(start?: string): PiVersionReading {
	const searched: string[] = [];
	const found = findPackageJson(start ?? dirname(fileURLToPath(import.meta.url)), searched);
	if (found !== undefined) {
		try {
			const manifest = JSON.parse(readFileSync(found, "utf8")) as { version?: unknown };
			const version = typeof manifest.version === "string" ? manifest.version : "unknown";
			return { version, foundAt: found, unreadable: false, searched };
		} catch {
			// The package is there and its manifest will not parse. That is a fact about the manifest rather than about
			// the search, so `unreadable` stays false and `foundAt` still names what was found.
			return { version: "unknown", foundAt: found, unreadable: false, searched };
		}
	}
	// The fallback the previous revision used is kept: a resolution the walk cannot see may still work, and dropping it
	// would turn a working install into a failure.
	try {
		const resolved = String(require("@earendil-works/pi-coding-agent").VERSION ?? "unknown");
		return { version: resolved, unreadable: resolved === "unknown", searched };
	} catch {
		return { version: "unknown", unreadable: true, searched };
	}
}

/**
 * The sentence a warning carries when a reading found nothing.
 *
 * It names **what was searched**, because that is the cause this code can check: "the host is missing" would be a claim
 * about a machine this function cannot see, while the list of paths it walked is a fact about its own behaviour.
 */
export function describePiVersionFailure(reading: PiVersionReading): string {
	const tried = reading.searched.length > 0 ? reading.searched.join("; ") : "(no path was tried)";
	return `The Pi host version could not be read: no @earendil-works/pi-coding-agent/package.json was found from this module upward. Searched: ${tried}`;
}

/** The version as a string, for the call sites that read it as identity. Unchanged on the success path. */
export function getPiVersion(): string {
	return readPiVersion().version;
}

function findPackageJson(start: string, searched: string[]): string | undefined {
	let current = start;
	for (;;) {
		const candidate = join(current, "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
		searched.push(candidate);
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
