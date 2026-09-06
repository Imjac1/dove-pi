"""Project-local Trellis bridge for the shared task convergence reducer."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from .log import Colors, colored
from .paths import get_repo_root


def cmd_convergence(args: argparse.Namespace) -> int:
    repo_root = get_repo_root()
    helper = repo_root / "scripts" / "trellis-convergence.mts"
    loader = repo_root / "node_modules" / "tsx" / "dist" / "loader.mjs"
    node = shutil.which("node")
    if node is None or not helper.is_file() or not loader.is_file():
        print(colored("Error: shared convergence helper requires Node.js and installed tsx.", Colors.RED), file=sys.stderr)
        return 1

    if args.action == "replay":
        fixture = (repo_root / (args.fixture or "tests/fixtures/task-convergence-traces.json")).resolve()
        command = [node, "--import", loader.as_uri(), str(helper), "replay", str(fixture)]
        if args.trace:
            command.append(args.trace)
    else:
        if not args.snapshot:
            print(colored("Error: convergence status/apply requires --snapshot.", Colors.RED), file=sys.stderr)
            return 1
        snapshot = (repo_root / args.snapshot).resolve()
        task_root = (repo_root / ".trellis" / "tasks").resolve()
        try:
            snapshot.relative_to(task_root)
        except ValueError:
            print(colored("Error: convergence snapshots must stay under .trellis/tasks.", Colors.RED), file=sys.stderr)
            return 1
        if snapshot.name != "convergence.json":
            print(colored("Error: convergence snapshot must be named convergence.json.", Colors.RED), file=sys.stderr)
            return 1
        command = [node, "--import", loader.as_uri(), str(helper), args.action, str(snapshot)]
        if args.action == "apply":
            if not args.event:
                print(colored("Error: convergence apply requires --event JSON.", Colors.RED), file=sys.stderr)
                return 1
            try:
                json.loads(args.event)
            except json.JSONDecodeError as error:
                print(colored(f"Error: invalid convergence event JSON: {error}", Colors.RED), file=sys.stderr)
                return 1
            command.append(args.event)

    result = subprocess.run(command, cwd=repo_root, text=True, capture_output=True)
    if result.stdout:
        print(result.stdout, end="")
    if result.returncode != 0 and result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode


def add_convergence_parser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser("convergence", help="Manage the shared Trellis task convergence snapshot")
    parser.add_argument("action", choices=["status", "apply", "replay"])
    parser.add_argument("--snapshot", help="Snapshot path relative to the repository root")
    parser.add_argument("--event", help="One validated convergence event as JSON")
    parser.add_argument("--fixture", help="Fixture path relative to the repository root")
    parser.add_argument("--trace", help="Replay only one named fixture trace")
