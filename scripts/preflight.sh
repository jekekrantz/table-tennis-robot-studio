#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[1/8] JavaScript syntax"
node --check app.js
node --check pongbot-protocol.js
node --check pongbot-ble.js
node --check selftest.js
node --check guided-calibration.js
node --check guided-calibration-selftest.js
node --check launch-model.js
node --check launch-model-selftest.js
echo "[2/8] Protocol/BLE mock self-test"
node selftest.js
echo "[3/8] Guided calibration solver self-test"
node guided-calibration-selftest.js
echo "[4/8] Linear launch-model self-test"
node launch-model-selftest.js
echo "[5/8] Python/shell/UI syntax"
python3 -m py_compile scripts/serve.py scripts/ui_structure_selftest.py
python3 scripts/ui_structure_selftest.py
rm -rf scripts/__pycache__
bash -n scripts/serve_android_via_adb.sh
echo "[6/8] Default training-library trajectory self-test"
python3 scripts/default_library_trajectory_selftest.py
echo "[7/8] Public-tree hygiene"
if find . -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.har' \) -print -quit | grep -q .; then
  echo "Potentially sensitive local file found:" >&2
  find . -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.har' \) -print >&2
  exit 1
fi
if grep -RInE --exclude-dir=.git --exclude='preflight.sh' '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{20,})' .; then
  echo "Potential credential pattern found; inspect before publishing." >&2
  exit 1
fi
echo "[8/8] Device-specific data check"
if grep -RInE --exclude-dir=.git --exclude='preflight.sh' '\b[A-Z][0-9]{11}\b' .; then
  echo "Possible device-specific serial found; redact it before publishing." >&2
  exit 1
fi
echo "Preflight PASS"
