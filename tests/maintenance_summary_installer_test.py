"""What class of defect this holds, and what it does not.

Holds the maintenance summary against the archived defect it answers: *maintenance logs could not explain two
installs and one repair within a few minutes*. It checks that the runs are listed in order with their decisions
and durations, and that a record which cannot say what it decided or how long it took is counted as such rather
than read as a no-op.

It does not hold the grouping of runs into a time window, because the summary deliberately does not group them:
the design says correlation fields are identifiers, and a timestamp is not one.
"""
from __future__ import annotations

import unittest

import dove_pi


def run(at: str, command: str, decision: str, duration_ms: object) -> dict:
    return {
        "at": at,
        "command": command,
        "status": "ready",
        "message": f"{command} completed",
        "schemaVersion": dove_pi.MAINTENANCE_SCHEMA_VERSION,
        "decision": decision,
        "durationMs": duration_ms,
    }


LEGACY = {"at": "2026-08-30T00:00:00+00:00", "command": "repair", "status": "ready", "message": "repaired"}


class MaintenanceSummaryTest(unittest.TestCase):
    def test_explains_two_installs_and_one_repair_in_the_order_they_happened(self) -> None:
        summary = dove_pi.summarize_maintenance_logs([
            run("2026-08-30T00:01:00+00:00", "install", "changed", 2400),
            run("2026-08-30T00:02:00+00:00", "install", "changed", 1800),
            run("2026-08-30T00:03:00+00:00", "repair", "changed", 900),
        ])
        self.assertEqual(summary["runCount"], 3)
        self.assertEqual([r["command"] for r in summary["runs"]], ["install", "install", "repair"],
                         "the runs are listed in the order given, which is the order they happened")
        self.assertEqual(summary["byDecision"], {"changed": 3})
        self.assertEqual(summary["totalDurationMs"], 5100, "the durations are summed, not averaged away")
        self.assertEqual(summary["runsWithoutDecision"], 0)

    def test_counts_a_record_that_cannot_say_what_it_decided(self) -> None:
        # The archived logs were four fields, so this is the shape that could not explain the cluster.
        summary = dove_pi.summarize_maintenance_logs([dict(LEGACY)])
        self.assertEqual(summary["runCount"], 1)
        self.assertEqual(summary["runsWithoutDecision"], 1)
        self.assertEqual(summary["byDecision"], {}, "a decision it cannot read is not counted as a decision")
        self.assertEqual(summary["runs"][0]["decision"], dove_pi.MAINTENANCE_UNAVAILABLE)
        self.assertEqual(summary["runs"][0]["command"], "repair", "the fields it does carry are kept")

    def test_does_not_report_a_total_duration_it_could_not_measure(self) -> None:
        summary = dove_pi.summarize_maintenance_logs([dict(LEGACY)])
        self.assertEqual(summary["runsWithDuration"], 0)
        self.assertEqual(summary["totalDurationMs"], dove_pi.MAINTENANCE_UNAVAILABLE,
                         "a sum of nothing must not read as a duration of zero")

    def test_treats_a_record_that_is_not_an_object_as_a_run_it_could_not_read(self) -> None:
        summary = dove_pi.summarize_maintenance_logs(["not a record", None, 42])
        self.assertEqual(summary["runCount"], 3)
        self.assertTrue(all(r["malformed"] for r in summary["runs"]))
        self.assertEqual(summary["runsWithoutDecision"], 3)

    def test_an_empty_log_directory_summarizes_to_nothing_rather_than_to_a_claim(self) -> None:
        summary = dove_pi.summarize_maintenance_logs([])
        self.assertEqual(summary["runCount"], 0)
        self.assertEqual(summary["byDecision"], {})
        self.assertEqual(summary["totalDurationMs"], dove_pi.MAINTENANCE_UNAVAILABLE)

    def test_a_control_that_an_ordinary_run_is_not_counted_as_undecided(self) -> None:
        summary = dove_pi.summarize_maintenance_logs([run("2026-08-30T00:00:00+00:00", "update", "no_op", 10)])
        self.assertEqual(summary["runsWithoutDecision"], 0, "no_op is a decision, not the absence of one")
        self.assertEqual(summary["byDecision"], {"no_op": 1})


if __name__ == "__main__":
    unittest.main()
