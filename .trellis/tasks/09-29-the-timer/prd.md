# The timer, and who owns a session

## Goal

Build the keepalive timer, which the round before this one named as what the policy still lacks.

## Two measurements that shaped the design

```text
the adapter has no scheduling facility   zero setInterval, setTimeout or timer in src/pi-adapter
the host event vocabulary is sixteen     before_agent_start, message_end, tool_result, session_start,
                                         turn_start, before_provider_request, after_provider_response,
                                         agent_settled, session_shutdown, and six more
```

**Every one of those is a callback the host fires, and none of them means time passed.** So the adapter cannot
observe idleness through its event surface, a timer is the only way, and a timer is the one thing here that can act
without a request.

## So the timer takes its clock as an argument

```text
KeepaliveClock        now(), setTimer(callback, delayMs), clearTimer(handle)
SessionKeepaliveTimer arm(), observe(), disarm()
```

**Injecting the clock is what makes the decision testable** - the scheduling rules are the same in a test and in
production, and only the provider call the callback would make is out of reach. **The class enforces three rules
the policy cannot know alone**:

- `observe()` re-arms, because a session that is talking needs no heartbeat and one that falls silent does.
- **`disarm()` is the caller obligation on session shutdown.** A timer surviving its session would send the next
  session a request nobody asked for, which is worse than a cold cache.
- **A due callback disarms itself first**, so a callback slower than the interval cannot stack a second heartbeat.

## And the fake clock had to model a timer rather than a switch

```text
the failure   a session that just talked is not idle: actual 1, expected 0
the cause     the fake fire() fired whatever was pending, ignoring when it was due - so a test could fire
              early and read the result as a defect
the fix       fire() returns false unless the due time has passed, which makes the fake a model of a timer
```

**A fake that does not model the thing it stands in for produces findings about the fake.** That is worth the line
it takes, because the whole reason this class exists is to make an untestable act testable.

## And the allow-list entry stays, which the reachability suite confirmed

**Importing a module from a test does not reach it**: the walk starts from entry points, and a test file is not one.
So the module is still unreachable, the entry from the previous round is still correct, and the suite says so in
both directions - **a reachable module still listed is a failure too.**

## Acceptance criteria

- [x] **AC1** The timer takes its clock as an argument and is tested with one.
- [x] **AC2** Arming, observing, firing and disarming are each held, with the second fire as a control.
- [x] **AC3** The reachability rule is satisfied in the direction it is still in.
- [x] **AC4** The gate passes.
