#!/usr/bin/env python3
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
app = (root / "app.js").read_text(encoding="utf-8")
ids = set(re.findall(r'\bid="([^"]+)"', html))
for expected in ["calibrationGuidedPanel","guidedPlacementTable","guidedPlacementGround","guidedDistanceInput","guidedNetHeightInput","guidedSaveNextBtn","guidedComputeBtn","guidedSpeedMinInput","guidedSpeedMaxInput","guidedFeedBtn","guidedRepeatCountInput","guidedNozzleXInput"]:
    if expected not in ids: raise SystemExit(f"Missing guided calibration control: {expected}")
for script in ("guided-calibration.js", "launch-model.js", "app.js"):
    if f'<script src="{script}"></script>' not in html: raise SystemExit(f"{script} is not loaded")
if html.index("guided-calibration.js") > html.index("app.js"): raise SystemExit("guided-calibration.js must load before app.js")
if html.index("launch-model.js") > html.index("app.js"): raise SystemExit("launch-model.js must load before app.js")
for svg_id in ("poseSvg", "calibrationSideTrajectory", "tableDimensionSvg"):
    if not re.search(rf'<svg id="{svg_id}"[^>]*hidden', html): raise SystemExit(f"{svg_id} must remain hidden")
if 'value="base_back"' not in html: raise SystemExit("Ground calibration must expose the back-of-base distance reference")
if 'value="26.5"' not in html: raise SystemExit("Guided calibration must default to 26.5 cm nozzle offset")
if 'const DEFAULT_NOVA_NOZZLE_HEIGHT_M = 0.225;' not in app: raise SystemExit("Default nozzle height must be 22.5 cm")
if 'pose: { x: 0.265, y: 0, yawDeg: 0 }' not in app: raise SystemExit("Default launch point must be 26.5 cm")
for token in ('data-step-target="shotSpeedField"','data-step-delta="0.1"','data-step-target="shotSpinField"','data-step-delta="1"'):
    if token not in app: raise SystemExit(f"Missing shot editor stepper control: {token}")
if 'Predicted landing distance · yaw intentionally omitted' not in app or 'distanceTrajectorySvg(prediction, 600, 150)' not in app:
    raise SystemExit("Shot inspector must use yaw-free distance line visualization")
if 'Linear raw wheel input → launch speed' not in app:
    raise SystemExit("Guided calibration result must expose the linear speed model")
if 'supported linear exit-speed range' not in app:
    raise SystemExit("Shot validation must use the linear exit-speed range")
if 'hybridRange' in app:
    raise SystemExit("Obsolete hybrid speed-range path remains in app.js")

for name in (
    "Drill: Forehand / backhand alternating",
    "Drill: 2-2 forehand / backhand",
    "Drill: Falkenberg",
    "Drill: Three spots random",
    "Shot: No-spin center",
    "Shot: Heavy topspin center",
    "Shot: Backspin center",
):
    if name not in app: raise SystemExit(f"Missing built-in training preset: {name}")
for legacy in ("Serve + third ball", "Two forehands then backhand", "Match-play mix"):
    # Legacy names may appear only in the one-time migration marker, not as newly built drills.
    if f'defaultDrill("{legacy}")' in app: raise SystemExit(f"Legacy built-in drill is still created: {legacy}")
if '>Restore defaults</button>' not in html: raise SystemExit("Default-library action should be named Restore defaults")

print("UI structure self-test: PASS")
