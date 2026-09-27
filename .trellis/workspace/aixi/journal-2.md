# Journal - aixi (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-09-28

---



## Session 52: The readings, exercised as scripts: the layer only a hand had run
<!-- trellis-session: v=2 fp=9fd2ef573e5a723c -->

**Date**: 2026-09-28
**Task**: The readings, exercised as scripts: the layer only a hand had run
**Branch**: `master`

### Summary

Four reading scripts had unit tests over constructed records and no test had ever spawned one, while the turn guide quotes them as the first and last steps of a turn. A fixture with a request, a refusal before its failure, an application and a decision now drives all four as processes.

### Main Changes

- the assertions reach the links between instruments rather than one reading at a time: the failure reading prints the mechanism, the reference a manifest cites, and the preserve list, which means the declaration verifiedBy reaches the mining half through the component attribution - a link never exercised end to end until now
- four paths that do not exist are asserted too, one per script, each exiting 0 with a sentence saying what was not found: the property the scripts were written for, and a comment rather than a check until this file
- each script is spawned with execFileSync and --import tsx, the shape tests/harness-effect-claim.test.ts already uses: in-process imports would test the modules, and the modules are the layer that already had tests
- both cases passed on the first run, which is the outcome to want from a test written after the code, and no script changed - git status shows it rather than a sentence claiming it

### Git Commits

| Hash | Message |
|------|---------|
| `a798c9f` | test(readings): exercise the four scripts as scripts, against a ledger on disk |
| `2c0b014` | chore(task): record the readings script test and what it found |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 715 tests, 713 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the only new file is the test.

### Status

[OK] **Completed**

### Next Steps

- Running the turn, which needs a Pi host; and a drift test for the guide against the schema, recorded rather than bundled.


## Session 53: Executing the names: a drift check for the declaration and the guide
<!-- trellis-session: v=2 fp=f3418522fbb4920c -->

**Date**: 2026-09-28
**Task**: Executing the names: a drift check for the declaration and the guide
**Branch**: `master`

### Summary

Two documents name things - the declaration embedded list names symbols, and the turn guide names tool calls with fields - and nothing kept either claim true. Both are now checked by executing them: the module is imported and its symbols asserted to be exported functions, and the mapper is called with exactly the fields the guide lists.

### Main Changes

- the typed form of the question matters: a text scan checks what a pattern can match, which is how the withdrawn behaviour map ended, so where a check can import or call, it does
- status refusing as read-only is asserted, because the guide tells a reader to run a status read and a read is what it must stay
- the doc comment states the two limits rather than leaving them to be assumed: operation=applied is not mapped - the tool execute handles it, and the host tests exercise its refusals - and the guide prose is not checkable at all
- and the first run failed on an assumption of mine rather than on a document drift: the test asserted the guide quotes all four readings, and it quotes three, because the SSM axis compares runs rather than describing a step of a turn - a check that encodes an unstated assumption is caught by running it, which is the whole point of writing one

### Git Commits

| Hash | Message |
|------|---------|
| `cd701eb` | test(docs): execute the names the declaration and the guide rely on |
| `214e886` | chore(task): record the drift check and the assumption its first run caught |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 719 tests, 717 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and no document changed - the only new file is the check.

### Status

[OK] **Completed**

### Next Steps

- Running the turn, which needs a Pi host; the loop specification still has its 262 bytes for whenever a contract needs them.


## Session 54: One vocabulary for the refusal labels, and the eleventh the compiler found
<!-- trellis-session: v=2 fp=20bc0eadda140b3c -->

**Date**: 2026-09-28
**Task**: One vocabulary for the refusal labels, and the eleventh the compiler found
**Branch**: `master`

### Summary

GATE_LABELS is the closed set a manifest prediction is validated against, and the producers shared no type with it - so a label a producer wrote and the set did not carry meant a refusal class nobody could predict. Declared once, with the label a refusal carries typed as a member, the compiler found intensity: a live eleventh label that three earlier hand counts had missed.

### Main Changes

- the vocabulary is one declaration - a tuple, with the union and the set derived from it - so the two cannot disagree, and the parser that validates predictions keeps taking the set
- typing the label a refusal carries turned a producer that invents a label into a compile error, which is how intensity was found: the intensity ceiling refuses with it and the set carried ten
- and the same typecheck refused the wrong coupling: ActionGate.id is not a refusal label, because the loop gate is a general abstraction driven by test doubles while the policy gates are the ones that reach the ledger. That was reverted, with a sentence left where it was tried
- the policy gate list is checked by a test instead, because its entries come from gate objects with wider ids, and a label nobody writes is covered by neither - stated in the contract rather than implied
- a process slip, recorded rather than backdated: this task went to code before its design and implementation artifacts existed and before task.py start ran. The artifacts were written afterwards, the checklist reconstructed, and the slip written into the task file because a task that hides its own sequence teaches the next reader the wrong one

### Git Commits

| Hash | Message |
|------|---------|
| `5aee501` | fix(convergence): one vocabulary for the refusal labels, and the eleventh the compiler found |
| `2a16343` | docs(spec): the label list gains its eleventh name, and the coupling that found it |
| `01df626` | chore(task): record the vocabulary task, the compiler finding and the step that was skipped |
| `6eb91cf` | docs(loop): record why a gate id is not a refusal label, where the coupling was tried and reverted |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 722 tests, 720 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the affected suites - action policy, loop gate, change verdict, 50 tests - pass with the two literal substitutions.

### Status

[OK] **Completed**

### Next Steps

- The rest of the survey: which other vocabularies in this repository have producers that share no type with them.


## Session 55: The vocabulary consumers, typed: the axis keeps printing a number that would have quietly gone wrong
<!-- trellis-session: v=2 fp=f71c5208af1d77c1 -->

**Date**: 2026-09-28
**Task**: The vocabulary consumers, typed: the axis keeps printing a number that would have quietly gone wrong
**Branch**: `master`

### Summary

The survey finished: no live drift is left after the eleventh label, and two couplings were still untyped. The verdict a decision record carries was a string, and the axis isolation set was a set of strings holding sandbox and fence - so a renamed label would have left the reading printing an isolation refusal count that had quietly stopped counting fence refusals, with the axis own test still passing.

### Main Changes

- the second coupling is the one worth finding: the axis test asserts its own two literals, so nothing connected the set to the vocabulary it came from
- both are typed against the vocabulary now, and the check was seen to fire rather than assumed: renaming fence in the vocabulary reports five errors - four in the producers, which is the previous round typing the label a refusal carries, and one in the axis - and zero after the revert
- the reader of a decision record stays a string on purpose: an append-only ledger holds what it holds, and a reader that insists on today vocabulary breaks on yesterday records. The writer is the party that must not invent a value
- and the refusal channel itself must stay a string, which the contract now says: a gate may be a composite such as deny+scope+registered+ask, which the axis splits into atoms, so a typo in a computed label is covered by neither the typecheck nor the reader

### Git Commits

| Hash | Message |
|------|---------|
| `8a08534` | fix(convergence): type the two consumers of the refusal vocabulary |
| `8953cc3` | docs(spec): the typed consumers, the reader that stays a string, and the channel that cannot be typed |
| `22f67df` | chore(task): record the survey, the two typings and the rename that proved them |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 722 tests, 720 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and no test needed changing - which is what a typing that only narrows a channel should look like.

### Status

[OK] **Completed**

### Next Steps

- The survey of vocabularies is answered: the remaining ones are typed or are free text, and the mode file fields have their loader refusals as their check. The first real turn still needs a Pi host.


## Session 56: Citations name a thing, not a position
<!-- trellis-session: v=2 fp=98a42df99945376a -->

**Date**: 2026-09-28
**Task**: Citations name a thing, not a position
**Branch**: `master`

### Summary

Eighteen line-number citations were found in comments - the specifications cite none - and two were already stale, one of them because the verifier extraction moved every line of the adapter. The live code now names what a citation points at, and a prohibition keeps the pattern from coming back.

### Main Changes

- the measurement decided the fix: a citation into our own code is wrong the moment somebody edits above it, and nothing notices, so the durable form is the name of the thing rather than its position
- two categories stayed, named inside the check that enforces the rule: types.d.ts, the Pi host own type file pinned by version, and the withdrawn behaviour map, whose citations are its evidence
- seven of the eighteen named no symbol on the citing line, so no check could judge them - the sweep removed their positions, which is the point: what a reader cannot check, they should not have to
- the prohibition was seen to fail on a seed and pass again once removed, because a prohibition nobody has watched fire has unproven wiring
- and the check states its own limit: it forbids a pattern, so it cannot tell whether the file a citation names is the right one - a floor, not a proof

### Git Commits

| Hash | Message |
|------|---------|
| `d96beab` | docs(citations): name the thing, not the position |
| `e81c339` | chore(task): record the citation sweep, the seed that proved the check, and the allowances |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 723 tests, 721 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the sweep changed comments only.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the seven unjudgeable citations, which no check can judge, are the residue of this class.


## Session 57: A count of what the code declares is a claim with no reader
<!-- trellis-session: v=2 fp=489e9babef4079be -->

**Date**: 2026-09-28
**Task**: A count of what the code declares is a claim with no reader
**Branch**: `master`

### Summary

Thirty-three countable claims in prose were found, every one about a declared enumeration was verified true, and the count was removed from nine sites anyway - because a sentence saying three and a code saying three are connected by nothing, which is how the refusal labels came to be documented as ten when they had become eleven.

### Main Changes

- the verification came first and found nothing wrong: terminal classes four, observables three, components seven, steps seven, operations ten, readings two, each read against the thing it counts
- the replacement is the declaration or its members, and it is shorter: the loop specification went from 24,314 to 24,306 bytes, which matters because that file has 262 bytes of headroom and protecting a count with words spends the room the next contract needs
- one replacement grew the file by four bytes and was shortened until it did not - the criterion existing for exactly that reason
- structural numbers stay: one path may belong to two components is a rule about the map, not a count of an enumeration, and deleting the number would delete the rule
- and the convention says which it is: prose cannot be checked, the labels are kept true by the typecheck, the surface by its loader, the citations by a prohibition, and this is the residue - a convention that read as a control would be the defect the other checks exist to prevent

### Git Commits

| Hash | Message |
|------|---------|
| `4c8865a` | docs(prose): a count of what the code declares is a claim with no reader |
| `27251c2` | chore(task): record the count sweep, the verification that found nothing wrong, and the nine replacements |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 723 tests, 721 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the loop specification is smaller than before the round.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and what remains of the drift survey is the class no check can reach - prose about meaning, which is read by people or not at all.


## Session 58: One reader for the ledger, because two of the five disagreed about a truncated line
<!-- trellis-session: v=2 fp=92d408374e9eec82 -->

**Date**: 2026-09-28
**Task**: One reader for the ledger, because two of the five disagreed about a truncated line
**Branch**: `master`

### Summary

A ledger whose last append a crash cut short made the two mining readings exit 1 with no output at all - blind on exactly the run the harness exists to explain. Five readers parsed one line format, two of them copies with the try removed; there is one reader now, used by the ledger class and all four readings.

### Main Changes

- the rule the one reader encodes: a line which does not parse is not a record, because the append guarantee is one line per call, so a line the writer never finished was never written
- the regression test hands all four readings the truncated ledger and asserts exit 0, the complete records still read, and no phantom record from the half line
- the first measurement was polluted by my own pipeline - Select-Object -First 6 terminates the process it reads, so those exit codes were the pipeline own - and the re-measurement is the one the fix rests on
- the first insertion put the function inside the class, and the fix took three refused attempts, each refusing because the script own boundary check was wrong rather than half-applying anything: brace depth zero and a clean typecheck on the fourth
- and the PRD was wrong about the blackbox script: it reads the same ledger and keeps a tolerant copy because it runs under plain node and cannot import a TypeScript module - so the contract names the exception rather than the count hiding it
- a partial line anywhere but the end stays open and recorded rather than answered: it would mean the append guarantee itself was broken, and nothing here says whether a reading should skip it, count it, or refuse the file

### Git Commits

| Hash | Message |
|------|---------|
| `2008cba` | fix(ledger): one reader, because two of the five disagreed about a truncated line |
| `15a4f93` | docs(spec): one reader for the ledger, the rule it encodes, and the partial line that is left open |
| `d1945e9` | chore(task): record the one-reader fix, the polluted first measurement and the three refused attempts |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 724 tests, 722 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the middle-of-file question, which needs an observed corruption to settle.


## Session 59: Decode the record instead of casting it, and report what cannot be read
<!-- trellis-session: v=2 fp=d2177da743ae9c0a -->

**Date**: 2026-09-28
**Task**: Decode the record instead of casting it, and report what cannot be read
**Branch**: `master`

### Summary

The turn reading cast a record into a shape instead of decoding it, so a record carrying changes: none counted four characters as four changes, printed changes recorded: 4 and died. It decodes through the decoder that owns the format now, and reports what it cannot read - which also repaired the fixture it had been tested against, a record that was never valid.

### Main Changes

- the fix argues for itself: with a decoder, the fixture used since round 19 turned out to carry a literal acceptance revision, an empty criteria list and a criterion state without evidenceRefs - a test validating a fiction, which passed for two rounds because the reading cast instead of decoding
- and the report is the point of the change: saying no turn has been recorded here would be false when a record exists that this build cannot read, and those are different facts with only one of them about the workspace
- the axis half of this round was withdrawn: the core counts unclassifiable terminals, the printer prints them, the suite asserts them, and the hole I measured was a line my own output filter hid by searching for unclassifiable while the line says unclassified
- that is the second measurement mistake in two rounds and both were mine - a pipeline that terminated the process it read, then a filter that hid a line - so the lesson is written where the next probe will read it: do not filter the output you are judging
- and the round own tooling mistakes are recorded too: an insertion into a class body, three refused boundary checks, and a probe written as .cjs that could not load a TypeScript module - which cost more calls than the fix did

### Git Commits

| Hash | Message |
|------|---------|
| `42f91bb` | fix(readings): decode the record instead of casting it, and report what cannot be read |
| `05af129` | docs(spec,task): one decoder for the record, and the finding that was my filter rather than the code |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 725 tests, 723 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 4 of 4 including the repaired fixture.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the probe hygiene lesson, which belongs in the loop guide.


## Session 60: The instruments enter the type gate, and it immediately pays for itself
<!-- trellis-session: v=2 fp=18b8c42422a94221 -->

**Date**: 2026-09-28
**Task**: The instruments enter the type gate, and it immediately pays for itself
**Branch**: `master`

### Summary

tsconfig included src, tests and .pi - not scripts - so the four readings and every command the guide tells a person to run were never type-checked. Widening it reports exactly two errors, and the first is a live defect: a gate-refusals prediction printed as =undefined in every turn output, for the observable the whole verdict machinery is built around.

### Main Changes

- the printer read .to for every arm of the movement union while a refusal count names its target direction, and the type system had known all along - the gate was pointed everywhere except at the instruments
- the fixture and the printer agreed with each other and neither agreed with the union, so the test covered the one case that looked right: fixing the printer alone would have failed the test and fixing the fixture alone would have hidden the defect again
- the second error was a typing gap rather than a defect: an implicit any in a trellis helper, fixed by naming the parameter type, and the round reports two errors rather than saying the scripts were nearly clean
- and one thing is recorded rather than fixed: the decoder tolerates a movement carrying to for a gate-refusals observable, which the union does not name - that tolerance is how the fixture could be wrong in the first place, and how strict the decoder should be is its own decision
- the round also closed the loop on its own method: the probe that found the defect printed unfiltered output, which is the lesson from the two measurement mistakes of the previous round

### Git Commits

| Hash | Message |
|------|---------|
| `546d393` | fix(scripts): the instruments enter the type gate, which immediately pays for itself |
| `e320ce0` | docs(spec,task): a new script is a new file inside the type gate, with the two errors it found |

### Testing

- [OK] npm run typecheck: 0 errors with scripts/**/*.mts inside the gate. npm test: 725 tests, 723 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 4 of 4 with the new assertion.

### Status

[OK] **Completed**

### Next Steps

- How strict the decoder should be about a movement carrying a field its arm does not name; and the first real turn, which needs a Pi host.


## Session 61: The arm of a movement decides the field, and the tolerance only a hand-written record needed
<!-- trellis-session: v=2 fp=de869c6c5292f2b2 -->

**Date**: 2026-09-28
**Task**: The arm of a movement decides the field, and the tolerance only a hand-written record needed
**Branch**: `master`

### Summary

The decoder read movement.to ?? movement.direction, so a gate-refusals movement carrying to was accepted and normalised - which is how the fixture from round 27 came to carry a field its arm does not name for two rounds while looking right. The arm decides now, and the refusal names the field that arm needs.

### Main Changes

- the earlier message offered both names with an or, so a reader could satisfy it while still writing the wrong field, and a fixture did exactly that
- and the comment it fixes was already claiming the guarantee: storedMovements said the shared validator would refuse a mismatch by naming what that observable accepts, while the code offered both names - a declaration describing a refusal that did not exist
- the suite is the check on the blast radius and it found none: 726 tests pass unchanged apart from the new case, so no record this build wrote ever carried the wrong field for its arm
- the rule is tested in both directions, because a rule tested only where it passes is a rule nobody has seen refuse: the mismatch is refused with the field named, and the correct pairing still decodes
- what is left recorded rather than built: refusing extra fields beyond the target, which is a general strictness pass with its own blast radius, and the question of whether to unify the two field names, which is a migration rather than a fix

### Git Commits

| Hash | Message |
|------|---------|
| `a57e1b6` | fix(record): the arm of a movement decides the field that names its target |
| `5235749` | docs(spec,task): the field name belongs to the arm, and a tolerance only a hand-written record needed |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 726 tests, 724 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the decoder suite is 26 of 26.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the other probe forms - a half-written observation, an anomalous resource observation - which have not been tried.


## Session 62: A decision the record no longer carries still happened
<!-- trellis-session: v=2 fp=744a6b1a48ca79c4 -->

**Date**: 2026-09-28
**Task**: A decision the record no longer carries still happened
**Branch**: `master`

### Summary

Probed four forms of an incomplete run: a decision naming a change the record does not carry produced no line anywhere, and the change beside it printed a true sentence about the wrong thing. The record is bounded and the ledger is append-only, so the disagreement is designed - and the reading now names the orphans.

### Main Changes

- the orphan is not corruption: the record drops a change whose verdict is still pending while the ledger keeps what happened, and the contract already said so in the record module own words
- the reading names the orphans by id in its own line, which is the same rule as the unreadable record of two rounds ago: report what you cannot place rather than folding it into nothing
- the change own line keeps its meaning, and the test asserts both halves: the orphan reported, and chg-1 still reading as pending
- three negative results are recorded too, because a probe that finds nothing wrong is still a result: all four fixtures exited 0, the decoder refusing a negative resource count and the reading saying so is a previous round working on a case it was not written for, and a negative count in a resource record is read by no reading at all - a question about ownership rather than a defect

### Git Commits

| Hash | Message |
|------|---------|
| `50c2bd0` | fix(reading): a decision the record no longer carries still happened |
| `8fceb25` | docs(spec,task): the ledger keeps what the bounded record drops, and the reading says which |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 727 tests, 725 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- Which reading should own the resource record, since none does; and the first real turn, which needs a Pi host.
