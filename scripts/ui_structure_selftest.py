#!/usr/bin/env python3
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
app = (root / "app.js").read_text(encoding="utf-8")
ids = set(re.findall(r'\bid="([^"]+)"', html))
for expected in ["calibrationGuidedPanel","guidedPlacementTable","guidedPlacementGround","guidedDistanceInput","guidedNetHeightInput","guidedSaveNextBtn","guidedComputeBtn","guidedSpeedMinInput","guidedSpeedMaxInput","guidedFeedBtn","guidedRepeatCountInput","guidedNozzleXInput","liveTuningBtn","liveTuningDialog","tuningPaceValue","tuningClearanceValue","tuningSpinValue","tuningSpeedValue","resetLiveTuningBtn","builtInLibraryTab","myDrillsLibraryTab","libraryBreadcrumb","librarySearchInput","newFolderBtn","copyBuiltInBtn","moveDrillBtn","folderDialog","moveDrillDialog","mobileDrillsBtn","closeMobileDrillsBtn","mobileGraphNavBtn","mobileDrillsNavBtn","mobileCalibrationNavBtn"]:
    if expected not in ids: raise SystemExit(f"Missing guided calibration control: {expected}")
for script in ("guided-calibration.js", "launch-model.js", "drill-adjustments.js", "app.js"):
    if f'<script src="{script}"></script>' not in html: raise SystemExit(f"{script} is not loaded")
if html.index("guided-calibration.js") > html.index("app.js"): raise SystemExit("guided-calibration.js must load before app.js")
if html.index("launch-model.js") > html.index("app.js"): raise SystemExit("launch-model.js must load before app.js")
if html.index("drill-adjustments.js") > html.index("app.js"): raise SystemExit("drill-adjustments.js must load before app.js")
for svg_id in ("poseSvg", "calibrationSideTrajectory", "tableDimensionSvg"):
    if not re.search(rf'<svg id="{svg_id}"[^>]*hidden', html): raise SystemExit(f"{svg_id} must remain hidden")
if 'value="base_back"' not in html: raise SystemExit("Ground calibration must expose the back-of-base distance reference")
if 'value="26.5"' not in html: raise SystemExit("Guided calibration must default to 26.5 cm nozzle offset")
if 'const DEFAULT_NOVA_NOZZLE_HEIGHT_M = 0.225;' not in app: raise SystemExit("Default nozzle height must be 22.5 cm")
if 'pose: { x: 0.265, y: 0, yawDeg: 0 }' not in app: raise SystemExit("Default launch point must be 26.5 cm")
for token in ('data-step-target="shotSpeedField"','data-step-delta="0.1"','data-step-target="shotSpinField"','data-step-delta="1"'):
    if token not in app: raise SystemExit(f"Missing shot editor stepper control: {token}")
if 'Predicted top view' not in app or 'topTrajectorySvg(prediction, 600, 280)' not in app:
    raise SystemExit("Shot inspector must use the top-view landing visualization")
if 'distanceTrajectorySvg(' in app:
    raise SystemExit("Obsolete one-dimensional landing-distance visualization remains")
for token in ('class="shot-parameter-stack"','class="field shot-parameter-row"'):
    if token not in app: raise SystemExit(f"Shot controls must be stacked into visible rows: {token}")
if 'params: { speedMps: 5.97, spinRps: 0, elevationDeg: 12.5, aimDeg: 0 }' not in app:
    raise SystemExit("New shot defaults must be a safe center no-spin ball")
if 'Linear raw wheel input → launch speed' not in app:
    raise SystemExit("Guided calibration result must expose the linear speed model")
if 'supported linear exit-speed range' not in app:
    raise SystemExit("Shot validation must use the linear exit-speed range")
if 'hybridRange' in app:
    raise SystemExit("Obsolete hybrid speed-range path remains in app.js")
for token in ("adjustedShotForLiveTuning", "tunedDelaySeconds", "Live tuning is active", "never stored inside a drill"):
    if token not in app and token not in html: raise SystemExit(f"Missing live tuning integration: {token}")
for token in ("applyTuningToShotList", "requestImmediateLiveRetune", "playbackResponsiveTuning", "maxBatchSize: playbackResponsiveTuning ? 1 : 6", "All balls · example"):
    if token not in app: raise SystemExit(f"Missing all-ball/immediate live tuning behavior: {token}")
if 'Every ball, including balls from sub-drills' not in html:
    raise SystemExit("Live tuning dialog must explain all-ball scope")
for token in ('LIVE_TUNING_STORAGE_KEY', 'saveLiveTuningPreference', 'loadLiveTuningPreference'):
    if token not in app: raise SystemExit(f"Live tuning must persist outside drill storage: {token}")
for token in ('data-tuning-key="speedPct" data-tuning-delta="-2"', 'data-tuning-key="speedPct" data-tuning-delta="2"', 'range −100% to +200%', 'range −100% to +300%'):
    if token not in html: raise SystemExit(f"Missing expanded Live tuning UI: {token}")
if 'libraryView = { root: "builtin", folderId: "builtin-root", query: "" };' not in app:
    raise SystemExit("Drill browser must start at the Built-in root")

for name in (
    "Drill: Forehand / backhand alternating",
    "Drill: 2-2 forehand / backhand",
    "Drill: Falkenberg",
    "Drill: Three spots random",
    "Shot: No-spin center",
    "Shot: Heavy topspin center",
    "Shot: Backspin center",
    "Shot: Short underspin to forehand",
    "Shot: Long wide topspin to backhand",
    "Match: Short forehand underspin → wide recovery",
    "Match: Short backhand underspin → forehand recovery",
    "Match: Short receive → random long attack",
    "Match: Backhand exchange → switch",
    "Match: Weighted rally",
    "Match: Random pattern mix",
):
    if name not in app: raise SystemExit(f"Missing built-in training preset: {name}")
for legacy in ("Serve + third ball", "Two forehands then backhand", "Match-play mix"):
    # Legacy names may appear only in the one-time migration marker, not as newly built drills.
    if f'defaultDrill("{legacy}")' in app: raise SystemExit(f"Legacy built-in drill is still created: {legacy}")
if '>Restore defaults</button>' in html: raise SystemExit("Built-in drills must not rely on a destructive Restore defaults action")
for token in ("Built-in", "My drills", "Copy to My drills", "New folder"):
    if token not in html: raise SystemExit(f"Missing separated-library UI: {token}")
for token in ("LIBRARY_STRUCTURE_VERSION = 2", "makeBuiltInCatalog", "migrateLegacyLibrary", "builtIn = true", "stableIds.has(node.referencedDrillId)"):
    if token not in app: raise SystemExit(f"Missing separated-library model: {token}")

print("UI structure self-test: PASS")

css = (root / "styles.css").read_text(encoding="utf-8")
if "mobile-drills-open .toolbox" not in css:
    raise SystemExit("Mobile Drills library must be accessible as a full-screen browser")
if ".mobile-workspace-nav" not in css or "--mobile-nav-height" not in css:
    raise SystemExit("Persistent mobile Graph / Drills / Calibrate navigation is missing")
if 'setMobileWorkspace("drills")' not in app or 'setMobileWorkspace("graph")' not in app:
    raise SystemExit("Mobile workspace navigation handlers are missing")

if "...builtInCatalog.drills.map(drill => drill.id)" not in app:
    raise SystemExit("Saved My drills must preserve sub-drill references to Built-in presets")
