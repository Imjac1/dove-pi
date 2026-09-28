/**
 * Dove desktop notify plugin (quick path)
 *
 * Fires a native Windows toast when Pi finishes running an instruction and is
 * waiting for input. This maps to the `agent_settled` event (ctx.isIdle() is
 * true there), which covers both "instruction finished" and "needs user input".
 *
 * Unlike the pi bundled notify.ts example, the Windows toast path does NOT
 * depend on WT_SESSION: on a win32 platform we always fire the native Toast.
 * A short debounce window prevents the toast stack from spamming when Pi
 * auto-retries / compacts / runs queued follow-ups.
 *
 * **Turning it off**: `DOVE_PI_NOTIFY=0`, `=off` or `=false`. The same three spellings `DOVE_PI_PREFIX_FUSE` accepts, because a
 * repository with two off idioms has one too many. Anything else, or nothing, leaves it on - this extension shipped with no switch at
 * all, so the default must not change for anyone who liked it.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Build the PowerShell one-liner that shows a Windows toast. */
function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

/** Fire-and-forget native notification. Never throws on callers. */
function notify(title: string, body: string): void {
	if (process.platform !== "win32") {
		// Non-Windows -> OSC 777 (Ghostty, iTerm2, WezTerm, rxvt-unicode, ...)
		process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
		return;
	}
	const { execFile } =
		require("node:child_process") as typeof import("node:child_process");
	execFile(
		"powershell.exe",
		[
			"-NoProfile",
			"-NonInteractive",
			"-WindowStyle",
			"Hidden",
			"-Command",
			windowsToastScript(title, body),
		],
		{ windowsHide: true },
		// Ignore errors: notification is best-effort and must never crash Pi.
		() => {},
	);
}

/**
 * Whether the desktop notification is enabled. Off for the three spellings this repository already uses, on for everything else.
 *
 * Exported so the spellings are testable without spawning a process or a toast: an off switch that does not recognise a spelling is an
 * off switch that does not work.
 */
export function notificationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	const raw = env.DOVE_PI_NOTIFY?.trim().toLowerCase();
	return raw !== "0" && raw !== "off" && raw !== "false";
}

export default function (pi: ExtensionAPI): void {
	const SETTLE_DEBOUNCE_MS = 1500;
	let lastSettle = 0;

	// `agent_settled` fires after each low-level run; Pi may still auto-retry,
	// compact-and-retry, or continue with queued follow-ups. Debounce so a full
	// user instruction settles to exactly one toast.
	pi.on("agent_settled", () => {
		if (!notificationsEnabled()) return;
		const now = Date.now();
		if (now - lastSettle < SETTLE_DEBOUNCE_MS) return;
		lastSettle = now;
		notify("Pi 完成", "指令已执行完，等待你输入");
	});
}
