# Ground truth: Anthropic "Building Effective AI Agents"

- Query: Independent verbatim extract, used to cross-check the wave-1 research agent's output
- Scope: official, fetched directly by the main session (not via sub-agent)
- Date: 2026-09-25
- Source: https://www.anthropic.com/engineering/building-effective-agents (fetched, HTTP 200)

## The pattern taxonomy, verbatim

- **Building block: The augmented LLM** - "The basic building block of agentic systems is
  an LLM enhanced with augmentations such as retrieval, tools, and memory."
- **Workflow: Prompt chaining** - "decomposes a task into a sequence of steps, where each
  LLM call processes the output of the previous one. You can add programmatic checks (see
  'gate' in the diagram below) on any intermediate steps to ensure that the process is
  still on track."
- **Workflow: Routing** - "classifies an input and directs it to a specialized followup
  task. This workflow allows for separation of concerns, and building more specialized
  prompts."
- **Workflow: Parallelization** - two named variations: "**Sectioning**: Breaking a task
  into independent subtasks run in parallel." and "**Voting**: Running the same task
  multiple times to get diverse outputs."
- **Workflow: Orchestrator-workers** - "a central LLM dynamically breaks down tasks,
  delegates them to worker LLMs, and synthesizes their results."
- **Workflow: Evaluator-optimizer** - "one LLM call generates a response while another
  provides evaluation and feedback in a loop."
- **Autonomous agent** - the final rung, past workflows.

So: 1 building block, 5 workflow patterns, then agents. That is the canonical count to
check the research agent against.

## Verbatim caveats that bear on this task

> Agents' autonomy makes them ideal for scaling tasks in trusted environments. The
> autonomous nature of agents means higher costs, and the potential for compounding
> errors. We recommend extensive testing in sandboxed environments, along with the
> appropriate guardrails.

> These building blocks aren't prescriptive. They're common patterns that developers can
> shape and combine to fit different use cases. The key to success, as with any LLM
> features, is measuring performance and iterating on implementations.

## The three stated core principles

> Maintain **simplicity** in your agent's design. Prioritize **transparency** by
> explicitly showing the agent's planning steps. Carefully craft your agent-computer
> interface (ACI) through thorough tool **documentation and testing**.

## The most decision-relevant line for this task

> Frameworks can help you get started quickly, but don't hesitate to reduce abstraction
> layers and build with basic components as you move to production.

Anthropic's own production guidance is to shed framework abstraction and build on basic
components. That is a direct argument against adopting a heavy third-party agent
framework as the base, and in favour of a thin owned loop with a narrow extension seam.

## Also relevant

- Guardrails are described as a **parallelization/sectioning** use case: "Implementing
  guardrails where one model instance processes user queries while another screens them
  for inappropriate content or requests. This tends to perform better than having the
  same LLM call handle both guardrails and the core response."
  Note this is a *screening* pattern, not an execution gate.
- "Reviewing a piece of code for vulnerabilities, where several different prompts review
  and flag the code if they find a problem" is given as the Voting example - i.e.
  code-audit-style review is cited as a parallelization/voting case, not an agent case.
- Three stated principles include "Prioritize transparency by explicitly showing the
  agent's planning steps."

## Caveats / Not Found

- The strings "Agents are systems where LLMs dynamically direct their own processes" and
  a literal "When to use agents" heading were not found verbatim; the page uses
  "Autonomous agent" plus "When to use agents:" as a lead-in. Do not quote those as
  verbatim.
- This file covers one source only. The Agent SDK, Agent Skills spec, and MCP spec
  sections are the research agent's responsibility.
