import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * **Every module in src is named by something, or is an entry point named here with its reason.** "Nothing imports this" is checkable
 * where "this is untested" is a guess, and the measurement that produced this test found nothing dead: 103 modules, none unreferenced.
 * The test exists so the next module added is either wired or named.
 *
 * **It errs toward silence on purpose.** The check is a text search over src and tests for the module path relative to src, not a
 * resolved import graph: a pattern-based graph would miss a dynamic import or a re-export and report a live module as dead, and a check
 * that cries wolf gets deleted. A file that nothing names at all is what this can be sure about - and a round already found the other
 * trap, a file nothing referenced that was live through Pi own auto-discovery, which is why the entry points are written out by hand
 * rather than inferred.
 */
const ENTRY_POINTS: Readonly<Record<string, string>> = {
	"cli.ts": "what the CLI and `npm run doctor` run",
	"pi-adapter/extension.ts": "what Pi loads as the Dove extension",
	"runtime.ts": "the runtime entry the adapter and the host tests build",
};

function typescriptFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) return typescriptFiles(full);
		return entry.isFile() && full.endsWith(".ts") ? [full] : [];
	});
}

describe("the source module graph", () => {
	it("names every module, or says why it is an entry point", () => {
		const root = process.cwd();
		const sources = [...typescriptFiles(join(root, "src")), ...typescriptFiles(join(root, "tests"))];
		const texts = sources.map((file) => ({ file, text: readFileSync(file, "utf8") }));

		const orphans: string[] = [];
		for (const file of typescriptFiles(join(root, "src"))) {
			const modulePath = relative(join(root, "src"), file).replaceAll("\\", "/");
			if (ENTRY_POINTS[modulePath] !== undefined) continue;
			// **Named by any other file, in src or in tests, and the module own text is not evidence about itself.** The test accepts
			// either the path relative to src or the bare file name, because a sibling import says "./work-mode.ts" and contains only
			// the second: requiring the first reported wired modules as orphans, which is the crying-wolf failure this check is
			// written to avoid. Accepting both over-approximates what "named" means, and over-approximating here means staying silent.
			const name = modulePath.slice(modulePath.lastIndexOf("/") + 1);
			const named = texts.some((other) => other.file !== file && (other.text.includes(modulePath) || other.text.includes(name)));
			if (!named) orphans.push(modulePath);
		}

		assert.deepEqual(orphans, [], "a module nobody names is either unwired or an entry point that should be listed here with its reason: " + orphans.join(", "));
	});
});
