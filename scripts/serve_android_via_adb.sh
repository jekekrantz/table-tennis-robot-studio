#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-8080}"
if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not installed or not on PATH" >&2
  exit 1
fi
adb reverse "tcp:${PORT}" "tcp:${PORT}"
echo "ADB reverse active: Android http://localhost:${PORT} -> this computer"
echo "Open http://localhost:${PORT} in Chrome on the Android device."
exec python3 "$(dirname "$0")/serve.py" "$PORT"
