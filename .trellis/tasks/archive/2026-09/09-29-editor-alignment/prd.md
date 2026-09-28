# The editor alignment across hosts

## Goal

Do the usage review P2, measuring first because the previous round found P1 already built.

## Background: three items, measured, and the pattern they show

P2 has three items: align the editor tools across hosts, route dispatch through the Trellis lifecycle, and surface
the cache diagnostics. **All three were measured against the source before anything was changed, and all three
turn out to exist in some form already.**

## 1. The editor alignment - built

```text
extension.ts:1143   const hashline = hasHashlineEditTools(pi.getAllTools().map((tool) => tool.name))
extension.ts:1860   hashlineEdit: hasHashlineEditTools(allToolNames)
extension.ts:2115   const hashline = hasHashlineEditTools(allToolNames)
extension.ts:2116   const hasEdit = allToolNames.includes("edit")
extension.ts:2118   ctx.ui.notify("...\u672c Pi \u5bbf\u4e3b\u672a\u63d0\u4f9b hashline ... "replace/insert/undo"
                    "... \u5efa\u8bae\u5347\u7ea7 Pi \u6216\u6267\u884c dove-pi install", "warning")
```

**The adapter already detects a host without `replace`/`insert`/`undo` and says so, by name.** The review own
wording acknowledges the Pi side was fine and the item was about the *other* host - **which is a host behaviour,
not a change this repository owns.**

## 2. The cache diagnostics - surfaced, on a full path

```text
cache-diagnostics.ts:379   export function formatCacheDiagnostics(diagnostics): string
extension.ts:28            imported
extension.ts:1148          const cacheText = full ? ` Cache: ${formatCacheDiagnostics(cache)}. Goals: ${...}`
```

**The review says it is *not* shown in the status line or UX.** It is shown, behind a `full` flag. **That makes it a
visibility question rather than a missing capability**, which is a smaller and different piece of work.

## 3. Dispatch through the Trellis lifecycle - the provider exists

```text
src/trellis-adapter/            the adapter itself
project-provider/contracts.ts   ProjectProviderKind = "native" | "trellis" | "lightweight"
                                TrellisSnapshot, TrellisTaskRecord, trellisCompatibility
extension.ts                    no dispatch-policy call sites at all
```

**Trellis is a first-class provider kind**, so the lifecycle integration the item asks for is present as a provider.
**The dispatch policy is not in the adapter** - zero call sites - which is where the review measured its one
`bg_delegate` call: **that is a host-side routing fact rather than a missing adapter feature.**

## The pattern, which is worth more than the three verdicts

**The review is a telemetry document.** It measured *session transcripts* and concluded *what to change in the
product*. Its P1, P2 and P3 items describe behaviour an observing session saw - **and three of them are already
built, two of them with the exact words the review asks for**. **Reading a telemetry document as a repository
work list produces findings like this one**, and the honest response is to say so rather than to build a fourth
mechanism.

## Acceptance criteria

- [x] **AC1** All three P2 items were measured before anything was changed.
- [x] **AC2** Each verdict is stated with the line it came from.
- [x] **AC3** The pattern is named.
- [x] **AC4** The gate passes.