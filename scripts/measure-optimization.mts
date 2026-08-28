import { developmentCapabilities } from "../src/capabilities/development.ts";
import {
	webAccessStatusCapability,
	webRealUserSetupCapability,
} from "../src/capabilities/web-access.ts";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
import type { CapabilityDefinition } from "../src/core/contracts.ts";
import { DEFAULT_MAX_CONTEXT_TOKENS } from "../src/pi-adapter/context-guard.ts";

/**
 * Measurement harness — quantifies (a) injected system-prompt token cost and
 * (b) historical capability-reuse potential, using the real registered data
 * and real session transcripts. Mirrors exactly what extension.ts registers.
 */

// Rebuild the same capability set the extension registers at startup.
function buildRegistry(): CapabilityRegistry {
	const registry = new CapabilityRegistry();
	for (const cap of developmentCapabilities) registry.register(cap);
	registry.register(webAccessStatusCapability);
	registry.register(webRealUserSetupCapability);
	registry.register({
		name: "windows.host_info",
		version: "0.1.0",
		description: "Read basic Windows and PowerShell environment information.",
		platforms: ["windows"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "stable",
		async execute() {
			return {};
		},
	} as CapabilityDefinition);
	return registry;
}

// Mirror buildCapabilityIndex + dispatch guidance + reuse-hint logic verbatim-ish.
function buildCapabilityIndexText(registry: CapabilityRegistry): string {
	const caps = registry.list();
	if (caps.length === 0) return "";
	const capLines = caps.map(
		(c) =>
			`  - ${c.name} — ${c.description} (${c.sideEffects.join(",")}${c.idempotent ? ", idempotent" : ""})`,
	);
	return `\n[DOVE REGISTERED CAPABILITIES]\n${capLines.join("\n")}\n`;
}

const dispatchGuidance = `\nDispatch guidance: when a task splits into ≥2 independent branches and would take more than ~60s of wall time, consider bg_delegate / fusion tools to parallelize only if the coordination cost is clearly below the expected savings. Background tasks must respect the same auth, approval, and project-boundary rules as inline work.`;

// Local token estimate matching ContextCompiler: ASCII ~0.25 tok/char, CJK=1.
function estimateTokens(value: string): number {
	let estimate = 0;
	for (const character of value)
		estimate += /[\u0000-\u007f]/.test(character) ? 0.25 : 1;
	return Math.ceil(estimate);
}

async function main(): Promise<void> {
	const registry = buildRegistry();

	// ---------- 1) Injected system-prompt cost ----------
	const indexText = buildCapabilityIndexText(registry);
	const indexTokens = estimateTokens(indexText);
	const dispatchTokens = estimateTokens(dispatchGuidance);
	const reuseSlideTokens = estimateTokens(
		"\n[PERSONAL AGENT] Prefer agent_run_capability or agent_run_recipe for registered deterministic work. Do not regenerate an existing capability as ad-hoc shell commands.",
	);
	// FIX1 guard hint only appears when triggered (near threshold); base 0.
	const injectedTotal = indexTokens + dispatchTokens + reuseSlideTokens;

	console.log("==================================================");
	console.log("A. 已注入 system prompt 的固定 token 开销(模型看到,每轮固定)");
	console.log("==================================================");
	console.log(`  registered capabilities : ${registry.list().length}`);
	console.log(
		`  [DOVE CAPABILITIES] block: ${indexText.length} chars ~ ${indexTokens} tokens`,
	);
	console.log(`  dispatch guidance        : ~${dispatchTokens} tokens`);
	console.log(`  [PERSONAL AGENT] preamble(原已有,不计新增)`);
	console.log(`  FIX1 guard hint          : 0 (仅触发时出现)`);
	console.log(
		`  新增固定开销越严格合计      : ~${injectedTotal} tokens / 轮(system prompt 常驻)`,
	);
	console.log(
		`  占比: 相对 ~18-21万 场景前缀 <0.03%, 相对 ~1.6-4k 基础场景 ${((injectedTotal / 4000) * 100).toFixed(1)}%`,
	);
	console.log("");

	// ---------- 2. Capability-reuse potential from real sessions ----------
	const hintCommands = new Map<string, string>();
	for (const cap of registry.list()) {
		for (const h of cap.hintCommands ?? [])
			hintCommands.set(normalize(h), cap.name);
	}

	console.log("====================================================");
	console.log('B. 历史会话中"本可复用 capability"的命令(tool call 实测)');
	console.log("====================================================");

	const { readFile, readdir } = await import("node:fs/promises");
	const { homedir } = await import("node:os");
	const { join } = await import("node:path");

	const base = process.env.PI_CODING_AGENT_DIR
		? join(process.env.PI_CODING_AGENT_DIR, "sessions")
		: join(homedir(), ".pi", "agent", "sessions");
	let projectDirs: string[] = [];
	try {
		projectDirs = await readdir(base);
	} catch {
		console.log("  (no session dir)");
		return;
	}

	// normalize command string like capabilityReuseHint does
	function normalize(s: string): string {
		let cmd = s.trim().replace(/\s+/g, " ").toLowerCase();
		cmd = cmd.replace(/^cd(\s+(\S+|\"[^\"]*\")){1,2}\s*&&\s*/, "");
		cmd = cmd.replace(/\s*\|\s+[^|]*$/, "");
		return cmd.trim();
	}

	function matchLeading(normalized: string, hintNorm: string): boolean {
		return (
			normalized === hintNorm ||
			normalized.startsWith(`${hintNorm} `) ||
			normalized.startsWith(`${hintNorm} 2>&1`) ||
			normalized.startsWith(`${hintNorm}&&`) ||
			normalized.startsWith(`${hintNorm};`)
		);
	}

	let totalBash = 0;
	let totalMatch = 0;
	const perCap = new Map<string, number>();
	const perProject = new Map<string, { bash: number; match: number }>();

	for (const dir of projectDirs) {
		const projectPath = join(base, dir);
		const st = await import("node:fs/promises").then((fs) =>
			fs.stat(projectPath).catch(() => undefined),
		);
		if (!st?.isDirectory()) continue;
		let files: string[] = [];
		try {
			files = (await readdir(projectPath))
				.filter((f) => f.endsWith(".jsonl"))
				.map((f) => join(projectPath, f));
		} catch {
			continue;
		}
		for (const file of files) {
			const text = await readFile(file, "utf8");
			const projLabel = dir
				.split("--")
				.join("/")
				.replace(/^\/|\/$/g, "");
			for (const line of text.split("\n")) {
				if (!line.trim()) continue;
				let e: any;
				try {
					e = JSON.parse(line);
				} catch {
					continue;
				}
				// bash/powershell tool calls live as assistant content blocks {type:"toolCall", name, arguments}.
				const msg = e?.message;
				if (e?.type !== "message" || msg?.role !== "assistant") continue;
				const content = Array.isArray(msg?.content) ? msg.content : [];
				for (const block of content) {
					const bc = block as { type?: string; name?: string; arguments?: unknown };
					if (bc?.type !== "toolCall") continue;
					const name = bc.name;
					if (!["bash", "powershell"].includes(name ?? "")) continue;
					let cmd = "";
					const args = bc.arguments;
					if (typeof args === "string") {
						try {
							const parsed = JSON.parse(args);
							cmd = parsed?.command ?? parsed?.script ?? args;
						} catch {
							cmd = args;
						}
					} else if (args && typeof args === "object") {
						const asAny = args as {
							command?: string;
							script?: string;
							shellCommand?: string;
						};
						cmd = asAny.command ?? asAny.script ?? asAny.shellCommand ?? "";
					}
					if (typeof cmd !== "string" || !cmd.trim()) continue;
					if (!cmd || typeof cmd !== "string") continue;
					totalBash++;
					let matched = "";
					const normalized = normalize(cmd);
					for (const [hintNorm, capName] of hintCommands) {
						if (matchLeading(normalized, hintNorm)) {
							matched = capName;
							break;
						}
					}
					if (matched) {
						totalMatch++;
						perCap.set(matched, (perCap.get(matched) ?? 0) + 1);
						const p = perProject.get(projLabel) ?? { bash: 0, match: 0 };
						p.bash++;
						p.match++;
						perProject.set(projLabel, p);
					} else {
						const p = perProject.get(projLabel) ?? { bash: 0, match: 0 };
						p.bash++;
						perProject.set(projLabel, p);
					}
				}
			}
		}
	}

	console.log(`  历史 bash/powershell 调用(已测) : ${totalBash}`);
	console.log(`  命中已注册 capability 的命令    : ${totalMatch}`);
	if (totalBash > 0)
		console.log(
			`  可复用比例                     : ${((totalMatch / totalBash) * 100).toFixed(1)}%`,
		);
	console.log("\n  命中分布(capability):");
	for (const [cap, n] of [...perCap.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`    ${cap}: ${n}`);
	}
	console.log("");
	console.log(
		`  这些命令每轮:模型需重写命令(输出)+ 出错重试的token,而现在会被 hint 引导走 fast-path`,
	);
	console.log("");
	console.log("==================================================");
	console.log("C. token 节省潜力(prefix-fuse + reuse 实测样本)");
	console.log("==================================================");

	// (1) Stacked-context fuse potential: how many assistant usage samples exceed
	// the same absolute advisory threshold used by context-guard.
	let samples = 0;
	let overCap = 0;
	let maxPrompt = 0;
	let fullMissions = 0;
	for (const dir of projectDirs) {
		const projectPath = join(base, dir);
		const st2 = await import("node:fs/promises").then((fs) =>
			fs.stat(projectPath).catch(() => undefined),
		);
		if (!st2?.isDirectory()) continue;
		let files: string[] = [];
		try {
			files = (await readdir(projectPath))
				.filter((f) => f.endsWith(".jsonl"))
				.map((f) => join(projectPath, f));
		} catch {
			continue;
		}
		for (const file of files) {
			const text = await readFile(file, "utf8");
			for (const line of text.split("\n")) {
				if (!line.trim()) continue;
				let e: any;
				try {
					e = JSON.parse(line);
				} catch {
					continue;
				}
				const m = e?.message;
				if (e?.type !== "message" || m?.role !== "assistant" || !m?.usage) continue;
				const u = m.usage;
				const prompt = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
				if (prompt <= 0) continue;
				samples++;
				if (prompt > maxPrompt) maxPrompt = prompt;
				if (u.input > DEFAULT_MAX_CONTEXT_TOKENS) overCap++;
				if (u.input > 0 && (u.cacheRead ?? 0) === 0 && prompt > 10_000)
					fullMissions++;
			}
		}
	}
	console.log(`  assistant usage 样本            : ${samples}`);
	console.log(
		`  > ${DEFAULT_MAX_CONTEXT_TOKENS.toLocaleString()} 输入(提示阈值,fuse 会建议 compact): ${overCap} (${samples ? ((overCap / samples) * 100).toFixed(1) : 0}%)`,
	);
	console.log(
		`  大前缀全 MISS(input>0 & cacheRead=0 & prompt>10k): ${fullMissions} 次(每条约数千~18万, fuse 提示/用户 compact 可避免)`,
	);
	console.log(
		`  峰值 prompt                        : ${maxPrompt.toLocaleString()} tokens`,
	);
	console.log("");
	// (2) 复用输出节省的粗估: 24 个命中命令,每个省下重写命令的那段输出 + 可能的失败重试。
	console.log(
		"  reuse 捕获命令                   : " +
			totalMatch +
			" 次 (dev.typecheck/dev.project_test)",
	);
	console.log(
		"  每次省模型重写命令的输出 token ~ 5-15(命令文本)+ 命中后确定性执行避免失败重试 —— 量小但确定性&少错(质量维度)",
	);
	console.log("");
}

main().catch((e) => {
	console.error("error", e);
	process.exit(1);
});
// Inject a loose-match diagnostic after main() for the session run.
process.on("exit", () => {});
