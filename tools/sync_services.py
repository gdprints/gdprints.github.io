from __future__ import annotations

from pathlib import Path
import json
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "services.json"
OUTPUT = ROOT / "data" / "generated" / "services.catalog.js"
REQUIRED_LANGS = ("hy", "ru", "en")


class SyncError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise SyncError(message)


def load_and_validate() -> list[dict]:
    if not SOURCE.exists():
        fail(f"Source file not found: {SOURCE.relative_to(ROOT)}")

    try:
        payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(
            "services.json contains invalid JSON "
            f"(line {exc.lineno}, column {exc.colno}): {exc.msg}"
        )

    if not isinstance(payload, dict):
        fail("services.json root must be a JSON object.")

    services = payload.get("services")
    if not isinstance(services, list) or not services:
        fail("services.json must contain a non-empty 'services' array.")

    seen_keys: set[str] = set()
    errors: list[str] = []

    for index, service in enumerate(services, start=1):
        if not isinstance(service, dict):
            errors.append(f"#{index}: service must be an object")
            continue

        key = str(service.get("key", "")).strip()
        if not key:
            errors.append(f"#{index}: missing service key")
        elif key in seen_keys:
            errors.append(f"#{index}: duplicate key '{key}'")
        else:
            seen_keys.add(key)

        names = service.get("names")
        if not isinstance(names, dict):
            errors.append(f"{key or '#'+str(index)}: missing names object")
        else:
            for lang in REQUIRED_LANGS:
                if not str(names.get(lang, "")).strip():
                    errors.append(f"{key or '#'+str(index)}: missing names.{lang}")

        image = str(service.get("image", "")).strip()
        if not image:
            errors.append(f"{key or '#'+str(index)}: missing image path")
        else:
            image_path = ROOT / image
            if not image_path.exists():
                errors.append(f"{key or '#'+str(index)}: image not found: {image}")

    if errors:
        preview = "\n - ".join(errors[:20])
        more = "" if len(errors) <= 20 else f"\n - ... and {len(errors)-20} more issue(s)"
        fail(f"Validation failed:\n - {preview}{more}")

    return services


def render_catalog(services: list[dict]) -> str:
    serialized = json.dumps(services, ensure_ascii=False, indent=2)
    return (
        "/* AUTO-GENERATED FROM data/services.json — do not edit directly. */\n"
        f"window.GDPRINT_SERVICE_CATALOG = {serialized};\n"
        "window.GDPRINT_SERVICE_BY_KEY = Object.fromEntries("
        "window.GDPRINT_SERVICE_CATALOG.map(s => [s.key, s])"
        ");\n"
        "window.gdServiceName = function(key, locale='hy'){ "
        "const s=window.GDPRINT_SERVICE_BY_KEY[key]; "
        "return s?.names?.[locale] || s?.names?.hy || key; "
        "};\n"
    )


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="\n", delete=False, dir=path.parent, suffix=".tmp"
    ) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    temp_path.replace(path)


def main() -> int:
    try:
        services = load_and_validate()
        body = render_catalog(services)
        atomic_write(OUTPUT, body)

        active_count = sum(1 for service in services if service.get("active", True))
        print(f"OK|{len(services)}|{active_count}|{OUTPUT.relative_to(ROOT)}")
        return 0
    except SyncError as exc:
        print(f"ERROR|{exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # defensive: surface unexpected problems to the UI
        print(f"ERROR|Unexpected error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
