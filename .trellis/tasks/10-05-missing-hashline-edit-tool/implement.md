# Implementation: a declaration with nothing behind it is reported, not hidden

Depends on the operator's choice in `design.md`: the checklist below is the recommended branch **(ii) load and record**.
Under **(i) refuse the session** steps 3 and 4 become the refusal beside `extension.ts:2420`, and step 2's case asserts
the refusal instead of the sentence; everything else holds.

## Ordered checklist

1. **Write the case first, and watch it red.** Two cases in one file, because the control is what makes the claim:
   - a session whose declared packages are all present produces the start line it produces today;
   - a session whose declaration names a package the store does not have produces a line that **names the package**.
   Red today: nothing compares the declaration to the store.

2. **Compute the disagreement where the two sides already are.** The declaration is in the agent directory's
   `settings.json`; the store is the directory Pi resolves packages from. Both are read at start already for the tool
   surface (`extension.ts:1256`, `hasHashlineEditTools` over `pi.getAllTools()`), so the comparison is a sibling of that
   read and not a new subsystem. **Read it once and derive both readings from it**, so the sentence and the field cannot
   disagree - the same shape the front door requires of the network axis.

3. **Say it on the start line, as a suffix.** The line that already reports the mode and its tool families gains the
   missing declaration. A satisfied declaration adds nothing: byte-identical output for the case that had nothing
   missing.

4. **Do not add a second status field.** `hashlineEditTools=absent` already answers the family question for hashline; the
   new sentence answers the *declaration* question, and a reader who wants the list opens `/status`.

5. **Leave the runner's carrier out of the refusal, if the operator chose (i).** The field runner's own session
   directory is a run's configuration, and the carrier's list is the runner's contract (`personal-agent-field-run.md`);
   refusing a person's session for a run's configuration would be the wrong end of the same fact.

6. **One sentence in `personal-agent-field-run.md`**, beside the carrier's list: what a run reports when a declared
   package is absent, with an anchor the citation door can resolve.

7. **Run the doors and the suite** - `npm test`, `spec-anchors`, `document-drift`, `task-artifact-lint --assert-corpus` -
   and repoint the mount table from the declarations if the edit lands above a registration, reading each prose citation
   back rather than computing a delta.

## Validation

- The two cases are the acceptance criteria: satisfied declaration silent, unsatisfied declaration named.
- Under (ii), **no** existing case changes behaviour, which is the assertion that only the reading moved.
- Under (i), the case asserts a refusal that names the package and the store, and a second case asserts that the
  runner's carrier does not trigger it.
- The PRD's first open item - the missing family as a reading - is closed by pointing at `hashlineEditTools=`, with the
  case that already holds it; this task does not add a second field for it.

## What is deliberately left out

- Installing, repairing or removing anything.
- Changing which packages Pi resolves or which tools the host provides.
- Re-opening the corrected premise: the host has the tools, and that is measured.
