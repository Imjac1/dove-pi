# The graded project, and how it is rebuilt

**This file exists because the fixture was not reproducible.** The 2026-10-05 runs measured against a `cachecontrol`
clone that was bound to Dove and carried one failing test, and nothing recorded where that clone was, which commit it sat
on, or how the failing test was produced. On 2026-10-11 the clone was gone from this machine (searched: `$env:TEMP`, the
user profile to depth 5, `C:\` to depth 4, `D:\` to depth 6 — every `.dove/mode.json` found belonged to a test fixture,
and `D:\path` holds toolchains only), so the judged half of those runs could not have been re-measured at all. This is
that missing record.

## 1. The shape, as measured

| Part | What it is | Reading |
|---|---|---|
| Source | upstream `cachecontrol`, cloned from `https://github.com/psf/cachecontrol.git`, at `2627d9b` (HEAD on 2026-10-07) | `git log -1` |
| The work under measurement | RFC 8246: a response that is still fresh and marked `immutable` is not revalidated when the client asks for a fresh copy | `tests/test_immutable.py` |
| The instrument | `tests/test_immutable.py` — `class TestImmutable`, `test_immutable_is_not_revalidated_while_fresh` — **planted, and not upstream** | `git show HEAD:tests/test_immutable.py` fails; `immutable` appears 0 times in `cachecontrol/controller.py` |
| The route it needs | `SimpleApp.immutable_cacheable` in `tests/conftest.py`, serving `Cache-Control: public, max-age=60, immutable` | added 2026-10-11 |
| Baseline | `1 failed, 115 passed` — the 115 is upstream's own suite, the 1 is the planted instrument | `python -m pytest -q` on 2026-10-11, 2.4 s |
| The recorded failure | `assert False is True`, `where False = <Response [200]>.from_cache` | byte-identical to the failure recorded on 2026-10-05 |
| Binding | `.dove/mode.json` — **55 B, no BOM, LF**: `{\n  "schemaVersion": 1,\n  "mode": "code-development"\n}` | measured; matches the 55 B the earlier readings record |
| Location | `C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol` — outside this repository, as a graded project must be | — |

**Why the source tree is pinned by a byte count rather than by a commit message.** `cachecontrol/controller.py` is
**20,090 B** in the working copy, which is exactly the number the 2026-10-05 readings record for it before the agent's
edit (`20090 → 20691 B`). A file size agreeing to the byte across five days is the cheapest evidence available that the
same tree is being measured; the commit `2627d9b` is what produced it.

## 2. How it is rebuilt

```bash
mkdir -p /c/Users/Macfy/Desktop/dsh/dove-graded && cd /c/Users/Macfy/Desktop/dsh/dove-graded
git clone https://github.com/psf/cachecontrol.git
# 1. the route the planted test needs, next to `cache_60` in tests/conftest.py:
#      def immutable_cacheable(self, env, start_response):
#          headers = [("Cache-Control", "public, max-age=60, immutable"),
#                     ("Content-Type", "text/plain")]
#          start_response("200 OK", headers)
#          return [pformat(env).encode("utf8")]
# 2. tests/test_immutable.py: Session + CacheControlAdapter, first GET not from cache, second GET with
#    the request header `Cache-Control: max-age=0` asserted `is True` for `from_cache`.
# 3. bind it: .dove/mode.json with schemaVersion 1 and mode "code-development", 55 B, written without a BOM.
python -m pytest -q      # must print: 1 failed, 115 passed
```

**Nothing needs installing.** The machine's `python` (3.11.5) already carries `requests`, `msgpack`, `pytest`,
`cherrypy`, `cheroot`, `filelock` and `redis`, and `python -m pytest` is what makes that work: it puts the current
directory first on `sys.path`, so `import cachecontrol` resolves to the source tree being graded rather than to the
`cachecontrol` installed in `site-packages`. A bare `pytest` does not make that promise, which is why every reading in
this task says `python -m pytest -q`.

## 3. What is not byte-identical to the 2026-10-05 fixture

- **`tests/test_immutable.py` is a reconstruction.** Its name, class, method and failure text match the record; its
  bytes are mine. The original was never committed and is not on this machine.
- **`tests/conftest.py` measures 5,971 B here against 5,876 B in the record.** The difference is the route above plus
  two lines of comment; the route is what makes the planted test reachable, and the earlier record's own account of the
  fixture's `conftest.py` edit (+273 B by the agent, ignoring empty path segments so that `//immutable_cacheable` could
  reach a handler) is independent evidence that a route of that name existed there too.
- **The upstream commit is inferred, not recorded**: `2627d9b` is HEAD five days after the runs, and it reproduces the
  recorded `controller.py` size and the recorded `115 passed`. A commit is not claimed where a byte count is what was
  checked.

## 4. What must not be assumed

- **A passing suite is not the same as the work being right.** The instrument decides one behaviour; `115 passed` was
  green before the agent ran, and a solution that makes 116 green can still be wrong in the ways a single test does not
  see (RFC 8246 has more to say than one code path).
- **The baseline is a fact about this clone, not about cachecontrol.** Two re-measurements of the same command on
  different days are two experiments; the number `115` is whatever upstream's suite holds at the commit measured.
- **`dove-pi.cmd` may be replaced by a bare `dove-pi` once the managed install carries the extension-less shim.** The
  installer writes it (`installer/manager.py:250`), this machine's managed install does not have it yet, and the shell
  this harness selects is git-bash — measured 2026-10-11: `command -v dove-pi.cmd` resolves and `command -v dove-pi`
  does not.
