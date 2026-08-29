import { performance } from "node:perf_hooks";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectProvider } from "../src/project-provider/index.ts";
import { buildInteroperableProjectContext } from "../src/context/interoperable.ts";
import { LocalCapabilityAdapter } from "../src/adapters/local-rpc.ts";
import { CAPABILITY_PROTOCOL_VERSION } from "../src/core/capability-protocol.ts";

const ITERATIONS = 25;
const temporary = await mkdtemp(join(tmpdir(), "dove-interop-benchmark-"));
try {
	const provider = createProjectProvider(process.cwd());
	const refreshMs = measure(() => provider.getContext(), ITERATIONS);
	const contextMs = measure(() => buildInteroperableProjectContext(provider, "protocol capability adapter", "standard"), ITERATIONS);
	const adapter = new LocalCapabilityAdapter(join(temporary, "ledger.jsonl"));
	const invocationSamples: number[] = [];
	for (let index = 0; index < ITERATIONS; index++) {
		const started = performance.now();
		await adapter.invoke({
			protocolVersion: CAPABILITY_PROTOCOL_VERSION,
			capability: { name: "workspace.inspect" },
			arguments: { path: "package.json" },
			context: { cwd: process.cwd(), mode: "fast", taskId: "benchmark", stepId: `invoke-${index}` },
			correlation: { requestId: `benchmark-${index}` },
			approval: "not_required",
		});
		invocationSamples.push(performance.now() - started);
	}
	const context = buildInteroperableProjectContext(provider, "protocol capability adapter", "standard");
	console.log(JSON.stringify({
		iterations: ITERATIONS,
		providerRefresh: summary(refreshMs),
		contextCompilation: summary(contextMs),
		capabilityInvocation: summary(invocationSamples),
		context: { chars: context.context.charCount, estimatedTokens: context.context.estimatedTokens, authorities: context.projection.authorities.length },
	}, null, 2));
} finally {
	await rm(temporary, { recursive: true, force: true });
}

function measure(action: () => unknown, iterations: number): number[] {
	const samples: number[] = [];
	for (let index = 0; index < iterations; index++) {
		const started = performance.now();
		action();
		samples.push(performance.now() - started);
	}
	return samples;
}

function summary(samples: readonly number[]) {
	const ordered = [...samples].sort((left, right) => left - right);
	return {
		meanMs: round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
		p95Ms: round(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)] ?? 0),
	};
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
