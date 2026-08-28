#!/usr/bin/env python3
"""Dove Pi installer and launcher.

Usage:
    python dove_pi.py install [--profile PROFILE] [--verify quick|full|none] [--no-path] [--clean]
    python dove_pi.py setup [same options as install]
    python dove_pi.py update [--check] [--force] [--verify quick|full|none]
    python dove_pi.py icons setup|install|status
    python dove_pi.py [official Pi arguments]
"""

from __future__ import annotations

import argparse
import ctypes
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
import sys
import json
from typing import Sequence



PROJECT_ROOT = Path(__file__).resolve().parent
PI_ENTRY = PROJECT_ROOT / "node_modules" / "@earendil-works" / "pi-coding-agent" / "dist" / "bundle" / "cli.js"
EXTENSION = PROJECT_ROOT / ".pi" / "extensions" / "personal-agent.ts"
TSX_LOADER = PROJECT_ROOT / "node_modules" / "tsx" / "dist" / "loader.mjs"
CLI = PROJECT_ROOT / "src" / "cli.ts"
ICON_FONT_PACKAGE = "DEVCOM.JetBrainsMonoNerdFont"
MIN_NODE = (22, 19, 0)
PROFILES = ("minimal", "dev", "research", "security", "max")
DEFAULT_PROFILE = "max"
MANIFEST_DIR = PROJECT_ROOT / ".dove"
MANIFEST_PATH = MANIFEST_DIR / "manifest.json"
MANIFEST_FIELDS = ("profile", "previousCommit", "currentCommit", "lastUpdatedAt")
TRELLIS_GLOBAL_PACKAGE = "@mindfoldhq/trellis"
REMOTE_BRANCH = "origin/master"
LOCAL_BRANCH = "master"


def executable(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"{name} is required but was not found in PATH")
    return path


def run(command: Sequence[str], *, cwd: Path = PROJECT_ROOT, label: str | None = None, show_command: bool = False) -> None:
    if label:
        print(f"\n[{label}]", flush=True)
    if show_command:
        print("  +", " ".join(command), flush=True)
    subprocess.run(list(command), cwd=cwd, check=True)


def node_version() -> tuple[int, int, int]:
    node = executable("node")
    output = subprocess.check_output([node, "--version"], text=True).strip()
    raw = output.removeprefix("v").split(".")
    try:
        version = tuple(int(part) for part in raw[:3])
    except ValueError as error:
        raise RuntimeError(f"Unable to parse Node.js version: {output}") from error
    if len(version) != 3:
        raise RuntimeError(f"Unable to parse Node.js version: {output}")
    return version


def format_version(version: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in version)


def install(*, skip_checks: bool = False, no_path: bool = False, extension_profile: str | None = "max", clean: bool = False, verify: str | None = None, install_font: bool = True, update_extensions: bool = True, update_trellis: bool = True) -> None:
    # `skip_checks` remains for callers of the original Python API. The CLI
    # uses --verify so the common path is explicit and easy to understand.
    if extension_profile is None:
        extension_profile = read_manifest().get("profile") or DEFAULT_PROFILE
    if verify is not None:
        if verify not in {"quick", "full", "none"}:
            raise RuntimeError("verify must be quick, full, or none")
        skip_checks = verify == "none"
    print("Dove Pi setup")
    print(f"Source: {PROJECT_ROOT}")
    executable("node")
    npm = executable("npm")
    version = node_version()
    if version < MIN_NODE:
        raise RuntimeError(f"Node.js {format_version(MIN_NODE)} or newer is required; found {format_version(version)}. Install Node.js LTS and try again.")
    print(f"Node.js: {format_version(version)}")

    total_steps = 1 + (1 if extension_profile else 0) + (1 if extension_profile and install_font else 0) + (1 if extension_profile and update_trellis else 0)
    total_steps += 0 if skip_checks else 2 + (1 if verify == "full" else 0)
    current_step = 0

    def stage(label: str) -> str:
        nonlocal current_step
        current_step += 1
        return f"{current_step}/{total_steps} {label}"

    lockfile = PROJECT_ROOT / "package-lock.json"
    if lockfile.exists() and (clean or not (PROJECT_ROOT / "node_modules").exists()):
        run([npm, "ci", "--no-audit", "--no-fund", "--loglevel=error"], label=stage("Installing locked dependencies"))
    elif lockfile.exists():
        run([npm, "install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"], label=stage("Checking dependencies"))
    else:
        run([npm, "install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"], label=stage("Installing dependencies"))

    if extension_profile:
        print(f"\n[{stage(f'Configuring Pi extensions ({extension_profile})')}]", flush=True)
        extension_args = ["extensions", "install", extension_profile]
        if not update_extensions:
            extension_args.append("--no-update")
        extension_exit = run_local_cli(extension_args)
        if extension_exit != 0:
            raise subprocess.CalledProcessError(extension_exit, ["dove-pi", "extensions", "install", extension_profile])
        if install_font:
            print(f"\n[{stage('Configuring terminal icons')}]", flush=True)
            ensure_icon_font()
        else:
            configure_icons("auto")
        if update_trellis:
            print(f"\n[{stage('Updating Trellis CLI')}]", flush=True)
            update_trellis_cli()

    if not skip_checks:
        run([npm, "run", "typecheck"], label=stage("Checking Dove Pi"))
        run([npm, "run", "pi:smoke"], label=stage("Checking Pi integration"))
        if verify == "full":
            run([npm, "test"], label=stage("Running full test suite"))

    launcher_root = launcher_directory()
    launcher_root.mkdir(parents=True, exist_ok=True)
    write_launchers(launcher_root)
    if not no_path:
        add_user_path(launcher_root)
    print(f"\nDove Pi is ready: {launcher_root}")
    write_manifest(profile=extension_profile, current_commit=git_current_commit())
    if no_path:
        print(f"Run directly: {launcher_root / ('dove-pi.cmd' if os.name == 'nt' else 'dove-pi')}")
    else:
        print("Open a new terminal, then run 'dove-pi' from any target project directory.")
    print("Next: dove-pi doctor")


def launcher_directory() -> Path:
    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            raise RuntimeError("LOCALAPPDATA is not available")
        return Path(local_app_data) / "DovePi" / "bin"
    return Path.home() / ".local" / "bin"


def write_launchers(directory: Path) -> None:
    python = Path(sys.executable).resolve()
    script = PROJECT_ROOT / "dove_pi.py"
    if os.name == "nt":
        python_text = str(python).replace("'", "''")
        script_text = str(script).replace("'", "''")
        ps1 = directory / "dove-pi.ps1"
        ps1.write_text(
            f"& '{python_text}' '{script_text}' @args\nexit $LASTEXITCODE\n",
            # Windows PowerShell 5.1 needs a BOM to reliably decode a script
            # that contains non-ASCII paths. PowerShell 7 accepts this too.
            encoding="utf-8-sig",
        )
        cmd = directory / "dove-pi.cmd"
        # Keep the batch file itself ASCII and resolve its sibling PowerShell
        # launcher at runtime. This avoids encoding the user's profile or
        # repository path in cmd.exe at all (including code pages that cannot
        # represent a particular Unicode character).
        cmd.write_text(
            '@echo off\r\n'
            'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass '
            '-File "%~dp0dove-pi.ps1" %*\r\n'
            'exit /b %ERRORLEVEL%\r\n',
            encoding="ascii",
        )
    else:
        launcher = directory / "dove-pi"
        launcher.write_text(f'#!/bin/sh\nexec "{python}" "{script}" "$@"\n', encoding="utf-8")
        launcher.chmod(0o755)


def add_user_path(directory: Path) -> None:
    value = str(directory)
    if os.name != "nt":
        current = os.environ.get("PATH", "").split(os.pathsep)
        if value not in current:
            print(f"Add {value} to PATH in your shell profile to use dove-pi globally.")
        return

    import winreg

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
        try:
            current = winreg.QueryValueEx(key, "Path")[0] or ""
        except FileNotFoundError:
            current = ""
        entries = [entry for entry in current.split(";") if entry]
        if value not in entries:
            winreg.SetValueEx(key, "Path", 0, winreg.REG_EXPAND_SZ, ";".join(entries + [value]))
            broadcast_environment_change()
            print(f"Added {value} to the user PATH. Open a new terminal to use dove-pi.")


def broadcast_environment_change() -> None:
    try:
        hwnd = 0xFFFF
        message = 0x001A
        ctypes.windll.user32.SendMessageTimeoutW(hwnd, message, 0, "Environment", 0x0002, 1000, None)
    except (AttributeError, OSError):
        # PATH is still persisted; a new process will see it even if broadcast is unavailable.
        pass


def pi_agent_directory() -> Path:
    configured = os.environ.get("PI_CODING_AGENT_DIR")
    return Path(configured) if configured else Path.home() / ".pi" / "agent"


def open_tui_settings_path() -> Path:
    return pi_agent_directory() / "open-tui.json"


def nerd_font_installed() -> bool:
    if os.name != "nt":
        return False
    try:
        import winreg

        locations = (
            (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts"),
        )
        for root, path in locations:
            try:
                with winreg.OpenKey(root, path) as key:
                    for index in range(winreg.QueryInfoKey(key)[1]):
                        name, value, _ = winreg.EnumValue(key, index)
                        if "nerd" in f"{name} {value}".lower():
                            return True
            except FileNotFoundError:
                continue
    except (ImportError, OSError):
        return False
    return False


def configure_icons(mode: str) -> str:
    if mode not in {"auto", "nerd", "ascii"}:
        raise RuntimeError(f"Unsupported icon mode '{mode}'. Use auto, nerd, or ascii.")
    settings_path = open_tui_settings_path()
    settings: dict[str, object] = {}
    if settings_path.exists():
        try:
            parsed = json.loads(settings_path.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                settings = parsed
        except (OSError, json.JSONDecodeError):
            print(f"Warning: unable to parse {settings_path}; leaving it unchanged.", file=sys.stderr)
            # Do not try to use the not-yet-computed selection from below.
            # Returning a deterministic fallback keeps `icons setup` usable
            # while honoring the warning above by leaving the malformed file
            # untouched.
            return "ascii" if mode == "auto" else mode
    icons = settings.get("icons")
    if not isinstance(icons, dict):
        icons = {}
    existing_mode = icons.get("mode")
    if mode == "auto" and isinstance(existing_mode, str) and existing_mode in {"nerd", "ascii"}:
        selected = existing_mode
    else:
        selected = ("nerd" if nerd_font_installed() else "ascii") if mode == "auto" else mode
    icons["mode"] = selected
    settings["icons"] = icons
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"pi-open-tui icon mode: {selected} ({settings_path})")
    return selected


def install_icon_font() -> int:
    if os.name != "nt":
        raise RuntimeError("Automatic Nerd Font installation is currently supported on Windows only.")
    winget = shutil.which("winget")
    if not winget:
        raise RuntimeError("winget is required to install the icon font. Install App Installer or use 'dove-pi icons setup'.")
    run([winget, "install", "--id", ICON_FONT_PACKAGE, "--exact", "--source", "winget", "--silent", "--accept-source-agreements", "--accept-package-agreements"])
    configure_icons("nerd")
    configure_windows_terminal_font()
    print("Restart Windows Terminal/VS Code and select 'JetBrainsMono Nerd Font' as the terminal font face.")
    return 0


def ensure_icon_font() -> str:
    """Install the default Nerd Font when possible, then configure open-tui."""
    if nerd_font_installed():
        selected = configure_icons("nerd")
        configure_windows_terminal_font()
        return selected
    if os.name == "nt" and shutil.which("winget"):
        try:
            install_icon_font()
            return "nerd"
        except (RuntimeError, subprocess.CalledProcessError) as error:
            print(f"Warning: Nerd Font installation failed ({error}); using ASCII icons.", file=sys.stderr)
    else:
        print("Warning: winget is unavailable; using ASCII icons. Run 'dove-pi icons install' later.", file=sys.stderr)
    return configure_icons("ascii")


def configure_windows_terminal_font() -> bool:
    settings_path = Path(os.environ.get("LOCALAPPDATA", "")) / "Packages" / "Microsoft.WindowsTerminal_8wekyb3d8bbwe" / "LocalState" / "settings.json"
    if not settings_path.exists():
        return False
    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
        if not isinstance(settings, dict):
            return False
        profiles = settings.get("profiles")
        if not isinstance(profiles, dict):
            return False
        defaults = profiles.get("defaults")
        if not isinstance(defaults, dict):
            defaults = {}
            profiles["defaults"] = defaults
        font = defaults.get("font")
        if not isinstance(font, dict):
            font = {}
            defaults["font"] = font
        if isinstance(font.get("face"), str) and font["face"].strip():
            return False
        font["face"] = "JetBrainsMono Nerd Font"
        settings_path.write_text(json.dumps(settings, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Windows Terminal default font configured: {settings_path}")
        return True
    except (OSError, json.JSONDecodeError, TypeError):
        print(f"Warning: unable to update Windows Terminal settings at {settings_path}.", file=sys.stderr)
        return False


def run_icons_command(arguments: Sequence[str]) -> int:
    command = arguments[0] if arguments else "status"
    if command == "setup":
        configure_icons("auto")
        if nerd_font_installed():
            configure_windows_terminal_font()
        return 0
    if command == "install":
        return install_icon_font()
    if command == "status":
        print(json.dumps({"fontInstalled": nerd_font_installed(), "settingsPath": str(open_tui_settings_path())}, ensure_ascii=False))
        return 0
    raise RuntimeError("Unknown icons command. Use setup, install, or status.")


def launch(arguments: Sequence[str]) -> int:
    node = executable("node")
    if not PI_ENTRY.exists():
        raise RuntimeError("Dove Pi dependencies are missing. Run 'python dove_pi.py install' first.")
    completed = subprocess.run([node, str(PI_ENTRY), "-e", str(EXTENSION), *arguments], cwd=Path.cwd())
    return completed.returncode


def run_local_cli(arguments: Sequence[str]) -> int:
    node = executable("node")
    if not CLI.exists() or not TSX_LOADER.exists():
        raise RuntimeError("Dove Pi CLI dependencies are missing. Run 'python dove_pi.py install' first.")
    completed = subprocess.run(
        [node, "--import", TSX_LOADER.as_uri(), str(CLI), *arguments],
        cwd=Path.cwd(),
    )
    return completed.returncode



def read_manifest() -> dict[str, object]:
    """Read `.dove/manifest.json`, tolerating a missing or malformed file.

    Returns a dict of known string fields; unknown keys and non-string
    values are dropped. A missing/corrupt manifest yields an empty dict so
    callers fall back to defaults without blocking setup."""
    try:
        parsed = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    result: dict[str, object] = {}
    for key, value in parsed.items():
        if key == "schemaVersion" and isinstance(value, (int, str)):
            result["schemaVersion"] = int(value)
        elif key in MANIFEST_FIELDS and isinstance(value, str) and value:
            result[key] = value
    return result


def write_manifest(*, profile: str | None = None, previous_commit: str | None = None, current_commit: str | None = None) -> None:
    """Merge fields into the manifest and atomically write it to disk."""
    manifest = read_manifest()
    manifest["schemaVersion"] = 1
    if profile is not None:
        manifest["profile"] = profile
    if previous_commit is not None:
        manifest["previousCommit"] = previous_commit
    if current_commit is not None:
        manifest["currentCommit"] = current_commit
    manifest["lastUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    temporary = MANIFEST_DIR / "manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary, MANIFEST_PATH)


def run_git(arguments: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a git command against the repository root, capturing output."""
    git = executable("git")
    completed = subprocess.run(
        [git, *arguments],
        cwd=PROJECT_ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if check and completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"git {' '.join(arguments)} failed: {detail or completed.returncode}")
    return completed


def git_is_repository() -> bool:
    return run_git(["rev-parse", "--is-inside-work-tree"], check=False).returncode == 0


def git_has_origin() -> bool:
    return run_git(["remote", "get-url", "origin"], check=False).returncode == 0


def git_detached_head() -> bool:
    return run_git(["symbolic-ref", "-q", "HEAD"], check=False).returncode != 0


def git_current_branch() -> str:
    return run_git(["branch", "--show-current"], check=False).stdout.strip()


def git_status_porcelain() -> str:
    return run_git(["status", "--porcelain"], check=False).stdout.strip()


def git_current_commit() -> str:
    return run_git(["rev-parse", "HEAD"], check=False).stdout.strip()


def git_fetch_origin() -> None:
    run_git(["fetch", "origin", "master"])


def git_remote_commit() -> str:
    return run_git(["rev-parse", REMOTE_BRANCH], check=False).stdout.strip()


def git_fast_forward() -> None:
    """Merge origin/master with --ff-only; raising keeps the tree unchanged on failure."""
    run_git(["merge", "--ff-only", REMOTE_BRANCH])


def git_reset_hard() -> None:
    """Discard uncommitted local changes (the --force path)."""
    run_git(["reset", "--hard", "HEAD"])


def git_is_ancestor(ancestor: str, descendant: str) -> bool:
    return run_git(["merge-base", "--is-ancestor", ancestor, descendant], check=False).returncode == 0


def update_trellis_cli() -> None:
    """Update the global Trellis CLI; a failure is a warning, never fatal."""
    npm = executable("npm")
    completed = subprocess.run(
        [npm, "update", "-g", TRELLIS_GLOBAL_PACKAGE, "--no-audit", "--no-fund", "--loglevel=error"],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        print(f"Warning: Trellis CLI update failed: {detail or completed.returncode}", file=sys.stderr)


def parse_update(arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="dove-pi update")
    parser.add_argument("--check", action="store_true", help="Report update availability without changing anything")
    parser.add_argument("--force", action="store_true", help="Discard uncommitted local changes before updating")
    parser.add_argument("--verify", choices=("quick", "full", "none"), default="quick", help="Verification level after updating (default: quick)")
    parser.add_argument("--no-trellis-update", action="store_true", help="Skip updating the global Trellis CLI")
    return parser.parse_args(arguments)


def run_update(arguments: Sequence[str]) -> int:
    """Self-update dove-pi from its git origin (tracking master)."""
    options = parse_update(arguments)
    if not git_is_repository():
        raise RuntimeError("dove-pi is not inside a git repository; self-update requires the dove-pi clone.")
    if not git_has_origin():
        raise RuntimeError("dove-pi clone has no 'origin' remote; cannot determine the update source.")
    if git_detached_head():
        raise RuntimeError("dove-pi is on a detached HEAD; run `git switch master` before updating.")
    branch = git_current_branch()
    if branch != LOCAL_BRANCH:
        raise RuntimeError(
            f"dove-pi is on branch '{branch or '(unknown)'}', but self-update tracks '{LOCAL_BRANCH}'. "
            f"Run `git switch {LOCAL_BRANCH}` and then retry `dove-pi update`."
        )
    if options.check:
        git_fetch_origin()
        current = git_current_commit()
        target = git_remote_commit()
        if not current or not target:
            raise RuntimeError(
                "Unable to read GitHub's origin/master after fetch; check the repository remote and network."
            )
        relation = _update_relation(current, target)
        print(json.dumps({
            "currentCommit": current,
            "targetCommit": target,
            "updateAvailable": relation == "remote-ahead",
            "state": relation,
            "branch": branch,
        }, ensure_ascii=False))
        return 0
    dirty = git_status_porcelain()
    if dirty:
        if not options.force:
            raise RuntimeError(
                f"Working tree has uncommitted changes; commit/stash them or rerun with --force. "
                f"Dirty files:\n{dirty}"
            )
        print(f"Discarding uncommitted changes (--force): {dirty.replace(chr(10), ' ')}", file=sys.stderr)
        git_reset_hard()
    current = git_current_commit()
    git_fetch_origin()
    target = git_remote_commit()
    if not current or not target:
        raise RuntimeError("Unable to determine local or remote commit; git state is incomplete.")
    relation = _update_relation(current, target)
    if relation == "up-to-date":
        print(json.dumps({
            "updated": False,
            "currentCommit": current,
            "targetCommit": target,
            "state": relation,
            "branch": branch,
            "message": "already up to date",
        }, ensure_ascii=False))
        return 0
    if relation == "local-ahead":
        print(json.dumps({
            "updated": False,
            "currentCommit": current,
            "targetCommit": target,
            "state": relation,
            "message": "local checkout is ahead of GitHub; nothing to download",
        }, ensure_ascii=False))
        return 0
    if relation == "diverged":
        raise RuntimeError(
            f"Local history diverged from {REMOTE_BRANCH}; push your local commits or reinstall, then retry."
        )
    write_manifest(previous_commit=current)
    git_fast_forward()
    profile = read_manifest().get("profile") or DEFAULT_PROFILE
    install(
        verify=options.verify,
        extension_profile=profile,
        clean=False,
        install_font=False,
        update_trellis=not options.no_trellis_update,
    )
    print(json.dumps({
        "updated": True,
        "previousCommit": current,
        "currentCommit": git_current_commit(),
        "profile": profile,
    }, ensure_ascii=False))
    return 0


def _update_relation(current: str, target: str) -> str:
    """Classify local HEAD relative to the fetched remote HEAD.

    Hash equality alone cannot distinguish a remote update from a local-only
    commit.  Using ancestry keeps ``update --check`` truthful and lets the
    normal update command be a no-op when the local checkout is ahead.
    """
    if not current or not target:
        return "unknown"
    if current == target:
        return "up-to-date"
    if git_is_ancestor(current, target):
        return "remote-ahead"
    if git_is_ancestor(target, current):
        return "local-ahead"
    return "diverged"


def parse_install(arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="dove-pi install")
    parser.add_argument(
        "--profile", "--extensions", dest="profile",
        choices=PROFILES,
        default=None,
        help="Extension profile (default: stored profile from .dove/manifest.json, else max)",
    )
    parser.add_argument(
        "--no-extensions",
        action="store_true",
        help="Skip third-party Pi extension installation",
    )
    parser.add_argument(
        "--no-extension-updates",
        action="store_true",
        help="Keep configured Pi extensions at their current versions",
    )
    parser.add_argument("--verify", choices=("quick", "full", "none"), default="quick", help="Verification level: quick (default), full, or none")
    parser.add_argument("--skip-checks", action="store_true", help="Compatibility alias for --verify none")
    parser.add_argument("--no-path", action="store_true")
    parser.add_argument("--clean", action="store_true", help="Reinstall locked npm dependencies from scratch")
    parser.add_argument("--no-font", action="store_true", help="Skip Nerd Font installation; use ASCII icons instead")
    return parser.parse_args(arguments)


def print_help() -> None:
    print("""Dove Pi installer and launcher

Install or update everything with one command:
  python dove_pi.py install
  python dove_pi.py update          self-update dove-pi from GitHub (tracking master)
  python dove_pi.py update --check  report available updates without changing anything

Update controls:
  --force                discard uncommitted local changes before updating
  --no-trellis-update    skip updating the global Trellis CLI

Common controls:
  --verify quick|full|none  quick (default), full tests, or no checks
  --no-font                skip Nerd Font setup and use ASCII icons
  --no-path                do not add the launcher to user PATH
  --clean                  reinstall locked npm dependencies
  --no-extension-updates   skip Pi's official extension update step

Advanced controls:
  --profile PROFILE        max, or minimal/dev/research/security (default: stored profile, else max)
  --no-extensions          skip Pi extension installation

Compatibility aliases remain available: --extensions and --skip-checks.

After installation:
  dove-pi doctor
  dove-pi update | dove-pi update --check
  dove-pi skills [query]
  dove-pi web status | dove-pi web auth <hosts...> [profile=name]
  dove-pi project doctor
  dove-pi project init
  dove-pi
  Ordinary sessions use automatic intent-based tool loading to keep prompt
  tokens low. Use /dove-tools full inside Pi, or set
  DOVE_PI_TOOL_PROFILE=full, when you need every installed extension tool.

Cache compatibility:
  Custom OpenRouter providers receive Pi session affinity automatically.
  Set DOVE_PI_DISABLE_SESSION_AFFINITY=1 only for proxies that reject it.
  Set PI_CACHE_RETENTION=long when the selected upstream supports long TTLs.
""")


def main(arguments: Sequence[str]) -> int:
    if arguments and arguments[0] in {"help", "-h", "--help"}:
        print_help()
        return 0
    if arguments and arguments[0] in {"install", "setup"}:
        options = parse_install(arguments[1:])
        install(
            verify="none" if options.skip_checks else options.verify,
            no_path=options.no_path,
            extension_profile=None if options.no_extensions else options.profile,
            clean=options.clean,
            install_font=not options.no_font,
            update_extensions=not options.no_extension_updates,
        )
        return 0
    if arguments and arguments[0] == "update":
        return run_update(arguments[1:])
    if arguments and arguments[0] == "extensions":
        return run_local_cli(arguments)
    if arguments and arguments[0] in ("doctor", "project", "skills", "web"):
        return run_local_cli(arguments)
    if arguments and arguments[0] == "icons":
        return run_icons_command(arguments[1:])
    return launch(arguments)


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"dove-pi: {error}", file=sys.stderr)
        raise SystemExit(1) from error
