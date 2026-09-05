import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / ".trellis" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common.active_task import (  # noqa: E402
    clear_active_task,
    resolve_active_task,
)


class ActiveTaskSessionIsolationTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="trellis-active-task-")
        self.root = Path(self.tempdir.name)
        self.sessions = self.root / ".trellis" / ".runtime" / "sessions"
        self.sessions.mkdir(parents=True)
        self.task = self.root / ".trellis" / "tasks" / "demo"
        self.task.mkdir(parents=True)

    def tearDown(self):
        self.tempdir.cleanup()

    def write_session(self, key: str, task_ref: str = ".trellis/tasks/demo") -> Path:
        path = self.sessions / f"{key}.json"
        path.write_text(json.dumps({"current_task": task_ref}), encoding="utf-8")
        return path

    def test_matching_explicit_session_resolves_its_task(self):
        self.write_session("codex_thread-1")

        active = resolve_active_task(
            self.root,
            {"session_id": "thread-1"},
            platform="codex",
            allow_environment_context=False,
        )

        self.assertEqual(active.task_path, ".trellis/tasks/demo")
        self.assertEqual(active.source_type, "session")
        self.assertEqual(active.context_key, "codex_thread-1")

    def test_unmatched_explicit_session_does_not_fallback_to_sole_other_session(self):
        self.write_session("codex_old-window")

        active = resolve_active_task(
            self.root,
            {"session_id": "new-window"},
            platform="codex",
            allow_environment_context=False,
        )

        self.assertIsNone(active.task_path)
        self.assertEqual(active.source_type, "none")
        self.assertEqual(active.context_key, "codex_new-window")

    def test_identityless_invocation_keeps_documented_single_session_fallback(self):
        self.write_session("pull-agent")

        active = resolve_active_task(
            self.root,
            {},
            platform="copilot",
            allow_environment_context=False,
        )

        self.assertEqual(active.task_path, ".trellis/tasks/demo")
        self.assertEqual(active.source_type, "session-fallback")
        self.assertEqual(active.context_key, "pull-agent")

    def test_finish_with_unmatched_explicit_session_does_not_delete_other_pointer(self):
        old_path = self.write_session("codex_old-window")

        active = clear_active_task(
            self.root,
            {"session_id": "new-window"},
            platform="codex",
        )

        self.assertIsNone(active.task_path)
        self.assertTrue(old_path.exists())


if __name__ == "__main__":
    unittest.main()
