# Design

## What changes, and what deliberately does not

**The format loses one field and keeps two decisions.** `permissions.yaml` keeps `ask_before` and `never_allow`;
`always_allow` is removed from `PERMISSION_FIELDS` (`src/core/work-mode.ts`) and from `PermissionSet`. Because the
loader's rule is that an unknown field is **refused by name, never ignored**, a mode still writing it fails to load and
is told which field. That is the fail-loud direction and it needs no new rule.

**The default stays `allow`.** An action on neither list runs. That is what the policy already does; the change is
that the *format* stops offering a field that could never alter it.

**`evaluatePermission` keeps its job and narrows its answer.** Its precedence rule (never_allow > ask_before > the
default) is the one place the rule lives, and the spec documents it, so the name and the function stay. Its return
becomes `"ask" | "deny"`: with `always_allow` gone there is no third answer to give, and a union arm that can never be
returned is the kind of declaration this task exists to remove. Callers that compare against `"allow"` lose that
comparison; there are none outside the policy and the tests.

## The policy's tail, before and after

```ts
// before: two inputs, one outcome
const permission = evaluatePermission(mode.permissions, invocation.tool);
if (permission === "ask" && matchesPermission(mode.permissions.ask_before, invocation.tool)) return ask;
return { outcome: "allow", ...(permission === "ask" ? { reason: "not on any list" } : {}) };

// after: one declared question, and the default
if (matchesPermission(mode.permissions.ask_before, invocation.tool)) return ask;
return { outcome: "allow", reason: "the mode neither asks about this action nor denies it" };
```

The old shape is worth recording because it is the bug: it computed `permission`, then decided on
`permission === "ask"` **and** a second lookup, so the `always_allow` answer could only reach the reason string. The new
shape has no branch that cannot change the outcome.

## The three mode files

| mode | before | after |
|---|---|---|
| code-audit | `always_allow: [repo.read]`, `ask_before: [report.write]`, `never_allow: [shell.exec, network.*]` | `ask_before: [write, edit]`, `never_allow: [bash, powershell, network.*]` |
| pentest | `always_allow: [net.scan]`, `ask_before: [exploit.run]`, `never_allow: [dos.*, social-engineering.*, physical.*]` | `ask_before: [exploit.run]`, `never_allow: [dos.*, social-engineering.*, physical.*]` |
| trading | `always_allow: [market.read]`, `ask_before: [order.submit]`, `never_allow: [order.withdraw_funds, production.*]` | `ask_before: [order.submit]`, `never_allow: [order.withdraw_funds, production.*]` |

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

- **A mode writing `always_allow` stops loading**, with a named unknown-field error. In this repository the only such
  modes are the three shipped ones, updated in the same change. Nothing else is affected: no runtime reads the field.
- **Rollback** is the field's return to `PERMISSION_FIELDS` and `PermissionSet`; the mode files' old entries can be
  restored, and the behaviour returns to today's - which is the behaviour this task exists to stop describing as a
  control.

## What the spec pays for itself

The Work-Mode scenario in `.trellis/spec/backend/personal-agent-framework-core.md` documents the precedence rule and
lists the fields, so it changes. That file has **56 bytes** of headroom against a 24 KiB budget
(`tests/spec-context-budget.test.ts`, which normalises CRLF before counting), so the edit is written to be **net
negative**: the precedence line loses `always_allow` and the matrix row about an unlisted tool is replaced, not added
to. The budget test runs as part of the change, not after it.
