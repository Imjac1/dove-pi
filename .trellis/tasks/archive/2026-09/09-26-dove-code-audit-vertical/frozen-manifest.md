# Frozen manifest - 09-26-dove-code-audit-vertical

**The per-row comparison is the check that works.** The digest hashes this manifest own body and the
mtime line is computed from the recorded mtimes, so both are invariant under any change to the files
they describe. The mtime column is the floor of mtimeMs.

MANIFEST DIGEST: 749b7bf8a1e71f72e59b8b4d0e6fc27da541e02e9dff6c52a63de42584d78500
ROWS: 35

## What this pin cannot do

**Most of these files are untracked**, so the pinned bytes cannot be recovered or diffed against once
the tree moves. A pin over untracked files is a statement about a moment, not a revision. Committing
them is what makes it mean something, and that needs the user.

## Expected at this revision

- npm run typecheck -> 0 errors
- npm test -> tests 496 / pass 494 / fail 0 / skipped 2, exit 0
- node --import tsx --test tests/spec-context-budget.test.ts -> 5 pass / 0 fail

```text
1a05b79ece545a2c9cc95919e5ab86e673596b19ea122e34af63ce76d92290d4     2487  1790414283701  .trellis/spec/backend/index.md
127528c9755ebc54d6687961a70946e625a4b817308769331d9a80ba87ddd62c    15258  1790423893431  .trellis/spec/backend/personal-agent-audit-vertical.md
d9c21af67617478093205ea4ac4803cc87b8a2ba680490642e04729e772a9091    22067  1790415399448  .trellis/spec/backend/personal-agent-framework-core.md
ce651c374af12e3fc30286120d37325f5f51f3cd20100549fc775f15378f8e80     2979  1790414291458  .trellis/spec/backend/personal-agent-runtime.md
f218f7b2e5bcaaa631e2a7581236f1a9f95ac762cf0f5c6c788764c927597b87      885  1790411329481  .trellis/tasks/09-26-dove-code-audit-vertical/check.jsonl
b0afc818c7f43a1c4160043a5516a80951dec7b250074a3b8229be3c839a26ef    18231  1790425197512  .trellis/tasks/09-26-dove-code-audit-vertical/design.md
1cca7c07200dd052cbb1e31857f46e842c17cb2df400e1312e28b05b8f4f0332     1028  1790411319553  .trellis/tasks/09-26-dove-code-audit-vertical/implement.jsonl
46695d05891d4f5fed372971791df1abd18851fa8391dc818ba845fc52636a77    41048  1790425524025  .trellis/tasks/09-26-dove-code-audit-vertical/implement.md
73160956120e3219e749273bc621a1c53cc7757597320442e248fd5e37792b76    14914  1790425227306  .trellis/tasks/09-26-dove-code-audit-vertical/prd.md
5b2c5c3b1c0fd25d447b740184c67bf81c7657db8076c0a600e60ff496c5faaa     3671  1790424992814  modes/code-audit/MODE.md
6b53e3c433a7abb1d0fce8292e26083764d7f12eb751b7b77cb763305d5e016a     9177  1790414539140  modes/code-audit/catalog/typescript.json
bc3d42cb9c96f8a195fc80e69ddc634b9e9bd3947b206e3ae5ea419af91d2e9b      868  1790416209316  modes/code-audit/governance.yaml
3b7a1ed4092f543f698c268d8b662adeec48124a09f761ec5780431e6aae44af       96  1790352993332  modes/code-audit/permissions.yaml
fa616e3c4f05bce3975b2cf13b1aad22e0349e1f1735cc1925c491abf398040a    20271  1790425385671  src/capabilities/code-audit.ts
f96847656b5dd02c1cf5b6bfecfb5c867787cb27c61aa44ab4a1d0778657ca89    23395  1790424737670  src/core/evidence-sarif.ts
ca274ab58912a6b7d1390f521cad118de090249678cfcf59c28a69938dcf1e13     1584  1790413865914  src/runtime.ts
076252f0df37da37a777e5f2859fbf4c48bae6ed9ed0ed30f7008dd3303b935f     7577  1790413450629  src/code-audit/catalog.ts
4db1f2a8d65b7329de177a44bd70978b807462db8d01f8642db1c14bc041f133    23988  1790424770381  src/code-audit/claim-schema.ts
cf0c29258c08d485dfbb7bcfcd926e124d2f597db09e8f87870b70450ce70337     5561  1790425346786  src/code-audit/derive-findings.ts
cebb4537018276069755c190966f47e81e0fc740b606a6516e782a78053238ae     5144  1790413465909  src/code-audit/receipt.ts
974317aa0b1945e89694f00d776c74c7e362bc468a3e70849517262d729dee06     8327  1790413483861  src/code-audit/seed-scanner.ts
d51c5fa24da90ddedaaea2d5ef7ba8cf53e67d9dd368fbf6b72e93135e0412d8     9597  1790414943138  tests/code-audit-claim.test.ts
6360b39ea65dc2ce4cf40415eb2d205b02b5e8e6446ff7d96174baf8bb4826f0     3877  1790425467542  tests/code-audit-derive.test.ts
3c58479beaab548739e748f413350516d0022503cc0bae2fbed291c23f86c930    19096  1790424937536  tests/code-audit-mode.test.ts
70da28c55f4aa6e4b69e19a83558d205f63b8dce2d5e9a51f4ba0d2d6be1ca57    11811  1790416102360  tests/code-audit-seed.test.ts
e0e48611f4197a972f17ae60e9f0d30a80e805302173bc3cf48294d1e2ab42aa    22671  1790424901816  tests/code-audit-vertical.test.ts
fe4e9f9f0b018bf9341c4c682cee8a7106f5bd05578f45f272b97f7949e479fd    13747  1790424137067  tests/evidence-sarif.test.ts
c88ae6f56485cda1d4b15d0ab3e9da8cb0976de7024bbfbcecf36dd539e281f6    87552  1790414011259  tests/pi-adapter.test.ts
d944b58845879d7a536a5bafd6f8140783bc80ee80ad5d2d219cece15f584493     4200  1790414283673  tests/spec-context-budget.test.ts
4e2de4ef7503ae435d150a55e5b8a8eaa1c2ba4c9d2807622c1d601cbe0c97a1       41  1790413510302  tests/fixtures/code-audit/safe/README.md
3a6ca15b1bb648d47676b5b1b25bc19ff8abcdbd52cc1497521a7cfc7751cba8      117  1790413510298  tests/fixtures/code-audit/safe/src/clean.ts
d7ddeadf71c9e1d29b8bcf263675f3ddf6b344fd4c8b6ac4a3ce876b64b60fb5      358  1790413510283  tests/fixtures/code-audit/vulnerable/src/db/query.ts
f031347c8b7a55a3ad354f5e8bde05831ee749e03ca9903b3e5317ef29f0b692      345  1790413510293  tests/fixtures/code-audit/vulnerable/src/fetch/proxy.ts
60fdfb0b72f3b6073b38031e4728b564ad5b64295d18d138c94905e45bffee67      441  1790413510288  tests/fixtures/code-audit/vulnerable/src/http/export.ts
c3ca66f3892c9004a8bc43198f126b05d6cb9cb37a5eaef1d3b46c8053b85cf7      684  1790413604591  tsconfig.json
```
