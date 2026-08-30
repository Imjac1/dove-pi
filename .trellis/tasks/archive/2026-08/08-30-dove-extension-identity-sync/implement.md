# Implementation plan: Dove extension identity and synchronization

- [x] Inventory launcher, manifest, Pi loader, wrapper, doctor, and installer contracts.
- [x] Add host-independent identity/selection types and deterministic digest helpers.
- [x] Add manifest identity fields and legacy `unknown` decoding.
- [x] Add Pi registration claim and structured duplicate/mismatch diagnostics.
- [x] Make managed explicit by default; make project override explicit/trusted.
- [x] Remove the current `Path.cwd()/personal-agent.ts` workaround.
- [x] Project sync state through doctor/status and maintenance evidence.
- [x] Test normal/source/untrusted/unrelated/symlink/case/version-drift/third-party cases.
- [x] Run typecheck, focused Node tests, installer tests, doctor, and Pi smoke.

## Risky Files

- `dove_pi.py`
- `.pi/extensions/personal-agent.ts`
- `src/pi-adapter/extension.ts`
- release manifest/installer modules and their tests

Do not stage unrelated existing hunks wholesale.
