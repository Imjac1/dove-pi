import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exactInstallSpec, getProfilePackages } from "../src/extensions/catalog.ts";
import { getExtension } from "../src/extensions/catalog.ts";
import { checkProfileConflicts, inspectExtensionProfile } from "../src/extensions/doctor.ts";
import { installExtensionProfile, npmEnvironment } from "../src/extensions/install.ts";
import { projectExtensionCapabilities } from "../src/extensions/capabilities.ts";

describe("extension profiles", () => {
	it("keeps optional native packages while disabling repeated npm advisory work", () => {
		const env = npmEnvironment({ npm_config_optional: "true", KEEP_ME: "yes" });
		assert.equal(env.KEEP_ME, "yes");
		assert.equal(env.npm_config_optional, undefined);
		assert.equal(env.npm_config_include, "optional");
		assert.equal(env.npm_config_audit, "false");
		assert.equal(env.npm_config_fund, "false");
		assert.equal(env.npm_config_progress, "false");
		assert.equal(env.npm_config_update_notifier, "false");
	});
	it("projects configured Pi plugins as host-owned capabilities without registering Core executors", () => {
		const configured = ["npm:pi-open-tui@0.2.15", "npm:pi-web-access@0.24.2", "npm:pi-mcp-adapter@2.27.0"];
		const projected = projectExtensionCapabilities(configured, ["web_search"]);
		assert.equal(projected.find((entry) => entry.id === "host.telemetry")?.status, "available");
		assert.equal(projected.find((entry) => entry.id === "host.web_access")?.status, "available");
		assert.deepEqual(projected.find((entry) => entry.id === "host.mcp_client")?.missingTools, ["mcp"]);
		assert.ok(projected.every((entry) => entry.provider === "pi-extension"));
	});

	it("keeps settings before the single preferred TUI renderer", () => {
		assert.deepEqual(getProfilePackages("minimal").map((entry) => entry.id).slice(0, 2), ["extension-settings", "open-tui"]);
		assert.equal(getProfilePackages("minimal").some((entry) => entry.id === "powerbar"), false);
		assert.equal(getExtension("open-tui").currentVersion, "0.2.15");
		assert.equal(getExtension("open-tui").minPi, "0.80.0");
	});

	it("reports missing packages without making network calls", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-pi-extension-doctor-"));
		const settingsPath = join(temporary, "settings.json");
		await writeFile(settingsPath, JSON.stringify({ packages: ["npm:pi-open-tui", "npm:@juanibiapina/pi-extension-settings"] }), "utf8");
		const report = await inspectExtensionProfile("minimal", {
			cwd: temporary,
			settingsPath,
			piVersion: "0.84.3",
			nodeVersion: "22.19.0",
			platform: "win32",
			checkExecutables: false,
		});
		assert.equal(report.ok, false);
		assert.ok(report.issues.some((issue) => issue.code === "load-order"));
		assert.ok(report.issues.some((issue) => issue.code === "not-configured"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("keeps max profile free of duplicate extension authorities", async () => {
		const report = await inspectExtensionProfile("max", {
			cwd: process.cwd(),
			settingsPath: join(tmpdir(), "missing-dove-pi-settings.json"),
			piVersion: "0.84.3",
			nodeVersion: "22.19.0",
			platform: "win32",
			checkExecutables: false,
		});
		assert.equal(report.issues.some((issue) => issue.code === "profile-conflict"), false);
	});

	it("reports hashline overlap with Dove built-in editing authority", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-pi-extension-hashline-"));
		const settingsPath = join(temporary, "settings.json");
		await writeFile(settingsPath, JSON.stringify({ packages: ["npm:pi-hashline-edit-pro"] }), "utf8");
		const report = await inspectExtensionProfile("dev", {
			cwd: temporary,
			settingsPath,
			piVersion: "0.84.3",
			nodeVersion: "22.19.0",
			platform: "win32",
			checkExecutables: false,
		});
		assert.ok(report.issues.some((issue) => issue.code === "dove-authority-overlap"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("detects a conflicting pair when a caller composes one", () => {
		const issues = checkProfileConflicts([getExtension("pi-lsp"), getExtension("lens")]);
		assert.ok(issues.some((issue) => issue.code === "profile-conflict"));
	});

	it("keeps fallback footer renderers exclusive from open-tui", () => {
		const issues = checkProfileConflicts([getExtension("open-tui"), getExtension("powerbar")]);
		assert.ok(issues.some((issue) => issue.code === "profile-conflict"));
	});

	it("doctor flags a configured fallback alongside the preferred renderer", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-pi-extension-conflict-"));
		const settingsPath = join(temporary, "settings.json");
		await writeFile(settingsPath, JSON.stringify({ packages: ["npm:pi-open-tui", "npm:@juanibiapina/pi-powerbar"] }), "utf8");
		const report = await inspectExtensionProfile("minimal", {
			cwd: temporary,
			settingsPath,
			piVersion: "0.84.3",
			nodeVersion: "22.19.0",
			platform: "win32",
			checkExecutables: false,
		});
		assert.ok(report.issues.some((issue) => issue.code === "profile-conflict"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("installs a profile in catalog order through Pi", async () => {
		const calls: string[][] = [];
		const progress: Array<{ phase: string; current: number; total: number; extensionId?: string }> = [];
		const result = await installExtensionProfile("minimal", {
			cwd: process.cwd(),
			piEntry: "pi-entry",
			configuredPackages: [],
			run: async (command, args) => {
				calls.push([command, ...args]);
			},
			onProgress: (event) => progress.push(event),
		});
		assert.deepEqual(result.installed, ["extension-settings", "open-tui", "raw-paste", "caffeinate"]);
		assert.equal(result.updateStatus, "skipped-empty");
		assert.deepEqual(result.skipped, []);
		assert.deepEqual(calls, [
			["pi-entry", "install", "npm:@juanibiapina/pi-extension-settings@0.9.1"],
			["pi-entry", "install", "npm:pi-open-tui@0.2.15"],
			["pi-entry", "install", "npm:@tmustier/pi-raw-paste@0.1.3"],
			["pi-entry", "install", "npm:@narumitw/pi-caffeinate@0.49.5"],
		]);
		assert.deepEqual(progress.map(({ phase, current, total, extensionId }) => ({ phase, current, total, extensionId })), [
			{ phase: "start", current: 0, total: 4, extensionId: undefined },
			{ phase: "package", current: 1, total: 4, extensionId: "extension-settings" },
			{ phase: "package", current: 2, total: 4, extensionId: "open-tui" },
			{ phase: "package", current: 3, total: 4, extensionId: "raw-paste" },
			{ phase: "package", current: 4, total: 4, extensionId: "caffeinate" },
			{ phase: "complete", current: 4, total: 4, extensionId: undefined },
		]);
	});

	it("skips extensions already present in Pi settings", async () => {
		const calls: string[][] = [];
		const result = await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: ["npm:pi-open-tui", "npm:@juanibiapina/pi-extension-settings"],
			updateConfigured: false,
			run: async (command, args) => {
				calls.push([command, ...args]);
			},
		});
		assert.deepEqual(result.skipped, ["extension-settings", "open-tui"]);
		assert.equal(result.updateStatus, "skipped-disabled");
		assert.deepEqual(calls.map((call) => call[2]), ["npm:@tmustier/pi-raw-paste@0.1.3", "npm:@narumitw/pi-caffeinate@0.49.5"]);
	});

	it("continues after an optional extension fails and reports the failure", async () => {
		const calls: string[][] = [];
		const result = await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: [],
			run: async (command, args) => {
				calls.push([command, ...args]);
				if (args[1]?.startsWith("npm:pi-open-tui@")) throw new Error("Failed to locate native binary.");
			},
		});
		assert.deepEqual(result.installed, ["extension-settings", "raw-paste", "caffeinate"]);
		assert.deepEqual(result.failed, [{ id: "open-tui", installSpec: "npm:pi-open-tui@0.2.15", error: "Failed to locate native binary." }]);
		assert.equal(calls.length, 4);
	});

	it("can fail fast when strict extension installation is requested", async () => {
		await assert.rejects(
			installExtensionProfile("minimal", {
				piEntry: "pi-entry",
				configuredPackages: [],
				continueOnError: false,
				updateConfigured: false,
				run: async (_command, args) => {
					if (args[1]?.startsWith("npm:pi-open-tui@")) throw new Error("native install failed");
				},
			}),
			/native install failed/,
		);
	});

	it("repairs a Windows native helper and retries pi-lens once", async () => {
		const calls: string[][] = [];
		let repaired = 0;
		const configured = getProfilePackages("max")
			.filter((entry) => entry.id !== "lens")
			.map(exactInstallSpec);
		const result = await installExtensionProfile("max", {
			piEntry: "pi-entry",
			configuredPackages: configured,
			updateConfigured: false,
			repairNativeDependency: async () => {
				repaired += 1;
				return true;
			},
			run: async (command, args) => {
				calls.push([command, ...args]);
				if (calls.length === 1) throw new Error("Pi extension install exited with code 1.");
			},
		});
		assert.equal(repaired, 1);
		assert.deepEqual(result.installed, ["lens"]);
		assert.deepEqual(result.failed, []);
		assert.equal(calls.length, 2);
	});

	it("reconciles only Dove-managed identities to exact versions through Pi", async () => {
		const calls: string[][] = [];
		const configured = [getProfilePackages("minimal")[0].installSpec];
		const result = await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: configured,
			run: async (command, args) => { calls.push([command, ...args]); },
		});
		assert.equal(result.updated, true);
		assert.equal(result.updateStatus, "updated");
		assert.equal(result.updateError, undefined);
		assert.deepEqual(result.installed, ["extension-settings", "open-tui", "raw-paste", "caffeinate"]);
		assert.deepEqual(result.skipped, []);
		assert.deepEqual(calls, [
			["pi-entry", "install", "npm:@juanibiapina/pi-extension-settings@0.9.1"],
			["pi-entry", "install", "npm:pi-open-tui@0.2.15"],
			["pi-entry", "install", "npm:@tmustier/pi-raw-paste@0.1.3"],
			["pi-entry", "install", "npm:@narumitw/pi-caffeinate@0.49.5"],
		]);
	});

	it("continues profile reconciliation when one exact-version update fails", async () => {
		const result = await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: ["npm:pi-open-tui"],
			run: async (_command, args) => {
				if (args[1]?.startsWith("npm:pi-open-tui@")) throw new Error("update unavailable");
			},
		});
		assert.equal(result.updated, false);
		assert.equal(result.updateStatus, "failed");
		assert.match(result.updateError ?? "", /open-tui.*update unavailable/);
		assert.ok(result.installed.includes("extension-settings"));
	});

	it("does not touch unrelated user packages", async () => {
		const calls: string[][] = [];
		await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: ["npm:user-owned-extension@9.9.9", ...getProfilePackages("minimal").map(exactInstallSpec)],
			run: async (command, args) => { calls.push([command, ...args]); },
		});
		assert.deepEqual(calls, []);
	});
});
