"""Every Python test file under tests is either run by the installer pattern or declared foreign.

**Found by measuring the pattern rather than trusting it.** The installer suite runs `python -m unittest discover -s tests -p
"*installer*_test.py"`, and `tests/active_task_test.py` does not contain `installer` - so it is skipped. Reading it explains it: it tests
`.trellis/scripts/common/active_task.py`, which is the Trellis tooling rather than this project, and nothing in this repository runs it.

**So the file is not wrong and the pattern is not wrong; what was missing is a statement.** This holds the classification, so the next
Python file added under `tests/` is either named for the suite that runs it or listed here with the reason it is not.

**One direction on purpose**, like the switch check: the pattern may match a subset, while a file matched by nothing is the defect.
"""
import re
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PATTERN = re.compile(r"installer.*_test\.py$")

# **Files under tests that this repository does not own.** The Trellis tooling ships its own tests, and one of them landed here; a
# `trellis update` may replace it, so wiring it into the installer pattern would be editing a file that is not ours to keep.
FOREIGN = {
    "active_task_test.py": "tests the Trellis tooling under .trellis/scripts, not this project",
}


class PythonDiscoveryTests(unittest.TestCase):
    def test_every_python_test_file_is_run_or_declared_foreign(self):
        on_disk = sorted(path.name for path in (ROOT / "tests").glob("*_test.py"))
        self.assertTrue(on_disk, "the discovery found no test files at all, which is its own kind of wrong")

        skipped = [name for name in on_disk if PATTERN.search(name) is None and name not in FOREIGN]
        self.assertEqual(
            skipped,
            [],
            "a python test file the installer pattern skips and no list explains: " + ", ".join(skipped),
        )

        stale = [name for name in FOREIGN if name not in on_disk]
        self.assertEqual(stale, [], "the foreign list names a file that is gone: " + ", ".join(stale))


if __name__ == "__main__":
    unittest.main()
