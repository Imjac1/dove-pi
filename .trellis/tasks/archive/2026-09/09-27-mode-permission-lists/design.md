# Design

## What changes, and what deliberately does not

**The format gains one required field and keeps all three lists.** `permissions.yaml` must state `unlisted: allow`
or `unlisted: ask`, and it keeps `always_allow`, `ask_before` and `never_allow`. `always_allow` becomes the list
that answers `unlisted: ask` for named actions, which is the only configuration where it can decide anything - so the
loader **refuses** `unlisted: allow` beside a non-empty `always_allow`, naming both ways out. That is the rule the gate
already obeys ("a declaration that cannot decide anything is refused, at the level it is declared") applied to the pair
the stance creates.

**The default is the mode's, not the code's.** An action on none of the three lists gets the stance the mode declared.
A mode that declares no stance is refused by name rather than defaulted: a default here is a policy nobody chose, and
this is the one field in the format where an unstated value would decide whether an action runs.

**`evaluatePermission` keeps its name, its precedence and its three answers.** Its precedence rule (never_allow >
ask_before > always_allow > the stance) is the one place the rule lives, and the spec documents it. The change is its
last line: it returns `permissions.unlisted` instead of a constant `"ask"`. Its contract no longer says an unlisted
action is always `ask` - it says the unlisted answer is the mode's, and that nothing in the function invents one.

## The policy's tail, before and after

```ts
// before: two inputs, one outcome, and the first input could only reach the reason string
const permission = evaluatePermission(mode.permissions, invocation.tool);
if (permission === "ask" && matchesPermission(mode.permissions.ask_before, invocation.tool)) return ask;
return { outcome: "allow", ...(permission === "ask" ? { reason: "not on any list" } : {}) };

// after: one input, three outcomes, and the reason names the list that produced it
const permission = evaluatePermission(mode.permissions, invocation.tool);
if (permission === "ask") return ask;   // ask_before, or the mode's own 'unlisted: ask'
return {
  outcome: "allow",
  ...(permission === "allow" && matchesPermission(mode.permissions.always_allow, invocation.tool)
    ? { reason: "on always_allow, so it runs without the confirmation the stance would otherwise require" }
    : {}),
};
```

The old shape is worth recording because it is the bug: it computed `permission`, then decided on
`permission === "ask"` **and** a second lookup, so the `always_allow` answer could only reach the reason string. The new
shape has no branch that cannot change the outcome - `permission` **is** the outcome.

## The three mode files

| mode | before | after |
|---|---|---|
| code-audit | `always_allow: [repo.read]`, `ask_before: [report.write]`, `never_allow: [shell.exec, network.*]` | `unlisted: allow`, `ask_before: [write, edit]`, `never_allow: [bash, powershell, network.*]` |
| pentest | `always_allow: [net.scan]`, `ask_before: [exploit.run]`, `never_allow: [dos.*, social-engineering.*, physical.*]` | `unlisted: allow`, `ask_before: [exploit.run]`, `never_allow: [dos.*, social-engineering.*, physical.*]` |
| trading | `always_allow: [market.read]`, `ask_before: [order.submit]`, `never_allow: [order.withdraw_funds, production.*]` | `unlisted: allow`, `ask_before: [order.submit]`, `never_allow: [order.withdraw_funds, production.*]` |

`unlisted: allow` in all three is the stance the user's option-A reasoning asks for: no mode prompts about a tool it did
not list. `always_allow` is therefore empty in all three, which the loader would refuse to leave non-empty anyway.

**Capability-shaped entries stay, including ones nothing implements.** `exploit.run`, `order.submit`, `network.*` and
`dos.*` are policy for a capability the *deployment* may provide; `09-27-mode-declared-capability` established that a
mode naming one is stating an environment requirement, not a malformed mode. They become live the moment such a
capability is registered, because the registration check passes first and the deny/ask then fires. The entries that
were wrong were the *host-tool* ones, which could never match anything.

**Why `ask_before: [write, edit]` for code-audit rather than nothing.** The mode's intent is "ask before writing the
report". The list is name-based and the condition is about the argument, so the finer rule is not expressible; asking
on every write is stricter than intended, which is the safe direction, and it is *live* rather than inert.

**Version bumps.** Each mode's `governance.yaml` version moves: what the mode authorizes changed. code-audit
1.6.0 -> 1.7.0, pentest 1.1.0 -> 1.2.0, trading 1.1.0 -> 1.2.0. The convention is asserted by
`tests/code-audit-mode.test.ts` and is the only way a run can be attributed to one authority set.

## The two comments that depend on the claim

`src/capabilities/code-audit.ts:19-22` and `src/code-audit/seed-scanner.ts:10-12` both reason from
`never_allow: [shell.exec]` as an enforced rule. After this change the rule is `never_allow: [bash, powershell]` and it
**is** enforced, so both comments stay true with one word changed - and the change is what makes them true. Correcting
them to say "not enforced" would have been the alternative, and it would have left the mode declaring a prohibition it
does not have.

## Compatibility and rollback

- **A mode that does not state `unlisted` stops loading**, with a named missing-field error that offers both values.
  In this repository the only such modes are the three shipped ones, updated in the same change.
- **A mode that writes `always_allow` beside `unlisted: allow` stops loading**, with a named error. No shipped mode
  does; the fixture in `tests/host-work-mode.test.ts` does, which is how the accepting case is covered.
- **Rollback** is one line: delete `unlisted` from `PERMISSION_FIELDS`, `PermissionSet`, `parsePermissions` and the
  two load rules, and let `evaluatePermission`'s last line return `"allow"` again. The mode files' `unlisted:` lines
  then become unknown fields and are refused by name, so they have to go too - the behaviour returns to today's, which
  is the behaviour this task exists to stop describing as a control.

## What the spec pays for itself

The Work-Mode scenario in `.trellis/spec/backend/personal-agent-framework-core.md` documents the precedence rule and
lists the fields, so it changes. That file has **55 bytes** of headroom against a 24 KiB budget
(`tests/spec-context-budget.test.ts`, which normalises CRLF before counting), and the change **adds two matrix rows**,
so the edit had to pay for them: the `ask` bullet was rewritten from five lines to four, and three bullets were
compressed. The result is **+46 bytes, leaving 9 of headroom** - measured, not estimated, and the budget test ran as
part of the change rather than after it. The next change to this file will have to cut something.
