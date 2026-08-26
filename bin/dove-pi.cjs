#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const launcher = path.join(packageRoot, "dove_pi.py");
const python = process.platform === "win32" ? "python" : "python3";

const child = spawn(python, [launcher, ...process.argv.slice(2)], {
	cwd: process.cwd(),
	stdio: "inherit",
});

child.on("error", (error) => {
	console.error(`Unable to start bundled Pi: ${error.message}`);
	process.exitCode = 1;
});
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
