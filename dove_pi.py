#!/usr/bin/env python3
"""Dove Pi installer and launcher.

Usage:
    python dove_pi.py install [--profile PROFILE] [--verify quick|full|none] [--no-path] [--clean]
    python dove_pi.py setup [same options as install]
    python dove_pi.py update [--check] [--json] [--verify quick|full|none]
    python dove_pi.py icons setup|install|status
    python dove_pi.py [official Pi arguments]
"""

from __future__ import annotations

import argparse
import ctypes
import os
from pathlib import Path
import shutil
import subprocess
import sys
import json
from datetime import datetime, timezone
from typing import Sequence

from installer import InstallState, MaintenanceResult, ManagedExtensionState, ManagedInstaller, ManagedLayout, ReleaseManifest, TransactionError, load_state



PROJECT_ROOT = Path(__file__).resolve().parent
PI_ENTRY = PROJECT_ROOT / "node_modules" / "@earendil-works" / "pi-coding-agent" / "dist" / "bundle" / "cli.js"
EXTENSION = PROJECT_ROOT / ".pi" / "extensions" / "personal-agent.ts"
TSX_LOADER = PROJECT_ROOT / "node_modules" / "tsx" / "dist" / "loader.mjs"
CLI = PROJECT_ROOT / "src" / "cli.ts"
ICON_FONT_PACKAGE = "DEVCOM.JetBrainsMonoNerdFont"
MIN_NODE = (22, 19, 0)
PROFILES = ("minimal", "dev", "research", "security", "max")
DEFAULT_PROFILE = "max"


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


def validate_managed_prerequisites() -> None:
    if sys.version_info < (3, 10):
        raise RuntimeError(f"Python 3.10 or newer is required; found {sys.version.split()[0]}.")
    version = node_version()
    if version < MIN_NODE:
        raise RuntimeError(f"Node.js {format_version(MIN_NODE)} or newer is required; found {format_version(version)}.")
    executable("npm")


def install(*, skip_checks: bool = False, no_path: bool = False, extension_profile: str | None = None, install_extensions: bool = True, clean: bool = False, verify: str | None = None, install_font: bool = True, update_extensions: bool = True, update_trellis: bool = True) -> None:
    """Compatibility API that delegates to the V2 managed installer."""
    options = argparse.Namespace(
        profile=extension_profile,
        no_extensions=not install_extensions,
        no_extension_updates=not update_extensions,
        verify=verify or ("none" if skip_checks else "quick"),
        skip_checks=skip_checks,
        no_path=no_path,
        clean=clean,
        no_font=not install_font,
    )
    run_managed_install(options)


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


def run_installed_cli_json(install_root: Path, arguments: Sequence[str]) -> dict[str, object]:
    """Run Dove's TypeScript CLI from one validated managed release."""
    node = executable("node")
    loader = install_root / "node_modules" / "tsx" / "dist" / "loader.mjs"
    cli = install_root / "src" / "cli.ts"
    if not cli.is_file() or not loader.is_file():
        raise RuntimeError(f"Managed Dove Pi release is incomplete at {install_root}; run 'dove-pi repair'.")
    completed = subprocess.run(
        [node, "--import", loader.as_uri(), str(cli), *arguments],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.stderr:
        print(completed.stderr.rstrip(), file=sys.stderr)
    if completed.returncode != 0:
        raise RuntimeError(f"Managed Dove Pi command failed with exit {completed.returncode}: {completed.stdout.strip() or completed.stderr.strip()}")
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Managed Dove Pi command returned invalid JSON: {completed.stdout[-500:]}") from error
    if not isinstance(value, dict):
        raise RuntimeError("Managed Dove Pi command returned a non-object result")
    return value


def npm_spec_identity(spec: str) -> str:
    value = spec.removeprefix("npm:")
    if value.startswith("@"):
        slash = value.find("/")
        separator = value.find("@", slash) if slash >= 0 else -1
    else:
        separator = value.find("@")
    return value if separator < 0 else value[:separator]


def reconcile_managed_extensions(state: InstallState, *, update_extensions: bool = True) -> list[ManagedExtensionState]:
    if not state.current:
        raise RuntimeError("Managed install completed without a current release; run 'dove-pi repair'.")
    manifest = ReleaseManifest.read(state.current.install_path / "release.json")
    specs = manifest.profiles.get(state.profile, [])
    extension_args = ["extensions", "install", state.profile]
    if not update_extensions:
        extension_args.append("--no-update")
    try:
        result = run_installed_cli_json(state.current.install_path, extension_args)
    except RuntimeError as error:
        message = str(error)
        return [
            ManagedExtensionState(
                identity=f"npm:{npm_spec_identity(spec)}",
                spec=spec,
                status="degraded",
                error=message,
            )
            for spec in specs
        ]
    failed_values = result.get("failed")
    failed_by_spec = {
        entry.get("installSpec"): entry.get("error")
        for entry in failed_values
        if isinstance(entry, dict) and isinstance(entry.get("installSpec"), str)
    } if isinstance(failed_values, list) else {}
    return [
        ManagedExtensionState(
            identity=f"npm:{npm_spec_identity(spec)}",
            spec=spec,
            status="degraded" if spec in failed_by_spec else "healthy",
            error=str(failed_by_spec[spec]) if spec in failed_by_spec else None,
        )
        for spec in specs
    ]


def write_maintenance_log(layout: ManagedLayout, command: str, status: str, message: str) -> Path:
    layout.logs_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    path = layout.logs_dir / f"maintenance-{stamp}.log"
    path.write_text(
        json.dumps({"at": datetime.now(timezone.utc).isoformat(), "command": command, "status": status, "message": message}, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return path


def emit_maintenance_result(result: MaintenanceResult, *, json_output: bool, layout: ManagedLayout | None = None) -> None:
    payload = result.to_json()
    if layout is not None and result.command not in {"update-check", "uninstall"}:
        payload["logPath"] = str(write_maintenance_log(layout, result.command, "ready", result.message))
    if json_output:
        print(json.dumps(payload, ensure_ascii=False))
        return
    message = payload.get("message") or "Dove Pi maintenance completed."
    print(f"\n{message}")
    if payload.get("currentRelease"):
        print(f"Current release: {payload['currentRelease']}")
    if payload.get("previousRelease"):
        print(f"Previous release: {payload['previousRelease']}")
    degraded = payload.get("degradedExtensions")
    if isinstance(degraded, list) and degraded:
        print(f"Degraded extensions: {', '.join(str(value) for value in degraded)}", file=sys.stderr)


def run_managed_install(options: argparse.Namespace) -> int:
    validate_managed_prerequisites()
    layout = ManagedLayout.default()
    result = ManagedInstaller(layout).install_source(
        PROJECT_ROOT,
        profile=options.profile,
        verify="none" if options.skip_checks else options.verify,
        force_rebuild=options.clean,
        reconcile_components=(
            lambda state: reconcile_managed_extensions(state, update_extensions=not options.no_extension_updates)
        ) if not options.no_extensions else None,
        source_asset=(Path(options.source_archive), Path(options.source_checksum), options.source_tag)
        if getattr(options, "source_archive", None) and getattr(options, "source_checksum", None) and getattr(options, "source_tag", None) else None,
    )
    if not options.no_font:
        ensure_icon_font()
    if not options.no_path:
        add_user_path(layout.bin_dir)
    emit_maintenance_result(result, json_output=False, layout=layout)
    print("Next: dove-pi doctor")
    return 0


def parse_managed_update(arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="dove-pi update")
    parser.add_argument("--check", action="store_true", help="Check the latest stable GitHub release without changing local state")
    parser.add_argument("--verify", choices=("quick", "full", "none"), default="quick")
    parser.add_argument("--json", action="store_true", help="Emit one machine-readable JSON result")
    parser.add_argument("--no-extensions", action="store_true", help="Skip Dove-managed Pi extension reconciliation")
    parser.add_argument("--force", action="store_true", help=argparse.SUPPRESS)
    options = parser.parse_args(arguments)
    if options.force:
        raise RuntimeError("Managed Dove Pi releases do not use --force. Run 'dove-pi repair' if the installation is damaged.")
    return options


def run_managed_update(arguments: Sequence[str]) -> int:
    options = parse_managed_update(arguments)
    layout = ManagedLayout.default()
    if not options.check:
        validate_managed_prerequisites()
    result = ManagedInstaller(layout).update(
        check=options.check,
        verify=options.verify,
        reconcile_components=(lambda state: reconcile_managed_extensions(state))
        if not options.check and not options.no_extensions else None,
    )
    emit_maintenance_result(result, json_output=options.json, layout=layout)
    return 0


def parse_managed_maintenance(command: str, arguments: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog=f"dove-pi {command}")
    parser.add_argument("--verify", choices=("quick", "full", "none"), default="quick")
    parser.add_argument("--json", action="store_true")
    if command == "uninstall":
        parser.add_argument("--yes", action="store_true", help="Confirm removal of Dove-managed application files")
    return parser.parse_args(arguments)


def run_managed_maintenance(command: str, arguments: Sequence[str]) -> int:
    options = parse_managed_maintenance(command, arguments)
    installer = ManagedInstaller(ManagedLayout.default())
    if command == "repair":
        validate_managed_prerequisites()
        result = installer.repair(
            verify=options.verify,
            reconcile_components=lambda state: reconcile_managed_extensions(state),
        )
    elif command == "rollback":
        result = installer.rollback()
    elif command == "uninstall":
        result = installer.uninstall(confirmed=options.yes)
    else:
        raise RuntimeError(f"Unknown maintenance command: {command}")
    emit_maintenance_result(result, json_output=options.json, layout=installer.layout)
    return 0



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
    parser.add_argument("--source-archive", help=argparse.SUPPRESS)
    parser.add_argument("--source-checksum", help=argparse.SUPPRESS)
    parser.add_argument("--source-tag", help=argparse.SUPPRESS)
    options = parser.parse_args(arguments)
    source_values = (options.source_archive, options.source_checksum, options.source_tag)
    if any(source_values) and not all(source_values):
        parser.error("--source-archive, --source-checksum, and --source-tag must be supplied together")
    return options


def print_help() -> None:
    print("""Dove Pi installer and launcher

Install or maintain the managed Dove Pi application:
  python dove_pi.py install
  dove-pi update          install the latest stable GitHub release atomically
  dove-pi update --check  report available stable updates without changing anything
  dove-pi repair          repair the current managed release or recover the previous one
  dove-pi rollback        switch to the previous managed application release
  dove-pi uninstall       preserve user/project data; requires --yes

Update controls:
  --json                 emit one machine-readable maintenance result
  --no-extensions        skip Dove-managed Pi extension reconciliation

Common controls:
  --verify quick|full|none  quick (default), full tests, or no checks
  --no-font                skip Nerd Font setup and use ASCII icons
  --no-path                do not add the launcher to user PATH
  --clean                  rebuild the managed application release
  --no-extension-updates   install missing Dove extensions but keep configured versions

Advanced controls:
  --profile PROFILE        max, or minimal/dev/research/security (default: stored profile, else max)
  --no-extensions          skip Pi extension installation

Compatibility aliases remain available: --extensions and --skip-checks.

After installation:
  dove-pi doctor
  dove-pi update | dove-pi update --check
  dove-pi capability list | dove-pi capability run <name>
  dove-pi rpc | dove-pi mcp
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
        return run_managed_install(options)
    if arguments and arguments[0] == "update":
        return run_managed_update(arguments[1:])
    if arguments and arguments[0] in {"repair", "rollback", "uninstall"}:
        return run_managed_maintenance(arguments[0], arguments[1:])
    if arguments and arguments[0] == "extensions":
        return run_local_cli(arguments)
    if arguments and arguments[0] in ("doctor", "project", "skills", "web", "capability", "rpc", "mcp"):
        return run_local_cli(arguments)
    if arguments and arguments[0] == "icons":
        return run_icons_command(arguments[1:])
    return launch(arguments)


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except (RuntimeError, subprocess.CalledProcessError) as error:
        arguments = sys.argv[1:]
        command = arguments[0] if arguments else "launch"
        json_output = "--json" in arguments and command in {"update", "repair", "rollback", "uninstall"}
        print(f"dove-pi: {error}", file=sys.stderr)
        if json_output:
            layout = ManagedLayout.default()
            state = load_state(layout)
            payload: dict[str, object] = {
                "command": command,
                "status": "error",
                "code": error.__class__.__name__,
                "message": str(error),
                "currentRelease": state.current.release_id if state.current else None,
                "fallbackRunnable": bool(state.previous),
            }
            if isinstance(error, TransactionError):
                payload["failedStep"] = error.step
            if not (command == "update" and "--check" in arguments) and command != "uninstall":
                payload["logPath"] = str(write_maintenance_log(layout, command, "error", str(error)))
            print(json.dumps(payload, ensure_ascii=False))
        raise SystemExit(1) from error
