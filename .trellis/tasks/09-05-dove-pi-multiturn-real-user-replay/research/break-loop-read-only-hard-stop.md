## Bug Analysis: Changing read-only work is cut off by a fixed request budget

### 1. Root Cause Category

- **Category**: B / D - Cross-layer contract and test coverage gap.
- **Specific Cause**: `readOnlyToolBudget()` supplies a fixed hard-stop count to
  `ProgressGuard`. The guard checks `readOnlyToolCalls` before considering
  whether the next call has a new path or whether prior calls produced new
  observations. The public Pi loop therefore aborts call 13 in a healthy
  twenty-file inspection even though calls 1-12 all succeeded with changing
  evidence.

### 2. Why Earlier Checks Missed It

1. Unit tests covered repeated observations and a small varied-read budget, but
   did not replay a successful changing-read request through the public launcher.
2. The standard faux provider returned text only, so it never exercised the
   request-level read guard.
3. README language described progress guards as stopping stalled loops, which
   hid that the separate fixed read-only cap also terminates productive work.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Test coverage | Add public-path replay cases for changing reads beyond the current warning and hard-stop boundaries. | TODO follow-up |
| P0 | Contract | Define whether productive read-only work may cross a request budget and how a user escapes a guard. | TODO follow-up |
| P1 | Diagnostics | Keep advisory, hard-stop, and repeated-observation reasons distinct in summaries and status output. | Partial |
| P1 | Documentation | Never describe the policy as only stopping stalled loops while a count hard stop remains. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Provider-round limits may also be request-count based, but
  the faux provider does not invoke Pi's `onPayload` hook, so that path still
  needs a real-provider-compatible deterministic seam before conclusions.
- **Design Improvement**: Separate safety limits for repeated/no-progress work
  from user-controlled investigation breadth; prefer rolling progress windows
  or an explicit continue/override signal over a silent terminal abort.
- **Process Improvement**: Every guard that calls `ctx.abort()` needs one
  public-path test for productive progress and one for genuine stagnation.

### 5. Knowledge Capture

- [x] Record the evidence in the active replay task.
- [x] Clarify the current contract in the backend request-runtime spec.
- [ ] Create a follow-up strategy-policy task before changing ceilings.
