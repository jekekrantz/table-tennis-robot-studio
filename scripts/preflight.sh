#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/14] Generated runtime bundle"
python3 scripts/build_runtime_bundle.py --check

echo "[2/14] JavaScript syntax"
for file in \
  app.js pongbot-protocol.js pongbot-ble.js selftest.js emergency-shutdown-selftest.js \
  robot-geometry.js geometry-calibration-selftest.js guided-calibration.js guided-calibration-selftest.js \
  launch-model.js launch-model-selftest.js linear-model-selftest.js \
  drill-adjustments.js drill-adjustments-selftest.js shot-variation.js shot-variation-selftest.js protocol-debug.js protocol-debug-selftest.js \
  studio-features-core.js studio-features-selftest.js debug-advisor.js studio-features.js \
  continuous-runtime-selftest.js vendor/qrcode.min.js tools/openai-companion.mjs; do
  node --check "$file"
done

echo "[3/14] Protocol/BLE mock self-test"
node selftest.js

echo "[4/14] Page-exit emergency STOP/disconnect self-test"
node emergency-shutdown-selftest.js

echo "[5/14] Protocol debug parser self-test"
node protocol-debug-selftest.js

echo "[6/14] Fixed geometry + guided calibration solver self-tests"
node geometry-calibration-selftest.js
node guided-calibration-selftest.js

echo "[7/14] Global affine launch-speed self-tests"
node launch-model-selftest.js
node linear-model-selftest.js

echo "[8/14] Live drill-adjustment solver self-test"
node drill-adjustments-selftest.js
node shot-variation-selftest.js

echo "[9/14] Sharing / AI / debugger / continuous-runtime logic"
node studio-features-selftest.js
node continuous-runtime-selftest.js

echo "[10/14] Python/shell/UI structure"
python3 -m py_compile scripts/serve.py scripts/ui_structure_selftest.py scripts/default_library_trajectory_selftest.py scripts/build_runtime_bundle.py scripts/release_manifest.py
python3 scripts/ui_structure_selftest.py
rm -rf scripts/__pycache__
bash -n scripts/serve_android_via_adb.sh

echo "[11/14] Default training-library trajectory self-test"
python3 scripts/default_library_trajectory_selftest.py

echo "[12/14] Example data / documentation presence"
python3 - <<'PY'
import json
from pathlib import Path
for path in Path('debug-packs').glob('*.json'):
    json.loads(path.read_text())
for required in [
    'docs/guided-debugger.md','docs/drill-file-format.md','docs/ai-drill-assistant.md',
    'docs/continuous-playback.md','docs/deployment.md','docs/shot-variation.md','vendor/QRCode-LICENSE.txt'
]:
    if not Path(required).is_file(): raise SystemExit(f'Missing {required}')
print('Example/documentation check: PASS')
PY

echo "[13/14] Public-tree hygiene"
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

echo "[14/14] Release manifest"
python3 scripts/release_manifest.py

echo "Preflight PASS"
