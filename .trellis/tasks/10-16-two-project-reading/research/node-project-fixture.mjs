// Generates the second project of the two-project reading, and prints the byte sizes the reading is asserted over.
//
// **Why generated rather than committed.** The reading's third criterion is "the held-out instrument is byte-identical
// afterwards"; a committed fixture would make that assertion depend on a file that can rot in this repository's own
// archive, and a fixture whose bytes are declared by a generator cannot. Run it with a destination directory:
//
//   node .trellis/tasks/10-16-two-project-reading/research/node-project-fixture.mjs <destination>
//
// The project is deliberately framework-free - `node --test` and nothing else - because the reading is about a second
// ecosystem, and a framework dependency would make the reading about npm resolution instead.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const destination = process.argv[2];
if (!destination) throw new Error("give a destination directory");

/** Every file of the fixture, with its exact bytes. */
const files = {
	"package.json": `${JSON.stringify(
		{
			name: "ledger",
			private: true,
			type: "module",
			scripts: { test: "node --test" },
		},
		null,
		2,
	)}\n`,

	// The module under test. `total` adds in currency units, which is where the failing case comes from: summing 0.1 and
	// 0.2 as floats gives 0.30000000000000004, and the customer's complaint is that a ledger report shows a balance that
	// does not match the sum of its entries.
	"src/ledger.mjs": `export function total(entries) {\n\treturn entries.reduce((sum, entry) => sum + entry.amount, 0);\n}\n\nexport function format(amount) {\n\treturn amount.toFixed(2);\n}\n`,

	"src/cli.mjs": `import { format, total } from "./ledger.mjs";\n\nconst entries = [{ amount: 0.1 }, { amount: 0.2 }];\nprocess.stdout.write(\`\${format(total(entries))}\\n\`);\n`,

	// One passing case, so the suite is a suite rather than a single red line.
	"test/ledger.test.mjs": `import { describe, it } from "node:test";\nimport assert from "node:assert/strict";\n\nimport { format, total } from "../src/ledger.mjs";\n\ndescribe("the ledger", () => {\n\tit("adds whole amounts", () => {\n\t\tassert.equal(total([{ amount: 1 }, { amount: 2 }]), 3);\n\t});\n\n\tit("formats to two places", () => {\n\t\tassert.equal(format(3), "3.00");\n\t});\n});\n`,

	// **The failing case, and it is failing on purpose.** The reading's second project is not supposed to go green: the
	// mode it runs under cannot write, so the honest outcome is a suite that still fails, an instrument whose bytes are
	// unchanged, and a record that says the tool never ran rather than one that claims success.
	"test/report.test.mjs": `import { describe, it } from "node:test";\nimport assert from "node:assert/strict";\n\nimport { total } from "../src/ledger.mjs";\n\ndescribe("the customer's complaint", () => {\n\tit("a balance equals the sum of its entries", () => {\n\t\tassert.equal(total([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);\n\t});\n});\n`,

	// **The instrument.** It checks the fixture against `instrument.lock.json`, so any edit to any file above turns it red -
	// which is what makes "the instrument is byte-identical afterwards" a claim about the project rather than about a file
	// nobody looked at. It reads the manifest by path so the checks run from wherever `node --test` was started.
	"test/instrument.test.mjs": `import { describe, it } from "node:test";\nimport assert from "node:assert/strict";\nimport { createHash } from "node:crypto";\nimport { readFileSync } from "node:fs";\nimport { fileURLToPath } from "node:url";\nimport { dirname, join } from "node:path";\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), "..");\nconst lock = JSON.parse(readFileSync(join(root, "instrument.lock.json"), "utf8"));\n\ndescribe("the instrument", () => {\n\tit("still describes this project byte for byte", () => {\n\t\tfor (const [relative, digest] of Object.entries(lock.files)) {\n\t\t\tconst actual = createHash("sha256").update(readFileSync(join(root, relative))).digest("hex");\n\t\t\tassert.equal(actual, digest, \`\${relative} is not the file this instrument was written for\`);\n\t\t}\n\t});\n});\n`,
};

const digests = (() => {
	const out = {};
	for (const [relative, content] of Object.entries(files)) {
		if (relative === "instrument.lock.json") continue;
		out[relative] = createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
	}
	return out;
})();

files["instrument.lock.json"] = `${JSON.stringify({ note: "written by node-project-fixture.mjs; the instrument checks these digits", files: digests }, null, 2)}\n`;

for (const [relative, content] of Object.entries(files)) {
	const path = join(destination, relative);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

// R4: the sizes are declared by the script rather than read from a committed file.
const sizes = Object.entries(files)
	.map(([relative, content]) => `${relative} ${Buffer.byteLength(content, "utf8")}`)
	.sort();
process.stdout.write(`${sizes.join("\n")}\ntotal ${Buffer.byteLength(Object.values(files).join(""), "utf8")} bytes in ${sizes.length} files\n`);
