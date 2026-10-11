import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

/**
 * **A throwaway directory that is removed when this file's tests finish.**
 *
 * Several of these files grew a `freshRoot()` that called `mkdtempSync` per test and removed nothing. Measured
 * 2026-10-11: one full suite run left **92** directories behind, and this machine's temp directory had accumulated
 * **49,044** of them across two months. That is worth fixing for a reason past tidiness - a test that leaves its own
 * workspace on disk hands the next run a directory it did not create, and the one unreproduced assertion failure seen
 * among eleven green runs is the shape that produces. It was found while chasing that failure, and it is not offered as
 * its cause: eleven runs were green with every one of those 49,044 present.
 *
 * **The removal is registered on the file's own hook**, so it runs whether the file passed or failed. A directory that
 * cannot be removed throws here rather than being swallowed, because a leftover that survives is the signal that some
 * test left a handle open.
 */
const temporaries: string[] = [];

export function temporaryDirectory(prefix: string): string {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	temporaries.push(directory);
	return directory;
}

after(() => {
	for (const directory of temporaries) rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
	temporaries.length = 0;
});
