import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createConfiguredPiSubagentProvider, createPiSubagentProvider, resolvePiChildCommand } from "../src/pi-adapter/subagent-provider.ts";

class FakeChild extends EventEmitter {
	readonly stdout = new EventEmitter();
	readonly stderr = new EventEmitter();
	killed = false;
	kill() { this.killed = true; this.emit("close", null, "SIGTERM"); return true; }
}

describe("Pi subagent provider", () => {
	it("requires explicit child configuration and keeps argv shell-free", () => {
		assert.equal(resolvePiChildCommand({}), undefined);
		assert.deepEqual(resolvePiChildCommand({ DOVE_PI_SUBAGENT_EXECUTABLE: "C:/Program Files/pi/pi.cmd" }), {
			executable: "C:/Program Files/pi/pi.cmd",
			prefixArgs: [],
		});
		assert.deepEqual(resolvePiChildCommand({
			DOVE_PI_SUBAGENT_EXECUTABLE: "pi",
			DOVE_PI_SUBAGENT_PREFIX_ARGS: '["--runner","child process"]',
		}), { executable: "pi", prefixArgs: ["--runner", "child process"] });
		assert.equal(resolvePiChildCommand({ DOVE_PI_SUBAGENT_EXECUTABLE: "pi", DOVE_PI_SUBAGENT_PREFIX_ARGS: "--runner child" }), undefined);
		assert.equal(createConfiguredPiSubagentProvider({}), undefined);
	});

	it("uses a fixed read-only argv and returns the child answer", async () => {
		let command = "";
		let args: readonly string[] = [];
		const child = new FakeChild();
		const provider = createPiSubagentProvider({
			command: { executable: process.execPath, prefixArgs: ["pi-cli.js"] },
			spawnChild(executable: string, childArgs: readonly string[]) { command = executable; args = childArgs; return child as never; },
		});
		const request = { dispatchId: "dispatch-1", name: "inspect", prompt: "Read files", cwd: process.cwd(), capabilities: ["read"] as const };
		const launch = await provider.launch(request);
		assert.equal(command, process.execPath);
		assert.deepEqual(args.slice(0, 10), ["pi-cli.js", "--mode", "text", "--print", "--no-session", "--no-extensions", "--tools", "read,grep,find,ls", "--", "Read files"]);
		const collecting = provider.collect(launch.runId);
		child.stdout.emit("data", "answer");
		child.emit("close", 0, null);
		assert.deepEqual(await collecting, { runId: launch.runId, dispatchId: "dispatch-1", state: "succeeded", value: "answer" });
	});

	it("rejects writable capabilities before starting a child", async () => {
		let started = false;
		const provider = createPiSubagentProvider({ command: { executable: process.execPath, prefixArgs: [] }, spawnChild(_executable: string, _args: readonly string[]) { started = true; return new FakeChild() as never; } });
		await assert.rejects(() => provider.launch({ dispatchId: "dispatch-2", name: "write", prompt: "edit", cwd: process.cwd(), capabilities: ["read", "write" as never] }), /read-only/);
		assert.equal(started, false);
	});

	it("settles cancellation once and does not rewrite a completed answer", async () => {
		const child = new FakeChild();
		const provider = createPiSubagentProvider({ command: { executable: process.execPath, prefixArgs: [] }, spawnChild() { return child as never; } });
		const launch = await provider.launch({ dispatchId: "dispatch-3", name: "inspect", prompt: "read", cwd: process.cwd(), capabilities: ["read"] });
		const pending = provider.collect(launch.runId);
		const cancelled = provider.cancel(launch.runId);
		const first = await cancelled;
		assert.equal(first.state, "cancelled");
		assert.deepEqual(await pending, first);
		assert.deepEqual(await provider.collect(launch.runId), first);
	});

	it("reports an unavailable configured executable without launching", async () => {
		const provider = createPiSubagentProvider({ command: { executable: "C:/missing/pi-child.exe", prefixArgs: [] } });
		assert.deepEqual(await provider.inspect(), {
			available: false,
			provider: "pi-child",
			reason: "Pi child executable is unavailable.",
		});
	});

	it("normalizes child failure and empty output as one terminal result", async () => {
		const failedChild = new FakeChild();
		const provider = createPiSubagentProvider({ command: { executable: process.execPath, prefixArgs: [] }, spawnChild() { return failedChild as never; } });
		const launch = await provider.launch({ dispatchId: "dispatch-failure", name: "inspect", prompt: "read", cwd: process.cwd(), capabilities: ["read"] });
		const pending = provider.collect(launch.runId);
		failedChild.stderr.emit("data", "child failed");
		failedChild.emit("close", 7, null);
		const terminal = await pending;
		assert.equal(terminal.state, "failed");
		assert.equal(terminal.error?.code, "child_exit");
		assert.match(terminal.error?.summary ?? "", /child failed/);
		failedChild.emit("close", 0, null);
		assert.deepEqual(await provider.collect(launch.runId), terminal);

		const emptyChild = new FakeChild();
		const emptyProvider = createPiSubagentProvider({ command: { executable: process.execPath, prefixArgs: [] }, spawnChild() { return emptyChild as never; } });
		const emptyLaunch = await emptyProvider.launch({ dispatchId: "dispatch-empty", name: "inspect", prompt: "read", cwd: process.cwd(), capabilities: ["read"] });
		const emptyPending = emptyProvider.collect(emptyLaunch.runId);
		emptyChild.emit("close", 0, null);
		const emptyTerminal = await emptyPending;
		assert.equal(emptyTerminal.state, "failed");
		assert.equal(emptyTerminal.error?.code, "child_exit");
	});
});
