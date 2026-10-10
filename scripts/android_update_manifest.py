#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APK = ROOT / "downloads" / "table-tennis-robot-studio-android-preview.apk"
GRADLE = ROOT / "android" / "app" / "build.gradle"
OUTPUT = ROOT / "android-update.json"
APK_URL = "https://jekekrantz.github.io/table-tennis-robot-studio/downloads/table-tennis-robot-studio-android-preview.apk"


def gradle_value(pattern: str) -> str:
    match = re.search(pattern, GRADLE.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit(f"Could not read Android version from {GRADLE}")
    return match.group(1)


def expected_text() -> str:
    build_id = (ROOT / "BUILD_ID").read_text(encoding="utf-8").strip()
    version_code = int(gradle_value(r"versionCode\s+(\d+)"))
    version_name = gradle_value(r'versionName\s+"([^"]+)"')
    if version_name != build_id:
        raise SystemExit(f"Android versionName {version_name!r} must match BUILD_ID {build_id!r}")
    if not APK.is_file():
        raise SystemExit(f"Missing staged Android APK: {APK}")
    payload = {
        "schema": "table-tennis-robot-studio/android-update/v1",
        "versionCode": version_code,
        "versionName": version_name,
        "buildId": build_id,
        "apkUrl": APK_URL,
        "sha256": hashlib.sha256(APK.read_bytes()).hexdigest(),
    }
    return json.dumps(payload, indent=2) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Write or verify the website Android update descriptor")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    expected = expected_text()
    if args.write:
        OUTPUT.write_text(expected, encoding="utf-8")
        print(f"Wrote {OUTPUT.name}")
        return
    if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != expected:
        raise SystemExit(f"{OUTPUT.name} is stale; run scripts/android_update_manifest.py --write")
    print(f"Android update manifest check: PASS ({json.loads(expected)['versionName']})")


if __name__ == "__main__":
    main()
