import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * **Which class of defect this holds, and which it does not.** It holds a *layer* claim: the modules under `src/core` do not import
 * anything from the Pi side, so the core type-checks and runs without a host. It reads every `.ts` file under `src/core`, takes each
 * import specifier, and refuses any that names a Pi module.
 *
 * **It does not hold three things.** A dynamic `await import("...")` is not an import statement and is not seen. A re-export
 * (`export ... from`) is not seen either, though `src/core` carries none today. And it does not decide *why* an import would be wrong -
 * a deeper layer that Pi also imports would still be a violation by this rule, which is the rule the specification states.
 */
describe("the core layer", () => {
	const coreDirectory = join(process.cwd(), "src", "core");
	const PI_MODULE = /pi-adapter|pi-agent|@mariozechner|\/pi-/;

	function importsOf(directory: string): readonly string[] {
		const found: string[] = [];
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) { found.push(...importsOf(path)); continue; }
			if (!entry.name.endsWith(".ts")) continue;
			for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
				const specifier = line.match(/^\s*(?:import|export)[^;]*?from\s+"([^"]+)"/)?.[1];
				if (specifier !== undefined) found.push(`${path}\u0000${specifier}`);
			}
		}
		return found;
	}

	it("imports nothing from the Pi side", () => {
		const imports = importsOf(coreDirectory);
		assert.ok(imports.length > 50, `a small extraction means the pattern broke: found ${imports.length}`);
		const offenders = imports.filter((entry) => PI_MODULE.test(entry.split("\u0000")[1]!));
		assert.deepEqual(offenders, [], "a core module reaches the Pi side");
	});

	it("notices when a core module does reach the Pi side", () => {
		// The control, and it is a real one: a temporary module is written into src/core with a Pi import, the same walk runs over it, and
		// it must be found. The file is removed in the same test.
		const planted = join(coreDirectory, "zz-control-layer.test-plant.ts");
		try {
			writeFileSync(planted, 'import { x } from "../pi-adapter/extension.ts";\n', "utf8");
			const offenders = importsOf(coreDirectory).filter((entry) => PI_MODULE.test(entry.split("\u0000")[1]!));
			assert.equal(offenders.length, 1, "the planted import must be found");
			assert.match(offenders[0]!, /pi-adapter/);
		} finally {
			rmSync(planted, { force: true });
		}
	});
});
  it("finds no executable file under modes, which is what makes a vertical additive", () => {
    // **What this holds and what it does not.** It holds the fact that two qualified claims lean on: **modes/ is data**. A mode is
    // declared in markdown and yaml, so a vertical *cannot* add core code - not because a search finds no trace of it, but because it
    // has no code to contribute. That is the structural reason behind the mode-format item that could not be satisfied as written.
    // It does not hold that no *string* matching a mode name appears in the source: a workspace mode is also called pentest, and that
    // is the trap the string-search version of the claim fell into.
    const modesDirectory = join(process.cwd(), "modes");
    const executable: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { walk(path); continue; }
        if (/\.(ts|js|mts|cjs|mjs)$/.test(entry.name)) executable.push(path);
      }
    };
    walk(modesDirectory);
    assert.deepEqual(executable, [], "a mode with code in it would no longer be additive");
    // The control: the directory was read and holds entries, so an empty result is about the extensions and not about a missing directory.
    assert.ok(readdirSync(modesDirectory).length > 0, "the control: the modes directory was read");
  });
