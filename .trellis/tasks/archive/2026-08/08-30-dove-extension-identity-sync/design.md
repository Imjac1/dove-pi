# Design: Dove extension identity and synchronization

## Boundaries

- Host-independent identity comparison belongs in `src/core` and imports no Pi/installer code.
- Pi discovery and registration guarding belong in `src/pi-adapter` and the `.pi` wrapper.
- Python consumes manifest/probe output; it does not reimplement hashing rules.

## Selection

The launcher explicitly supplies managed Dove while Pi preserves normal discovery. A stable process-global registration claim prevents another legitimate Dove copy from registering the same tools. Precedence is `explicit trusted developer override > managed explicit > project auto-discovery`. Override fails closed when trust cannot be established. An unrelated extension claiming Dove tools remains a visible conflict.

## Synchronization State

Release manifests carry extension ID/version/digest. Project identity is read-only. Doctor projects comparison. Maintenance commands update only the versioned managed release under the existing transaction/lock. Legacy manifests remain runnable but report `unknown` until verified repair/update.
