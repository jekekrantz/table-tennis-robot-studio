#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
app = (root / "app.js").read_text(encoding="utf-8")
css = (root / "styles.css").read_text(encoding="utf-8")
features = (root / "studio-features.js").read_text(encoding="utf-8")
core = (root / "studio-features-core.js").read_text(encoding="utf-8")
ble = (root / "pongbot-ble.js").read_text(encoding="utf-8")
ids = set(re.findall(r'\bid="([^"]+)"', html))

# Core guided calibration / navigation / debug controls.
for expected in [
    "calibrationGuidedPanel", "guidedPlacementTable", "guidedPlacementGround",
    "guidedDistanceInput", "guidedNetHeightInput", "guidedSaveNextBtn",
    "guidedComputeBtn", "guidedSpeedMinInput", "guidedSpeedMaxInput",
    "guidedFeedBtn", "guidedRepeatCountInput", "guidedNozzleXInput",
    "guidedMeasurementOffsetInput", "guidedExportMeasurementsBtn",
    "liveTuningBtn", "liveTuningDialog", "tuningPaceValue", "tuningClearanceValue",
    "tuningSpinValue", "tuningSpeedValue", "resetLiveTuningBtn",
    "saveLiveTunedDrillBtn", "saveEffectiveDrillBtn", "updateRobotPoseBtn",
    "poseCalibrationDialog", "poseCalibrationTableSvg", "poseCalibrationGuide",
    "poseCalibrationConfidence", "savePoseCalibrationBtn", "cancelPoseCalibrationBtn",
    "builtInLibraryTab", "myDrillsLibraryTab", "libraryBreadcrumb", "librarySearchInput",
    "newFolderBtn", "copyBuiltInBtn", "moveDrillBtn", "folderDialog", "moveDrillDialog",
    "libraryScreen", "runScreen", "editorScreen", "robotScreen",
    "mobileLibraryNavBtn", "mobileRunNavBtn", "mobileEditNavBtn", "mobileRobotNavBtn",
    "addNodeDialog", "drillDetailsDialog", "addNodeMenuBtn", "runEditDrillBtn",
    "editorRunBtn", "robotDiagnosticsBtn", "protocolDebugBtn", "protocolDebugDialog",
    "protocolDebugEditor", "protocolDebugRunBtn", "protocolDebugStopScriptBtn",
    "protocolDebugStopNovaBtn", "protocolDebugFileInput", "robotDialogContext",
    "robotDialogConnectBtn",
]:
    if expected not in ids:
        raise SystemExit(f"Missing required UI control: {expected}")

# Production uses one generated runtime bundle so a partial GitHub Pages upload cannot
# mix a new app shell with missing/old dependency files. Source files stay separate for
# development/tests and scripts/build_runtime_bundle.py verifies bundle freshness.
if not re.search(r'<script src="runtime\.bundle\.js\?v=[A-Za-z0-9._-]+" onerror="globalThis\.__TTRS_BUNDLE_LOAD_ERROR = true"></script>', html):
    raise SystemExit("index.html must load the versioned runtime.bundle.js")
for obsolete_script in (
    "pongbot-protocol.js", "pongbot-ble.js", "robot-geometry.js", "launch-model.js",
    "guided-calibration.js", "drill-adjustments.js", "protocol-debug.js",
    "studio-features-core.js", "debug-advisor.js", "app.js", "vendor/qrcode.min.js",
    "studio-features.js",
):
    if f'<script src="{obsolete_script}"></script>' in html:
        raise SystemExit(f"production index must not load {obsolete_script} separately")
if "deploy the complete release" not in html.lower():
    raise SystemExit("runtime bundle fallback must explain incomplete deployments")

for svg_id in ("poseSvg", "calibrationSideTrajectory", "tableDimensionSvg"):
    if not re.search(rf'<svg id="{svg_id}"[^>]*hidden', html):
        raise SystemExit(f"{svg_id} must remain hidden")

# Fixed measured geometry / base-back coordinate convention.
for token in (
    'value="base_back"',
    'id="guidedNozzleXInput" type="number" step="0.1" value="0"',
    'Base back from near edge',
    'Measurement offset',
):
    if token not in html:
        raise SystemExit(f"Missing base-back calibration convention: {token}")
for token in (
    'geometryReference: ROBOT_GEOMETRY_REFERENCE',
    'pose: { x: 0, y: 0, yawDeg: 0 }',
    'robotPose: { x: 0, y: 0, yawDeg: 0 }',
    'x: clamp(els.drillRobotXInput.value, -1.5, 4.2, 0)',
    'RobotGeometry.releasePoint',
):
    if token not in app:
        raise SystemExit(f"Missing fixed-pivot/base-back model integration: {token}")
for obsolete in (
    'const DEFAULT_NOVA_NOZZLE_HEIGHT_M = 0.225;',
    'pose: { x: 0.265, y: 0, yawDeg: 0 }',
    'robotPose: { x: 0.265, y: 0, yawDeg: 0 }',
):
    if obsolete in app:
        raise SystemExit(f"Obsolete fixed-nozzle convention remains: {obsolete}")

# One global affine raw -> launch-speed model.
for token in (
    'Global speed line:', 'slopeMpsPerRaw', 'interceptMps',
    'the same affine line is extrapolated',
    'Global linear raw wheel input → launch speed',
):
    if token not in app:
        raise SystemExit(f"Missing affine speed-model behavior: {token}")
for forbidden in ('USER_SEED_SPEED_MAP', 'LOCAL_EXIT_SPEED_MAP', 'speedFromMap(', 'result.speedMap'):
    if forbidden in app:
        raise SystemExit(f"Piecewise speed model leaked into app.js: {forbidden}")

# Calibration robustness / export.
for token in (
    "Robust fit diagnostics", "Residual by elevation", "Residual by wheel input",
    "guidedDownloadResidualsBtn", "measurementSigmaM", "MAD-rejected",
    "exportGuidedMeasurements", "measurementOffsetCm",
):
    if token not in app and token not in (root / "guided-calibration.js").read_text(encoding="utf-8"):
        raise SystemExit(f"Missing robust calibration/export behavior: {token}")

# Shot editor and semantic presentation.
for token in ('data-step-target="shotSpeedField"', 'data-step-delta="0.1"',
              'data-step-target="shotSpinField"', 'data-step-delta="1"',
              'data-step-target="shotElevationField"', 'data-step-target="shotAimField"',
              'data-step-delta="0.5"', 'data-decimals="2"', 'data-decimals="1"',
              'Predicted top view', 'topTrajectorySvg(prediction, 600, 280)',
              'class="shot-parameter-stack"', 'class="field shot-parameter-row"',
              'Shot variation', 'testShotVariationBtn', 'variationDepthField',
              'variationClearanceMinField', 'variationSpeedMinField', 'variationSpinMinField'):
    if token not in app:
        raise SystemExit(f"Missing shot-editor behavior: {token}")
if 'distanceTrajectorySvg(' in app:
    raise SystemExit("Obsolete one-dimensional landing-distance visualization remains")
if 'params: { speedMps: 5.84, spinRps: 0, elevationDeg: 10.3, aimDeg: 0 }' not in app:
    raise SystemExit("New-shot default must use the re-solved safe center no-spin ball")

# Continuous playback: one active record slot, advanced by real ball events.
for token in (
    'function compilePlaybackWindow', 'NOVA_SEQUENCE_RECORD_LIMIT = 9', 'NOVA_STREAM_COMBO_LIMIT = 255',
    'maxRecords = NOVA_SEQUENCE_RECORD_LIMIT', 'maxBatchSize: 1',
    'Protocol.buildLiveAdjustPacket(records)', 'mode: 3, value: 0',
    'value: segment.batches.length', 'robot.updateActiveSequence(',
    'robot.waitForBallEvent(', 'next streaming shot', 'nextCarryDelay',
    'flushImmediateLiveRetune', 'enqueuePlaybackUpdate',
):
    if token not in app:
        raise SystemExit(f"Missing continuous playback behavior: {token}")
if 'playbackResponsiveTuning' in app:
    raise SystemExit("Obsolete one-ball responsive tuning mode remains")
for token in ("adjustedShotForRuntime", "tunedDelaySeconds", "Live tuning is active", "source drill stays unchanged"):
    if token not in app and token not in html:
        raise SystemExit(f"Missing live tuning integration: {token}")
if 'every ball, including sub-drills' not in html:
    raise SystemExit("Live tuning dialog must explain all-ball scope")
for token in ('data-tuning-range="pacePct"', 'data-tuning-range="clearancePct"',
              'data-tuning-range="speedPct"', 'data-tuning-range="spinPct"',
              'data-tuning-delta="1"', 'type="range" min="-50" max="100" step="1"',
              'class="info-disclosure"'):
    if token not in html:
        raise SystemExit(f"Missing compact live-tuning control: {token}")
for token in ('LIVE_TUNING_STORAGE_KEY', 'saveLiveTuningPreference', 'loadLiveTuningPreference'):
    if token not in app:
        raise SystemExit(f"Live tuning must persist outside drill storage: {token}")
for token in ('function trajectoryPlanWarning', 'modeled to hit the net',
              'The nominal adjusted shot will be sent instead', 'const trajectoryWarning'):
    if token not in app:
        raise SystemExit(f"Missing non-blocking trajectory feedback: {token}")
if 'if (!adjusted.feasible) errors.push' in app or 'if (variation.error) errors.push' in app:
    raise SystemExit("Modeled trajectory feasibility must warn rather than block a representable command")

# Robot position is set directly on a table, then refined from observed first bounces.
for token in (
    'data-pose-drag="position"', 'data-pose-drag="rotation"',
    'Zoomable equal-scale landing view', 'recordPoseObservationFromMap', 'MANUAL_POSE_PRIOR',
    'PoseCalibration.estimatePoseObservation', 'pose-observation-map',
    'PoseCalibration.planCalibrationSequence', 'PoseCalibration.feedbackMeasurementNoise',
    'pose-table-markings', 'pose-net-mesh', 'pose-observation-grid',
    'pose-expected-region', 'PoseCalibration.expectedLandingCovariance',
    'beginPoseMeasurementGesture', 'All numbers are centimetres',
    'horizontalPlacement', 'verticalPlacement', 'Fire calibration shot',
):
    if token not in app:
        raise SystemExit(f"Missing interactive pose-calibration behavior: {token}")
for obsolete in (
    'poseUncertaintyXInput', 'poseLandingNoiseInput', 'poseMeasurementNoiseInput',
    'generatePoseVerificationBtn', 'markPoseVerifiedBtn', 'poseVerificationPlan',
    'data-pose-category', 'recordPoseCategory', 'pose-miss-actions',
    'data-pose-map-zoom', 'pose-map-controls', 'pose-reference-summary',
    'pose-observation-heading', 'pose-expected-point',
    'data-pose-action="retry"', 'Fire that ball again',
    'Fire when ready', 'Connect & fire when ready', 'clearOfBall',
):
    if obsolete in app or f'id="{obsolete}"' in html:
        raise SystemExit(f"Obsolete manual pose-calibration control remains: {obsolete}")

# Connection friction / lifecycle safety / copy-on-edit.
for token in (
    'function requestRobotConnection', 'browserBluetoothInstructions',
    'Connect once and the app will continue automatically', 'emergencyPageExit',
    'robot?.emergencyShutdown?.()', 'Copy this drill to edit it?',
):
    if token not in app:
        raise SystemExit(f"Missing low-friction connection/safety/edit behavior: {token}")
for token in ('emergencyShutdown()', 'best-effort STOP queued'):
    if token not in ble:
        raise SystemExit(f"Missing BLE page-exit safety behavior: {token}")

# Feature modules: sharing + AI + guided debugger.
for token in (
    'table-tennis-robot-studio/drill', 'makeShareUrl', 'parseShareHash',
    'validateDebugPack', 'compactTelemetry', 'validateAdvisorResponse',
):
    if token not in core:
        raise SystemExit(f"Missing feature-core primitive: {token}")
for token in (
    'Share drill', 'AI assist', 'Guided debug', 'Copy AI request', 'Show QR code',
    'Import test pack JSON', 'Copy ChatGPT handoff', 'SpeechRecognition',
    'promptRequestsFreshDrill', "proposalIntent==='create'", 'Create drill',
):
    if token not in features:
        raise SystemExit(f"Missing integrated feature UI: {token}")

# Library/navigation semantics.
if 'libraryView = { root: "builtin", folderId: "builtin-root", query: "" };' not in app:
    raise SystemExit("Drill browser must start at the Built-in root")
for name in (
    "Drill: Forehand / backhand alternating", "Drill: 2-2 forehand / backhand",
    "Drill: Falkenberg", "Drill: Three spots random", "Shot: No-spin center",
    "Shot: Heavy topspin center", "Shot: Backspin center", "Shot: Short underspin to forehand",
    "Shot: Long wide topspin to backhand", "Match: Short forehand underspin → wide recovery",
    "Match: Short backhand underspin → forehand recovery", "Match: Short receive → random long attack",
    "Match: Backhand exchange → switch", "Match: Weighted rally", "Match: Random pattern mix",
    "Drill: Variable topspin rally", "Drill: Variable short receive",
):
    if name not in app:
        raise SystemExit(f"Missing built-in training preset: {name}")
for removed_preset in ("Serve + third ball", "Two forehands then backhand", "Match-play mix"):
    if f'defaultDrill("{removed_preset}")' in app:
        raise SystemExit(f"Removed built-in drill was recreated: {removed_preset}")
if '>Restore defaults</button>' in html:
    raise SystemExit("Built-in drills must not rely on a destructive Restore defaults action")
for token in ("Built-in", "My drills", "Copy to My drills", "New folder"):
    if token not in html:
        raise SystemExit(f"Missing separated-library UI: {token}")
for token in ("makeBuiltInCatalog", "sanitizeLibrary", "builtIn = true", "stableIds.has(node.referencedDrillId)"):
    if token not in app:
        raise SystemExit(f"Missing separated-library model: {token}")
for token in ('const DEFAULT_LIBRARY_VERSION = 6;', 'DEFAULT_VARIATION_PROFILES',
              'variationProfile: "shortNeutral"', 'variationProfile: "short"', 'variationProfile: "rally"',
              'variationProfile: "deep"', 'variationProfile: "spin"',
              'variationProfile: "fast"', 'function variedPresetShot',
              'shot.variation = variationForPreset(DEFAULT_SHOT_PRESETS[key]);'):
    if token not in app:
        raise SystemExit(f"Built-in library variation integration missing: {token}")
if app.count('variationProfile:') != 18:
    raise SystemExit("Every built-in shot preset must select exactly one variation profile")
for token in ('labels: ["Variable topspin"], varied: true',
              'randomLabel: "Variable short underspin"',
              'const shotFactory = varied ? variedPresetShot : presetShot;'):
    if token not in app:
        raise SystemExit(f"Selective built-in variation behavior missing: {token}")

# Responsive structure.
for token in (".mobile-primary-nav", ".desktop-primary-nav", "body.details-open .editor-screen .canvas-shell",
              ".drill-library-card", ".flow-terminal", ".add-node-choice-grid", ".feature-dialog", ".debug-frame"):
    if token not in css:
        raise SystemExit(f"Missing responsive UI structure: {token}")
for token in ('navigateApp("library"', 'navigateApp("run"', 'navigateApp("editor"', 'navigateApp("robot"',
              'openAddNodeMenu', 'openAddNodeConfig', 'openDrillDetails'):
    if token not in app:
        raise SystemExit(f"Missing app navigation/create flow: {token}")
if 'navigateApp("library", { push: false })' not in app:
    raise SystemExit("App must start on the drill library")
for token in ('description: ""', 'tags: []', 'robotPose: { x: 0, y: 0, yawDeg: 0 }'):
    if token not in app:
        raise SystemExit(f"Missing drill metadata model: {token}")
if 'set the step, then add it' not in app.lower():
    raise SystemExit("Add-node flow must configure before creating")
if 'renderSyntheticEndpoints' not in app or 'START' not in app or 'END' not in app:
    raise SystemExit("Editor must always render synthetic Start and End nodes")
if 'mobileGraphLayoutEnabled' not in app or 'mobileLayoutMap' not in app:
    raise SystemExit("Mobile editor must use vertical graph layout")
for token in ('measureRenderedNodeHeights', 'nodeHeightCache', 'MOBILE_LAYOUT_CENTER_X', 'horizontalGap = 48'):
    if token not in app:
        raise SystemExit(f"Missing collision-free content-sized graph layout: {token}")
for token in ('.spin-ball-icon', '.spin-direction-symbol', '.shot-metrics { display:flex; gap:5px; flex-wrap:nowrap'):
    if token not in css:
        raise SystemExit(f"Missing compact speed/spin node presentation: {token}")
if '...builtInCatalog.drills.map(drill => drill.id)' not in app:
    raise SystemExit("Saved My drills must preserve sub-drill references to Built-in presets")

print("UI structure self-test: PASS")
