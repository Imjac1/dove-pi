/**
 * The syntax layer: what a command line *is*, as opposed to what a field says it is.
 *
 * **Why this module exists.** A technique prohibition read from a declared field is a rule the caller can
 * switch off by not filling the field in - and the corpus measured exactly that (`2609.30217`: 98% of evasion
 * attempts succeeded on 88%). `dos` is a *conduct*: it shows in the shape of what runs, not in a field named
 * `technique`. So the prohibition is read off the arguments as well, by shape.
 *
 * **The table is the work, the parser is not.** The reference implementation keeps roughly 130 arity entries
 * behind a tree-sitter parser; the parser is replaceable and the dictionary is what decides. This module is
 * the small, declared beginning of that dictionary, and it says what it cannot witness rather than guessing:
 * a technique name with no entry here is a declaration the runtime cannot enforce, which is a fact about our
 * knowledge and belongs in a refusal rather than in silence.
 *
 * **What a witness is not.** It is not a proof that the action is harmful, and not a proof that a permitted
 * command is safe. It is a shape this repository decided to refuse, with the remedy beside it - and the table
 * measures its own coverage by fault injection rather than by claiming it.
 */

/** The tools whose argument *is* a command line. The fence excludes the same two names for the same reason. */
export const SHELL_TOOLS: ReadonlySet<string> = new Set(["bash", "powershell"]);

export interface ShellWord {
	readonly text: string;
	/** Whether any part of this word was quoted, which is what tells a loop from the word `while` in prose. */
	readonly quoted: boolean;
}

/**
 * Split a command line into the words a shell would act on, and say which of them were quoted.
 *
 * **Quoting is the whole reason this is not `split(" ")`.** `"while true"` is text; `while true` is a loop,
 * and a rule reading the raw line cannot tell them apart. Separators are boundaries too, so `a;while true`
 * yields the same shape as `while true` on its own line.
 *
 * **It is not a shell, and it does not pretend to be.** Nothing is expanded: no variables, no substitutions,
 * no globbing. A rule that would need expansion is a rule this module cannot decide, and the honest answer
 * there is "cannot tell" - which the caller has to make, not this function.
 */
export function splitCommandLine(command: string): readonly ShellWord[] {
	const words: ShellWord[] = [];
	let current = "";
	let quoted = false;
	let inSingle = false;
	let inDouble = false;
	const flush = (): void => {
		if (current !== "") words.push({ text: current, quoted });
		current = "";
		quoted = false;
	};
	for (const character of command) {
		if (inSingle) {
			if (character === "'") inSingle = false;
			current += character;
			continue;
		}
		if (inDouble) {
			if (character === '"') inDouble = false;
			current += character;
			continue;
		}
		if (character === "'" || character === '"') {
			if (character === "'") inSingle = true;
			else inDouble = true;
			quoted = true;
			current += character;
			continue;
		}
		if ("\t\n ;|&(){}".includes(character)) {
			flush();
			continue;
		}
		current += character;
	}
	flush();
	return words;
}

export interface TechniqueWitness {
	/** The words that witness it, quoted back in the refusal so the operator can see what was read. */
	readonly witness: string;
	/** What to write instead. A detector without one is the failure this project exists to avoid. */
	readonly remedy: string;
}

/** A literal that is true whatever the state is, which is what makes a repetition unbounded. */
const ALWAYS_TRUE = new Set(["true", ":", "$true", "1", "yes", "$null", "null"]);

/**
 * Repetition with no bound in its own header: `while true`, `while :`, `while ($true)`, `until false`.
 *
 * **The boundary of this witness, stated rather than implied.** A `while true` whose body breaks out of it is
 * bounded in effect and this refuses it anyway, because the header is what the syntax shows. The remedy says
 * what to write instead, and the fault-injection slice is what measures how much of the table is missing -
 * not a claim that it is complete.
 */
function unboundedRepetition(command: string): TechniqueWitness | undefined {
	const words = splitCommandLine(command);
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		if (word === undefined || word.quoted) continue;
		const keyword = word.text.toLowerCase();
		if (keyword !== "while" && keyword !== "until") continue;
		// A parenthesis may sit between the keyword and its condition, as PowerShell writes it.
		const rest = words.slice(index + 1).filter((entry) => !entry.quoted);
		const first = rest[0]?.text;
		const condition = first === "(" ? rest[1]?.text : first;
		if (condition === undefined) continue;
		const literal = condition.toLowerCase();
		const negated = keyword === "until";
		if (!ALWAYS_TRUE.has(literal)) continue;
		return {
			witness: `${word.text} ${condition}`,
			remedy: negated
				? "State the bound in the command - a counted loop, or a single request - because an unbounded repetition is the technique the mode forbids."
				: "State the bound in the command - a counted loop, or a single request - because an unbounded repetition is the technique the mode forbids.",
		};
	}
	return undefined;
}

/**
 * The witnesses this repository knows, by the technique name a mode declares.
 *
 * A name with no entry is **not** silently permitted: the caller decides what an unwitnessable declaration
 * means, and the slice that owns that decision is named in the task's `implement.md` rather than left here as
 * an implied allow.
 */
export const TECHNIQUE_WITNESSES: Readonly<Record<string, (command: string) => TechniqueWitness | undefined>> = {
	dos: unboundedRepetition,
};

/** The technique names this table can witness, for a loader that wants to refuse the rest by name. */
export const WITNESSED_TECHNIQUES: ReadonlySet<string> = new Set(Object.keys(TECHNIQUE_WITNESSES));
