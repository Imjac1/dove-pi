# The effect claim store: what the primitives actually guarantee

Written 2026-09-26 to close the one part of M1 that the earlier research left open. `exactly-once-premise-correction.md`
settles **what** the contract must be (six parts). It does not say **how** to build part 2 - "one atomic claim in a
store shared across hosts" - without a database, and it names a real cross-host `EffectStore` as "the
highest-leverage missing piece". This file answers that, from primary vendor documentation plus runs on this machine.

## Sources, and what each one actually says

| Source | Claim | Where |
|---|---|---|
| POSIX `open(2)` | `O_CREAT\|O_EXCL` "Ensure that this call creates the file: if this flag is specified in conjunction with O_CREAT, and path already exists, then open() fails with the error EEXIST" | man7.org/linux/man-pages/man2/open.2.html |
| POSIX `open(2)` | "`O_APPEND` may lead to **corrupted files on NFS** filesystems if more than one process appends data to a file at once ... the client kernel has to simulate it, which can't be done without a race condition" | same page |
| POSIX `rename(2)` | "If newpath already exists, it will be **atomically replaced**, so that there is no point at which another process attempting to access newpath will find it missing. However, there will probably be a window in which both oldpath and newpath refer to the file" | man7.org/linux/man-pages/man2/rename.2.html |
| POSIX `rename(2)` | `renameat2(RENAME_NOREPLACE)` = atomic create-if-absent, `RENAME_EXCHANGE` = atomic swap. **Linux-only**: not POSIX, not Windows, not macOS | same page |
| POSIX `flock(2)` | "**NFS details**: Up to Linux 2.6.11, flock() does not lock files over NFS ... `fcntl(2)` byte-range locking ... does work over NFS, given a sufficiently recent version of Linux and a server which supports locking" | man7.org/linux/man-pages/man2/flock.2.html |
| POSIX `flock(2)` | "**CIFS details**: Up to Linux 5.4, flock() is not propagated over SMB. A file with such locks will not appear locked for remote clients. Since Linux 5.5, flock() locks are emulated with SMB byte-range locks ... the locks are **not advisory anymore**: any IO on a locked file will always fail with EACCES when done from a separate file descriptor" | same page |
| Windows `CreateFileW` | `CREATE_NEW` "Creates a new file, only if it does not already exist. If the specified file exists, the function fails and the last-error code is set to ERROR_FILE_EXISTS (80)" | learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew |
| SQLite WAL | "since there is only one WAL file, there can only be **one writer at a time**" | sqlite.org/wal.html |
| SQLite atomic commit | transactions "appear to be atomic **even if the transaction is interrupted by an operating system crash or power failure**" - under stated hardware assumptions (linear sector writes, honest fsync) | sqlite.org/atomiccommit.html |
| SQLite corruption | "some filesystems contain bugs in their locking logic such that the locks do not always behave as advertised. This is **especially true of network filesystems and NFS in particular**. If SQLite is used on a filesystem where the locking primitives contain bugs, and if two or more threads or processes try to access the same database at the same time, then **database corruption might result**" | sqlite.org/howtocorrupt.html |
| IETF draft | `draft-ietf-httpapi-idempotency-key-header-07` **"This Internet-Draft is no longer active." It expired 2026-04-18.** It never became a standard | datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07 |
| that draft, semantics | concurrent same key -> **409** "A request is outstanding for this Idempotency-Key"; same key with a **different payload** -> **422**; and it defines an **Idempotency Fingerprint** (section 2.4) precisely so "same key, different payload" is detectable | same page |

## Verified on this machine, not taken from documentation

Node v24.14.1, Windows, in this repository's runtime:

```text
openSync(path, 'wx') on an existing file  -> EEXIST
openSync(path, 'wx') a second time        -> EEXIST
node:sqlite present?                      -> yes; PRAGMA journal_mode=WAL -> wal
duplicate claim via PRIMARY KEY           -> ERR_SQLITE_ERROR, and the first row is untouched
node:sqlite warning                       -> "SQLite is an experimental feature and might change at any time"
```

So the atomic create-if-absent exists on the platform this product ships on, and it is the same primitive on both
families of OS: POSIX `O_CREAT|O_EXCL`, Windows `CREATE_NEW`, Node `'wx'`.

## What this repository already has

- **`src/project-provider/lock.ts:17` already uses this exact primitive** for cross-process mutual exclusion over
  Dove native project state: `mkdir(lockPath, { recursive: false })` and treat `EEXIST` as "someone holds it"
  (`:44-46`). The pattern is not new to this codebase.
- **That lock also reclaims.** `isStale` (`:35-42`) deletes the lock directory once its mtime is older than
  `staleMs` (default ten minutes) and retries. **This is right for a mutex and wrong for an effect claim**, and the
  difference is the central design decision below.
- `src/core/effect-ledger.ts:51-55` is already claim-shaped: `claim` / `get` / `complete`, with the docstring at
  `:47-50` requiring `claim` to be atomic across processes. **M1 adds an implementation, it does not redesign the
  interface.**
- `effect-ledger.ts:60-63` names the shape a real store takes: "a database row, a lock service, an append-only log
  with a unique constraint". Two of those three are now documented-unsafe on a network mount: an append-only log
  because `O_APPEND` is racy on NFS, and SQLite because of the corruption note above.

## The decision

**1. The claim is a file whose existence is the claim**, created with exclusive create (`'wx'`) under the project
state root, one file per effect key. Never `has()` then `record()`; the window between them is where the duplicate
lands, which is the measurement this whole contract exists for. This is the primitive `lock.ts` already uses, applied
to a different problem.

**2. The staleness policy must be the opposite of the lock's, and they must not share code.** Reclaiming a mutex older
than ten minutes is a reasonable guess about a dead process. Reclaiming an **effect claim** is a guess that the effect
did not land - and re-executing on that guess is the duplicate the claim exists to prevent. So a claim file whose
owner is gone reads as **unknown** and is **surfaced**, never auto-reclaimed. That is the top-ranked behaviour in
`exactly-once-premise-correction.md` section 5 ("refuse and surface; do not guess"), and it is consistent with
`dispatchOnce`'s existing `retryPriorAttempt: false` default. **Two mechanisms that look alike must not share a
policy** - this is the same "two implementations of one contract" failure the PRD names as risk 1, in the opposite
direction: one implementation serving two incompatible policies.

**3. The claim record carries a fingerprint of the validated arguments.** "Same key, different payload" must be a
refusal, not a silent replay (the expired draft's section 2.4 and its 422). This repository already does the
equivalent in the evidence plane's content hash, so the idea is in-house.

**4. States, with `unknown` reachable by construction**: `in_flight | completed | failed | cancelled | unknown`. The
exclusive-create-then-crash window leaves `in_flight` with **no outcome written**, and that reads as unknown. The
three-state model is not bolted on; it falls out of the primitive. A ledger with only done/not-done has to guess, and
every default it can pick is wrong in one direction.

**5. The boundary goes in the code comment and in the spec: atomic between processes on one host with a local
filesystem.** Nothing here is safe across a network mount - not exclusive create (unverified by the vendors whose
locks are documented broken), not `flock` (absent over NFS before 2.6.11, non-advisory over SMB since 5.5), not
`O_APPEND` (documented racy on NFS), not SQLite (documented to corrupt). True multi-host exclusion is the
**backend's**, through the forwarded key - the same conclusion Stripe and Temporal forced, now forced again by the
filesystem documentation. The harness must say this out loud rather than implying a guarantee it cannot make, because
AC5 is exactly that requirement.

**6. Do not adopt `node:sqlite` for M1.** It is in this runtime and it would be correct on a local filesystem, but
it is experimental here ("might change at any time"), and `database-guidelines.md` records that the first release has
no database. `EffectStore` is already `Promise`-returning, so a transactional store can replace the file store
without touching callers. SQLite is the **named** alternative for the day multi-writer transactional semantics are
needed, with the caveat attached: never on a network mount.

## What this does not settle

- **Whether real Dove projects put their state on a network share.** If they do, point 5 is load-bearing and needs a
  startup check or at least a reported warning. Not measured.
- **Windows `MoveFileEx` atomicity** was not verified. It is not needed by this design (the claim uses exclusive
  create, which was verified), but it would matter for any future atomic-replace path.
- **github.com is unreachable from this session** (30 s timeout; the proxy at `socks5h://127.0.0.1:10808` is not
  configured into the fetch tool) and **`web_search` is misconfigured** ("DeepSeek search request failed ... fetch
  failed" against `api.deepseek.com/anthropic/v1/messages`). So engine source - Temporal, Restate, DBOS, LangGraph's
  SQLite checkpointer - could not be read this round. Everything above is vendor documentation plus local runs, which
  is enough for the decision and short of what a full survey would give. **The user should be told to fix the search
  endpoint in Settings > Plugins > Plugin configuration > Web search if they want a source-level survey.**
