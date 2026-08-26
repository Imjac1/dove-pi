import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getProfilePackages } from "../src/extensions/catalog.ts";
import { getExtension } from "../src/extensions/catalog.ts";
import { checkProfileConflicts, inspectExtensionProfile } from "../src/extensions/doctor.ts";
import { installExtensionProfile } from "../src/extensions/install.ts";

describe("extension profiles", () => {
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
		const result = await installExtensionProfile("minimal", {
			cwd: process.cwd(),
			piEntry: "pi-entry",
			configuredPackages: [],
			run: async (command, args) => {
			calls.push([command, ...args]);
		},
		});
		assert.deepEqual(result.installed, ["extension-settings", "open-tui", "raw-paste", "caffeinate"]);
		assert.deepEqual(result.skipped, []);
		assert.deepEqual(calls, [
			["pi-entry", "install", "npm:@juanibiapina/pi-extension-settings"],
			["pi-entry", "install", "npm:pi-open-tui"],
			["pi-entry", "install", "npm:@tmustier/pi-raw-paste"],
			["pi-entry", "install", "npm:@narumitw/pi-caffeinate"],
		]);
	});

	it("skips extensions already present in Pi settings", async () => {
		const calls: string[][] = [];
		const result = await installExtensionProfile("minimal", {
			piEntry: "pi-entry",
			configuredPackages: ["npm:pi-open-tui", "npm:@juanibiapina/pi-extension-settings"],
			run: async (command, args) => {
				calls.push([command, ...args]);
			},
		});
		assert.deepEqual(result.skipped, ["extension-settings", "open-tui"]);
		assert.deepEqual(calls.map((call) => call[2]), ["npm:@tmustier/pi-raw-paste", "npm:@narumitw/pi-caffeinate"]);
	});
});
