import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyInvocation, declaredMutatingToolNames, declaredNetworkToolNames, declaredReadOnly, isReadOnlyShellCommand } from "../src/core/invocation-disposition.ts";
import { createDoveRuntime } from "../src/runtime.ts";

/**
 * **One question, asked once, and the two answers its consumers read out of it.**
 *
 * This module replaced two name tables and two vocabularies that disagreed about the same unknown tool: the freeze gate
 * read a tool nobody declared as *not a mutation* and let it run, while the replay path read it as *not replay-safe* and
 * refused. Both readings survive, because both are deliberate - what changed is that they are now two readings of one
 * classification instead of two classifications, and each is asserted here so a later reader meets the difference as a
 * decision rather than as an accident.
 *
 * **The case list is the old one, moved rather than rewritten.** It used to live in `request-lifecycle-pi.test.ts`,
 * asserting `isPiToolInvocationIdempotent` through the adapter. The classifier is where that question lives now, so the
 * assertions are about the classifier - and they are stricter than before, because they can see `disposition` and
 * `basis` as well as the boolean.
 */
describe("what an invocation is, and what that answer rests on", () => {
	it("classifies only reviewed read-only tools and fully idempotent recipes as retry-safe", () => {
		const { capabilities, recipes } = createDoveRuntime();
		const classify = (toolName: string, input: Readonly<Record<string, unknown>>) => classifyInvocation({ toolName, input, registry: capabilities, recipes });

		assert.equal(classify("read", {}).replaySafe, true);
		assert.equal(classify("agent_run_capability", { name: "workspace.inspect" }).replaySafe, true);
		assert.equal(classify("agent_run_capability", { name: "dev.project_test" }).replaySafe, false);
		assert.equal(classify("agent_run_recipe", { name: "windows.readonly_baseline" }).replaySafe, true);
		assert.equal(classify("agent_run_recipe", { name: "dev.validate_project" }).replaySafe, false);
		assert.equal(classify("third_party_unknown", {}).replaySafe, false);
	});

	it("answers `unknown` rather than guessing, and each consumer reads that answer its own way", () => {
		const { capabilities, recipes } = createDoveRuntime();
		const unknown = classifyInvocation({ toolName: "mcp_some_server_write", input: {}, registry: capabilities, recipes });

		// The gate's reading: an undeclared tool is not a product mutation, so a formal run does not need frozen
		// acceptance criteria before it can run. That is the pre-existing stance, and it is why the gate names the tool
		// rather than blocking it - the adapter records an `undetermined-disposition` refusal for the same call.
		assert.equal(unknown.disposition, "unknown", "the gate must not read an undeclared tool as a mutation it never declared");
		// The replay path's reading: the same answer, the opposite decision, because its question is "may this run
		// twice" rather than "may this run at all". An undeclared side effect that runs twice is the failure it exists
		// to prevent, so being wrong here costs a recorded effect rather than a duplicated one.
		assert.equal(unknown.replaySafe, false, "the replay path must not read an undeclared tool as replay-safe");
		assert.equal(unknown.basis, "name-table", "and it says the answer came from the name, which is all it had");

		// The name is not a declaration even when it reads like one: a tool called `..._write` is still undeclared.
		assert.equal(classifyInvocation({ toolName: "mcp_some_server_write", input: { path: "a" }, registry: capabilities, recipes }).disposition, "unknown");
	});

	it("never lets a command's text claim replay safety, and says so in the basis", () => {
		const { capabilities, recipes } = createDoveRuntime();
		const classify = (command: string) => classifyInvocation({ toolName: "bash", input: { command }, registry: capabilities, recipes });

		assert.equal(classify("git status").disposition, "read-only", "the gate admits a read-only inspection before criteria are frozen");
		assert.equal(classify("rm -rf build").disposition, "mutating");
		// **The three measured false positives.** Each one changes something and each one reads as read-only, which is
		// why a `command-text` answer is enough for the gate and never enough to replay: refusing to replay a read-only
		// command is harmless, replaying a mutation is not, and this pattern cannot tell them apart.
		for (const command of ["git branch -D feature", "find . -name '*.tmp' -delete", "sed -n 'w out.txt' in.txt"]) {
			assert.equal(classify(command).disposition, "read-only", command + " reads as read-only, which is the measured false positive");
			assert.equal(classify(command).replaySafe, false, command + " must still not be replay-safe");
		}
		assert.ok(
			["git status", "rm -rf build", "git branch -D feature"].every((command) => classify(command).basis === "command-text"),
			"every shell answer says it came from the text, so a caller can see it is not strong enough to carry replay",
		);
		assert.equal(classify("").disposition, "mutating", "an unreadable command fails closed at the gate");
	});

	it("keeps the one pre-existing asymmetry between a named capability and a named recipe", () => {
		const { capabilities, recipes } = createDoveRuntime();
		// A capability the registry does not hold has no `sideEffects` to read, so the gate reads it as "not a
		// mutation" - the older gate did exactly this, and collapsing it into `mutating` here would be a behaviour
		// change dressed as a tidy-up.
		assert.equal(classifyInvocation({ toolName: "agent_run_capability", input: { name: "no.such_capability" }, registry: capabilities, recipes }).disposition, "unknown");
		assert.equal(classifyInvocation({ toolName: "agent_run_capability", input: {}, registry: capabilities, recipes }).disposition, "unknown");
		// A recipe whose declaration cannot be read is the one case where `unknown` would be dishonest: the gate's
		// older reading of an unreadable recipe was already "treat it as a mutation", so it fails closed on both answers.
		assert.equal(classifyInvocation({ toolName: "agent_run_recipe", input: { name: "no.such_recipe" }, registry: capabilities, recipes }).disposition, "mutating");
		assert.equal(classifyInvocation({ toolName: "agent_run_recipe", input: {}, registry: capabilities, recipes }).disposition, "unknown");
	});

	it("reads one declaration table from both sides, so a name cannot be read-only for one consumer and not the other", () => {
		assert.equal(declaredReadOnly("read"), true, "a reviewed read-only tool is read-only by name");
		assert.equal(declaredReadOnly("write"), false, "a declared mutation is not read-only by name");
		assert.equal(declaredReadOnly("mcp_some_server_write"), undefined, "an undeclared tool is neither, which is the answer the consumers act on");

		// The name-only view and the mutating-name view are two readings of the same table, so they must partition it:
		// every name is in exactly one of them, and nothing is in both.
		const mutating = declaredMutatingToolNames();
		assert.ok(mutating.length > 0, "the table declares mutations, or the fence's union check would compare against nothing");
		assert.deepEqual(mutating.filter((toolName) => declaredReadOnly(toolName) === true), [], "a name cannot be declared a mutation and read-only at once");
		assert.ok(mutating.includes("write") && mutating.includes("agent_workspace_patch"), "and the view names the mutations the fence has to refuse");
	});

	it("reads the shell predicate the gate depends on, unchanged", () => {
		// The predicate moved here with the rest of the mutation question. It is asserted through its own module now,
		// which is where a reader of the gate's behaviour will look for it.
		assert.equal(isReadOnlyShellCommand("bash", { command: "git status --porcelain" }), true);
		assert.equal(isReadOnlyShellCommand("powershell", { command: "Get-ChildItem -Force" }), true);
		assert.equal(isReadOnlyShellCommand("read", { path: "a.ts" }), false, "it answers for the shell, and only the shell");
		assert.equal(isReadOnlyShellCommand("bash", { command: "npm install" }), false);
	});

	it("lets a project's own test command run before the freeze, in more than one language", () => {
		// **The predicate's own doc states the intent** - it allows "common read-only inspection and verification
		// commands to run before an acceptance contract is frozen" - and `go test` / `go vet` are in the grammar for
		// exactly that. Measured 2026-10-11, eleventh field run: the graded project is Python, the model's first act was
		// to run its suite, and the grammar had no Python entry, so the convergence gate refused a **measurement** as a
		// product mutation and ended the request. The same command in Go is allowed. A grammar that admits one
		// ecosystem's test runner and refuses another's is not conservative, it is arbitrary - and this one blocked the
		// step the acceptance criteria are read from.
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -m pytest -q 2>&1 | tail -30" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -m pytest tests/test_immutable.py -q" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "pytest -q" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "python3 -m unittest discover" }), true);
		// The parity, stated as parity rather than as a new permission: this is the entry that was already there.
		assert.equal(isReadOnlyShellCommand("bash", { command: "go test ./... 2>&1 | tail -20" }), true);
		// **It is the runner that is allowed, not Python.** `-m` names a module and only a test module is in the set, and
		// a bare `pytest` has to be the whole word - so a server, a `-c` program, and a name that merely starts with the
		// runner all stay mutations, because the text cannot tell what they will do.
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -m http.server 8000" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -c \"open('f','w').write('x')\"" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -m pytest_cache_filler" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "npm test" }), false, "an npm script is arbitrary, so it is not admitted by this change");
	});

	it("names every host tool that reaches the network, and nothing that does not", () => {
		// **The list is written here on purpose.** The sandbox's `network: none` is a boundary claim, so the set of tools it
		// covers is a decision rather than a detail: a ninth name is a change to what that mode refuses, and the point of
		// asserting the whole set here is that adding one has to be written down twice - once in the declaration and once in
		// this sentence about it. Before 2026-10-05 this set lived in three places at once (`action-policy.ts` carried eight
		// names, this module declared four of the same tools, and the representative catalog carried a third set) and no two
		// of them were compared, so "does `network: none` cover browser calls" had three answers.
		assert.deepEqual([...declaredNetworkToolNames()].sort(), [
			"agent_browser",
			"browser",
			"fetch_content",
			"get_search_content",
			"mcp",
			"mcpScript",
			"source_check",
			"web_search",
		]);
		// A tool whose only reach is the local machine is not in it, or the axis would refuse ordinary work.
		for (const local of ["read", "grep", "ls", "write", "bash", "agent_project_status"]) {
			assert.ok(!declaredNetworkToolNames().includes(local), local + " reaches nothing outside the machine");
		}
	});
});
