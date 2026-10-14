# Design: an external reading with no writer on the real path

## The gap, from the located root cause

The PRD's root cause is located and anchored: `scripts/real-dove-blackbox.mjs:110` installs the recording extension only
when `providerMode === "faux"`, and `:308` reads `providerEvidence: readProviderEvidence(providerCapturePath)` on every
run. So on `--provider real` - which is what a field run is - the array is always empty, and `systemPromptChars` has **no
writer at all** on that path.

That is not a field going stale. It is the repository's own defect class, in the shape the front door already names for
record kinds: **something declared that nothing produces**, which a reader then sees as a mechanism. The earlier reading
that saw a zero came from the faux leg, where a writer exists; on the real leg there is nothing to be zero.

## The two branches, and the recommendation

| branch | what it does | for and against |
|---|---|---|
| **(a) record on the real path too** | install a capture extension for `--provider real`, so `providerEvidence` is populated where a field run reads it | **for**: an external reading beside the product's own is a cross-check - the harness's evidence is not supposed to be its own word. **against**: the recorder becomes part of the path being measured, and a capture extension that fails to load changes the run it is measuring |
| **(b) drop the external field, keep the product's reading** | remove or mark `systemPromptChars` so no reader goes looking for a record that cannot exist, and point the reading at `/status full`'s `prompt=<n>` | **for**: the product's own reading is already measured working on a real run (`prompt=28340`, in this task's own record), and it removes a declared-but-unproduced field instead of adding a writer to keep it alive. **against**: one fewer independent reading, so a bug in the product's own count would have nothing to contradict it |

**Recommendation: (b)**, on this repository's own terms rather than on convenience. The front door holds that a declared
kind with no writer is a defect; the fix it prescribes is to give it a writer **or delete it**, and (a) gives a writer to
a reading whose only purpose was to be independent of the thing it would now be installed into. The cost is stated rather
than hidden: cross-validation of the prompt size is lost, and the field that remains is the product's own.

**If the operator chooses (a)**, the design changes shape: the capture extension is installed for both providers, the case
asserts `providerEvidence` is non-empty under `--provider real`, and the field-run specification must say that the
recorder is inside the measured path - which is the sentence that makes (a) honest rather than free.

## Files this changes, and why each is necessary

| file | why |
|---|---|
| `scripts/real-dove-blackbox.mjs` | (b): `:308` stops reporting a field that has no writer on the real path; (a): `:110` installs the recorder for both providers |
| `tests/real-dove-blackbox.test.ts` | the case: (b) asserts the summary no longer carries a field that cannot be populated, (a) asserts the evidence is non-empty under `--provider real` |
| `.trellis/spec/backend/personal-agent-field-run.md` | what a field run's evidence record does and does not carry, with the reason - it is the page a reader of a run's summary is sent to |
| `tests/pi-adapter.test.ts` (only under (b)) | the product's own `prompt=<n>` reading, if it has no case of its own, becomes the thing the field-run page points at |

## What this is not

- **Not a Pi version question.** The PRD's out-of-scope list already closes it: the record is absent on the real path
  because of where the recorder is installed, not because of what the host reports.
- **Not a change to the product's own reading.** `prompt=<n>` stays exactly as it is; under (b) it becomes the reading,
  and under (a) it stays the one that is cross-checked.
- **Not a new field.** Neither branch adds a reading; both remove a disagreement between a declared field and its writer.

## How the change is shown not to alter behaviour

The measured path is the faux leg, which is what the deterministic suite runs; neither branch touches it. Under (b) the
change is to what the summary reports on the real leg, so the assertion is on the summary's shape rather than on a run.
Under (a) the faux leg's output must stay byte-identical, which is the control that shows the second installation did not
disturb the first.
