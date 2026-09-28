# Implementation plan: the refusal names the gate

## Ordered checklist

- [x] **1. The path**, read first.
- [x] **2. The reason travels.**
- [x] **3. Both messages, observed.**
- [x] **4. The test, then the gate.**

## The change, which was about the trip rather than the message

```text
fast-path.ts:12         authorize may now return a reason string as well as a boolean
fast-path.ts:52         if (approved !== true)   <- a string is a refusal that says why
fast-path.ts:63         the error is the reason when there is one, and the old sentence otherwise
capability-invocation.ts  each of its three conditions returns its own reason:
                          not required -> true, not granted -> a sentence, no approver -> a sentence
```

## Observed in a run

```text
approval=approval_denied  error=Capability approval was not granted.        sent unavailable
approval=approval_denied  error=No approver is configured for this host.    sent granted
```

**Two gates, one status, two sentences.** The status is unchanged, which the requirements fixed, so nothing that keyed on it is affected -
and a client can now tell which of the two refused it.

**The work was not the message**: the callback returned a boolean, so the reason had nowhere to travel from. Letting it return the reason as
a string, and checking `!== true` rather than truthiness, is the smallest change that makes it arrive.

## Validation commands

```powershell
<granted invoke> | python dove_pi.py rpc
npm run typecheck
npm test
```

## Recorded, not built

1. **The status vocabulary.**
2. **The first real turn.**