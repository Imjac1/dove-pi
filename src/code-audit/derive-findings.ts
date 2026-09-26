import { isAbsolute, relative, sep } from "node:path";
import type { Finding } from "../core/evidence-sarif.ts";
import type { SeedCandidate } from "./seed-scanner.ts";

/**
 * Derive the findings a report may contain from the seeds a scan produced and the claims made about them.
 *
 * **Why this is exported and separate.** The writer used to read a findings file. That made an artifact
 * possible in which the seed set was verified against the tree while the results came from a file the
 * caller wrote: a probe produced a correct seed digest next to a finding for a path that does not exist.
 * The findings are derived instead, and the derivation carries the refusals - a category that is not its
 * seed's, an id that binds to no seed, a seed with no evidence, a path outside the roots the seed
 * recorded. Inline in the capability those refusals were unreachable through the public API and therefore
 * untestable: the receipt checks refuse first. Here they are the function's own contract and can be tested
 * directly. An assertion no test can reach is not pinned, it is prose.
 */
export interface Derivation {
	readonly findings: readonly Finding[];
	/** Completed as it goes, so a caller does not walk the same claim list a second time. */
	readonly counts: Readonly<Record<string, number>>;
}

/**
 * A path relative to the root the scan searched, with forward slashes.
 *
 * SARIF's artifactLocation.uri is a URI and this framework documents Finding.path as repository-relative;
 * an absolute drive path is neither, and it makes a baseline non-portable, because the same-(category,
 * path) tier could never fire across two roots.
 *
 * **A path under no recorded root is refused rather than returned as-is.** A seed records the roots it was
 * scanned against, so a miss means the invariant is already broken, and returning an absolute path would
 * put a leak into the artifact while looking like a successful write.
 *
 * **Known limit:** the result depends on the root *list*, not only on the tree. The same bytes scanned as
 * `[repo/src]` give `db/query.ts` and as `[repo, repo/src]` give `src/db/query.ts`, so listing an ancestor
 * root changes every uri and the same-(category, path) tier cannot fire between the two runs. Stated rather
 * than fixed: choosing a canonical root is a policy the mode should own.
 */
export function relativeToRoot(path: string, roots: readonly string[]): string {
	for (const root of roots) {
		const candidate = relative(root, path);
		if (candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate)) return candidate.split(sep).join("/");
	}
	throw new Error("no recorded scan root contains " + path + ", so it cannot be expressed as a repository-relative location");
}

/** The claim fields this reads, so a malformed claim is refused by the schema rather than here. */
interface ClaimShape {
	readonly candidateId?: unknown;
	readonly category?: unknown;
	readonly status?: unknown;
	readonly severity?: unknown;
	readonly title?: unknown;
}

/** Whether a claim produces a result: a confirmed or hypothesised defect, and nothing else. */
function isResult(status: unknown): boolean {
	return status === "CONFIRMED" || status === "HYPOTHESIS";
}

/**
 * SARIF has three levels and the claim schema has four severities, so this necessarily collapses two of
 * them; `dove/severity` carries the claim's own value so nothing is lost. A hypothesis is capped at
 * `warning` however high its severity, because an unconfirmed finding should not be able to fail a build.
 */
function levelOf(claim: ClaimShape): Finding["severity"] {
	const high = claim.severity === "CRITICAL" || claim.severity === "HIGH";
	if (claim.status === "HYPOTHESIS") return claim.severity === "LOW" ? "note" : "warning";
	return high ? "error" : claim.severity === "MEDIUM" ? "warning" : "note";
}

export function deriveFindings(seeds: readonly SeedCandidate[], claims: readonly unknown[]): Derivation {
	const byId = new Map(seeds.map((seed) => [seed.candidateId, seed]));
	const findings: Finding[] = [];
	const counts: Record<string, number> = {};
	for (const raw of claims) {
		const claim = raw as ClaimShape | null | undefined;
		if (claim === null || typeof claim !== "object") continue;
		if (typeof claim.status === "string") counts[claim.status] = (counts[claim.status] ?? 0) + 1;
		if (!isResult(claim.status)) continue;
		const seed = typeof claim.candidateId === "string" ? byId.get(claim.candidateId) : undefined;
		// Loud rather than a quiet skip: the reconciliation has already proven every id binds to a seed, so
		// this cannot fire - which is the reason to make it visible rather than the reason to stay silent.
		if (seed === undefined) throw new Error("claim " + String(claim.candidateId) + " binds to no seed in this scan");
		if (claim.category !== seed.category) {
			throw new Error("claim " + seed.candidateId + " says " + String(claim.category) + " but the seed it names is " + seed.category);
		}
		const where = seed.evidence[0];
		if (where === undefined) throw new Error("seed " + seed.candidateId + " carries no evidence, so it cannot become a result");
		findings.push({
			path: relativeToRoot(where.path, seed.coverage.searched),
			category: seed.category,
			existingCode: where.excerpt,
			message: typeof claim.title === "string" && claim.title.trim() !== "" ? claim.title : seed.sink.location,
			severity: levelOf(claim),
			startLine: where.line,
			properties: { "dove/severity": claim.severity, "dove/status": claim.status },
		});
	}
	return { findings, counts };
}
