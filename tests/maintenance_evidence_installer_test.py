"""What class of defect this holds, and what it does not.

Holds the maintenance evidence and redaction contracts: a legacy four-field record is projected as schema 1 with
the fields a newer record would add reported unavailable rather than guessed, a malformed record is reported and
not raised, and a message carrying the shapes the child task names is redacted and bounded before it becomes
evidence.

It does not hold that the writer emits schema 2 - that is a later plan item - and it does not hold the audit
summary command, which reads these projections rather than defining them.
"""
from __future__ import annotations

import json
from pathlib import Path
import unittest

import dove_pi


LEGACY = {"at": "2026-08-30T00:00:00+00:00", "command": "repair", "status": "ready", "message": "repaired"}


class MaintenanceEvidenceContractTest(unittest.TestCase):
    def test_legacy_four_field_record_projects_as_schema_one_and_labels_what_it_lacks(self) -> None:
        projected = dove_pi.project_maintenance_record(dict(LEGACY))
        self.assertEqual(projected["schemaVersion"], 1)
        # The four legacy fields survive, which is what "remains readable" means.
        self.assertEqual(projected["command"], "repair")
        self.assertEqual(projected["status"], "ready")
        # And what a newer record would carry is labelled, not guessed.
        for field in dove_pi.ADDITIVE_MAINTENANCE_FIELDS:
            self.assertEqual(projected[field], dove_pi.MAINTENANCE_UNAVAILABLE, field)

    def test_the_projection_does_not_rewrite_history(self) -> None:
        original = dict(LEGACY)
        dove_pi.project_maintenance_record(original)
        self.assertEqual(original, LEGACY, "the record passed in must be unchanged")

    def test_a_versioned_record_keeps_its_own_fields(self) -> None:
        record = dict(LEGACY, schemaVersion=dove_pi.MAINTENANCE_SCHEMA_VERSION, runId="run-1", durationMs=12)
        projected = dove_pi.project_maintenance_record(record)
        self.assertEqual(projected["schemaVersion"], dove_pi.MAINTENANCE_SCHEMA_VERSION)
        self.assertEqual(projected["runId"], "run-1")
        self.assertEqual(projected["durationMs"], 12)

    def test_a_malformed_record_is_reported_rather_than_raised(self) -> None:
        for bad in (None, "not a record", [], {"schemaVersion": 0}, {"schemaVersion": "two"}, {"schemaVersion": True}):
            projected = dove_pi.project_maintenance_record(bad)
            self.assertEqual(projected["schemaVersion"], 0, repr(bad))
            self.assertTrue(projected["malformed"], repr(bad))
            self.assertIn("reason", projected)

    def test_a_message_carrying_a_secret_is_redacted_before_it_becomes_evidence(self) -> None:
        cases = {
            "token=abc123": "abc123",
            "Authorization: Bearer ghp_secretvalue": "ghp_secretvalue",
            "api_key: sk-live-9999": "sk-live-9999",
            "password hunter2": "hunter2",
            "key at C:/Users/x/.ssh/id_rsa": "id_rsa",
    }
        for text, secret in cases.items():
            redacted = dove_pi.redact_maintenance_text(text)
            self.assertNotIn(secret, redacted, text)
            self.assertIn("<redacted", redacted, text)
        # The control: ordinary text is left alone, so the redaction is about the shapes and not about every word.
        self.assertEqual(dove_pi.redact_maintenance_text("repaired the managed release"), "repaired the managed release")

    def test_a_redacted_message_is_bounded(self) -> None:
        redacted = dove_pi.redact_maintenance_text("x" * 2000, limit=100)
        self.assertLessEqual(len(redacted), 103, "bounded to the limit plus the marker")


if __name__ == "__main__":
    unittest.main()
