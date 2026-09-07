#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/13] Generated runtime bundle"
python3 scripts/build_runtime_bundle.py --check

echo "[2/13] JavaScript syntax"
for file in \
  app.js pongbot-protocol.js pongbot-ble.js selftest.js emergency-shutdown-selftest.js \
  robot-geometry.js geometry-calibration-selftest.js guided-calibration.js guided-calibration-selftest.js \
  launch-model.js launch-model-selftest.js linear-model-selftest.js \
  drill-adjustments.js drill-adjustments-selftest.js pose-calibration.js pose-calibration-selftest.js shot-variation.js shot-variation-selftest.js table-bounce.js table-bounce-selftest.js adaptive-timing.js adaptive-timing-selftest.js \
  built-in-library-selftest.js \
  studio-features-core.js studio-features-selftest.js studio-features.js \
  continuous-runtime-selftest.js vendor/qrcode.min.js; do
  node --check "$file"
done

echo "[3/13] Protocol/BLE mock self-test"
node selftest.js

echo "[4/13] Page-exit emergency STOP/disconnect self-test"
node emergency-shutdown-selftest.js

echo "[5/13] Fixed geometry + guided calibration solver self-tests"
node geometry-calibration-selftest.js
node guided-calibration-selftest.js

echo "[6/13] Global affine launch-speed self-tests"
node launch-model-selftest.js
node linear-model-selftest.js

echo "[7/13] Live drill-adjustment solver self-test"
node drill-adjustments-selftest.js
node pose-calibration-selftest.js
node shot-variation-selftest.js
node table-bounce-selftest.js
node adaptive-timing-selftest.js
node built-in-library-selftest.js

echo "[8/13] Sharing / AI / continuous-runtime / UX responsiveness"
node studio-features-selftest.js
node continuous-runtime-selftest.js
node ux-responsiveness-selftest.js

echo "[9/13] Python/shell/UI structure"
python3 -m py_compile scripts/serve.py scripts/ui_structure_selftest.py scripts/default_library_trajectory_selftest.py scripts/nova_firmware_workbench_selftest.py scripts/build_runtime_bundle.py scripts/release_manifest.py tools/nova_firmware_workbench.py
python3 scripts/ui_structure_selftest.py
python3 scripts/nova_firmware_workbench_selftest.py
rm -rf scripts/__pycache__
rm -rf tools/__pycache__
bash -n scripts/serve_android_via_adb.sh

echo "[10/13] Default training-library trajectory self-test"
python3 scripts/default_library_trajectory_selftest.py

echo "[11/13] Example data / documentation presence"
python3 - <<'PY'
from pathlib import Path
for required in [
    'docs/drill-file-format.md','docs/ai-drill-assistant.md',
    'docs/continuous-playback.md','docs/custom-firmware-readiness.md','docs/deployment.md','docs/shot-variation.md','docs/robot-pose-calibration.md',
    'docs/ux-responsiveness.md','vendor/QRCode-LICENSE.txt'
]:
    if not Path(required).is_file(): raise SystemExit(f'Missing {required}')
print('Example/documentation check: PASS')
PY

echo "[12/13] Public-tree hygiene"
if find . -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.har' \) -print -quit | grep -q .; then
  echo "Potentially sensitive local file found:" >&2
  find . -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.har' \) -print >&2
  exit 1
fi
if grep -RInE --exclude-dir=.git --exclude='preflight.sh' '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{20,})' .; then
  echo "Potential credential pattern found; inspect before publishing." >&2
  exit 1
fi
if grep -RInE --exclude-dir=.git --exclude='preflight.sh' '\b[A-Z][0-9]{11}\b' .; then
  echo "Possible device-specific serial found; redact it before publishing." >&2
  exit 1
fi

echo "[13/13] Release manifest"
python3 scripts/release_manifest.py

echo "Preflight PASS"
