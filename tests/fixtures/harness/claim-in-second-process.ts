/**
 * A second process that tries to claim one effect key.
 *
 * This exists because the failure the claim prevents crosses processes: two resumers in one process are
 * already covered by the in-memory store's tests, and the in-memory store's own docstring says that is not
 * what it is for. Spawning a real process is the only way to exercise the primitive that has to hold.
 *
 * Invoked as: node --import tsx <this file> <claim-directory> <effect-key>
 * Writes the ClaimResult as JSON to stdout.
 */
import { createFileEffectStore } from "../../../src/core/effect-store-file.ts";

const [directory, effectKey] = process.argv.slice(2);
if (directory === undefined || effectKey === undefined) {
	throw new Error("usage: claim-in-second-process <claim-directory> <effect-key>");
}

const store = createFileEffectStore({ directory });
const result = await store.claim({
	effectKey,
	engagement: "eng-1",
	mode: { id: "code-audit", version: "1.0.0", governanceVersion: "1" },
	tool: "write_report",
	decision: "allowed",
	startedAt: new Date().toISOString(),
});

process.stdout.write(JSON.stringify(result));
