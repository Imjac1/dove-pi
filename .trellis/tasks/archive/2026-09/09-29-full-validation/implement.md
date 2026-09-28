# Implementation plan: the full validation

## Ordered checklist

- [x] **1. Run all five commands together.**
- [x] **2. Read what doctor disagrees about.**
- [x] **3. Hold the criteria against what exists.**
- [x] **4. The gate.**

## Validation commands

```powershell
npm run typecheck; npm test; npm run test:installer; npm run doctor; npm run pi:smoke
```

## The finding, in one line

**The host is here.** Pi 0.84.3 is installed on this machine - unmanaged, at the checkout root - while the
*managed* release is what `update --check` reported missing. The session had been reading that line as *there is
no Pi here*.

## And what that changes, and does not

**It does not lift the boundary**: `dove-pi update` still installs the managed release, and that is still a change
to this machine which nothing in this loop may authorise. **It changes the statement of the boundary**: not *this
environment has no host*, but *this environment has an unmanaged host and cannot create the managed release*.

**That is the fifth time a cannot-be-done judgement rested on a premise nobody measured** - after the timeout
that was declared unreachable, the fallback, the network behind `update --check`, and the toolset.
