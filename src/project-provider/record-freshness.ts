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

/**
 * Whether the projection a goal carries is behind the record it was copied from.
 *
 * **What this is for.** A convergence write stores the authoritative `convergence.json` first and the copy `state.json`
 * carries second, and the same shape holds for progress. An interrupted write therefore leaves the copy behind - and
 * measured, that heals itself: the next snapshot is reduced from the **file**, so its revision is the file's plus one,
 * and the copy stored with it is current again.
 *
 * What does not heal on its own is the reading taken in between. An ordinary task is projected from the copy beside it
 * rather than from its file, so for that window a stale snapshot is reported as if it were current, and nothing says so.
 * That report is the defect this function exists to make visible, and it is the only one left in the sequence:
 * the write order is already record-first, and the replay back to agreement is already the next write.
 *
 * A missing revision on either side is **not** behind: a task with no convergence record has no projection to be
 * behind, and this answers one question rather than guessing at another.
 */
export function projectionIsBehind(projectionRevision: number | undefined, recordRevision: number | undefined): boolean {
	if (projectionRevision === undefined || recordRevision === undefined) return false;
	return projectionRevision < recordRevision;
}
