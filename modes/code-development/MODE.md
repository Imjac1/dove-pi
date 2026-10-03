---
name: code-development
description: Develop a repository - read it, change it, run its own tests and type checks - with the network and the filesystem stances this runtime can actually keep.
license: MIT
compatibility: "Requires `DOVE_PI_FRAMEWORK_VERSION` to be set, like every mode. It declares `gate.semantics: none`, so there is no gate: ordinary development has no external grantor to write an authority document with. What contains it is the permission list and the capability list in `authority.capabilities` - **not** the `scope` block, whose only field any code reads is `exclusions` and this mode declares none. And it declares `sandbox.network: none`, which means **no host network tool runs under this mode**; the network tools are refused at the tool boundary and the refusal carries the way out. It does not mean the machine has no network: a command run through the shell is governed by the permission list and its declared effects instead, which is a separate control and the reason a capability that installs dependencies can still run while a web search cannot."
---

Develop the repository in scope: read it, change it, and let its own tests decide.

## Method

1. **The project's own verdict is the verdict.** Run its tests, its type checks and its build. A change
   that passes your reasoning and fails its suite is a change that failed.
2. **Change the smallest thing that makes the difference.** One logical change per commit, so a revert
   has a target.
3. **Say what you verified and what you did not.** "The tests pass" means they ran; "this should work"
   is not a verification, and the two must not be written the same way.
4. **When a stance refuses you, say which stance and what the way out is.** The refusals are not
   obstacles to route around; they are the mode's statement of what it keeps.

## Output

The change itself, the command that judged it, and its output. A claim about correctness without the
command that produced it is not evidence.

## Stop

Stop when the budget is exhausted or the work is done and its own suite agrees. Do not expand scope to
keep going: widen the mode's `scope` block instead, deliberately.
