---
name: trading
description: Submit orders against a venue under pre-trade limits, with a stable client order id so a retry cannot double-execute.
license: MIT
compatibility: Requires a limit gate, an effect ledger, and a venue that honours client order ids.
---

Submit only what the limits permit, and make every submission identifiable.

## Before submitting

Every order passes the pre-trade limits first. A limit that cannot be evaluated - a missing notional, a
non-finite quantity - is a **block**, never a pass. SEC Rule 15c3-5 requires controls "reasonably
designed to prevent the entry of orders that exceed appropriate pre-set credit or capital thresholds,
or that appear to be erroneous", applied **before** entry.

## Identifying a submission

Every order carries a **client order id derived from the framework's effect identity**. That is what
makes a retry safe: if a resume or a retry resubmits, the venue rejects the duplicate rather than
filling it twice. Never invent a fresh id for a retry - a new id is a new order.

Derive the id from the framework's effect identity, and if you cannot, stop and say so: an id invented for the
occasion is a new order rather than a retry of the one that did not land.

## When something fails

A submission whose outcome is unknown is **ambiguous**, not failed: a timeout may have been filled. Do
not resubmit on your own initiative. Report the ambiguity and let the operator decide, because the
framework cannot tell "did not land" from "landed but the acknowledgement was lost".

## Scope

Sandbox or testnet only. A production endpoint is out of scope for this mode.
