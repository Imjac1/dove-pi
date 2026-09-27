# The RSI landscape as its community describes it, and where that puts us

- Date: 2026-09-27
- Why this file exists: `frontier-anatomy.md` is built from **papers**. D5 and D6 are about *self-improvement*,
  and self-improvement is the one subject where the papers and the people building the systems say different
  things. This is the community half: curated lists, practitioner posts, framework READMEs, forum threads.
- Method: web search plus direct reads. Sources tagged **[PRIMARY]** (the paper's own abstract / the framework's
  own README), **[COMMUNITY]** (a curated community artifact), **[BLOG]** (a practitioner's post), **[THREAD]**
  (forum or social). Anything I could not reach at its source is named as such in §6. Nothing here is a paper
  claim unless it says so.

---

## 1. The definition the community uses, and the label it forces on us

**[BLOG]** Philipp Schmid, "Recursive Self-Improvement", 2026-08-21
(`https://www.philschmid.de/recursive-self-improvement`). His test is **which layer persists after the run**:

| Level | What moves | What stays fixed |
|---|---|---|
| **Iteration** | the output | the system, the verifier |
| **Self-improvement** | the **system** (a tool, a skill, a compaction policy) - "future tasks run through a different system" | the verifier - "the ruler that says better does not move" |
| **Recursive self-improvement** | the system **and the verifier** - "later rounds face a harder, still-honest test" | nothing the system can reach |

And then the sentence that matters for us: "Current systems work best when an external evaluator stays fixed.
A test passes, validation loss drops, or a benchmark score rises. **The system can search because it has a ruler
it doesn't control.**" His conclusion is explicit - we are **not** at RSI - and the reason is stated twice:
"If it can edit evaluation, it can jailbreak itself. **Reward hacking is the default behavior of a system asked
to raise a number.** The agent and the system that verifies it have to stay apart for the moment." And: "**Public
evidence for [raising the bar] remains thin.**"

**Consequence.** Under this definition **D5 is bounded self-improvement and must be called that**. The
distinction is not pedantry: it is the difference between a claim with a test (the system changed, the verifier
did not) and a claim with no public demonstration (the verifier rose, still honest, still uncaptured). His
summary of the second: "Verification is the bottleneck. Every convincing result has a ruler the system does not
own. The moment the system owns the ruler, it will get very good at looking improved."

This is the same rule as `frontier-anatomy.md` §9.1-9.3 from a different direction - AHE's read-only verifier,
Weng's "permission control and security layers need to live outside this loop", and now a practitioner stating
the *test* for the level above us.

---

## 2. The measurement layer, which §15.4 said did not exist

`decisions.md` §15.4 records: "**the frontier's top open problem, not the frontier's practice**", on the strength
of `2609.00006` §17.2's future-work list ("unified evaluation frameworks", "formal verification of safety
policies", "cross-system benchmark suite"). **The community half contradicts part of that**, and the correction
belongs in D6:

- **[COMMUNITY+PRIMARY]** **RSI-Bench** (`https://github.com/sunghunkwag/rsi-bench`) - "an open-source
  benchmark framework ... RSI-Bench decomposes RSI into six measurable axes", with the stated purpose
  "to distinguish genuine self-improvement from **metric gaming**". Six axes, each scored in [0,1], combined by a
  **weighted harmonic mean that "penalizes systems that score zero on any dimension"**:

  | Axis | Measures | Key metric |
  |---|---|---|
  | Self-Modification Depth (SMD) | how many meta-levels can be modified (L0-L4) | max stable modification level |
  | Improvement Trajectory Quality (ITQ) | how efficiently performance improves over iterations | slope, acceleration, **stagnation escape rate** |
  | Operator Discovery Rate (ODR) | can it synthesize novel useful operators | discovery rate, cross-task transfer, diversity index |
  | Meta-Adaptation Speed (MAS) | how fast it adapts to distributional shift | recovery time, adaptation gain, shock resilience |
  | Safety & Stability (SSM) | does self-modification preserve integrity | **crash-free ratio, Pareto preservation, sandbox violations** |
  | Autonomous Goal Generation (AGG) | can it define its own objectives | goal novelty, feasibility rate, curriculum quality |

- **[BLOG]** **HarnessOpt-Bench** - the methodological template, in Schmids's words: "An agent edits its harness
  on development feedback; **a separate system tests the candidate on hidden tasks.** Across **111 runs, 5
  optimizer models, and 4 tasks**, results varied sharply by model and task." That is D6's held-in/held-out split
  built by someone else, at a scale we could not reach alone.
- **[BLOG]** **PAST-Bench** - "asks whether stored experience actually helps later episodes. **In many of its
  scenarios, turning memory on does not.**"
- **[COMMUNITY]** Others named but not read: **PostTrainBench** `2603.08640`, **RSIBench-Data** `2607.25886`,
  **LongWoF-Bench** `2608.23200`.

**Consequence - D6's reason changes a second time.** §15.4's claim was "the field does not have the instrument".
The accurate claim is narrower: **the instrument exists for measuring self-improvement, and does not exist for
the verifier-raising axis** - Schmidt's "did the next round face a harder bar the system still could not cheat?"
is exactly AGG and is the thinnest axis in the community's own framework, and he says no public system does it.
So D6's cheapest step is no longer "flip the gap tests and invent a score": it is **adopt a named axis**.
SSM and ITQ are the two that describe observables we already have - SSM's `sandbox violations` is D1's build, and
`crash-free ratio` is our ledger's stop reasons; ITQ's `slope` and `stagnation escape rate` need the per-round
scores our convergence snapshot is one short step from carrying.

---

## 3. Where this project is catalogued, and the bar for the category

**[COMMUNITY]** `github.com/lobehub/awesome-rsi` is the field's curated map. It has a **Harness-level RSI**
section (Prompt & Program Optimization / Context & Memory Evolution / Harness & Scaffold Evolution / Extensible
Harness Substrates / Self-Verification / Self-Evolving Agent Frameworks), plus Multi-Agent, Automated AI R&D,
Safety, Benchmarks, and Frameworks sections. Three things in it are about us:

1. **We are listed.** Under **"Extensible Harness Substrates"**: "[**Pi**](https://github.com/earendil-works/pi) -
   self-extensible coding-agent harness with a reusable agent runtime, terminal UI, and unified multi-provider
   LLM API", alongside Agent Zero, **DeepSeek Harness**, and OpenClaw.
2. **And the category comes with a warning we do not meet.** "Extensible agent runtimes that expose prompts,
   tools, skills, memory, plugins, or control flow as modifiable surfaces. These systems do not necessarily
   implement self-improvement by default, but can serve as **substrates** for RSI experiments. **General
   extensibility alone is insufficient.** An RSI substrate should expose agent-relevant runtime components ...
   as programmatically modifiable surfaces suitable for **persistent self-modification** experiments." The
   catalogue's own framing: **we are a substrate, not an RSI system** - which matches §1's label exactly.
3. **It independently confirms the corrected AHE ID.** Its "Harness & Scaffold Evolution" entry is
   "[Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses](https://arxiv.org/abs/2604.25850)"
   - a third source for `2604.25850`, alongside AHE's own abstract and no longer `2603.03329` (which the same
   list carries separately as AutoHarness, "eliminating illegal actions across 145 TextArena games").

**[BLOG]** On what the substrate *costs*, Schmid is exact, and it is our subject: on Pi - "It ships 4 tools
(`read`, `write`, `edit`, `bash`) and a system prompt under 1,000 tokens. Everything else is a TypeScript
extension, auto-discovered from `.pi/extensions/`. **An agent can write one, reload it, and continue with new
tools.**" Then: "**An agent gets more code it can improve, and more ways to break compatibility or weaken a
permission boundary.**" He puts the spectrum as fixed core (Claude Code, Codex, Cursor) -> Pi (four built-ins,
everything else an extension the agent can write and reload) -> DeepSeek Harness (models, sandboxes and **the
control loop itself** are swappable plugins).

**Consequence.** Our extension `src/pi-adapter/extension.ts` **is** one of those auto-discovered extensions. So
the risk is not hypothetical and not someone else's: the substrate's own feature is that an agent can write and
reload the code that constrains it, and nothing in our tree distinguishes "the policy" from "any other file"
(`decisions.md` delta 3: `protected|immutable|tamper` over `src/` returns nothing). **This is the strongest
argument yet for D8**, and it comes from the substrate's own documentation rather than from a safety paper.

---

## 4. The risk taxonomy, aimed at exactly what D5 would be

**[PRIMARY]** `2509.26354` "Your Agent May Misevolve: Emergent Risks in Self-evolving LLM Agents" (ICLR 2026)
- abstract read. It "evaluate[s] misevolution along four key evolutionary pathways: **model, memory, tool, and
  workflow**", and finds "misevolution is a widespread risk, **affecting agents built even on top-tier LLMs**".
Two of the named emergent risks are ours by construction: "the **degradation of safety alignment after memory
accumulation**", and "the **unintended introduction of vulnerabilities in tool creation and reuse**".

Also named in the same section of the map, read at title/abstract level only: **SAHOO** `2603.06333`
(monitoring alignment drift "through **goal-drift detection, constraint-preservation checks, and regression-risk
analysis**"), **TamperBench** `2602.06911` (safety under fine-tuning, weight-space modification and
**tampering**), **Evaluating Goal Drift** `2505.02709`, **AI Sandbagging** `2406.07358`, and
**Performance of Bounded-Rational Agents With the Ability to Self-Modify** `2011.06275` - "self-modification
can amplify errors and gradually misalign bounded-rational agents even when ideal rational agents would preserve
their objectives".

**Consequence, and it is a gift.** **SAHOO's "constraint-preservation check" is our founding defect under a
different name.** What this project has been calling "a declaration with no consumer" is, in the safety
literature, "a constraint that was not preserved" - and the check they name is a *preservation* check, not an
existence check. That is `decisions.md` Round 11 delta 1 arriving from the other side: the sensor we want asks
whether the declaration **still governed the run**, which is a *following* sensor, not a reader scan. And
`2011.06275` supplies the reason a bounded-rational agent needs it even when the design looks sound.

---

## 5. The empirical counterweights

The honest priors, all **[BLOG]** unless tagged:

- **Keep-rate.** Karpathy's `autoresearch`: "~700 experiments, one GPU ... **~20 changes kept and transferred**",
  2.02 -> 1.80 h to GPT-2 quality. A ~3% keep rate where the gate, not the proposal, is the cost.
- **Variance.** HarnessOpt-Bench's 111 runs "varied **sharply** by model and task".
- **Experience may not help.** PAST-Bench: memory on often does not improve later episodes.
- **Agent-run hill-climbing.** Cline hill-climbed `Opus 4.5` 47% -> 57% on Terminal-Bench by hand; an agent then
  ran the same method for "17 hours and about $50" and moved `Kimi K3` from 69 of 89 tasks to 79 - and "**the
  report does not show whether the updated system became better at finding its next change**". That is §1's
  iteration/self-improvement boundary being crossed and *not* measured.
- **The industry's own claim side [PRIMARY]** - Anthropic, "When AI builds itself"
  (`anthropic.com/institute/recursive-self-improvement`): a March 2026 poll of 130 research staff with a median
  of ~4x self-reported output; Claude's success on the most open-ended tasks at 76% in May 2026; an automated
  Claude reviewer that a retrospective says would have caught ~a third of past production bugs. Recorded as the
  *claim* side, not as evidence for our decisions - the numbers are self-reported and the page argues for a
  programme.
- **[THREAD]** The HN thread on that piece (`news.ycombinator.com/item?id=48400842`) is dominated by
  **reviewability**, not by the metaphysics of RSI: the top-voted stories are a 600-file/40k-line AI PR that a
  colleague refused to review, and another merged without approval. The community's practical objection to the
  productivity claim is that a diff nobody can vet is not a gain. That is D3's subject, stated by practitioners.

---

## 6. What is disputed, and what is not established

- **Disputed, and worth recording as disputed.** Whether harness-level work should be called RSI at all:
  `awesome-rsi` opens by conceding that "**not every work listed here demonstrates RSI in the strict sense**;
  some represent bounded self-improvement or enabling techniques", while Weng's post titles the whole area
  "Harness Engineering **for** Self-Improvement" and calls it "a near-term path" to RSI. Schmid's three-level
  test is the cleanest arbiter we found, and it puts us at level 2.
- **Not established by me.** (1) Whether `2609.00006` §17.2's "the field does not have it" was about the
  *instrument* or about the verifier-raising axis - the two readings are both defensible and I could not load
  the survey's HTML to check. (2) HarnessOpt-Bench's own paper, PAST-Bench's own paper, and PostTrainBench -
  named by name only, read second-hand through Schmid's post. (3) A "Princeton-led study" he cites on agents
  executing AI-research engineering but not choosing original directions - **no identifier given, not checked,
  do not cite**. (4) RSI-Bench's six-axis scores on any real system - the framework is open source and we have
  not run it.
- **Not a source.** `x_search` is degraded this session (it fell back to a web index), so the social-platform
  half here is a single practitioner blog plus one HN thread rather than a labelled sample of opinion. Recorded
  so a later round does not treat this file as community consensus.
