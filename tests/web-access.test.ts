import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
import { registerWebAccessCapabilities } from "../src/capabilities/web-access.ts";
import { executeFastPath } from "../src/core/fast-path.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";
import {
	getWebSearchConfigPath,
	parseHostname,
	parseProfileName,
	readWebSearchConfig,
	writeWebSearchConfig,
} from "../src/web-access/config.ts";

describe("web-access config", () => {
	it("resolves the pi-web-access config path from PI_CODING_AGENT_DIR", () => {
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = "C:/fake-agent-dir";
		try {
			assert.equal(
				getWebSearchConfigPath(),
				join("C:/fake-agent-dir", "web-search.json"),
			);
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
		}
	});

	it("validates hostnames and profile names like pi-web-access", () => {
		assert.equal(parseHostname("Example.COM."), "example.com");
		assert.equal(parseHostname("docs.example.com"), "docs.example.com");
		assert.throws(() => parseHostname("https://example.com"));
		assert.throws(() => parseHostname(""));
		assert.throws(() => parseHostname("ex ample.com"));
		assert.equal(parseProfileName("work"), "work");
		assert.throws(() => parseProfileName("9bad"));
		assert.throws(() => parseProfileName("has space"));
	});

	it("writes allowBrowserCookies and a merged host-scoped profile without clobbering other keys", async () => {
		const directory = await mkdtemp(join(tmpdir(), "dove-web-config-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = directory;
		try {
			await writeFile(
				join(directory, "web-search.json"),
				JSON.stringify({
					searxngBaseUrl: "https://searx.example",
					ssrf: { trustEnvProxy: true },
				}),
				"utf-8",
			);
			const first = writeWebSearchConfig({
				allowBrowserCookies: true,
				profile: { name: "work", hosts: ["docs.example.com"] },
			});
			assert.equal(first.allowBrowserCookies, true);
			assert.deepEqual(first.profiles[0]?.hosts, ["docs.example.com"]);

			// A second write merges new hosts and preserves unrelated config.
			const second = writeWebSearchConfig({
				profile: { name: "work", hosts: ["www.example.com"] },
			});
			assert.deepEqual([...second.profiles[0]?.hosts].sort(), [
				"docs.example.com",
				"www.example.com",
			]);
			const raw = JSON.parse(
				await readFile(join(directory, "web-search.json"), "utf-8"),
			);
			assert.equal(raw.searxngBaseUrl, "https://searx.example");
			assert.equal(raw.allowBrowserCookies, true);
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("refuses to write a profile with an empty host list", async () => {
		const directory = await mkdtemp(join(tmpdir(), "dove-web-config-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = directory;
		try {
			assert.throws(
				() => writeWebSearchConfig({ profile: { name: "work", hosts: [] } }),
				/at least one hostname/,
			);
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("reads missing or malformed configs as a safe fallback", async () => {
		const directory = await mkdtemp(join(tmpdir(), "dove-web-config-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = directory;
		try {
			assert.deepEqual(readWebSearchConfig().profiles, []);
			assert.equal(readWebSearchConfig().allowBrowserCookies, false);
			await mkdir(directory, { recursive: true });
			await writeFile(join(directory, "web-search.json"), "{not json", "utf-8");
			assert.equal(readWebSearchConfig().allowBrowserCookies, false);
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe("web-access capabilities", () => {
	const directory = () => process.env.PI_CODING_AGENT_DIR ?? "";
	async function withAgentDir<T>(fn: () => Promise<T>): Promise<T> {
		const dir = await mkdtemp(join(tmpdir(), "dove-web-capability-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = dir;
		try {
			return await fn();
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(dir, { recursive: true, force: true });
		}
	}

	it("registers web.access_status and web.real_user_setup", () => {
		const registry = new CapabilityRegistry();
		registerWebAccessCapabilities(registry);
		assert.deepEqual(
			registry.list().map((capability) => capability.name),
			["web.access_status", "web.real_user_setup"],
		);
		assert.equal(
			registry.require("web.access_status").sideEffects[0],
			"read_only",
		);
		assert.equal(
			registry.require("web.real_user_setup").sideEffects[0],
			"system_change",
		);
	});

	it("web.access_status reports readiness without writing anything", async () => {
		await withAgentDir(async () => {
			const registry = new CapabilityRegistry();
			registerWebAccessCapabilities(registry);
			const result = await executeFastPath(
				registry,
				new ExecutionLedger(join(directory(), "ledger.jsonl")),
				"web.access_status",
				{},
				{
					cwd: process.cwd(),
					mode: "fast",
					taskId: "test",
					stepId: "status",
				},
			);
			assert.equal(result.status, "success");
			const readiness = result.result as {
				configExists: boolean;
				allowBrowserCookies: boolean;
				profiles: unknown[];
			};
			assert.equal(readiness.configExists, false);
			assert.equal(readiness.allowBrowserCookies, false);
			assert.deepEqual(readiness.profiles, []);
		});
	});

	it("web.real_user_setup writes the auth config and is idempotent", async () => {
		await withAgentDir(async () => {
			const registry = new CapabilityRegistry();
			registerWebAccessCapabilities(registry);
			const ledger = new ExecutionLedger(join(directory(), "ledger.jsonl"));
			const first = await executeFastPath(
				registry,
				ledger,
				"web.real_user_setup",
				{ hosts: ["x.com"] },
				{
					cwd: process.cwd(),
					mode: "fast",
					taskId: "test",
					stepId: "setup-1",
				},
			);
			assert.equal(first.status, "success");
			const second = await executeFastPath(
				registry,
				ledger,
				"web.real_user_setup",
				{ hosts: ["y.com"], profile: "social" },
				{
					cwd: process.cwd(),
					mode: "fast",
					taskId: "test",
					stepId: "setup-2",
				},
			);
			assert.equal(second.status, "success");
			const readiness = second.result as {
				profiles: Array<{ name: string; hosts: string[] }>;
			};
			assert.ok(
				readiness.profiles.some(
					(profile) => profile.name === "default" && profile.hosts.includes("x.com"),
				),
			);
			assert.ok(
				readiness.profiles.some(
					(profile) => profile.name === "social" && profile.hosts.includes("y.com"),
				),
			);
		});
	});

	it("web.real_user_setup rejects an empty host list", async () => {
		await withAgentDir(async () => {
			const registry = new CapabilityRegistry();
			registerWebAccessCapabilities(registry);
			const result = await executeFastPath(
				registry,
				new ExecutionLedger(join(directory(), "ledger.jsonl")),
				"web.real_user_setup",
				{ hosts: [] },
				{
					cwd: process.cwd(),
					mode: "fast",
					taskId: "test",
					stepId: "setup-empty",
				},
			);
			assert.equal(result.status, "failed");
			assert.match(result.error ?? "", /at least one hostname/);
		});
	});
});
