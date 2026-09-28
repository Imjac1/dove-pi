# The summary that explains repeated maintenance

## Goal

Do the child seventh plan item: validate repeated maintenance explanations and incomplete-session reporting.

## Background: the archived defect this answers

The 20260830 audit recorded that *maintenance logs could not explain two installs and one repair within a few
minutes*. The logs were four fields, so a repair that changed nothing and one that changed everything looked
identical. The contract round made a richer record possible; this round makes it explain something.

## Requirements

- **R1 - List the runs in order**, with each decision and duration.
- **R2 - Count what could not be read**, rather than reading it as a no-op.
- **R3 - Do not group runs by proximity**: a timestamp is not a correlation identifier.
- **R4 - Hold it with tests**, including a control that a no-op is a decision.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Two installs and a repair are listed in order with their decisions.
- [x] **AC2** A record without a decision is counted, not inferred.
- [x] **AC3** A total duration is not reported when none could be measured.
- [x] **AC4** The gate passes.