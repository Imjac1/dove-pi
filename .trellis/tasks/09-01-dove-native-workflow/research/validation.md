# Validation Evidence

## Automated gates

- TypeScript: 229 tests passed across 46 suites.
- Installer: 92 tests passed.
- `npm run typecheck` and `git diff --check` passed.
- Managed source installation completed with `--verify full`.
- Full-verified installed release: `0.1.5+source.fbf8d66e8975`. The final
  diagnostic-only patch was quick-verified as `0.1.5+source.89c25b1935e9`, with
  the full-verified build retained as rollback. Pi and Pi TUI: `0.84.3`.
- Installed package contains no `.agents`, no `@mindfoldhq/trellis`, and release
  components contain only Pi and Pi TUI.
- Managed doctor reports a healthy native project, 13 healthy extensions, one
  `provider:native` authority, and no context-authority conflicts.

## Real-provider clean-project flow

Project:
`C:\Users\rebot\AppData\Local\Temp\dove-native-realflow-f6e41ac49f9543cfb18262d42f6aea78`

Session/model: `dove-native-eval-isolated` /
`12321/deepseek-ai/DeepSeek-V4-Flash`.

- The first request created and read `hello.txt` directly. It asked no question,
  wrote exactly `DOVE_NATIVE_OK`, and silently created one native goal.
- The second request made one read call, asked no question, and returned exactly
  `VERIFIED`. Both provider calls reused cache at 99.0% and 98.6%.
- The third request ran after a 17-minute idle interval. Its first call missed
  the provider's default short-TTL cache; after one read call, the next provider
  call reused 23,296 tokens at 99.2% and returned exactly `STEADY`.
- Across seven provider calls, recent-five request hit rate was 80%, final hit
  rate 99.2%, and no Dove context message was emitted (`no-context`). Before the
  deliberate idle expiry, warm token reuse was 74.4%.
- System digest `8ed0fa90572b08332a76e0c9`, tool digest
  `cdfaa77b5381066d5d9027d6`, Dove-context digest
  `4f53cda18c2baa0c0354bb5f`, tool count 46, and schema bytes 66,958 stayed
  stable. A zero cache read therefore is not attributed to Dove prefix churn
  without separate prefix evidence.
- Cache-prefix diagnostics now ignore Pi/provider `cache_control` breakpoint
  movement while retaining actual roles, text, tool arguments, and call IDs.
  A post-fix real tool round was classified `stable-prefix` / `new-history` and
  reused 23,296 tokens at 98.8% instead of the old false `history-rewrite`.
- An immediate new-process request on the same installed version reused 23,552
  tokens on its first provider call at 99.7%, then 99.4% after the read tool.
  The earlier cold first call followed an installed-version/system-prompt change;
  process restart alone did not destroy provider reuse.

## Cleanup

The accidental root-temp `hello.txt` and `.dove/state.json`, plus the repository
test `.dove/state.json`, were verified by content/timestamps and removed. The
repository's pre-existing `.dove/manifest.json` was preserved. No files under
`C:\Users\rebot\Desktop\code` were modified.
