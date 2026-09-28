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


## Session 63: Fixtures from the writer types, and the correction of a probe that measured itself
<!-- trellis-session: v=2 fp=3523f4b717c44b54 -->

**Date**: 2026-09-28
**Task**: Fixtures from the writer types, and the correction of a probe that measured itself
**Branch**: `master`

### Summary

A previous round recorded that nothing reads the resource record. Measured properly, that was wrong: the appender writes task.convergence.observed and the failure reading takes it into the failure resources field, while the ledger reads the last one for repair. The probe had invented a kind no writer defines, so it measured itself - and the durable fix is typing fixture kinds as ExecutionRecordKind.

### Main Changes

- one writer, two readers: the resource record was read all along, and an unknown kind is ignored by design, which is what let a fabricated fixture look like a finding
- the readings suite hand-writes ledger lines, so its kind is typed as the union that owns kinds now, which makes an invented one a compile error rather than a silent no-op
- and it found nothing, which is the answer to a question nobody had asked: every kind the suite hand-writes is real. No other suite has the problem, because they build typed objects and let the type check the kind - the string path was the only unchecked one
- the correction is stated where the wrong claim was made, in the contract that describes the resource record, and the method lesson is in the guide a person follows: take a fixture kind from the writer, and read the whole reading unfiltered
- that is the third measurement mistake in three rounds and all three were mine - a pipeline that terminated the process it read, a filter that hid the line which made the arithmetic add up, and a record kind I made up. The first two are now in the guide; this round put the third one there and removed the possibility from the suite

### Git Commits

| Hash | Message |
|------|---------|
| `2821f3c` | test(readings): a fixture kind comes from the union that owns kinds |
| `95e5e8c` | docs(spec,guide): who reads the resource record, and the method lesson from getting it wrong |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 727 tests, 725 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 5 of 5 with its kinds checked.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the resource record name reading oddly for a resource observation, which costs nothing measured but is worth a look when a rename is already on the table.


## Session 64: The entrance lists every specification, and a check keeps it listing them
<!-- trellis-session: v=2 fp=f7006681244504d6 -->

**Date**: 2026-09-28
**Task**: The entrance lists every specification, and a check keeps it listing them
**Branch**: `master`

### Summary

The specs index existed and listed eight personal-agent specifications while the directory held eleven - missing the mode format, the convergence record, and the harness loop itself. So the entrance to the documentation did not lead to the loop; the index is repaired, AGENTS.md points at it from outside the Trellis block, and a check runs both directions.

### Main Changes

- the cause was not the one I first wrote down: my first measurement listed two directories and concluded there was no index at all, when the index existed and had drifted - the fourth measurement mistake in four rounds and the fourth that was mine
- which is why the fix is a check rather than an edit: an index that drifts silently is the defect, and an edit repairs one instance of it. Both directions are checked, and the limit is stated: a row pointing at the wrong specification resolves, and no check can see that
- the pointer in AGENTS.md sits outside the Trellis-managed block, in the area its own footer says a tool update preserves, because an entrance a tool update can delete is not an entrance
- and the round own honesty: the earlier rounds recorded that the resource record is read by nobody and that the specs directory has no index, and both were wrong in the same way - a measurement narrow enough to miss the thing it was looking for

### Git Commits

| Hash | Message |
|------|---------|
| `eeaf611` | docs(index): the entrance lists every specification, and a check keeps it listing them |
| `ea0cfd4` | chore(task): record the stale index, the correction, and the check that replaces the edit |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 728 tests, 726 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 6 of 6 with the index case.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and a review of what other generated-looking index or template file has drifted the same way.


## Session 65: The index rule covers every directory, and the wide measurement that widened it
<!-- trellis-session: v=2 fp=edd58bcb3fc0020d -->

**Date**: 2026-09-28
**Task**: The index rule covers every directory, and the wide measurement that widened it
**Branch**: `master`

### Summary

Wide measurement first: every markdown file in the repository and its relative links - 139 files, 61 links, none broken - and of the three specification indexes only the backend one was stale. The check written a round ago named that directory, so the rule covers every directory now, reports a directory with no index, and is proved to fail on a seeded omission.

### Main Changes

- the wide measurement is what makes the rule right: the drift happens where a specification is added and the table is not updated, which is what happened three times in backend and nowhere else, and a check naming one directory leaves that open everywhere else
- the comparison is extracted and seeded, so it is proved rather than asserted: an omitted file is reported, a name that is not there is reported, and a directory with no index is reported instead of skipped
- the content specifications are not template text - frontend/state-management.md describes this project own split of state by authority - so the generator boilerplate is confined to the two index files and is recorded rather than edited, because a tool update may rewrite it
- the guide now carries four lessons from four narrow measurements: widen the net before concluding, use the instrument the file type allows, take a fixture kind from the writer, and read the output unfiltered
- and this round own two tooling mistakes are recorded with the others: a probe written as .mjs that cannot call require, and an edit that replaced a test first line and left its body behind, which the typecheck caught before anything ran

### Git Commits

| Hash | Message |
|------|---------|
| `6c1b477` | test(docs): the index rule covers every specification directory, proved by seeding an omission |
| `46632cd` | chore(task): archive 09-28-wide-index-check |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 728 tests, 726 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 6 of 6 with the generalised case.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the generator boilerplate in the two index files, which a tool update may rewrite.


## Session 66: The bootstrap instruction this project never needed, and the tool rule the check implements
<!-- trellis-session: v=2 fp=97ec7221f9216133 -->

**Date**: 2026-09-28
**Task**: The bootstrap instruction this project never needed, and the tool rule the check implements
**Branch**: `master`

### Summary

Measured: the boilerplate phrase lives in exactly two files and nowhere else, no script or template regenerates them, and the content guidelines are all project-specific - so the reason a previous round gave for leaving the text alone was wrong. And the rule the index check enforces turns out to be the bootstrap skill own checklist line.

### Main Changes

- the corrected reason matters: the managed block footer says the block may be overwritten by a tool update, and the specification files are project content, so nothing was protecting the leftover text except a guess
- the section addressed a project that has not filled its guidelines in, and this one has - single-package TypeScript with explicit runtime boundaries, no database or ORM, errors crossing process and host boundaries
- removing it is safe because of the previous round check: the tables are what a newcomer reads and a hand-edited table drifts, so the table is kept true by a test and the prose around it can go
- and the check now names where its rule comes from: trellis-spec-bootstrap says in one checklist line that an index must match its final spec file set. This test is that sentence made mechanical, and it was not being kept when it was written - the backend index was missing three specifications, the harness loop among them

### Git Commits

| Hash | Message |
|------|---------|
| `513c8d1` | docs(spec): drop the bootstrap instruction this project never needed, and name the rule the check enforces |
| `778fa2a` | chore(task): record the wrong reason, the measurement that corrected it, and the tool rule the check implements |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 728 tests, 726 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the index check still passes after the removal.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the trellis-update-spec and trellis-check skills, which may state rules this repository already enforces mechanically.


## Session 67: The entry points name the checklist and the quality check the workflow promises
<!-- trellis-session: v=2 fp=53b978d489089bf1 -->

**Date**: 2026-09-28
**Task**: The entry points name the checklist and the quality check the workflow promises
**Branch**: `master`

### Summary

Measured: workflow.md says a spec index is the entry point with a Pre-Development Checklist and a Quality Check, and trellis-before-dev sends every agent to read the files listed in that checklist - while neither index had either section. Both name them now, pointing at the table and at quality-guidelines.md, and the index check asserts the presence.

### Main Changes

- nothing new was written: the checklist points at the table that already holds the content and the quality check points at the file that already is one - the broken part was the pointer between the tool own docs and this repository entry points
- and the check caught the inconsistency its own change introduced: the new sentence pointed at the router in another directory, and the rule only looked in its own, so a true sentence was called false. The rule resolves against sibling directories now, with its limit stated: a typo naming a file in another directory passes, and no name-based check can tell a pointer from a mistake
- the seed text, which is the check own test, was updated in the same change - a rule refinement that leaves its proof behind is a proof of the old rule
- two measurements recorded: the phrase appears nowhere else in the repository as a section of a specification, and the two .trellis/.backup-2026-09-25 trees are gitignored local copies rather than content, which a wide sweep has to skip

### Git Commits

| Hash | Message |
|------|---------|
| `cdbc9f1` | docs(spec): the entry points name the checklist and the quality check the workflow promises |
| `64520d9` | chore(task): record the promised entry point, the sibling rule, and the two measurements |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 728 tests, 726 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 6 of 6 with the presence assertion.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the other skill checklist rules that assert a state this repository could check mechanically.


## Session 68: What an update may overwrite, measured from the tool own bookkeeping
<!-- trellis-session: v=2 fp=6fcc456ba96a4571 -->

**Date**: 2026-09-28
**Task**: What an update may overwrite, measured from the tool own bookkeeping
**Branch**: `master`

### Summary

The tool hash file tracks 181 files - AGENTS.md, workflow.md, config.yaml, and the tool directories - and not one .trellis/spec/** path. So the specifications are project content, which two rounds of reasoning had only guessed at, and the managed block is the region an update owns. Two checks hold both arrangements now.

### Main Changes

- the marker check holds that this repository content in AGENTS.md is outside the managed block, and it is proved against a seeded document that puts the same section inside the markers
- the ownership check holds that no specification is tracked, so a future tool version that starts tracking them is noticed rather than discovered by losing an edit; on a fresh clone the bookkeeping is absent and no ownership claim is made, stated rather than silently passed
- and the round corrected its own assumption mid-flight: the first reading of the tracked set suggested AGENTS.md and the .trellis files were untracked, and the exact query showed AGENTS.md tracked and 74 .trellis paths tracked - of which scripts 68, .runtime 2, agents 2, config.yaml and workflow.md, and no specification
- the mechanism matters more than the list: a tracked file is one the tool knows, and the hash lets it notice an edit rather than clobber it, which is why the footer promise about the block holds and why our section sits outside it
- so this round edit to AGENTS.md makes the file user-modified in the tool own bookkeeping, which is exactly the state the block footer is written for

### Git Commits

| Hash | Message |
|------|---------|
| `885c370` | test(docs): hold the managed-block boundary and the ownership of the specifications |
| `f928e56` | chore(task): record what an update may overwrite, measured from the tool own bookkeeping |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 729 tests, 727 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 7 of 7 with the marker and ownership checks.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the remaining skill rules naming this repository, which the classification pass has not finished.


## Session 69: The paths a specification names, and the version of the check that reported all of them
<!-- trellis-session: v=2 fp=44922ca9bcf4f2a8 -->

**Date**: 2026-09-28
**Task**: The paths a specification names, and the version of the check that reported all of them
**Branch**: `master`

### Summary

The tool own skill says .trellis/spec/ describes the project as it exists now, and its strongest mechanical part is that the paths a specification names exist - forty-two of them across twenty-eight files, and they all resolve. The first version of the rule resolved from the file alone and reported every one of them missing.

### Main Changes

- specifications write paths from the repository root and a handful from their own directory, so the rule tries both bases - resolving from the file alone flagged src/core/contracts.ts, which exists
- that is the fifth measurement of mine in six rounds that was wrong before the data was, and it is the same class as the others: a rule narrow enough to miss what it was looking at, in this case the base a path is written from
- scope is the specifications and not the guides: a guide gives examples, and scripts/path/file.py is a shape rather than a claim - a rule that read the guides would report two true sentences, and a check that fires on true sentences teaches people to ignore it
- the checks outcome is a negative: nothing in the specifications names a path this repository lacks, so three rounds of auditing the docs have now found three index problems and no broken path
- the limit is stated in the check: it can see that a path exists, never that the sentence around it is still true - which is the part a reader checks and a check cannot

### Git Commits

| Hash | Message |
|------|---------|
| `6d0022e` | test(spec): the paths a specification names resolve from the root or from the file |
| `3d8bae2` | chore(task): record the path measurement and the version that reported forty-two false positives |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 730 tests, 728 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 8 of 8 with the path check.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the two remaining skill rules naming this repository that the classification pass has not closed.


## Session 70: The source of truth names two artifacts that are not there
<!-- trellis-session: v=2 fp=75dfeeef7c5cabec -->

**Date**: 2026-09-28
**Task**: The source of truth names two artifacts that are not there
**Branch**: `master`

### Summary

The front-door sweep found that .trellis/workflow.md - which calls itself the workflow source of truth and is what the Trellis block points every agent at - names a script that ships under .claude/hooks and .codex/hooks in this install, and a specification under a spec/cli tree this repository does not have. Our own documents pass the rule that found it.

### Main Changes

- the tool own bookkeeping settled where the script is: it is tracked at .claude/hooks/inject-workflow-state.py and .codex/hooks/inject-workflow-state.py, and nothing under .trellis/scripts matches the name - so the document describes an older layout rather than this install being broken
- the correction lives on our side of the boundary: workflow.md is tracked tool content with no managed block, so a local edit may be overwritten, while the AGENTS.md section is after the end marker and a test holds its position
- the assertion is a containment rather than an exact set, because an update that fixes the document drops an entry and a document that grows a new wrong path adds one - both mean the note should be revisited
- and the check forced a convention on the note itself: it first reported AGENTS.md, because a sentence describing a wrong path dressed it as code and the checks read code spans. The wrong path is written in plain text now, with the reason stated where the rule lives
- that is the second time in this audit that writing about a defect made the check fire on the writing - which is the check doing its job on a sentence that had not been written carefully

### Git Commits

| Hash | Message |
|------|---------|
| `e8b0c86` | test(docs): the front door names only paths that exist, and the tracked document is recorded |
| `ca6cd33` | chore(task): record the two stale paths in the tracked workflow document |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 731 tests, 729 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 9 of 9.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the drift suite at nine cases, whose size is worth measuring before it grows again.


## Session 71: A header that stopped describing its file, in the two files whose subject is exactly that
<!-- trellis-session: v=2 fp=651c805496418cac -->

**Date**: 2026-09-28
**Task**: A header that stopped describing its file, in the two files whose subject is exactly that
**Branch**: `master`

### Summary

The question was whether the drift suite needs splitting. Measured: 375 lines, the eighth largest test file, nine cases of one shape, four helpers that are the four rules - so it stays, and the measurement is the reason. And the measurement found that both headers had drifted from their files, in the two files whose subject is a declaration that stopped being true.

### Main Changes

- the drift suite header still said two kinds of naming while the file holds six; the readings suite header described the script layer while the file also holds four failure modes of the readings
- both headers now name the kinds they hold and point at the limits, which is the convention the guidelines carry: a header is a cursor, not a summary - a reader arrives at a file to answer one question, whether the defect they care about is caught here
- the split decision is recorded with its measurement, so the next person to wonder gets the number instead of the wondering
- and no case changed: the suite passes with the same counts, which is the evidence that this round edited prose about tests and nothing else

### Git Commits

| Hash | Message |
|------|---------|
| `dd82767` | docs(tests): a header that stopped describing its file, in the two files whose subject is exactly that |
| `ca45096` | chore(task): record the split measurement and the two stale headers it found |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 731 tests, 729 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 9 of 9.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the quality guidelines, which have grown a convention for headers and one for counts in three rounds.


## Session 72: The gate names the owners of its rules, and keeps the one that has none
<!-- trellis-session: v=2 fp=07241576fe6a2be4 -->

**Date**: 2026-09-28
**Task**: The gate names the owners of its rules, and keeps the one that has none
**Branch**: `master`

### Summary

Three measurements first: the quality guidelines are 5 KB and not becoming a specification; four of the five rules in its gate section are already owned by routed specs; and every code-shaped identifier the guidelines and the convergence record name resolves in src. So the section was redundant rather than wrong, and one rule - only blocking and regression findings fixed in scope - appears nowhere else.

### Main Changes

- the rewrite keeps that rule as this repository own and turns the other four into pointers, because a rule with no owner is a rule nobody maintains and a rule stated twice is a maintenance debt
- the resource rule turned out to be enforced rather than merely stated: the closed observable set carries no resource observable, which is the boundary decision of an earlier round doing the work
- the rewrite is 420 bytes larger, which is the cost of naming four owners instead of restating them, and the file is still under the limit the task set for itself
- and one tooling lesson: a sha ending in d was eaten by PowerShell numeric suffix parsing, so the journal took two attempts - quoting it fixed what no amount of care with the token would have

### Git Commits

| Hash | Message |
|------|---------|
| `826fd2e` | docs(spec): the gate names the owners of its rules, and keeps the one rule that has no other home |
| `610970d` | chore(task): record the three measurements behind the gate rewrite |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 731 tests, 729 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 9 of 9.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and the last unclassified skill rules naming this repository.


## Session 73: What the template hashes can and cannot say
<!-- trellis-session: v=2 fp=31a3d9a3d78b78f3 -->

**Date**: 2026-09-28
**Task**: What the template hashes can and cannot say
**Branch**: `master`

### Summary

Recomputing every tracked hash classified the numbers: 73 match, 34 differ, 74 are absent - and the differences are a tool update since the baseline, generated bytecode that can never match, and gitignored runtime state. AGENTS.md is the only file this repository edited on purpose.

### Main Changes

- the raw numbers read for a moment like forty-four tool files modified locally, and they are not - so the check that reads the file now carries the classification, and the next reader gets the number without the wrong conclusion
- the file says what it is: .trellis/.version reads 0.6.16 while the hash format version reads 2, so the baseline was written at initialisation and nothing rewrites it later
- no new rule was added, because a check that guessed at a difference would be wrong about two of its three causes - the check keeps asserting only what it can see, which is that no specification is tracked

### Git Commits

| Hash | Message |
|------|---------|
| `994a908` | docs(tests): the template hashes are a baseline, not a tamper check, and the check says so |
| `8ec25d8` | chore(task): record what the template hashes can and cannot say |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 731 tests, 729 pass, 0 fail, 2 skipped, with the same counts as before the round. Installer tests and doctor pass. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host.


## Session 74: The two front doors stay in step, in shape if not in meaning
<!-- trellis-session: v=2 fp=c48bd1a226721863 -->

**Date**: 2026-09-28
**Task**: The two front doors stay in step, in shape if not in meaning
**Branch**: `master`

### Summary

A census of the repository tree found no orphan - every top-level entry is named in the specifications or is tool content - and one thing with no guard: the two READMEs, 26 KB each and structurally identical by hand. The check holds their shape, and says it cannot hold their meaning.

### Main Changes

- measured before the check: 31 headings, 33 code fences and 14 table rows in each, the headings differing only as translations and a five percent byte difference which is the language itself, so they are in step and the only reason is that whoever writes one remembers the other
- the census is a result about the repository rather than about the search: engagements is the authority input the mode files name, dove_pi.py and install.ps1 are referenced from the READMEs and the installer tests, and .codex and .github are tool content
- the check is seeded both ways, and states what it cannot do - a section translated badly, or a command changed in one language and not the other, passes a shape check
- the commit list in this entry excludes the archive commit Trellis makes for itself: this round made the check and the task record, and the archive is the tool own, which every round has and whose message names the task

### Git Commits

| Hash | Message |
|------|---------|
| `a2b758b` | test(docs): the two front doors stay in step, in shape if not in meaning |
| `6725c63` | chore(task): record the tree census and the README shape measurement |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 732 tests, 730 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the drift suite is 10 of 10.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host; and with the audit converged - four measured-clean results in a row - the next round should ask what else the loop itself still lacks rather than look for another document class.


## Session 75: The last mile of the guide, rehearsed on a real commit
<!-- trellis-session: v=2 fp=dff25310e39c2978 -->

**Date**: 2026-09-28
**Task**: The last mile of the guide, rehearsed on a real commit
**Branch**: `master`

### Summary

Every script step of the turn guide runs against fixtures and every tool step needs the host, so the chain the guide promises at step 7 had only ever been read by hand. It is a test now, against the root commit resolved at runtime, with the outside list, the verifier answer and the decision asserted.

### Main Changes

- the subject choice is the test design: a hard-coded sha would pass here and be wrong in a clone with a different history, a recent commit would be absent from a shallow one, and the root commit answers in any full clone while touching every top-level directory - so it is outside every surface and the answer names the files
- a commit that does not exist is the second subject and reads unresolved, which is the third answer rather than a politer outside
- two assertions were wrong while writing it and both for one reason: the outside list is what is *not* in the declared surface, so it names the skill and tool files and correctly omits src/ and tests/. Asserting a source path there would have been asserting a bug - and the failure message now carries the line it saw, which is how the mistake became visible in one run
- and the guide gained the sentence it was missing: a run should leave behind the ledger and the convergence record, because they are what let it be read here afterwards

### Git Commits

| Hash | Message |
|------|---------|
| `c1b8c7c` | test(readings): rehearse the last mile of the guide on a real commit, and say what a run leaves behind |
| `3a7e672` | chore(task): record the last-mile rehearsal, its two subjects and the assertion that was wrong twice |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 733 tests, 731 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 6 of 6.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task - the only step left that this environment cannot take.


## Session 76: The inside answer, from a commit found at runtime
<!-- trellis-session: v=2 fp=bde0f39c0caad68e -->

**Date**: 2026-09-28
**Task**: The inside answer, from a commit found at runtime
**Branch**: `master`

### Summary

Round 42 rehearsed the last mile with outside and unresolved and left inside to the unit tests. Measured: scanning thirty commits takes about half a second and finds one that stays within a single surface, so the subject is resolved at runtime and the reading own inside line is asserted too - all three answers now, on real commits.

### Main Changes

- a checkout with no such commit skips the assertion with a message that says so, rather than passing silently or failing about its history depth
- the fourth answer the reading can print - surface not declared - is unreachable from a valid record, because the decoder validates a surface against the union the code carries, so it is recorded rather than tested
- and the new assertion found a fixture omission on its first run: the third change was added to the snapshot and not to the ledger, so the reading answered none recorded - which is the reading being right about an incomplete fixture

### Git Commits

| Hash | Message |
|------|---------|
| `2df1db4` | chore(task): record the runtime scan, the inside answer and the fourth answer that cannot fire |
| `5189baa` | test(readings): the inside answer, from a commit found at runtime |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 733 tests, 731 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the readings suite is 6 of 6 with all three surface answers asserted.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task - the only step this environment cannot take.


## Session 77: A round is a record, and the third axis is computable
<!-- trellis-session: v=2 fp=8a4552576540c96c -->

**Date**: 2026-09-28
**Task**: A round is a record, and the third axis is computable
**Branch**: `master`

### Summary

ITQ was declared uncomputable with its reason and its evidence: no per-round score was persisted, the criterion vector existed only in a checkpoint, and a convergence decision reads the same whether it started, passed or failed a criterion. Its wouldNeed named the observation and said that was a decision of its own - so the round made the decision and then made the axis computable.

### Main Changes

- the decision, and the measurement that corrected my first answer: the vector belongs on the observation, which is written for every settled request, and not on the decision record, which is only written on a tool call or a block. I had argued for the decision record on three grounds before measuring which record is actually per round
- the axis computes the per-round score, the slope as a last-minus-first difference rather than a fit, and the escape rate - an escape being the round a stagnation ended, not every round that follows it, which the first implementation got wrong and its own test caught
- ITQ leaves the uncomputable list, which now holds the one axis that needs something the harness does not measure at all: a second objective and a decision about its frontier
- and no observable is added: the closed set a manifest predicts stays behaviour-shaped, and a criterion vector is a record of what the criteria were rather than a fourth thing to predict

### Git Commits

| Hash | Message |
|------|---------|
| `7ee87ab` | feat(loop): a round is a record, and the third axis is computable |
| `0852c31` | chore(task): record the per-round score decision and the axis it made computable |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 733 tests, 731 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the axes suite is 9 of 9 with the new axis asserted on a constructed sequence.

### Status

[OK] **Completed**

### Next Steps

- The Pareto axis, which needs a second measured objective and a decision about its frontier - and that is a design decision rather than a build step. The first real turn still needs a Pi host.


## Session 78: The last uncomputable entry was contradicted by the file it lived in
<!-- trellis-session: v=2 fp=93a6106c1e787025 -->

**Date**: 2026-09-28
**Task**: The last uncomputable entry was contradicted by the file it lived in
**Branch**: `master`

### Summary

The Pareto entry said no second objective is recorded, so there is nothing to preserve against - while the same module reports crashFreeRatio and isolationRefusalsPerRequest from the same records, correlated per request, and the axes test asserts both. What is missing is a frontier, not a measurement.

### Main Changes

- the entry stays in the list and changes why it is there: declared for a decision rather than for a missing measurement, which is a different kind of absence and the only one left
- preservation asks whether a run that is stable but hits isolation refusals is better or worse than one that is safe but crashes, and the module own rule about thresholds says the same about rates: a decision belongs to whoever makes it, with its own evidence
- and the test now asserts the entry beside the two objectives, because a claim about what the harness cannot measure sits next to the code that measures it - the contradiction was only invisible because the two were never read together
- the round also corrected my own first reading of the entry: I had taken its word that no second objective exists, and the measurement was what showed the claim was about a record field rather than about the reading

### Git Commits

| Hash | Message |
|------|---------|
| `b46f4fc` | fix(axis): the last uncomputable entry was contradicted by the file it lived in |
| `0c1247e` | chore(task): record the correction of the last uncomputable entry |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 733 tests, 731 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the axes suite is 9 of 9.

### Status

[OK] **Completed**

### Next Steps

- Every axis this harness declares is now either computed or declared as a decision rather than a gap. The first real turn still needs a Pi host and a formal native task.


## Session 79: A toast on every instruction, documented nowhere and impossible to turn off
<!-- trellis-session: v=2 fp=c59e644c62cdf0cd -->

**Date**: 2026-09-28
**Task**: A toast on every instruction, documented nowhere and impossible to turn off
**Branch**: `master`

### Summary

Measured: .pi/extensions/notify.ts ships in the release, is auto-discovered by Pi in every session, fires a Windows toast on every settled instruction, has no switch of any kind, and appears in no specification and no line of the README. It has a switch and a contract now.

### Main Changes

- the switch writes itself: DOVE_PI_PREFIX_FUSE is off for 0, off and false, and a repository with two off idioms has one too many - so DOVE_PI_NOTIFY follows it and defaults to on, which leaves the behavior unchanged for anyone who liked the toast
- the predicate is exported so the spellings are testable without spawning a process or a toast, because an off switch that does not recognise a spelling is an off switch that does not work
- and the extension runtime specification now says what fires, when, the debounce, that the extension ships, and the switch - the specification owned this subject and had nothing to say about it
- the round began by checking four trees no round had opened: modes is documented and tested, bin and engagements are referenced from the README and the mode files, and .pi held two extensions - one named as the release entry point, and one nothing referenced, which the Pi own docs turned out to explain: every .ts in that directory is auto-discovered

### Git Commits

| Hash | Message |
|------|---------|
| `f9624a0` | fix(extension): the toast gets a switch, and the behavior gets a contract |
| `9c5884d` | chore(task): record the undocumented toast and the switch it now has |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 735 tests, 733 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the new notify test is 2 of 2.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task. Everything else measured this round is either documented, tested, or referenced from something that is.


## Session 80: The release digest did not cover the mode definitions the runtime loads
<!-- trellis-session: v=2 fp=d7ec89b17f757133 -->

**Date**: 2026-09-28
**Task**: The release digest did not cover the mode definitions the runtime loads
**Branch**: `master`

### Summary

Reading the release source roots showed the digest walked bin, src, installer, .pi and the package files - and not modes, while work-mode.ts loads modes/<id>/MODE.md and the code-audit capability reads a catalog under it. Two releases with different mode definitions could carry the same digest, and the modes decide what the running agent may do.

### Main Changes

- the roots moved into their own module so a test can read them: the builder writes a file when it runs, so importing it to inspect the list is impossible and a text check would compare a pattern rather than a value
- and running it exposed the same defect one level up: the builder now imports the roots module, and that module was itself uncovered, so a change to which roots are walked would not have changed the digest. Both are covered now, and the digest is stable across two builds
- the test holds three things: modes is included, the list covers itself and the builder, and every root resolves - because a root that resolves to nothing is silently skipped by the walk
- the round also corrected two of my own readings: release:check exits 2 with no output under a pipeline but is an argparse usage error needing five release artifacts, and the first grep for what CI runs missed npm test because the pattern said npm run
- and this repository already documents the trap that produced both: the managed-install contract says runtime discovery captures native output without a PowerShell pipeline before reading LASTEXITCODE

### Git Commits

| Hash | Message |
|------|---------|
| `476bfc9` | fix(release): the digest covers the mode definitions the runtime loads |
| `77e5ad6` | chore(task): record the digest gap and the second one the fix exposed |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests and doctor pass. The spec budget test is 5 of 5, and the new release roots test is 3 of 3.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 81: A help flag answered only in first position, and one command that answers nothing
<!-- trellis-session: v=2 fp=00c9c58c8e575b2d -->

**Date**: 2026-09-28
**Task**: A help flag answered only in first position, and one command that answers nothing
**Branch**: `master`

### Summary

The round asked whether the release chain actually runs, and it does: the launcher answers --version and --help, the five read-only subcommands all exit 0 with real output, the release artifact names are consistent across the workflow and the readiness check, and the one-launch workspace override leaves the file alone. Then all fourteen advertised commands were asked for their own help, and six answered a usage error.

### Main Changes

- the mechanism: dove_pi.py recognises help only as the first argument, so capability --help falls through to the local CLI and answers a usage error for a group that needs a subcommand
- and one of the eight that exit 0 answers nothing at all - rpc --help prints empty output, which is worse than the usage error because it says nothing
- the guard covers exactly the commands the local CLI owns, so install --help keeps its own argparse help: a specific answer beats a general one, and nothing that already worked was replaced
- verified by running all fourteen rather than reading the diff: every command answers --help now, install still prints its usage, the top level still prints the version, and the installer suite is 111 tests OK
- and a process slip, recorded rather than backdated: this task was written after the fix. The artifacts say so, because a task that hides its own sequence teaches the next reader the wrong one

### Git Commits

| Hash | Message |
|------|---------|
| `27f2a71` | fix(cli): a help flag is answered wherever it appears, not only first |
| `915dd9e` | chore(task): record the help flag finding, and that this task was written after the fix |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 111 tests OK. Doctor: exit 0. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task. Everything measured this round either runs or is consistent, except rpc --help printing nothing, which is the passthrough semantics and its own decision.


## Session 82: The mode suites read the directory the runtime reads
<!-- trellis-session: v=2 fp=2990d3c0c7b2275b -->

**Date**: 2026-09-28
**Task**: The mode suites read the directory the runtime reads
**Branch**: `master`

### Summary

The shipped modes are validated, and each of the three suites spelled modes/<name> by hand while the host resolves a mode through workModeDirectory. They agree today and nothing kept them in step - the same class the release digest had two rounds ago, where a test that spells a path is testing its own spelling.

### Main Changes

- the three suites use the resolver now, each with the reason, so a change to how the host finds a mode cannot leave them passing against a directory the runtime no longer reads
- the round also verified the previous round fix from the other door: bin/dove-pi.cjs routes to the same program, so capability --help answers the router help and install --help still prints its own argparse help through the stable launcher too
- and two more measurements came back negative: workModeDirectory is join(resolve(root), modes, name), the same path the suites wrote, and the adapter suite registers the extension against fake pi objects
- a process note, and it is a habit now rather than an accident: this task was written after the fix, for the second round in a row. The rule for the next round is written down where the next reader will find it - the task exists before the first edit

### Git Commits

| Hash | Message |
|------|---------|
| `875f7db` | test(modes): the mode suites read the directory the runtime reads |
| `12d0bb7` | chore(task): record the mode resolver finding and the habit it exposes |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. The three mode suites are 36 tests. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 83: The release gate, run on artifacts built from this tree
<!-- trellis-session: v=2 fp=60a6cf9c6a1ba59e -->

**Date**: 2026-09-28
**Task**: The release gate, run on artifacts built from this tree
**Branch**: `master`

### Summary

The one release link never exercised here was the readiness gate, because it needs five artifacts. Built what the workflow builds - a stage of the shipped roots plus release.json, zipped, with its checksum and the bootstrap - and ran it: it passed, Release ready: v0.2.0 (0.2.0+621790d), assets=4.

### Main Changes

- it refused three times on the way and every refusal was correct and mine: an untracked task directory, a tag that does not match the package version, and a manifest built before a later commit. Walking to the pass is what turned those refusals into evidence that the gate works
- and the walk exposed a gap in the suite: the spec names five kinds of refusal under one word, and three and a half were covered - the dirty case tested unstaged tracked changes while the untracked-files refusal was untested, and neither mismatch had a case
- three cases added, mirroring the fixtures already there. The installer suite went from 111 to 114 tests, OK
- the round followed the rule it wrote for itself last round: the task existed before the first edit, and this time the artifacts record the plan rather than reconstructing it

### Git Commits

| Hash | Message |
|------|---------|
| `74c7073` | test(release): cover the two refusals the readiness gate gave when it was finally run |
| `294f7c7` | chore(task): record the gate run, its three refusals and the three cases they exposed |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 114 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task. The release chain is now exercised end to end except a real install, which writes outside the repository.


## Session 84: The installer parameters, as declared and as accepted
<!-- trellis-session: v=2 fp=605c89d28a103454 -->

**Date**: 2026-09-28
**Task**: The installer parameters, as declared and as accepted
**Branch**: `master`

### Summary

Read both sides of the installer parameter surface: install.ps1 declares Profile, Verify, NoPath, NoFont, NoExtensions and Proxy and passes the first two through to the installer, while the managed-install contract named only the four NoPath/NoFont/NoExtensions/Proxy - so a user installing through the piped bootstrap had no document naming the switches that choose a profile and a verification level.

### Main Changes

- the contract names all six now, with the values in prose, and a test compares the documented list with the param block in both directions - a document promising a switch the script does not declare, and a script declaring one no document names
- two of my own readings were wrong first, and both the same way: a regex over both READMEs matched PowerShell own -NoProfile flag in a command-line example and reported it as a documented installer switch, and then the contract line was written with the values inside the backticks so the test regex did not see the names it had just added
- that is the lesson twice in one round: a pattern is not a claim, and a check whose pattern is stricter than the prose it reads reports the prose as missing something it says
- the round followed the rule it set itself two rounds ago and the task existed before the first edit

### Git Commits

| Hash | Message |
|------|---------|
| `7d2585d` | fix(installer): the contract names the two switches it was silent about, and a test holds the list |
| `6d2d96f` | chore(task): record the parameter surface, the missing names and the two patterns that were wrong first |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 115 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The READMEs still do not name -Profile or -Verify for the piped install path, which is a product-document decision rather than a contract one. The first real turn still needs a Pi host.


## Session 85: Do the READMEs claim to list the bootstrap switches
<!-- trellis-session: v=2 fp=17fc5af347eb7494 -->

**Date**: 2026-09-28
**Task**: Do the READMEs claim to list the bootstrap switches
**Branch**: `master`

### Summary

The open question was whether the READMEs are missing -Profile and -Verify. Read first, as the previous round learned to: both show .\install.ps1 -NoPath -NoFont -NoExtensions under a sentence about avoiding PATH and font changes, and say advanced switches in the plural. That is a purpose-bound example, not an enumeration, so the READMEs are not wrong and nothing in them changed.

### Main Changes

- what the example must be is true, and that is checkable in one direction: a switch an example names and the script does not declare is a command that fails when a reader copies it, while an example that omits switches is still an example
- so the installer suite asserts one direction for the READMEs and the contract keeps the both-directions check, because the contract is the document that does claim to list the surface: two assertions, two documents, each held to what it actually says
- the round produced a decision rather than a change, and recorded the quote it rests on, because a decision with its evidence is worth as much as an edit and does not risk making a true document false
- this is the third time this session that reading a pattern as a claim produced a false finding, and the first time the pattern was checked before anything was changed

### Git Commits

| Hash | Message |
|------|---------|
| `2d8b81c` | test(installer): the README examples may omit switches, and must not invent one |
| `88f3911` | chore(task): record the README decision and the one-directional check it produced |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 116 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task. The READMEs could name where the full switch list lives, which is a product-document decision rather than a correctness one.


## Session 86: Modules in src that nothing imports
<!-- trellis-session: v=2 fp=66b9d4346e187dec -->

**Date**: 2026-09-28
**Task**: Modules in src that nothing imports
**Branch**: `master`

### Summary

Built the import graph over src and tests: 103 modules, none unreferenced. A clean result, and the round turned it into a check rather than a note - every module in src is named by some other file, or is listed in the test with the reason nothing imports it, so the next module added is either wired or named.

### Main Changes

- the check is a text search rather than a resolved graph and errs toward silence on purpose: a pattern-based graph would miss a dynamic import or a re-export and report a live module as dead, and a check that cries wolf gets deleted
- it cried wolf on the first run anyway, for a different reason: requiring the path relative to src reported wired modules as orphans, because a sibling import says ./work-mode.ts and contains only the file name. The criterion accepts either now
- and it was given a negative control, which no other check this session has had: a planted orphan in src makes it fail and removing the file makes it pass. A test that cannot fail is not a test
- the entry points are written out by hand with reasons, because a previous round found a file nothing referenced that was live through Pi own auto-discovery - the graph is not the authority on what runs

### Git Commits

| Hash | Message |
|------|---------|
| `22847a9` | test(src): every module is named by something, or is an entry point with a reason |
| `5953d20` | chore(task): record the clean module graph and the check it became |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5. The module graph test passes, and fails when an orphan is planted.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 87: The one shipped file no typechecker has ever read
<!-- trellis-session: v=2 fp=e7fd485da4d7dc68 -->

**Date**: 2026-09-28
**Task**: The one shipped file no typechecker has ever read
**Branch**: `master`

### Summary

bin/dove-pi.cjs is the stable launcher on PATH, six kilobytes of argument handling, executed by CI smoke and never read by a checker because it is .cjs and the include holds .ts and .mts. Running a checker over it reports thirteen TS2339s, and all thirteen are one artifact of JavaScript inference.

### Main Changes

- the artifact: the spread in { ...process.env, PI_SKIP_VERSION_CHECK: 1 } does not carry an index signature into a JavaScript object literal inferred type, so every later assignment reads as a property that does not exist. Adding --types node changed nothing, which ruled out a missing types package
- reading them is what mattered, because the error shape pointed at a real defect worth ruling out: an env object built from scratch would drop the parent environment and a launched child would lose PATH. The file spreads process.env, so it does not. That is the value of running a checker over a file nobody had asked about - not the errors it prints but the question they made me ask
- the include stays as it is, and the reason is written in tsconfig.json beside the neighbouring decisions, so the next person does not re-run the experiment. What covers the launcher is execution: CI runs pi:smoke for --version and --help
- the round produced a decision and a note rather than a change, because the honest answer to whether that file needs typechecking was no, and the measurement is what makes the answer cost nothing to trust

### Git Commits

| Hash | Message |
|------|---------|
| `a534a05` | docs(tsconfig): why the launcher is out of the include, measured rather than assumed |
| `d59f094` | chore(task): record the launcher measurement, the thirteen artifacts and the decision |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. Doctor: exit 0. npm run pi:smoke prints Dove Pi 0.2.0 (Pi 0.84.3). The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 88: Modules on the Python side, and the duplicate the refinement found
<!-- trellis-session: v=2 fp=7114028e05f25508 -->

**Date**: 2026-09-28
**Task**: Modules on the Python side, and the duplicate the refinement found
**Branch**: `master`

### Summary

The Python module graph is clean: nine candidates across installer, dove_pi.py and scripts, nothing unreferenced. So the round went to the refinement - modules named by tests and by nothing in the product - and found seven, one of them a whole subsystem.

### Main Changes

- tests/harness-reachability.test.ts already asserts exactly that, and more: it resolves import edges forward from the entry points and holds the unreachable set to an allow-list in both directions, with a reason and a milestone per entry. Its header names the defect it was built for: twelve of thirty-five modules under src/core were loaded by nothing that runs
- so the check written two rounds ago was a weaker duplicate of it, and the assertion written this round was a third list for the same claim. The text search reports a module as reached when another unreachable module names it; the resolved graph does not
- tests/module-graph.test.ts is removed, and the round is a reduction rather than an addition: a second home for one claim is how two lists come to disagree, and the stronger check was already there with better evidence
- the two implementations of the check disagreed on two modules, and measuring why is what found the duplicate: my test never included scripts because its file walker filters to .ts before the .mts filter runs

### Git Commits

| Hash | Message |
|------|---------|
| `9aabb38` | test(src): remove a weaker duplicate of the reachability check that already existed |
| `0dbf020` | chore(task): record the clean python graph and the duplicate the refinement found |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. The reachability test is 6 of 6. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 89: The promises on the reachability list
<!-- trellis-session: v=2 fp=17b85f050910a405 -->

**Date**: 2026-09-28
**Task**: The promises on the reachability list
**Branch**: `master`

### Summary

The allow-list names, for each unreachable module, the milestone that would make it reachable, so a non-null value is a promise attached to a task. Read across all ten entries: every one is wiredBy null. The task that made the claims this list was born with has finished, and each claim left the list as it was wired, which the six shrinks in its own comments record.

### Main Changes

- the premise was that the list carries promises from finished tasks, and the measurement refuted it. What is left is modules unreachable on purpose - the four readings, each with the reason a reading must not be a control - and modules that predate the framework work and are claimed by nothing
- that is worth recording because the exactness assertion cannot see it: the test catches dead code arriving and a list rotting, and it cannot catch a promise whose task ended, because the list stays exact and the suite stays green either way
- so the one thing the check is blind to is now written where the next entry will be written, and the round is a measurement and a note rather than an edit to the list, which it was explicitly out of scope to touch

### Git Commits

| Hash | Message |
|------|---------|
| `b0004eb` | docs(reachability): every entry is wiredBy null, measured rather than assumed |
| `66aac8d` | chore(task): record the refuted premise and the one thing the reachability check cannot see |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. The reachability test is 6 of 6. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 90: The commands the READMEs tell a reader to run
<!-- trellis-session: v=2 fp=d51859c53109ba27 -->

**Date**: 2026-09-28
**Task**: The commands the READMEs tell a reader to run
**Branch**: `master`

### Summary

Held every dove-pi invocation in both READMEs against the CLI own help: shell is documented in both with its own section and five mentions each, is a first-class entry in LOCAL_CLI_COMMANDS, runs and answers with real JSON, and appeared nowhere in dove-pi --help - so a reader who saw the README could not find it from the tool.

### Main Changes

- the three other commands missing from the help - cache, token, extensions - appear in neither README, which is what makes their absence consistent and shell not. The help already carried a section of exactly that shape for workspace, so shell had a place to go
- the check added is one-directional on purpose, for the reason the switch check is: a README may show a way in without listing everything, while naming a command a reader cannot then find is the defect
- the check was wrong once, in the way this session keeps meeting: its first regex used \s+ and matched across a line break, reading python .\dove_pi.py install on the next line as a command named after dove-pi. A pattern that crosses lines is not reading the document it claims to read
- and it was given a negative control, the second check this session to get one: with the shell block removed it fails naming shell, and with it back it passes

### Git Commits

| Hash | Message |
|------|---------|
| `008f110` | fix(cli): the help names the shell command group it implements |
| `e886fdb` | chore(task): record the undiscoverable shell command and the check that found it |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 117 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 91: Three first-class commands with no document anywhere
<!-- trellis-session: v=2 fp=7686915e5c9fa7a9 -->

**Date**: 2026-09-28
**Task**: Three first-class commands with no document anywhere
**Branch**: `master`

### Summary

cache, token and extensions are in LOCAL_CLI_COMMANDS, so a user can run them, and none of the three appeared in either README or the CLI help. Reading them split them: extensions is invoked by the router itself to reconcile the profile it just installed, while cache and token are audits whose only caller is the CLI dispatch.

### Main Changes

- so extensions is internal by construction and the other two are user-facing and were simply unfindable. Both audits are named in the help now, and the internal one is declared rather than left to inference
- and the declaration is a set rather than a comment: INTERNAL_CLI_COMMANDS sits beside LOCAL_CLI_COMMANDS, and a test asserts in both directions that the difference is exactly what the help names. An exception that gains a mention is a command nobody declared; a command that loses its mention is one nobody can find
- nothing in the repository stated which commands are public, which is why the absence of three read as an oversight rather than a convention - so the fix is a statement rather than three descriptions
- the second direction got its own negative control: naming extensions in the help makes the check fail with that sentence, and removing it makes it pass. The first direction had already been proven live by the previous round failing on shell

### Git Commits

| Hash | Message |
|------|---------|
| `035c765` | fix(cli): two audits become findable, and the internal command says so |
| `cdc1a51` | chore(task): record the classification of the three undocumented commands |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 118 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 92: The switches the documents name
<!-- trellis-session: v=2 fp=40caccf95a6be1e3 -->

**Date**: 2026-09-28
**Task**: The switches the documents name
**Branch**: `master`

### Summary

Every flag the documents name is accepted by the program the document is about: Dove own flags by Dove, and --cwd, --prompt, --scenario and --launcher by scripts/real-dove-blackbox.mjs, which is where the READMEs name them. A clean result.

### Main Changes

- the first extraction reported eleven flags accepted nowhere and sixteen accepted but undocumented, and both directions were artifacts of the extraction rather than facts about the code
- two causes, both mine: a regex that lost its escaping inside the program that generated it, and a parser set of src plus dove_pi.py that left out the very script four of the flags belong to
- a probe was tried and rejected first: asking cmd --bogus --help whether argparse refuses unknown arguments answers zero, because --help short-circuits before the refusal. The honest probe was reading the parser and then grepping each documented flag with the grep tool rather than a generated regex
- so the round is a measurement with a clean result and a statement of scope on the existing help check, because a check is only as good as the scope it declares - and the next person to extend it now knows why four flags would be false positives

### Git Commits

| Hash | Message |
|------|---------|
| `29258af` | docs(cli): the switch surface is measured, and the check says what it does not cover |
| `ad5a762` | chore(task): record the switch surface, the clean result and the two artifacts |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 738 tests, 736 pass, 0 fail, 2 skipped. Installer tests: 118 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 93: The tests the runner actually runs
<!-- trellis-session: v=2 fp=1b161baec5979609 -->

**Date**: 2026-09-28
**Task**: The tests the runner actually runs
**Branch**: `master`

### Summary

Measured: 75 test files, all at depth one, none nested - so the suite pattern matches every one of them without depending on how a double star is interpreted. The behavioural question could not be answered here: three attempts, TAP, the spec reporter and an explicit-file run, and none of them reports which files were loaded. The precise question answered it instead.

### Main Changes

- the assumption was written nowhere, so it is asserted: a nested test file would make the runner pattern meaning-bearing, and the check says so where the next person will find it
- and the check failed its own negative control first: recursive readdir returns backslashes on Windows, so a filter looking for a forward slash matched nothing and the check passed over a planted nested file
- this is the first check this session whose control found it - the previous three passed on the first try, which is exactly why the fourth was worth running
- and the test file itself taught one more thing: its doc comment contained the glob pattern, whose star-slash closed the comment early and produced a syntax error, which is why the pattern is described in words there

### Git Commits

| Hash | Message |
|------|---------|
| `dd066d3` | test(tests): the runner pattern is unambiguous because every test file is at depth one |
| `09af467` | chore(task): record the runner pattern measurement and the control that found the dead filter |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5. The new check fails with a nested test file planted and passes without it.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 94: The Python test files the installer pattern skips
<!-- trellis-session: v=2 fp=ff407f70827c7b4b -->

**Date**: 2026-09-28
**Task**: The Python test files the installer pattern skips
**Branch**: `master`

### Summary

Measured the other runner: seven python test files under tests, and active_task_test.py does not contain installer, so python -m unittest discover with the installer pattern skips it. Reading it explains it - it tests .trellis/scripts/common/active_task.py, the Trellis tooling rather than this project, and nothing in this repository runs it.

### Main Changes

- neither the file nor the pattern is wrong: the pattern names the installer, and this is not an installer test, while the file is the tool own in a directory where the other six are all Dove own. What was missing is a statement
- the check holds the classification, so the next python file added under tests is either named for the suite that runs it or listed with the reason it is not - and the foreign list is asserted in both directions, because an entry naming a file that is gone is the same rot the reachability list guards against
- the finding direction is one-way on purpose, like the switch check: the pattern may match a subset, while a file matched by nothing is the defect
- and the check was given a negative control, the second one this session to have one and the first to be written with it from the start: a planted file makes it fail naming that file, and removing it makes it pass

### Git Commits

| Hash | Message |
|------|---------|
| `e06d5d2` | test(tests): the python test files the installer pattern skips |
| `4738b0f` | chore(task): record the python file nothing runs and the statement that now holds it |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. Installer tests: 119 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 95: The subcommands the usage strings name
<!-- trellis-session: v=2 fp=9b19bc59809387ce -->

**Date**: 2026-09-28
**Task**: The subcommands the usage strings name
**Branch**: `master`

### Summary

One level below the command and switch audits: every subcommand the usage strings name is one the dispatch handles. The thickest is task, whose usage names ten and src/commands/task.ts handles exactly those ten, six as branches and four through the mutation path. project names four and dispatches four, shell three and three, and web, workspace, capability and session likewise.

### Main Changes

- the READMEs and the help name subsets of those - nine of the ten task subcommands, three of them in the help - which is what a way in is allowed to be, the same reading a previous round gave the switch list
- no check was added: the usage strings are prose in the same files as the dispatch, so a textual comparison would be a pattern pretending to be a claim, the class this session has met five times. The measurement is recorded where the surface is already documented layer by layer

### Git Commits

| Hash | Message |
|------|---------|
| `3177292` | docs(cli): the subcommand layer is measured, and it is clean |
| `49f21bc` | chore: archive the subcommands task |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. Installer tests: 119 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 96: The capability names the documents tell a user to run
<!-- trellis-session: v=2 fp=56bb9a65e8bce24e -->

**Date**: 2026-09-28
**Task**: The capability names the documents tell a user to run
**Branch**: `master`

### Summary

Measured by running the registry rather than grepping for it: dove-pi capability list prints fourteen names, and the two the READMEs tell a user to run - workspace.inspect and dev.project_test - are both in it. The help names none, which is right, because it shows capability run <name> as a placeholder.

### Main Changes

- the twelve the documents do not name are discoverable by running capability list, which is a document that cannot go stale - unlike cache and token, which two rounds ago were named nowhere at all
- the sharper reading was the mode own grant: modes/code-audit/governance.yaml lists five names under authority.capabilities, and three are capability names while repo.read and report.write are that mode own actions, declared in permissions.yaml and given an idempotency class below
- so nothing is broken and one thing was unstated: a reader could take every dotted name in that list for a capability. The permissions file explains the mix and the governance file did not, and now does

### Git Commits

| Hash | Message |
|------|---------|
| `7fe470f` | docs(modes): the grant holds two namespaces, and now says so |
| `bd6bf93` | chore(task): record the capability registry measurement and the two namespaces |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 739 tests, 737 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5. The mode files still load, which is what proves the added comment is a comment.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 97: The fields the specification names in the doctor projection
<!-- trellis-session: v=2 fp=b7b94c6a40b9549a -->

**Date**: 2026-09-28
**Task**: The fields the specification names in the doctor projection
**Branch**: `master`

### Summary

Measured by running doctor rather than reading the builder: requestDiagnostics carried schemaVersion alone while the contract named three fields as if all three were always there, and the subagent projection matched its own contract exactly.

### Main Changes

- reading the builder narrowed the finding: the interface marks both fields optional and the builder spreads them conditionally, so the code never overstated anything - the prose was the one place that did, and a consumer would get undefined silently on a fresh workspace
- the presence case is asserted in the CLI, adapter and RPC suites; the absence case, which is what a fresh workspace gets, was held by nothing. It is now
- and the assertion is the behaviour itself rather than a pattern over it - the key is omitted, not present with an undefined value, which is what a consumer iterating keys sees

### Git Commits

| Hash | Message |
|------|---------|
| `989ae8c` | fix(spec): the diagnostics fields are conditional, and a test holds the absence |
| `7fb26ec` | chore(task): record the conditional fields and the absence nothing held |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 740 tests, 738 pass, 0 fail, 2 skipped. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 98: The runtime versions, as declared and as enforced
<!-- trellis-session: v=2 fp=3e25405ea4abb18a -->

**Date**: 2026-09-28
**Task**: The runtime versions, as declared and as enforced
**Branch**: `master`

### Summary

Measured across seven places - package.json engines, the release manifest, installer/release.py, the readiness check, both bootstrap prerequisite calls, dove_pi.py own checks and both READMEs - and they agree. Two of the places compare the manifest exactly, so a drift there fails the readiness check and therefore a release.

### Main Changes

- what none of that held is the value that decides what a user machine does: MIN_NODE is the comparison the launcher makes before it will run at all, and the manifest is a declaration about it. If they disagree, a user is told one thing by the release and refused by the tool
- so the check asserts the enforcer against the declaration, for both variables - the node constant and the python comparison, which is a literal rather than a constant and is read as one
- and it was given a negative control: lowering MIN_NODE makes it fail with the two versions side by side, and restoring it makes it pass. The file was restored exactly, which the clean tree confirms

### Git Commits

| Hash | Message |
|------|---------|
| `a01ab65` | test(installer): the minimum the launcher enforces is the minimum the release declares |
| `525d50f` | chore(task): record the seven runtime minima and the enforcer nothing held |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 740 tests, 738 pass, 0 fail, 2 skipped. Installer tests: 120 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.


## Session 99: The environment variables, as documented and as read
<!-- trellis-session: v=2 fp=015c30d2a003fa82 -->

**Date**: 2026-09-28
**Task**: The environment variables, as documented and as read
**Branch**: `master`

### Summary

Measured: the code reads twenty-seven DOVE_PI_ variables and the documents named four. Seven are set by the launcher for the extension it starts, and sixteen were named nowhere - including the prefix fuse off switch, the context budget pair and the state directory.

### Main Changes

- no dead knobs: all four documented variables are read. The finding is the other direction - a knob a user cannot find is a knob that does nothing, and its failure is quiet, because the shell accepts the setting and the tool behaves as if it were absent
- the help now names them in two classes, the ones a user may set and the ones the launcher overwrites, and a check asserts that every variable the help names is one the code reads
- and that check failed its own control twice, the same way both times: the help text lives inside dove_pi.py, so searching that file found a planted name in the very block that names it. The Python side is parsed with ast now, which sees reads rather than text

### Git Commits

| Hash | Message |
|------|---------|
| `7e5b07d` | fix(cli): the variables the code reads are named, and the check that holds them parses rather than searches |

### Testing

- [OK] npm run typecheck: 0 errors. npm test: 740 tests, 738 pass, 0 fail, 2 skipped. Installer tests: 121 tests OK. The spec budget test is 5 of 5.

### Status

[OK] **Completed**

### Next Steps

- The first real turn, which needs a Pi host and a formal native task.
