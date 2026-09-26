# Research: execution isolation - how the frontier actually contains a harness's own child processes

- **Query**: what bounds a harness's *own* subprocesses (git indexing, patch application, REPL parents,
  MCP servers), not what bounds the model's tool call - which is the part the six published bypasses went
  around.
- **Scope**: Linux namespaces / seccomp-bpf / Landlock / cgroups; macOS Seatbelt; gVisor; Firecracker and
  other microVMs; Kata; Docker/Podman defaults; Windows Job Objects, restricted tokens and AppContainer;
  the agent platforms (E2B, Modal, Daytona, Fly, Cloudflare, Deno); Anthropic's managed sandbox and
  `sandbox-runtime`; OpenAI Codex `codex-rs` source; Cursor, Replit, Codespaces; published escapes; cost.
- **Date**: 2026-09-26. Everything below reflects state at that date.
- **Fetch methods that worked** (recording because earlier waves failed here):
  - `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` - primary source for all code.
  - `api.github.com/repos/<o>/<r>/git/trees/<ref>?recursive=1` - worked, then hit the 60/hour anonymous
    cap. `/repos/<o>/<r>/security/advisories` (list) works; `/repos/<o>/<r>/security/advisories/<ghsa>`
    returns **403**; the global `/advisories/<ghsa>` is what you want but was rate-limited.
  - **`api.osv.dev/v1/vulns/<GHSA|CVE>`** - the best mirror for advisory *bodies* (OSV mirrors GHSA
    descriptions in full, including the PoC detail). Underused by the earlier waves.
  - **NVD** `services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=<term>` - the only way I found the
    gVisor CVE set; GitHub's advisory list for google/gvisor is empty.
  - **`github.com/<o>/<r>/tree/main/<path>` HTML + regex on the embedded JSON** - a working substitute for
    `api.github.com` directory listings once the API is exhausted. github.com **is reachable** here,
    contrary to the note in the earlier research files.
  - **`<url>.md`** works for Mintlify/Sphinx-style doc sites: `e2b.dev/docs/*`, `modal.com/docs/*`,
    `daytona.io/docs/*`, `developers.cloudflare.com/*`, `docs.deno.com/*`, `docs.fly.io/*`,
    `docs.claude.com/en/docs/claude-code/*`. It does **not** work for `docs.docker.com` or
    `docs.github.com`.
  - `img.shields.io/github/{stars,license,last-commit}/<o>/<r>.json` - the only metadata source that did
    not rate-limit. `ungh.cc` returned **429** ("21 configured: 0 invalid, 21 rate-limited").
  - `cdn.jsdelivr.net/gh/...` fetches files, but **`data.jsdelivr.com/.../flat` file listings were
    stale for openai/codex** (2573 files, missing `codex-rs/sandboxing/`, `mxc-sandbox/`, `v8-poc/`,
    `network-proxy/`). Do not use jsdelivr listings to enumerate an actively-moving repo; it sent me to
    five 404s.
  - Failed: `chromium.googlesource.com` (fetch failed). `docs.docker.com` returned an SPA shell with a
    404 status.
  - **Parallel bursts of ~10 fetches fail wholesale in this environment; the same URLs succeed with
    retries or lower concurrency.** Budget for that.

---


### Repositories touched, with metadata

Stars/licence/last-commit are from `img.shields.io` (rounded; `ungh.cc` was 429 for the
whole session). "Files read" is the exact set I opened, not the repo's contents.

| Repo | Stars | Last commit | Licence | Files read |
|---|---|---|---|---|
| `google/gvisor` | 19k | today | Apache-2.0 | `SECURITY.md`; `g3doc/architecture_guide/security.md`; `g3doc/architecture_guide/performance.md`; the published CSVs `/performance/{density,syscall,startup}.csv`; the `master` tree (5099 paths); the GitHub advisories HTML (contains no GHSA identifiers) |
| `firecracker-microvm/firecracker` | 37k | yesterday | Apache-2.0 | `SECURITY.md`; `docs/design.md`; `docs/seccomp.md`; `docs/jailer.md`; the `main` tree (977 paths) |
| `kata-containers/kata-containers` | 8.8k | yesterday | Apache-2.0 | `docs/Limitations.md`; the `main` tree (3386 paths); the 11 published advisories (summaries only) |
| `openai/codex` | 127k | today | Apache-2.0 | ~30 files under `codex-rs/`: `sandboxing/src/{lib,landlock,linux_pid_namespace,denial,windows,spawn,manager}.rs`; `sandboxing/src/seatbelt_base_policy.sbpl` and `seatbelt_network_policy.sbpl`; `protocol/src/sandbox.rs`; `linux-sandbox/README.md`; `core/src/windows_sandbox.rs`; `process-hardening/src/lib.rs`; `git-utils/src/{fsmonitor,git_process,trust,operations,info,baseline}.rs`; `windows-sandbox-rs/src/{lib,cap,identity,allow}.rs`; `mxc-sandbox/src/{lib,windows}.rs`; `v8-poc/{Cargo.toml,src/lib.rs}`; `docs/sandbox.md` (150 bytes - a link) |
| `anthropic-experimental/sandbox-runtime` | 5.3k | last Monday | Apache-2.0 | `README.md` (70 KB) only - **documentation-only evidence; the implementation was not read** |
| `containers/bubblewrap` | 8.8k | last Thursday | not identifiable by GitHub | `README.md` |
| `opencontainers/runc` | 13k | last Wednesday | Apache-2.0 | the 13 published advisories (summaries, plus 3 full bodies via OSV) |
| `moby/moby` | 72k | yesterday | Apache-2.0 | **no files read** - Docker's own docs were unreachable; every Docker claim here comes from runc's advisories |

Documentation-only or partially-read sources: `docs.kernel.org` (Landlock, seccomp), `man7.org`
(mount(8)), Apple's `sandbox-exec(1)` and `sandbox(7)`, `learn.microsoft.com` (Job Objects,
AppContainer, restricted tokens), `docs.claude.com` (Claude Code sandboxing), `e2b.dev/docs/*`,
`modal.com/docs/*`, `daytona.io/docs/*`, `docs.deno.com/sandbox`, `docs.fly.io/machines`,
`developers.cloudflare.com/*`, `docs.github.com` (Codespaces overview), `gvisor.dev` (benchmark CSVs).
**Closed source, not readable: Modal, E2B, Daytona, Cloudflare, Deno, Fly, Codespaces, Cursor, Replit, and
Claude Code itself.** Every claim about them is documentation-only and marked as such. Codex and
`sandbox-runtime` are the two agent-harness sandboxes whose *design* could be read from source, and
only Codex's was read at that depth.

---

## What the sources state

### 1. The kernel facilities, and what each one actually bounds

| Facility | Bounds | Does **not** bound | Documented escape / failure class |
|---|---|---|---|
| **namespaces** (mnt, pid, net, user, ipc, uts, cgroup) | visibility and identity: what is mounted, which PIDs exist, whether there is a route at all, which uid you are | resource use (that is cgroups); DAC on files that are *not* namespaced; and a new user namespace is itself a large attack surface | namespace-escape bugs are kernel bugs; the practical failure is the wrong namespace set (a "sandbox" that keeps the host netns has no egress bound at all) |
| **seccomp-bpf** | syscall number and *scalar* arguments, per thread, inherited by children | everything reachable through an allowed syscall. **BPF may not dereference pointers**, so it cannot express any path policy | kernel doc: "**System call filtering isn't a sandbox.** ... policy for logical behavior and information flow should be managed with a combination of other system hardening techniques"; its own named pitfall is filtering the syscall number without checking the `arch` value (a 32-bit ABI can alias it). Escape in the wild: gVisor CVE-2018-16359, where `renameat` was reachable and renamed files on the host |
| **Landlock** (stackable LSM) | filesystem access rights on a hierarchy; TCP/UDP `bind`/`connect` **by port only**; `LANDLOCK_SCOPE_SIGNAL` and `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET`; inherited by every `clone(2)`; usable by an **unprivileged** process on itself | network **by address** (ports only); paths reached through `/proc/<pid>/fd/*` and special kernel filesystems such as nsfs; `chroot(2)` (only `mount`/`pivot_root` are denied); **pre-existing file descriptors**: `LANDLOCK_ACCESS_FS_IOCTL_DEV` "only applies to newly opened device files ... pre-existing file descriptors like stdin, stdout and stderr are unaffected"; 16 stacked ruleset layers max, then `E2BIG`; IOCTL support is "coarse-grained" | design limits, not bugs. Relevant escape: a harness that hands the child an already-open fd has no Landlock coverage of it. Codex's own helper README states the converse limit: "Filesystem-restricted execution requires bubblewrap. The legacy Landlock option is **rejected** for these policies because it **cannot isolate app-server Unix sockets**" |
| **cgroups v2** | CPU, memory, pids, IO, freezer; and `cgroup.kill` gives a kill switch that survives daemonisation | **nothing about authority**. A process inside the memory limit can still read your SSH key if DAC allows | not a security boundary. `memory.max` produces an OOM kill, not a denial |
| **Docker / Podman defaults** | namespaces + default seccomp profile + dropped capabilities + a default capability set | see the runc corpus below | the entire escape class is **the runtime's own setup code**, not the workload's syscalls: CVE-2024-21626 (a leaked internal fd makes `runc exec`'s child start in the **host** filesystem namespace), CVE-2025-31133 ("masked path" abuse, the container's `/dev/null` is not verified to be a real `/dev/null`), CVE-2025-52881 (arbitrary write gadgets / procfs write redirects, "a more sophisticated version of CVE-2019-19921"), CVE-2025-52565 (`/dev/console` bind happens **before** `maskedPaths`/`readonlyPaths`), CVE-2026-41579 (an image whose `/dev` is a symlink). **CVE-2026-41579 is the single most transferable fact here**: it is *not exploitable under Docker because Docker creates a top-level `ro` layer that masks any malicious `/dev` symlink present in the image, without mounting the lower layers* - **Podman and containerd do not, and are exploitable.** The layer above the runtime must pre-mask the paths the runtime would otherwise resolve |
| **macOS Seatbelt** (`sandbox-exec` + SBPL profiles) | operations, checked at resource-acquisition time; children inherit the parent's policy | any resource already held. `sandbox(7)`: "Restrictions are generally enforced upon acquisition of operating system resources only. ... if the application already has a file descriptor opened for writing, it may use that file descriptor regardless of restrictions." | Apple's own man page marks `sandbox-exec` **DEPRECATED**. The manifest failure is not the profile but the *pair* of processes: CVE-2026-39861 - "**neither the sandboxed command nor the unsandboxed app could independently write outside the workspace, but their combination could write to arbitrary locations**" |
| **gVisor** | the host syscall surface *available to the workload*: the Sentry re-implements it, and the Sentry's own host syscalls are a minimised set, so an escape needs two chained exploits | the Sentry's own host surface (the gofer host-file helper is the live one), side channels, and - explicitly - **the sandbox configuration**. `SECURITY.md`: "its main security focus is on preventing a user workload from getting out of the box"; control over the OCI spec is out of scope for the project, and a misconfiguration is the *deployment's* problem | CVE-2026-96812 (2026-09-25): "including a `/dev/cuse` **character device node in a container image**, opening the device passes through to the host, allowing the sandboxed attacker to register a host device and ... overwrite root udev helper memory" - **an attacker-supplied path in a trusted-frame position, exactly the shape of CVE-2025-59532**; CVE-2025-2713 ("the process initially ran with root-like permissions until the first fork"); CVE-2023-7258 (mount refcount panic); CVE-2018-16359 (`renameat` reached the host); CVE-2024-10026 / CVE-2024-10603 (predictable identifiers and ports) |
| **Firecracker** | everything kernel-level: one process per microVM, KVM, a minimal device model, a per-thread seccomp filter loaded before guest code runs | **egress, explicitly**: "Firecracker does not perform any network traffic filtering. All egress traffic from a guest is therefore considered untrusted, and should be filtered at the host-level"; and side channels | CVE-2026-5747 (guest root modifies virtio queue registers after activation → OOB write in virtio-pci; host code execution needs extra preconditions); **CVE-2026-1386 - the jailer, Firecracker's own containment wrapper: a symlink in the pre-created jailer directories plus root privileges overwrites arbitrary host files during the start-up copy** |
| **Kata** | an actual VM per container with its own kernel | the **share layer and the configuration surface**. Eleven published GHSAs, and essentially all of them are virtiofs, annotations, or the agent policy | CVE-2026-47243 (virtiofsd run as host root with `--sandbox none --seccomp none`; a raw `FUSE_SYMLINK` with an absolute host path creates host-root symlinks in `/etc/cron.d`); CVE-2026-44210 (a default-enabled pod annotation injects `-o source=/` into virtiofsd and serves the host root into the guest); CVE-2026-50540 (`config_path` annotation loads an attacker-chosen host TOML, selecting an attacker-controlled hypervisor binary); CVE-2026-41326 (the CopyFile policy checks the destination **prefix** and not symlinks); CVE-2026-86072; CVE-2026-93417 (Dragonball virtio-blk length validation); CVE-2026-64676 (agent ttRPC methods outside the policy engine) |
| **Windows Job Objects** | process-tree lifetime, working-set / CPU / process-count limits, "terminate all processes associated with the job" | nothing about filesystem or network authority | the documented escape class is in the same page: "This default behavior **can be changed** by setting the extended limit `JOB_OBJECT_LIMIT_BREAKAWAY_OK` or `JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK`"; and "**Child processes created using `Win32_Process.Create` are not associated with the job**" - i.e. WMI creation escapes a job |
| **Windows AppContainer** | capability-based isolation: credential isolation ("the application cannot impersonate the user"), device isolation, "Granular access can be granted for Internet access, Intranet access, and acting as a server", process and window isolation | it is a *capability* model, and its file story is asymmetric: "Read-write access can be granted to specific persistent files and registry keys. **Read-only access is less restricted.**" | not an escape so much as a shape: on Windows there is no per-path write policy except **ACLs**, so "deny" must be an explicit ACE |
| **Windows restricted token** | removes privileges, applies the deny-only SID attribute, and adds **restricting SIDs** so that "the system performs two access checks: one using the token's enabled SIDs, and another using the list of restricting SIDs. Access is granted only if **both** access checks allow" | a restricted process that shares the default desktop is attackable from/at other windows: Microsoft says "Applications that use restricted tokens should run the restricted application on **desktops other than the default desktop**. This is necessary to prevent an attack by a restricted application, using `SendMessage` or `PostMessage`, to unrestricted applications" | and the useful affordance: "if the `CreateProcessAsUser` call specifies a **restricted version of the caller's primary token**, this privilege is not required. This enables ordinary applications to create restricted processes." That is how a non-elevated harness gets a restricted child without the `SE_ASSIGNPRIMARYTOKEN` privilege |

### 2. What the agent platforms use, and how they say it

**Vendor claims below are documentation-only unless marked "observed in code".**

- **E2B** - "an isolated Linux VM for your agent". **Every sandbox has outbound internet access by
  default**, with `allowInternetAccess`/`network` to restrict. Fine-grained control is by IP/CIDR/domain,
  and the domain matching is **L7-header only**: "Domain-based filtering only works for HTTP traffic on
  port 80 (via Host header inspection) and TLS traffic on port 443 (via SNI inspection). Traffic on other
  ports uses CIDR-based filtering only. **UDP-based protocols like QUIC/HTTP3 are not supported** for
  domain filtering." And a detail that matters for agent behaviour: "Due to firewall design, **blocked
  connections may appear successful from inside the sandbox** ... a TCP connection can succeed and report
  the socket as open even when the destination is denied". Bring-your-own SOCKS5 proxy and a wildcard
  `'*'` that matches HTTP `Host` and TLS SNI.
- **Modal** - "Sandboxes are built on top of **gVisor** ... giving you stronger isolation than most other
  container runtimes ... the blast radius of any malicious code will be limited to the Sandbox container
  itself". By default a Sandbox cannot accept inbound connections, and "**by default, Sandboxes can make
  outbound connections to any public IP address**"; three levels of outbound restriction plus
  `block_network=True`.
- **Daytona** - "**Linux containers by default**", with optional VM sandboxes (Linux or Windows) and
  macOS sandboxes on dedicated Apple silicon; default `auto-stop` 15 minutes. Egress policy is not
  documented on the pages I read.
- **Fly Machines** - "fast-launching VMs"; the lifecycle doc gives the cost split that matters to us:
  the `created` phase (reserve space, fetch the image, build a rootfs) "can take some time, maybe **low
  double digit seconds**"; booting an existing Machine "usually takes **well under a second**", as does
  restarting a stopped one.
- **Cloudflare Containers / Sandbox SDK** - containers; Sandbox SDK advertises "its own isolated container
  with a full Linux environment, providing strong security boundaries". Billing is per 10 ms of active
  time. I found **no statement of the isolation mechanism** on the pages I read.
- **Deno Sandbox** - "Individual Linux **microVMs** orchestrated by Deno Deploy ... boot times measured in
  milliseconds", `allowNet: ["google.com"]` host allowlists, and a pattern worth copying: "**Secrets never
  enter the sandbox environment. The real value is substituted only when the sandbox makes outbound
  requests to approved hosts.**" Limits: 768 MB-4 GB, 2 vCPU, 30 min, 5 concurrent sandboxes.
- **Anthropic, Claude Code built-in Bash sandbox** - macOS Seatbelt, Linux/WSL2 bubblewrap + seccomp.
  "**The sandbox is built into Claude Code and runs on macOS, Linux, and WSL2. Native Windows is not
  supported.** On Windows, run Claude Code inside a WSL2 distribution." Two admissions that are directly
  on this task's knife-edge:
  - `## Scope`: "**The sandbox isolates Bash subprocesses. Other tools operate under different
    boundaries.** * **Built-in file tools**: Read, Edit, and Write use the permission system directly
    rather than running through the sandbox."
  - The protected-paths rationale names the hazard: "A command that could edit those files could grant
    itself permissions, or **add a hook or MCP server that Claude Code runs outside the sandbox**."
  - **Fail-open default**: "By default, if the sandbox cannot start because dependencies are missing or the
    platform is unsupported, **Claude Code shows a warning and runs commands without sandboxing**. To make
    this a hard failure instead, set `sandbox.failIfUnavailable` to `true`."
  - **A model-reachable escape hatch**: on a violation, "Claude analyzes the violation and may retry the
    command with the `dangerouslyDisableSandbox` parameter. The retried command runs outside the sandbox."
  - Limitation named bluntly: "**Sandboxing reduces risk but is not a complete isolation boundary.**"
  - `allowAppleEvents` "removes code-execution isolation: sandboxed commands can launch other applications
    unsandboxed with no user prompt".
- **Anthropic, `sandbox-runtime` (`srt`)** - a separate standalone tool, and the most useful artefact in
  the whole survey, because it is the **only one that supports native Windows**:
  "**Windows**: Runs the sandboxed process under a dedicated `srt-sandbox` local user account, with a
  Windows Filtering Platform (WFP) egress fence keyed on that account's SID and per-session explicit ACEs
  on the working tree." It exists explicitly so you can sandbox **MCP servers** - i.e. **the harness's own
  children**, which is the gap the prior research identified.
- **GitHub Codespaces** - "Each codespace you create is hosted by GitHub in a **Docker container, running
  on a virtual machine**." The agent and the repository share that container.
- **Cursor, Replit** - **not verified in this pass**; see *Could not verify*.

### 3. The five named hazards, and what the correct containment actually is

**(a) A read-only bind mount that is still writable.** Authoritative source is `mount(8)`, not a blog:
"Note that the **filesystem mount options maintained by the kernel will remain the same as those on the
original mount point**"; "a read-only bind will create a read-only mountpoint (VFS entry), but the
**original filesystem superblock will still be writable**, meaning that the olddir will be writable, but
the newdir will be read-only"; and, since util-linux 2.39, "`-o bind,rw` will create a read-write node
**even if the original node was read-only**. This was impossible with the old classic `mount(2)` syscall."
Also: plain `--bind` does not carry submounts (you need `--rbind`), so a submount inside a bind is a
place content can hide. **Correct containment**: never rely on flag inheritance. Express the whole tree
with the new mount API - `open_tree(2)` to take a detached subtree and `mount_setattr(2)` with
`MOUNT_ATTR_RDONLY | MOUNT_ATTR_NOSUID | MOUNT_ATTR_NODEV | MOUNT_ATTR_NOEXEC` and `AT_RECURSIVE` (the
recursive semantics `mount(2)` cannot express) - and **never place a writable mount of the same
superblock anywhere in the same mount namespace**. Does any shipping implementation do it? **No.** Codex
approximates it by ordering: `--ro-bind / /` first, then `--bind <root> <root>` for writable roots, then
**re-applying `--ro-bind` for protected subpaths** (`.git`, resolved `gitdir:`, `.codex`) in
path-specificity order. Anthropic `srt` does the per-path ro-bind variant and adds *pinning* (below).
Nobody I read uses `mount_setattr`.

**(b) A writable directory implying its parent.** This is Overpatch (Codex `apply_patch`: "grants write
access to the parent folder of each path"). **Correct containment**: the allow set must be a set of
*leaves* resolved against the policy, never a prefix-of-parent rule; and because a child can reach a
protected path through its parent directory (*unlink*, *rename*, *mkdir*'s parent, `rename` across a
boundary), the deny must also stamp the **parent's** mutation rights. Two shipping implementations do
something concretely right, and they are the best evidence in this file:
- **Anthropic `srt` on Windows**: a `denyWrite` writes "an inheriting DENY ACE on the target, **plus an
  inheriting `FILE_DELETE_CHILD` DENY on its parent**", and the working-tree grant **withholds**
  `FILE_DELETE_CHILD` - "together ... this stops the sandboxed process from renaming or deleting a denied
  path via its parent directory".
- **Anthropic `srt` on Linux**: "Every existing ancestor of a protected path ... is made a mountpoint -
  '**pinned**' - and cannot be renamed or removed from inside the sandbox: `mv` or `rmdir` of such a
  directory ... fails with `EBUSY`, and `rm -rf` of a nested repository leaves the pinned directories and
  the protected files behind". With `allowWrite: ["/"]` the pins reach every ancestor and the top-level
  directory becomes the filesystem boundary, so `mv` between top-level directories fails `EXDEV`.
`srt` also states the residual honestly: "Glob patterns are expanded to concrete paths at
`initialize()` time - **a matching path that appears later is not covered**", and on Linux a `denyWrite`
for a path that does not exist yet must be materialised as a mountpoint **on the host**, visible for the
lifetime of the sandbox, which is observable and already caused a real bug in their own logs (a leftover
`.git/config.lock` making `git config` report "could not lock config file").

**(c) A model-supplied path becoming the sandbox root** (CVE-2025-59532). **Correct containment: the frame
and the input are different arguments.** Codex now carries both explicitly:

    create_linux_sandbox_command_args_for_permission_profile(command, command_cwd, permission_profile,
                                                            sandbox_policy_cwd, use_legacy_landlock, ...)
    // -> ["--sandbox-policy-cwd", .., "--command-cwd", .., "--permission-profile", .., "--", <cmd>]

with two distinct error types, `SandboxTransformError::InvalidCommandCwd` and
`InvalidSandboxPolicyCwd`. The policy cwd comes from the profile; the command cwd is an unchecked input.
Anthropic `srt` reaches the same place from the other direction: grants are applied **session-wide at
`initialize()` from trusted configuration**, and on Windows "passing them per-command in
`wrapWithSandbox`'s `customConfig` **throws** ... `srt-win exec` only **exposes per-exec denies**."
Generalised rule: **a per-call input may narrow a boundary and may never widen it**, and the widening
decision is taken once, outside the model's reach.

**(d) A shared heap between trusted and untrusted interpreters** (Heapjack, Codex `node_repl`,
`v8.getHeapSnapshot()`). **Observed in code**: `codex-rs/v8-poc/` is a Bazel-wired PoC crate whose
`Cargo.toml` maps a `sandbox` feature to `v8/v8_enable_sandbox` and whose `lib.rs` exposes
`linked_v8_has_sandbox()` calling `v8__V8__IsSandboxEnabled()`, and **constructs a fresh
`v8::Isolate::new(...)` per evaluation**. **Correct containment** (part inference, flagged): V8's
in-process sandbox is a *memory-corruption* containment cage; it does **not** separate trusted from
untrusted *objects*, so a `getHeapSnapshot` of a heap containing trusted objects is still a read. The
containment that matches the failure is **a separate `Isolate` (separate heap) per trust domain, or a
separate process** - which is exactly what a fresh isolate per evaluation gives you. I could not find the
current `node_repl` handler to check whether the shipped tool does this; see *Could not verify*.

**(e) The harness's own `git` running outside the boundary** (CVE-2026-55607, Beltdown2). This is the
hazard with the best shipping answer, and it is a *configuration* answer, all four parts observed in
`codex-rs/git-utils/`:
1. **`-c core.hooksPath=<DISABLED_HOOKS_PATH>`** on the harness's git invocations, so repository hooks
   never execute. (There is a test that plants a `post-index-change` hook and asserts it does not run.)
2. **`-c core.fsmonitor=false`** unless a *probe* proves the built-in daemon is available - and the probe
   is written defensively: it reads the **raw** effective value first ("A shadowed helper path can
   therefore make a repository-local true fail conversion"), requires the `feature: fsmonitor--daemon`
   line from `git version --build-options` (Git 2.35.1 and older interpret "true" as a *hook pathname*),
   and defaults to `Disabled` on any timeout, spawn failure, signal or non-zero exit.
3. **`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`** so user and system config cannot inject
   helpers, plus `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` for the overrides.
4. **Containment and hygiene of the child**: `scrub_non_inheritable_env_vars`, own process group on Unix,
   a Job Object on Windows, `kill_on_drop`, bounded timeout.
And a fifth that is the *architectural* half: **`git-utils/src/trust.rs` resolves the repository trust root
"without invoking the `git` executable"** - by reading `.git` metadata, `gitdir:` pointers,
`worktrees/`/`commondir` layout and canonicalising, with explicit defences against symlink substitution
("Following a substituted `.git` symlink must never turn an unrelated checkout into the registered one").
The rule to take: **anything the harness runs on its own behalf, on content the model or the repository
can influence, needs either the same boundary as the agent's commands or a configuration a repository
cannot influence.** Codex picked the second for git. I read `git_process.rs` and `info.rs`; neither
routes the harness's git through `SandboxManager`, so **it runs on the host as the user** - hardened, not
contained.

### 4. Egress: who blocks by default

| Platform | Default egress | Mechanism, as documented |
|---|---|---|
| E2B | **open** | firewall; L7 allow/deny by Host/SNI, CIDR otherwise; QUIC not filtered; blocked TCP still "connects" |
| Modal | **open to any public IP** | `block_network=True` for none; three levels of restriction; no inbound by default |
| Deno Sandbox | host allowlist via `allowNet` | microVM; secrets substituted only for approved hosts |
| Anthropic built-in sandbox | **deny by default**, domain allowlist | a proxy on the host; on Linux the netns "is removed entirely" and traffic goes over a bind-mounted Unix socket; **the proxy does not terminate TLS by default**, so the allow decision is made from the client-supplied hostname - the docs name domain fronting as the consequence |
| Anthropic `srt` on Windows | **deny by default** | WFP set at `FWPM_LAYER_ALE_AUTH_CONNECT_V4/V6`: a PERMIT for loopback inside the proxy port range + a BLOCK for any connect whose token carries the sandbox SID. "a process that strips its proxy environment and connects directly is blocked at the kernel" |
| Firecracker | **nothing, by design** | "should be filtered at the host-level" |
| gVisor | whatever the netns/policy gives it | deployment's responsibility |
| Cloudflare Containers | not found on the pages read | egress is *priced* ($0.025/GB NA+EU), which implies it is allowed |

The design conclusion is that the fence must be **in the kernel and keyed on an identity the child cannot
change** (a SID, a UID, or the absence of a route), never on environment variables the child can unset.
`srt`'s own honest list of what that still lets through is the best available: **DNS resolution via the
system resolver is not fenced** (the `Dnscache` service runs as NETWORK SERVICE, so `getaddrinfo`
succeeds even though the subsequent `connect()` is blocked), the proxy auth token appears in the runner's
argv, and CRL/OCSP under schannel goes out via WinHTTP ignoring the proxy.

### 5. Published escapes of the sandboxes themselves

Named above in the mechanism table; the ones to keep on the wall are the vetted advisory bodies:
- **gVisor CVE-2026-96812** (published 2026-09-25, one day before this file): a **container image** carries
  a `/dev/cuse` character device node; opening it passes through to the host; the attacker registers a
  host device and exploits CUSE ioctl handling to overwrite **root udev helper memory** → root on the host.
  A microVM's *device* surface is still an attacker-controlled path in a trusted frame.
- **Claude Code CVE-2026-39861**: symlinks created *inside* the sandbox, followed by the *unsandboxed*
  app. The advisory's own framing - "neither the sandboxed command nor the unsandboxed app could
  independently write outside the workspace, but their combination could" - is the thesis of the parent
  task, stated by a vendor about its own product.
- **Claude Code CVE-2026-55607** ("Sandbox Escape via Git Worktree Path Confusion Allows Unsandboxed Code
  Execution"): worktrees named `.git`, navigation outside the sandbox context, **`git fsmonitor`
  execution during worktree operations**, overwriting `~/.zshenv` → code execution outside Seatbelt.
  This is Beltdown2's shape and the reason Codex's fsmonitor probe exists.
- **Firecracker CVE-2026-1386**: the *jailer* had the symlink/path bug.
- **Kata CVE-2026-47243 / CVE-2026-44210 / CVE-2026-50540**: three independent ways the *configuration
  surface* around the VM gave the guest the host.
- **runc CVE-2024-21626**: a leaked fd put `runc exec`'s child in the host namespace.

### 6. The cost, with numbers

| Boundary | Measured / published cost | Source type |
|---|---|---|
| gVisor | fixed **+~19.6 MB per empty sandbox** (runc 4.09 MB → runsc 23.70 MB); node 76.7 → 124.1 MB; ruby 45.7 → 106.1 MB; redis ~1.055 → ~1.077 GB. Raw syscall **1.94 µs (runc) → 38.2 µs (runsc/ptrace) → 0.763 µs (runsc-kvm)**. Container start through Docker **1144 ms (runsc) vs 1193 ms (runc)** - i.e. Docker dominates and gVisor adds nothing at start | measured, gVisor's own published CSVs (`/performance/{density,syscall,startup}.csv`). Caveat: benchmark host is Debian 9 / kernel 4.19; the ptrace platform is the worst case and the docs say "users should use Systrap" |
| Firecracker | "a steady mutation rate of **5 microVMs per host core per second** (e.g. ... 180 microVMs per second on a host with 36 physical cores)" | stated, `docs/design.md` |
| Fly Machines | create (image fetch + rootfs build) "**low double digit seconds**"; start/stop of an existing Machine "**well under a second**" | stated, docs |
| Deno Sandbox | "boot times measured in **milliseconds**"; 5 concurrent sandboxes per org pre-release | stated, docs |
| E2B | **$0.000014 / vCPU-second**, **$0.0000045 / GiB-second**, storage free. Default sandbox 2 vCPU / 4 GiB → ≈ $0.0000392/s ≈ **$0.14/hour per sandbox**; Hobby $0/mo, 20 concurrent, **1 hour max session**; Pro $150/mo, 100 concurrent, 24 h | stated, pricing page |
| Cloudflare Containers | billed per **10 ms** active; $0.000020/vCPU-s, $0.0000025/GiB-s, disk $0.00000007/GB-s; included in $5/mo Workers Paid | stated, pricing page |
| Modal | not found on the pages I could read | gap |
| **A UID/ACL/proxy boundary** (`srt` shape) | one extra local account, some inheriting ACEs, one WFP filter set, one loopback proxy. No per-command process cost | inference from the design; not benchmarked anywhere I read |

**The decision-relevant reading of this table**: the expensive part is *provisioning* (rootfs, image
fetch, VM boot), and the part that is nearly free is *imposition* (a UID, an ACE, a kernel filter). A
design that pays 2 seconds per action to rebuild a boundary will be bypassed by its own authors; a design
that makes the boundary the *identity the child runs as* costs nothing per action **and** covers children
spawned out-of-band, which no per-command wrapper does.

---

## What I read in code

Files read (repository, path, why). All Codex files are from `openai/codex` at **`main`**, which is well
ahead of any released CLI.

**openai/codex - Linux / macOS**
- `codex-rs/sandboxing/src/lib.rs` - module map; `SandboxType`-driven dispatch; the fallback
  `system_bwrap_warning`.
- `codex-rs/sandboxing/src/landlock.rs` - the helper argv: "The helper performs the actual sandboxing
  (**bubblewrap by default + seccomp**)". `--use-legacy-landlock` only when no managed network.
- `codex-rs/sandboxing/src/linux_pid_namespace.rs` - `Isolate` (default, new PID ns + fresh `/proc`) vs
  `Inherit` ("allowing signals to other same-UID processes") - a good example of a boundary knob that is
  also a hazard knob.
- `codex-rs/sandboxing/src/denial.rs` - how a denial is *guessed*: exit 2/126/127 are explicitly
  **false**, `128+SIGSYS` for the seccomp backend is true, otherwise a keyword scan of
  stderr/stdout/aggregated output ("operation not permitted", "landlock", "read-only file system", ...).
  **Stated in-code as non-deterministic**: "We don't have a fully deterministic way to tell if our command
  failed because of the sandbox". Detection, not control - a distinction the parent task should keep.
- `codex-rs/sandboxing/src/seatbelt_base_policy.sbpl` - `(deny default)`, `(allow process-exec)`,
  `(allow process-fork)`, `(allow signal (target same-sandbox))`, `(allow process-info* (target
  same-sandbox))`, `file-write-data` to `/dev/null` only, an explicit sysctl allowlist, `ipc-posix-sem`
  and a narrowly-regexed `ipc-posix-shm-*` for OpenMP, pseudo-tty allowances, and an `iokit-open`
  `RootDomainUserClient`. Copied from Chrome's `common.sb`/`renderer.sb`, cited in the file.
- `codex-rs/sandboxing/src/seatbelt_network_policy.sbpl` - `AF_SYSTEM`/`IPPROTO_ICMPV6` only, a
  `mach-lookup` allowlist (`trustd.agent`, `networkd`, `ocspd`...), and `sysctl-read` for
  `net.routetable`. Derived from Chrome's `network.sb`.
- `codex-rs/sandboxing/src/windows.rs` - the Windows filesystem override model: "The elevated Windows
  backend consumes extra deny-read paths plus explicit read and write roots during setup/refresh. The
  unelevated restricted-token backend only consumes extra deny-write carveouts on top of the legacy
  `WorkspaceWrite` allow set."
- `codex-rs/sandboxing/src/spawn.rs` - the single spawn dispatch; on Windows it delegates to
  `codex_windows_sandbox::spawn_windows_sandbox_session_for_level` with
  `network_proxy_restricting_sid`.
- `codex-rs/protocol/src/sandbox.rs` - `SandboxType = { None, MacosSeatbelt, LinuxSeccomp,
  WindowsRestrictedToken, WindowsMxc }`.
- `codex-rs/sandboxing/src/manager.rs` - `get_platform_sandbox`: macOS→Seatbelt, Linux→LinuxSeccomp,
  Windows→`None` unless the Windows sandbox is enabled; `SandboxablePreference::{Auto,Require,Forbid}`.
- `codex-rs/linux-sandbox/README.md` - the semantics document (quoted throughout). Key lines: "**Filesystem-
  restricted execution requires bubblewrap. The legacy Landlock option is rejected for these policies
  because it cannot isolate app-server Unix sockets**"; `PR_SET_NO_NEW_PRIVS` + seccomp applied in-process;
  a read-only root by default; writable roots layered on top with `--bind`; protected subpaths re-applied
  read-only; "symlink-in-path and non-existent protected paths inside writable roots are blocked by
  mounting `/dev/null` on the symlink or first missing component"; `--unshare-user` and
  `--unshare-pid` by default; WSL1 rejected because it cannot create user namespaces.
- `codex-rs/process-hardening/src/lib.rs` - `PR_SET_DUMPABLE, 0`, `RLIMIT_CORE 0`, strip `LD_*`/`DYLD_*`;
  macOS `ptrace(PT_DENY_ATTACH)`; and `pre_main_hardening_windows()` is **empty** ("TODO(mbolin):
  Perform the appropriate configuration for Windows").
- `codex-rs/git-utils/src/{fsmonitor,git_process,trust}.rs` and `operations.rs`/`info.rs` - the four-part
  git hardening in section (e).

**openai/codex - Windows**
- `codex-rs/windows-sandbox-rs/src/lib.rs` (36 KB) - module map is the design: `acl`, `allow`,
  `app_package`, `cap`, `deny_read_acl`, `deny_read_state`, `desktop`, `dpapi`, `file_write`,
  `hide_users`, `identity`, `no_reparse_dir`, `package_identity`, `resolved_permissions`,
  `sandbox_users`, `service_identity`, `spawn_prep`, `token`, `token_user`, `wfp`, `wfp_setup`,
  `winutil`, `workspace_acl`, `runtime_ownership`, plus `elevated`, `setup_provisioning`,
  `setup_orchestrator`. `WindowsSandboxProvisioningSettings` has `proxy_ports` and
  `allow_local_binding` "for the offline sandbox identity" - a **two-identity** design (online/offline).
- `cap.rs` - random capability SIDs persisted in `codex_home/cap_sid`, with **per-workspace** SIDs keyed by
  canonicalised cwd and **per-write-root** SIDs, "included in a workspace-write token only when the root is
  currently allowed, so **stale ACLs from earlier extra roots do not expand later workspace sandboxes**" -
  a direct answer to the "a permit must not widen another operation" rule, implemented as a *positive*
  mechanism.
- `identity.rs` - `LogonUserW` / `LOGON32_LOGON_INTERACTIVE`, a stored sandbox password, DPAPI, and a
  distinct error type for "Windows rejected the stored sandbox account password" separate from policy
  errors.
- `allow.rs` - `compute_allow_paths_for_permissions`: writable roots are canonicalised and added to an
  **allow** set; `read_only_subpaths` become a **deny** set on top of them. Exactly the shape the hazards
  require: allow leaves computed from the resolved policy, denies carved inside them.
- `codex-rs/sandboxing/src/windows.rs`, `codex-rs/mxc-sandbox/src/{lib,windows,policy,native}.rs` -
  "Native Windows MXC helper." `is_available()` calls
  `appcontainer_common::base_container_runner::BaseContainerRunner::is_process_security_environment_usable()`
  and the doc comment is explicit: "This deliberately excludes MXC's older **AppContainer fallback
  backends**." MXC refuses `allow_local_binding=false` with the reason "MXC cannot enforce managed networking
  with allow_local_binding=false: **native host-loopback access is bidirectional**". Also: "Read the
  already-filtered wrapper environment, rejecting lossy values instead of inheriting a different
  environment inside the sandbox"; the launcher contract is passed out-of-band in the environment and the
  helper **removes** those variables before starting the sandboxed command.
- `codex-rs/core/src/windows_sandbox.rs` - `WindowsSandboxLevel = {Disabled, RestrictedToken, Elevated}`
  and the feature flags `WindowsSandbox`, `WindowsSandboxElevated`; "the unelevated restricted-token
  backend only consumes extra deny-write carveouts".

**openai/codex - other**
- `codex-rs/v8-poc/{Cargo.toml,src/lib.rs}` - the V8 in-process-sandbox probe (hazard (d)); inferred as a
  demonstration crate ("Bazel-wired proof-of-concept crate reserved for future V8 experiments"), **not
  evidence that the shipped JS tool uses it**.

**anthropic-experimental/sandbox-runtime**
- `README.md` (70 KB) - read in full for: *Dual Isolation Model*, *Filesystem Isolation*, *Mandatory Deny
  Paths*, *Windows (alpha)* (Setup / Security model / TLS termination / Known limitations),
  *Violation Detection*, *Security Limitations*, *Known Limitations and Future Work*. This is the only
  source I found that states a complete, per-OS containment model **and** its own residual gaps. I did
  **not** read its TypeScript/Rust implementation, so its claims are documentation-only here.

**containers/bubblewrap**
- `README.md` - "bubblewrap is not a complete, ready-made sandbox with a specific security policy ... the
  level of protection between the sandboxed processes and the host system is **entirely determined by the
  arguments passed to bubblewrap**"; the `TIOCSTI`/`--new-session` requirement (CVE-2017-5226); "Everything
  mounted into the sandbox can potentially be used to escalate privileges"; and the author's argument that
  path whitelisting is a bad idea and that retaining `CAP_SYS_ADMIN` while always accessing the filesystem
  as the invoking uid "entirely closes TOCTTOU attacks".

**Kernel / OS documentation read**: `docs.kernel.org/userspace-api/landlock.html` (full, including
*Current limitations* and *Previous limitations*), `docs.kernel.org/userspace-api/seccomp_filter.html`,
`man7.org/linux/man-pages/man8/mount.8.html`,
`keith.github.io/xcode-man-pages/sandbox-exec.1.html` (Apple's page, DEPRECATED),
`manpagez.com/man/7/sandbox/`,
`learn.microsoft.com/en-us/windows/win32/{procthread/job-objects,secauthz/appcontainer-isolation,secauthz/restricted-tokens}`.

**gVisor / Firecracker / Kata**: `g3doc/architecture_guide/{security,performance}.md`, `SECURITY.md`,
the published `/performance/{density,syscall,startup}.csv`; Firecracker `docs/{design,seccomp,jailer}.md`,
`SECURITY.md`; Kata `docs/Limitations.md` plus the ten GHSA summaries from its advisory list.

---

## What is transferable to a harness

### Must-answer 1 - the smallest containment that actually bounds a harness's own children

Every child the harness starts must go through **one** function, and the *frame* must be computed there
from trusted configuration, never from the model's arguments:

    spawn(child, policy_revision, requested_cwd) -> {
      // 1. policy from trusted config only; cwd is INPUT, and both are kept separate
      // 2. canonicalise inside this process, before any boundary exists
      // 3. create the boundary, spawn, return a kill handle
    }

The boundary, cheapest-first, and what each piece is *for*:

1. **cgroup v2 leaf** - `memory.max`, `pids.max`, `cpu.max`, and `cgroup.kill` for a kill switch that
   survives daemonisation. Resource containment only; do not describe it as security.
2. **A fresh mount / PID / net / IPC / UTS namespace, and (where the kernel allows it) a user
   namespace** - `clone(CLONE_NEWNS|CLONE_NEWPID|CLONE_NEWNET|CLONE_NEWIPC|CLONE_NEWUTS)`, then
   `pivot_root(2)` onto a tmpfs root. Express the whole tree with the new mount API -
   `open_tree(2)` + `mount_setattr(2)` with `AT_RECURSIVE` and
   `MOUNT_ATTR_RDONLY|MOUNT_ATTR_NOSUID|MOUNT_ATTR_NODEV|MOUNT_ATTR_NOEXEC` - rather than hoping
   `mount --bind -o ro` inherits a read-only flag it does not inherit. Then
   `prctl(PR_SET_NO_NEW_PRIVS)`, **`close_range(2)` everything above 2 and reopen stdio from inside**,
   and make a new session (or filter `TIOCSTI` in seccomp) - inherited descriptors and TIOCSTI are two of
   the three escapes the sources above actually name.
3. **Landlock as the belt** - it is the only facility that lets an *unprivileged* process confine itself
   and have every `clone(2)` descendant inherit it without a privileged helper:
   `landlock_create_ruleset(LANDLOCK_CREATE_RULESET_VERSION)`, add filesystem rules for the allowed
   hierarchies, add the network rules for the ports you need, and set
   `LANDLOCK_SCOPE_SIGNAL | LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET` so one sandbox cannot signal or reach
   another. Do not use it for `/proc/<pid>/fd`, nsfs, address-based network, or chroot - the doc says it
   cannot; those need the net namespace and the proxy.
4. **A seccomp-bpf allowlist on top**, with the `arch` value checked, and `SIGSYS` so a denial is
   distinguishable from an ordinary failure (Codex reads exactly that: `128 + SIGSYS`).
5. **Egress: a network namespace with no route, plus a loopback proxy.** Not a firewall rule. The only
   reachable address is the proxy; the proxy does the allowlist from a hostname it can actually see (SNI or
   `Host`, and it must terminate TLS if you need to bind an identity to a destination). This is what
   Anthropic's Linux path does (netns removed entirely, Unix socket) and what `srt` does on Windows (WFP
   fence on the sandbox SID, loopback permit only).
6. **The harness's own children get the same treatment**, i.e. **the same identity**, not the same wrapper:
   if the child runs as a *different OS principal* rather than under a per-command wrapper, then a child
   spawned out-of-band (Task Scheduler, BITS, COM, `Win32_Process.Create`, a double-fork) still carries
   that principal and is still inside the policy. `srt` states this as the reason for its design: "any
   process the child manages to spawn out-of-band still carries the `srt-sandbox` SID".

### Must-answer 2 - what is available on Windows, since the Pi host spawns the processes there

All of the following are available and **two shipping agent harnesses use them**:

| Facility | Use it for | The trap the docs name |
|---|---|---|
| `CreateJobObject` + `AssignProcessToJobObject` (+ nested jobs, Win8+) | process-tree lifetime, `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, resource limits | `JOB_OBJECT_LIMIT_BREAKAWAY_OK` / `SILENT_BREAKAWAY_OK` reopen the escape; **`Win32_Process.Create` children are not associated with the job** |
| `CreateRestrictedToken` (deny-only SIDs + **restricting SIDs**) + `CreateProcessAsUser` | drop the caller's authority; the double access check is the actual mechanism | run the restricted process on a **separate desktop**, or it can `SendMessage`/`PostMessage` an unrestricted app. You do **not** need `SE_ASSIGNPRIMARYTOKEN` if you pass a restricted version of your own token |
| A **dedicated local account** + explicit NTFS ACEs | the only real filesystem policy on Windows. `srt`: "additive, **inheriting** explicit ACEs for the `srt-sandbox` SID only - it never rewrites or replaces a path's existing security descriptor"; `denyWrite` adds a DENY **plus a parent `FILE_DELETE_CHILD` DENY**. Codex: per-workspace and per-write-root capability SIDs, refreshed so stale ACLs do not widen a later sandbox | per-user tool installs become unreachable ("tools installed under your profile ... cannot be opened by the sandbox account"); glob grants cover only paths that exist at initialise time |
| **Windows Filtering Platform** at `FWPM_LAYER_ALE_AUTH_CONNECT_V4/V6`, keyed on the account's SID | egress, and only egress: PERMIT loopback in the proxy range, BLOCK everything else carrying that SID | DNS through `Dnscache` (NETWORK SERVICE) still resolves; schannel CRL/OCSP uses WinHTTP under the caller's token and is blocked, breaking revocation checking (`CRYPT_E_REVOCATION_OFFLINE`) |
| **AppContainer** capability SIDs (and Microsoft's newer container primitive Codex calls **MXC**) | process/device/credential isolation; network capabilities for Internet / Intranet / server | AppContainer's file model grants read broadly - "Read-only access is less restricted"; Codex's `mxc-sandbox` deliberately **excludes the older AppContainer fallback backends** and refuses `allow_local_binding=false` because host-loopback is bidirectional |
| DPAPI (`HKLM`) for the sandbox account's credential | provisioning a machine-wide sandbox account idempotently | srt rotates the password and stores it machine-wide so fleet installs as SYSTEM work |

**Not available on Windows**: Landlock, seccomp-bpf, mount/pivot-root namespaces, or any per-path write
policy other than an ACE. So on Windows the boundary *is* token + ACL + WFP, and the "a model-supplied
path becomes the frame" hazard has to be handled by canonicalisation plus grants computed once, at
initialise time, from trusted configuration. **This is directly actionable for this project**: the Pi host
is the parent of these processes, so a Windows boundary has to be established by the process that spawns
them (or by a one-time machine setup step, exactly as `srt windows-install` does), and it cannot be
bolted on afterwards from inside.

### Must-answer 3 - the cheapest useful boundary that stops the published failure classes without a microVM

**A dedicated OS principal + explicit path grants + a kernel-level egress fence + a loopback proxy.**
`srt`'s Windows design is the complete shape and its Linux/Seatbelt analogues are the same shape with
different primitives; cost is one account, some ACEs, one filter set, one proxy - no per-action process
cost. Map it to the published failures:

| Published failure | What stops it in this shape |
|---|---|
| CVE-2026-55607 / Beltdown2 (the harness's own git) | the harness's git runs **as the sandbox principal**, plus `-c core.hooksPath=<empty>`, `-c core.fsmonitor=false`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, and trust-root resolution by filesystem inspection |
| Overpatch (parent folder of a path) | grants are leaves resolved from policy; deny adds a parent mutation DENY (`FILE_DELETE_CHILD`) on Windows and an ancestor **pin** on Linux so `mv`/`rmdir` fails `EBUSY` |
| CVE-2025-59532 (model `cwd` as the root) | the policy root and the command cwd are **two arguments**, resolutions happen in the trusted parent, and per-exec input can only narrow (srt: per-exec **denies only**; per-exec allow throws) |
| Heapjack (shared heap) | a separate `Isolate` per trust domain / a separate process - the boundary shape does not help here; this one is an interpreter-lifecycle rule |
| CVE-2026-39861 (sandboxed symlink + unsandboxed write) | every writer, including the harness's own file tools, runs under the same principal or re-validates the resolved target after the fact |
| any egress-dependent escape | no route except loopback; the fence is keyed on the identity, not on the environment |
| escapes via a spawned-out-of-band process | the identity cannot be shed, so the child is still fenced |

What this shape **does not** stop, stated by `srt` itself and worth carrying verbatim: name resolution
still works; a TLS-untouched proxy allowlist is domain-frontable; a path matching a glob that appears after
`initialize()` is uncovered; and the broad-domain problem ("allowing `github.com` lets a process push to
any repository").

### Must-answer 4 - does anyone run the harness itself inside the boundary?

**No product I read does, and one states the opposite explicitly.** Claude Code's own *Scope* section:
"**The sandbox isolates Bash subprocesses. Other tools operate under different boundaries.** * Built-in
file tools: Read, Edit, and Write use the permission system directly rather than running through the
sandbox." Codex sandboxes the command, not the Codex process (and the harness's internal git runs on the
host, hardened by configuration). Modal, E2B, Deno, Daytona and Cloudflare sandbox the *agent's commands*
or the *user's code*, not the agent runtime.

The two things closest to right, in ascending order of usefulness to this project:

1. **`sandbox-runtime` used to wrap an MCP server** - "a key use case is sandboxing Model Context Protocol
   (MCP) servers". That is the harness's own child being put under the boundary, by a different OS
   principal, which is the pattern the prior research says the failures live in. It is the only shipping
   artefact I found whose stated purpose includes containing the harness's own subprocesses.
2. **Codespaces / Replit-style "the whole computer is the sandbox"** - the dev environment including the
   agent runs in a container on a VM. That protects the *host from the tenant*, which is the vendor's
   threat model. It does **not** protect *the user's repository and credentials from the agent*, because inside that container the agent has everything. Useful only if the environment is per-task and
   ephemeral.

**Recommendation (opinion, flagged as such)**: for this project the boundary should be put around the
**chokepoint process** - the thing that spawns every child, including the harness's own git, patch
application and any interpreter - by running that chokepoint under a dedicated OS principal, keeping only
the model gateway outside it. That is a per-UID/per-SID boundary plus a loopback proxy, not a microVM, and
it is the only shape in this survey that covers the class of failure the six CVEs actually belong to.

---

## Could not verify

- **MCP's own approval surface** is not re-examined here; the parent's files cover it.
- **Modal's price per second** - not on any page I could fetch.
- **Cursor and Replit isolation** - not verified. `docs.cursor.com` returned an SPA and the Replit
  markdown page carried no isolation text. Recorded as a gap rather than guessed at.
- **Cloudflare's isolation mechanism** for Containers and the Sandbox SDK - the pages read say "isolated
  container" and nothing more specific. Cloudflare is closed source here.
- **Kata's published sandbox overhead** - `docs/how-to/how-to-size-sandbox-overhead-runtime-rs.md` exists in
  the tree and I did **not** read it.
- **Docker's and Podman's own documentation of their defaults** - `docs.docker.com` served an SPA with a
  404 status and no `.md` variant. Everything said about Docker/Podman defaults comes from **runc's
  advisories**, which is first-party for runc and explicit about the Docker/Podman/containerd difference
  in CVE-2026-41579 - not from Docker's docs.
- **gVisor's own advisory list** - `/repos/google/gvisor/security/advisories` returned **0** entries and
  the advisories HTML page contains no GHSA identifiers. My gVisor CVE set comes from an NVD keyword search
  (9 results) and is therefore **almost certainly incomplete**. gVisor's `SECURITY.md` adds a reason the
  public list is short: issues that stay inside a single sandbox "are generally not considered critical and
  are not given CVE numbers by default".
- **Codex's current `node_repl` handler** - the paths in the earlier (stale) jsdelivr listing
  (`codex-rs/core/src/tools/handlers/*`) 404 on `main`, and the API was rate-limited before I
  could list the new directory. So "trusted and untrusted JS share one V8 heap" is **taken from the parent's
  prior research and not re-verified here**, and `v8-poc` is a *PoC* crate whose existence is not
  evidence that the shipped tool uses it, nor that the V8 in-process sandbox addresses heap-snapshot reads
  at all.
- **Whether Codex's internal git is ever routed through `SandboxManager`** - I read `git_process.rs` and
  `info.rs` and saw no sandbox wrapper, but I did not enumerate every call site.
- **The exploitability of any CVE above** - I read advisory bodies and the vendors' own descriptions, not
  the patches, and I ran none of it.
- I ran **no code** and started **no sandbox**. Every statement in this file is source-reading, vendor
  documentation, or a vendor's own benchmark CSV.

## Caveats / Not Found

1. **`openai/codex@main` is not the shipped CLI.** The tree I read is well ahead of any release: the
   sandbox moved out of `codex-rs/core/src/{landlock,seatbelt}.rs` into a `codex-rs/sandboxing/` crate
   with `seatbelt.rs` (42 KB), `violation.rs`, `denial.rs`, `policy_transforms.rs`, plus new
   `mxc-sandbox/`, `network-proxy/` (with MITM and a credential broker), `process-hardening/`,
   `windows-sandbox-service/` and `v8-poc/` crates. **A capability present in `main` is not evidence
   that it ships**, and the reverse is also true.
2. `docs/sandbox.md` in that repo is 150 bytes and points at `developers.openai.com/codex/security`,
   which I did not fetch. That repo's own sandbox prose is therefore a link, not a document - the Linux
   helper README is the only real one.
3. **`ungh.cc` was 429 for the whole session** ("21 configured: 0 invalid, 21 rate-limited"), so
   every stars/licence/last-commit figure comes from `img.shields.io` and is rounded ("19k", "today").
4. `img.shields.io` reports `containers/bubblewrap`'s licence as "**not identifiable by
   GitHub**". I did not chase its `COPYING`; do not infer a licence for bubblewrap from this file.
5. **gVisor's performance CSVs are from a Debian 9 / kernel 4.19 host**, and the guide states the `ptrace`
   platform "suffers from the highest structural costs by far ... in no way represents an ideal scenario".
   Quote the *shape* - a fixed memory cost per sandbox, and a syscall cost that varies by an order of
   magnitude with the platform - not the absolute numbers.
6. **Vendor marketing, named as such**: "strong security boundaries", "production-grade isolation",
   "secure-by-default", "instant spin-up" are E2B / Cloudflare / Deno / Modal product language. Where a
   concrete checkable claim sits next to the slogan in the same document (a default, a parameter's effect)
   I quoted that instead.
7. Several sources here are dated 2026, including **CVE-2026-96812, published 2026-09-25, one day before
   this file**. Treat every "nobody does X" as "nobody did X as of 2026-09-26".
8. The single most useful source, `anthropic-experimental/sandbox-runtime`'s README, is **documentation-only**
   as far as this file is concerned: I read the README, not its implementation, and it describes itself as
   a "Beta Research Preview" whose "APIs and configuration formats may evolve".
9. **gVisor's `SECURITY.md` states that control over a sandbox's OCI spec is out of scope for the
   project**, and that a misconfiguration is the deployment's problem. That is the single most important
   caveat for this task: every mechanism in this file is only as good as the configuration the harness
   hands it, and the harness is the party the model can influence.
