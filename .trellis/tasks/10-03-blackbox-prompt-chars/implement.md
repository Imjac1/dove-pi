# Implementation: remove the declared field with no writer, or give it one
## Done when

- [x] 目标句已改写为已定位的事实（`## Goal` ✓）。
- [ ] 用例**先见红**：real 路径产出的 summary 不再呈现一个该路径填不了的字段。
- [ ] `/status full` 的 `prompt=<n>` 有自己的用例 —— 它成为该主题**唯一**的读数，不能是唯一没有用例的那个。
- [ ] 对照：faux 路径的 summary 与证据**逐字节不变**（确定性套件已在断言它）。
- [ ] `personal-agent-field-run.md` 写明：证据记录带什么、为什么**不含**那个外部字段、大小在哪里读。
- [ ] 门全绿：`npm test` · `spec-anchors` · `document-drift` · `task-artifact-lint --assert-corpus`。

Depends on the operator's choice in `design.md`. The checklist below is the recommended branch **(b) drop the external
field**; under **(a) record on the real path too**, step 2 becomes "install the capture extension for both providers" and
step 3 becomes "say in the field-run page that the recorder is inside the measured path".

## Ordered checklist

1. **Write the case first, and watch it red.** Under (b): the summary a run produces must not carry a field that cannot
   be populated on the path that produced it. Red today, because `:308` reads `providerEvidence` unconditionally while
   `:110` installs its writer only for `faux`.

2. **Decide the shape of the removal, and prefer marking over deleting where a reader may have older summaries.** A
   field that disappears silently from a JSON document is harder to notice than one that is absent by rule; the field-run
   page is where the rule is written, and the case asserts the rule rather than a particular key's absence.

3. **Point the reading at the product's own count.** `/status full`'s `prompt=<n>` is measured working on a real run
   (`prompt=28340`, this task's own record). If it has no case of its own, give it one here - a reading that becomes the
   only one for its subject should not be the one without a test.

4. **One paragraph in `personal-agent-field-run.md`**: what a field run's evidence record carries, why the external
   prompt-size field is not among it, and where the size is read instead. The paragraph is the fix for a reader who goes
   looking, which is the failure this task is about.

5. **Update the PRD's goal sentence** to the located fact - the record is absent on the real path because the recorder is
   installed only for `faux` - since the current sentence states a measurement that is not accurate.

6. **Run the doors and the suite**: `npm test` (the blackbox suite is the one that changes), `spec-anchors`,
   `document-drift`, `task-artifact-lint --assert-corpus`.

## Validation

- The case is the acceptance criterion: a summary from the real path does not present a field that path cannot fill.
- The control: the faux path's summary and evidence are unchanged, which is what the deterministic suite already asserts.
- The PRD's second acceptance criterion (root cause located with an anchor) is already met and stays met.
- The third (the goal sentence rewritten) is step 5.

## What is deliberately left out

- Any change to the product's own prompt-size reading.
- Any attempt to make the external field meaningful by measuring it elsewhere; that is branch (a), and it is a different
  design with its own cost.
- Re-opening whether Pi 1.0.0 is at fault - the PRD's out-of-scope list already closes it.
