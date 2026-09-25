# Ground truth: Anthropic's current architecture statements (Apr-Jun 2026)

- Query: What is the vendor's *current* position on framework form, loop ownership, and
  harness decomposition? (The Dec 2024 "Building effective agents" post carries its own
  staleness banner pointing here.)
- Scope: first-party, fetched directly by the main session
- Date: 2026-09-25
- Sources:
  - https://www.anthropic.com/engineering/managed-agents - "Scaling Managed Agents:
    Decoupling the brain from the hands", **Published Apr 08, 2026**
  - https://code.claude.com/docs/en/workflows.md - "Orchestrate subagents at scale with
    dynamic workflows"

## 1. The decomposition: session / harness / sandbox (verbatim)

> We virtualized the components of an agent: **a session** (the append-only log of
> everything that happened), **a harness** (the loop that calls Claude and routes Claude's
> tool calls to the relevant infrastructure), and **a sandbox** (an execution environment
> where Claude can run code and edit files). This allows the implementation of each to be
> swapped without disturbing the others. **We're opinionated about the shape of these
> interfaces, not about what runs behind them.**

This is the vendor's own answer to "what is an agent framework made of". Three components,
three interfaces, independently swappable. It maps cleanly onto the user's problem: a base
framework owns the *shapes*; a vertical swaps implementations behind them.

## 2. Why harness assumptions rot (verbatim)

> **Harnesses encode assumptions that go stale as models improve.**

Concrete example given:

> Claude Sonnet 4.5 would wrap up tasks prematurely as it sensed its context limit
> approaching - a behavior sometimes called "context anxiety." We addressed this by adding
> context resets to the harness. But when we used the same harness on Claude Opus 4.5, we
> found that the behavior was gone. **The resets had become dead weight.**

Implication for a base framework: any mitigation encoded for today's model weakness must
be removable without touching the other two components. This is an argument for keeping the
harness thin and the interfaces explicit.

## 3. "Don't adopt a pet" - the failure mode of coupling the three (verbatim)

> We started by placing all agent components into a single container, which meant the
> session, agent harness, and sandbox all shared an environment. ... But by coupling
> everything into one container, we ran into an old infrastructure problem: we'd adopted a
> **pet**. ... In our case, the server became that pet; **if a container failed, the session
> was lost**. If a container was unresponsive, we had to nurse it back to health.

And the observability consequence:

> Nursing containers meant debugging unresponsive stuck sessions. Our only window in was the
> WebSocket event stream, but that couldn't tell us *where* failures arose, which meant that
> **a bug in the harness, a packet drop in the event stream, or a container going offline all
> presented the same**.

Implication: the session must outlive any single execution environment, and failures must be
attributable to a layer. For a base framework this argues for the session as a durable,
separately-addressed component - not a field inside the runtime.

## 4. Dynamic workflows: the "who holds the plan" taxonomy (verbatim table)

`code.claude.com/docs/en/workflows.md`:

> A dynamic workflow is a JavaScript script that orchestrates many subagents at once. Claude
> writes the script for the task you describe, and a runtime executes it in the background
> while your session stays responsive.

The doc's own comparison, with **"who holds the plan"** as the discriminator:

| | Subagents | Skills | Agent teams | Workflows |
|---|---|---|---|---|
| What it is | A worker Claude spawns | Instructions Claude follows | A lead agent supervising peer sessions | A script the runtime executes |
| Who decides what runs next | Claude, turn by turn | Claude, following the prompt | The lead agent, turn by turn | **The script** |
| Where intermediate results live | Claude's context window | Claude's context window | A shared task list | **Script variables** |
| What's repeatable | The worker definition | The instructions | The team definition | **The orchestration itself** |
| Scale | A few del... (truncated in fetch) | | | |

This is the cleanest published taxonomy found so far for "which orchestration shape should a
given vertical use", and it is orthogonal to the 2024 pattern list. It also names the
motivating failures directly:

> When you ask the default Claude Code harness to do a task, it needs to both plan and
> execute in the same context window. For many coding tasks, this is highly effective, but
> **it can break down over long-running, massively parallel, highly structured and/or
> adversarial tasks.**

"Adversarial" and "long-running" are precisely the pentest and audit verticals.

## 5. Verticals needed custom harnesses, per the vendor

From the companion blog post (found via search; the page redirects to `claude.dev`, which was
not fetched directly - **treat the following as search-snippet-grade until verified**):

> While the default Claude Code harness is built for coding, it is also useful for many other
> types of tasks because, as it turns out, many tasks resemble coding tasks. But there are
> certain classes of tasks where **we have had to build custom harnesses on top of Claude
> Code** to achieve peak performance such as Research, **security analysis**, agent teams, or
> **Code Review**.

The snippet also lists six workflow patterns Claude composes: **classify-and-act,
fanout-and-synthesize, adversarial verification, generate-and-filter, tournament, and loop
until done**. If accurate, this is a newer pattern set than the 2024 five and includes two
(adversarial verification, tournament) that the 2024 post does not name.

**Unverified**: the six pattern names and the custom-harness quote above come from a search
result snippet, not from a fetched page. Must be fetched from `claude.dev` before citation.

## Implications for the base-framework decision

1. **The decomposition is settled by the vendor**: session / harness / sandbox, swappable,
   opinionated only about interface shape. A base framework should expose exactly these three
   seams rather than one monolithic "agent" object.
2. **The user's instinct - a base framework with verticals on top - matches the vendor's own
   path**: Anthropic built custom harnesses for security analysis and code review rather than
   one universal prompt.
3. **"Who holds the plan" is the orchestration decision**, and it is per-task, not per-product.
   A base framework needs to support more than one answer.
4. **Context-anxiety mitigations are perishable.** Any base-framework logic that exists to
   compensate for a model weakness must be isolated behind a removable seam.

## Caveats / Not Found

- The `claude.com/blog/...` URL redirects cross-origin to `claude.dev` and was not followed;
  section 5 is snippet-grade.
- The workflows doc's scale row and the full "when to use" section were truncated in the
  fetch. The six-pattern figure ("FIG C") is an image and its caption is the only text.
- Managed Agents is a *hosted service*; its interfaces are described conceptually in the post,
  not specified. The post's own docs link (`/docs`) was not followed.
