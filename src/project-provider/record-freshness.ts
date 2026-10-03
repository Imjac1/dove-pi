/**
 * Whether a task's own record still describes itself.
 *
 * A task in this provider keeps its acceptance criteria in `acceptance.md` and the events that justify them in
 * `evidence.jsonl`. Nothing currently compares the two, and a twelve-session run measured what that costs: five
 * criteria ticked, and an evidence file that never mentions four of them - the record claimed work the ledger
 * does not support, and no door was watching. This is the same failure the specification checks exist for,
 * applied to the product's own records.
 *
 * The rule is deliberately the narrow one the ledger can actually decide: **a ticked criterion must have an
 * event naming it.** Anything a tick *claims* beyond that - a test count, a command's output - is not
 * machine-checkable from here and is not guessed at.
 */

/** One criterion as it is written in `acceptance.md`. */
export interface AcceptanceCriterion {
	readonly id: string;
	readonly ticked: boolean;
}

/** A ticked criterion with no event behind it. */
export interface UnsupportedCriterion {
	readonly id: string;
}

/** Parse the `## Criteria` section, taking only well-formed `- [ ]` / `- [x] **ID**` lines. */
export function parseAcceptanceCriteria(markdown: string): readonly AcceptanceCriterion[] {
	const criteria: AcceptanceCriterion[] = [];
	for (const line of markdown.split(/\r?\n/u)) {
		const match = /^\s*-\s*\[([ xX])\]\s*\*\*([^*]+)\*\*/u.exec(line);
		if (match) criteria.push({ id: match[2]!.trim(), ticked: match[1]!.toLowerCase() === "x" });
	}
	return criteria;
}

/** The acceptance ids mentioned anywhere in an `evidence.jsonl` body. */
export function acceptanceIdsMentioned(evidence: string): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const match of evidence.matchAll(/"acceptanceId"\s*:\s*"([^"]+)"/gu)) ids.add(match[1]!);
	return ids;
}

/**
 * The ticked criteria whose id the evidence never names.
 *
 * Only ticked criteria are reported: an unticked one claims nothing, so there is nothing to back. And only the
 * **id** is compared, because that is what the ledger can decide - the ledger records that a criterion was
 * started or frozen, not whether the work behind it is true. A criterion whose text claims a test count is not
 * checked here, and is deliberately not guessed at.
 */
export function findUnsupportedCriteria(markdown: string, evidence: string): readonly UnsupportedCriterion[] {
	const mentioned = acceptanceIdsMentioned(evidence);
	return parseAcceptanceCriteria(markdown)
		.filter((criterion) => criterion.ticked && !mentioned.has(criterion.id))
		.map((criterion) => ({ id: criterion.id }));
}
