# The hang, measured end to end

## What was measured, and where

From one field run on a real library (`cachecontrol`), scenario `immutable-directive-work`, on `2026-10-05`. Two
records of the same window, and they agree.

### The sequence, from the runner's own event stream and the session transcript

| time | record | what it says |
|---|---|---|
| 19:07:59.629 | transcript | `bash` call: `python -m pytest tests/test_immutable.py -q 2>&1 \| head -40` |
| 19:08:00.607 | transcript | tool result, in one second: the test still fails |
| 19:08:37.112 | transcript | the assistant thinks: *"Still failing. Let me debug - is the response being cached at all? `cache.get(target)` is not None, so it's stored. Is the second request reaching cached…"* |
| 19:08:37.113 | event stream | `tool_execution_start`, `toolName: bash` - **and the transcript ends here** |
| 19:08:37.113 | event stream | `tool_execution_update`, `toolName: bash` - the last thing written |
| *six minutes thirty-three seconds, nothing in either record* | | |
| 19:15:10.744 | event stream | `harness_timeout` |

`durationMs 900022` · `harnessTimedOut true` · `sawAgentStart true` · **`sawAgentEnd false`** · `settled false` ·
`reason "cancelled"` · `eventCount 1994` · **`stderr` length 0** · the agent's own work took 8m26s.

So: a tool call began, never returned, and nothing outside it said anything at all. The only thing that ended the
run was the outer nine-hundred-second watchdog.

## Why the two-hundred-forty-second timeout did not help

`src/pi-adapter/extension.ts`, `applyAdaptiveShellTimeout`, read verbatim:

- `:222` - only `bash` and `powershell` are considered.
- `:223` - an explicit timeout wins and nothing is applied.
- `:228` - **and the command must match a whitelist regex**: `go test`, `npm test`, `pnpm test`, `yarn test`,
  `pytest`, `cargo test`, `dotnet test`, `make test`, `make check`. Anything else returns `{ applied: false }`.
- `:230` - the configured value, default 240.
- `:239` - the applied case sets `input.timeout`.

Its own comment states the premise: *"Pi's bash tool intentionally has no default timeout; on Windows a
package-wide test command can therefore sit behind a Git-Bash pipe until the host cancels the whole request and
reports only 'This operation was aborted'. This is an escape hatch, not a global tool limit: ordinary commands are
untouched."*

The run recorded four of the harness's notices - *"Dove 为聚合验证命令设置 240s 超时；可用
DOVE_PI_SHELL_TIMEOUT_SECONDS 调整，但仍受 Pi 宿主外层 watchdog 约束"* - at 19:05:06, 19:07:52 and 19:07:59, all
before the hang. Those are the `pytest` calls, which are on the list. **The call that hung is not on the list, so
no timeout was applied to it**, and the run sat until the outer watchdog.

## What is not known, and is not written as known

**Which command hung.** Neither record holds its arguments: the event stream carries `messageDigest`
(`310071df1f9df18c3ab3cbbe`) rather than a payload, and the transcript's last readable call is the `pytest` at
19:07:59. The context suggests a caching question being debugged, which would mean a command that starts a server
or reaches the network - but that is an inference and is labelled as one.

**Whether the hang is reproducible at all**, and whether it is Git-Bash's stdio handling on this platform rather
than anything the command did.

## The design question this task holds

Three routes, and the choice is not made here:

1. **Widen the list** - cheap, and it leaves the next unlisted command unprotected exactly as this one was.
2. **Make a timeout the default** and let the list only shorten it - protects everything, and changes the
   behaviour of every ordinary command, which the comment explicitly chose not to do.
3. **Record the absence** - leave the behaviour and make the reading say a call is still running, so a hang can be
   told from slowness rather than inferred from a watchdog message.

The third is the only one that is a reading rather than a behaviour, and this round's whole subject is that a
reading which omits the fact is what let two earlier readings be wrong.
