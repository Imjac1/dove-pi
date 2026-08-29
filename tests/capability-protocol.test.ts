import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CapabilityInvocationService } from "../src/core/capability-invocation.ts";
import { CAPABILITY_PROTOCOL_VERSION, parseCapabilityInvocationRequest, parseCapabilityInvocationResponse, type CapabilityInvocationRequest } from "../src/core/capability-protocol.ts";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";

function request(name: string, overrides: Partial<CapabilityInvocationRequest> = {}): CapabilityInvocationRequest {
	return {
		protocolVersion: CAPABILITY_PROTOCOL_VERSION,
		capability: { name },
		arguments: {},
		context: { cwd: process.cwd(), mode: "standard", taskId: "trellis:test", stepId: "protocol" },
		correlation: { requestId: `request-${name}`, hostSessionId: "host-session" },
		approval: "not_required",
		...overrides,
	};
}

function registry(): CapabilityRegistry {
	const registry = new CapabilityRegistry();
	registry.register({
		name: "fixture.read", version: "1.0.0", description: "read fixture", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "stable",
		parameterSchema: { type: "object", additionalProperties: false },
		preconditions: [{ id: "workspace", description: "workspace is readable", required: true }],
		evidence: [{ kind: "verification", description: "verified result", required: false }],
		async execute() { return { ok: true }; },
	});
	registry.register({
		name: "fixture.fail", version: "1.0.0", description: "failure fixture", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "tested",
		async execute() { throw new Error("fixture failure"); },
	});
	registry.register({
		name: "fixture.wait", version: "1.0.0", description: "wait fixture", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "tested",
		async execute(_args, context) {
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, 10_000);
				context.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
			});
		},
	});
	registry.register({
		name: "fixture.write", version: "1.0.0", description: "write fixture", platforms: ["any"], sideEffects: ["workspace_write"], idempotent: false, status: "verified",
		async execute() { return { changed: true }; },
	});
	registry.register({
		name: "fixture.windows", version: "1.0.0", description: "Windows fixture", platforms: ["windows"], sideEffects: ["read_only"], idempotent: true, status: "stable",
		async execute() { return { windows: true }; },
	});
	return registry;
}

describe("Capability Protocol", () => {
	it("validates versioned success, failure, timeout, cancellation, denial, and platform fixtures", async () => {
		const fixtures = JSON.parse(await readFile(new URL("./fixtures/capability-protocol/outcomes.json", import.meta.url), "utf8")) as unknown[];
		assert.equal(fixtures.length, 6);
		for (const fixture of fixtures) assert.equal(parseCapabilityInvocationResponse(fixture).protocolVersion, CAPABILITY_PROTOCOL_VERSION);
		assert.throws(() => parseCapabilityInvocationRequest({ protocolVersion: "2.0.0" }), /Invalid Capability Protocol/);
		for (const version of ["1.0.0-01", "1.0.0-.x", "1.0.0-alpha..1"]) {
			assert.throws(() => parseCapabilityInvocationResponse({
				protocolVersion: CAPABILITY_PROTOCOL_VERSION,
				capability: { name: "fixture.read", version },
				status: "success",
				correlation: { requestId: "invalid-semver", executionId: "exec-invalid-semver" },
				durationMs: 0,
				evidenceRefs: [],
			}), /Invalid Capability Protocol/, `${version} is not valid SemVer 2.0.0`);
		}
	});

	it("discovers the public manifest and executes success/failure through one host-neutral service", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-protocol-"));
		try {
			const service = new CapabilityInvocationService(registry(), new ExecutionLedger(join(temporary, "ledger.jsonl")), { platform: "windows", captureEvidence: () => ["evidence://safe/result"] });
			const manifest = service.discover().find((entry) => entry.name === "fixture.read");
			assert.equal(manifest?.protocolVersion, CAPABILITY_PROTOCOL_VERSION);
			assert.equal(manifest?.preconditions[0]?.id, "workspace");
			const success = await service.invoke(request("fixture.read"));
			assert.equal(success.status, "success");
			assert.deepEqual(success.evidenceRefs, ["evidence://safe/result"]);
			const failure = await service.invoke(request("fixture.fail"));
			assert.equal(failure.status, "failure");
			assert.match(failure.error ?? "", /fixture failure/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("rejects a registry definition with a non-semver capability version during discovery", async () => {
		const invalid = registry();
		invalid.register({
			name: "fixture.invalid-version", version: "1.0.0-01", description: "invalid version fixture",
			platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "draft",
			async execute() { return undefined; },
		});
		const temporary = await mkdtemp(join(tmpdir(), "dove-protocol-version-"));
		try {
			const service = new CapabilityInvocationService(invalid, new ExecutionLedger(join(temporary, "ledger.jsonl")));
			assert.throws(() => service.discover(), /not valid SemVer 2\.0\.0/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("enforces each capability's advertised parameter schema before execution", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-protocol-args-"));
		try {
			const service = new CapabilityInvocationService(registry(), new ExecutionLedger(join(temporary, "ledger.jsonl")), { platform: "windows" });
			await assert.rejects(
				() => service.invoke(request("fixture.read", { arguments: { unexpected: true } })),
				/advertised parameter schema/,
			);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("excludes credential-bearing evidence references by default", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-protocol-evidence-"));
		try {
			const service = new CapabilityInvocationService(registry(), new ExecutionLedger(join(temporary, "ledger.jsonl")), {
				platform: "windows",
				captureEvidence: () => [
					"evidence://safe/result.json",
					"file:///workspace/.env",
					"C:\\workspace\\credentials.json",
					"C:\\workspace\\github-token.txt",
					"C:\\workspace\\prod-secret.json",
					"C:\\workspace\\api_key_backup.txt",
					"C:\\workspace\\.npmrc",
					"C:\\workspace\\id_rsa",
					"C:\\workspace\\certificate.crt",
				],
			});
			const result = await service.invoke(request("fixture.read"));
			assert.deepEqual(result.evidenceRefs, ["evidence://safe/result.json"]);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("normalizes approval denial, unsupported platform, timeout, and cancellation", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-protocol-terminal-"));
		try {
			const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
			const service = new CapabilityInvocationService(registry(), ledger, { platform: "linux" });
			assert.equal((await service.invoke(request("fixture.write", { approval: "denied" }))).status, "approval_denied");
			assert.equal((await service.invoke(request("fixture.write", { approval: "granted" }))).status, "approval_denied", "an untrusted payload cannot self-authorize without a host callback");
			assert.equal((await service.invoke(request("fixture.windows"))).status, "unsupported_platform");
			assert.equal((await service.invoke(request("fixture.wait", { execution: { timeoutMs: 10 } }))).status, "timeout");
			const controller = new AbortController();
			controller.abort();
			assert.equal((await service.invoke(request("fixture.wait"), controller.signal)).status, "cancelled");
			assert.equal((await ledger.findIncompleteCapabilityExecutions()).length, 0);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});
});
