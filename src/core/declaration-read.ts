import { readFileSync } from "node:fs";

/**
 * Read a project-level declaration file as text, tolerating a byte order mark.
 *
 * **Measured first contact, and it cost a whole walk.** PowerShell 5.1's `Set-Content -Encoding UTF8` writes a BOM,
 * and `JSON.parse` rejects one, so a declaration a person had just written with the tools this platform gives them
 * was read as *exists but unreadable* - which is deliberately a different fact from *nothing declared*, and therefore
 * a different refusal. The schema was right the whole time. The failure was reproduced with the three bytes at the
 * front of the file and nothing else, and it is not specific to one file: every `JSON.parse(readFileSync(..., "utf8"))`
 * in this repository has the same hole, which is why the tolerance lives here and both declaration readers use it.
 *
 * This does not make malformed JSON valid. It removes one byte sequence that a text editor adds on purpose, so that
 * the distinction the readers draw - declared but unreadable versus nothing declared - keeps meaning what it says.
 */
export function readDeclaration(path: string): string {
	const text = readFileSync(path, "utf8");
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
