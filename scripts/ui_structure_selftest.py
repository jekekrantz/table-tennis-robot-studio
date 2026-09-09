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

# Core guided calibration and navigation controls.
for expected in [
    "calibrationGuidedPanel", "guidedPlacementTable", "guidedPlacementGround",
    "guidedDistanceInput", "guidedNetHeightInput", "guidedSaveNextBtn",
    "guidedComputeBtn", "guidedSpeedMinInput", "guidedSpeedMaxInput",
    "guidedFeedBtn", "guidedRepeatCountInput", "guidedNozzleXInput",
    "guidedMeasurementOffsetInput", "guidedExportMeasurementsBtn",
    "resetLiveTuningBtn", "saveEffectiveDrillBtn", "updateRobotPoseBtn",
    "poseCalibrationDialog", "poseCalibrationTableSvg", "poseCalibrationGuide",
    "poseCalibrationConfidence", "savePoseCalibrationBtn", "cancelPoseCalibrationBtn",
    "builtInLibraryTab", "myDrillsLibraryTab", "libraryBreadcrumb", "librarySearchInput",
    "newFolderBtn", "copyBuiltInBtn", "moveDrillBtn", "folderDialog", "moveDrillDialog",
    "libraryScreen", "runScreen", "editorScreen", "robotScreen",
    "addNodeDialog", "drillDetailsDialog", "addNodeMenuBtn", "runEditDrillBtn",
    "addServeBtn",
    "editorRunBtn", "robotDiagnosticsBtn", "robotDialogContext",
    "robotDialogConnectBtn",
    "aiGlobalBtn", "robotIdleStopInput", "robotIdleStopStatus",
    "robotIdleDisconnectInput", "robotIdleStatus",
    "playerModelSelect", "playerTimingSpeed", "newPlayerModelBtn",
    "duplicatePlayerModelBtn", "deletePlayerModelBtn", "setTimingModeInput",
    "inspectorBackBtn", "inspectorNameField", "inspectorAiMount",
]:
    if expected not in ids:
        raise SystemExit(f"Missing required UI control: {expected}")

if 'data-player-model-field="spinChangeRecognitionSeconds"' not in html:
    raise SystemExit("Missing advanced spin-change recognition setting")

# Production uses one generated runtime bundle so a partial GitHub Pages upload cannot
# mix a new app shell with missing/old dependency files. Source files stay separate for
# development/tests and scripts/build_runtime_bundle.py verifies bundle freshness.
if not re.search(r'<script src="runtime\.bundle\.js\?v=[A-Za-z0-9._-]+" onerror="globalThis\.__TTRS_BUNDLE_LOAD_ERROR = true"></script>', html):
    raise SystemExit("index.html must load the versioned runtime.bundle.js")
for obsolete_script in (
    "pongbot-protocol.js", "pongbot-ble.js", "robot-geometry.js", "launch-model.js",
    "guided-calibration.js", "drill-adjustments.js", "table-bounce.js",
    "studio-features-core.js", "app.js", "vendor/qrcode.min.js",
    "studio-features.js",
):
    if f'<script src="{obsolete_script}"></script>' in html:
        raise SystemExit(f"production index must not load {obsolete_script} separately")
if "deploy the complete release" not in html.lower():
    raise SystemExit("runtime bundle fallback must explain incomplete deployments")

for token in ('type === "serve"', 'function makeServe', 'trajectoryOptionsForNode',
              'firstBounceValid', 'netValid', 'secondBounceValid',
              'Valid modeled serve', 'addNode(type, draft)'):
    if token not in app:
        raise SystemExit(f"Missing first-class Serve integration: {token}")
if '["shot", "serve", "random", "drill", "counter"]' not in app:
    raise SystemExit("Serve must be accepted by saved/imported drill sanitization")
if "['shot','serve','random','drill','counter']" not in core:
    raise SystemExit("Serve must be accepted by portable drill validation")
for token in ("postBouncePoints", "secondBounce", "postBounceClipped", "thirdArcPoints", "thirdBounce", "thirdArcClipped",
              'SECOND_BOUNCE_COLOR = "#ff79c6"', 'THIRD_BOUNCE_COLOR = "#ffd166"', "trajectory-bounce-legend"):
    if token not in app:
        raise SystemExit(f"Missing post-bounce trajectory integration: {token}")
for token in ('drillVisible = !calibrationOpen', 'context.localContext.push(`Browsing:', 'contextualDrill(context)', 'APP_CAPABILITIES', 'Ask about drills or the library'):
    if token not in app and token not in features and token not in core:
        raise SystemExit(f"Missing screen-aware AI context behavior: {token}")
if 'Math.abs(table.netHeight - regulationTable().netHeight) > 1e-6' not in app:
    raise SystemExit("default regulation net height label must stay hidden in trajectory views")

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
for token in ('intuitiveRangeHtml("speed", selections.speed, domains.speed, "manual")',
              'intuitiveRangeHtml("spin", selections.spin, domains.spin, "manual")',
              'intuitiveRangeHtml("elevation", selections.elevation, domains.elevation, "manual")',
              'intuitiveRangeHtml("aim", selections.aim, domains.aim, "manual")',
              'applyManualShot(node)', 'bindManualShotInspector(node)',
              'intuitiveLandingSvg(node, prediction, null, serve, variation, true)',
              'trajectoryPlanWarning(node.label, prediction)'):
    if token not in app:
        raise SystemExit(f"Missing shot-editor behavior: {token}")
for token in ('data-shot-editor-mode="intuitive"', 'data-shot-editor-mode="manual"',
              'intuitiveLandingTable',
              'maxlength="5"', 'class="dual-range"', 'applyIntuitiveShot(node)',
              'candidatePrediction?.secondBounce', 'landing-target-rectangle',
              'depth: Object.freeze({ label: "From net"', 'lateral: Object.freeze({ label: "From center"',
              'function envelopeDomains', 'defaultIntuitiveVariation(node)',
              'if (!receiverPredictionValid(node, prediction))',
              'landing-robot-strip',
              'landing-target-hatch', 'landing-table-edge', 'manual-shot-editor',
              'intervalSideTrajectorySvg(node, variation)',
              'data-interactive-landing="true"', 'bindInteractiveLandingTable(node)',
              'data-landing-drag="nw"', 'data-landing-drag="ne"',
              'data-landing-drag="sw"', 'data-landing-drag="se"',
              'Math.min(next.depth, fixedDepth)', 'Math.max(next.lateral, fixedLateral)',
              'controls = { ...(intuitivePlacementFromTable() || {}), ...controls }',
              'landing-bounce-distribution', 'interval-bounce-band ${kind} arc-${arc}',
              'surfaceY+offset', 'bounceBaseline = 21',
              'table.length + .2', 'interval-metric-summary',
              '<dt>Net clearance</dt>', '<dt>Post bounce height</dt>',
              '<dt>Second bounce</dt>',
              'node.type === "serve" ? prediction.thirdArcPoints',
              'data-camera-lock="top"', 'data-camera-lock="side"',
              'bindTrajectoryViewCameras(node)', 'pointers.size >= 2',
              'state.scale * Math.exp(-event.deltaY * .0015)',
              'prediction.thirdBounce : prediction.secondBounce',
              'interval-side-band outer',
              'novaFeasiblePrediction(params', 'novaFeasibleBounds(library.calibration)',
              'LaunchModel.maxSpinRpsAtExitSpeed'):
    if token not in app:
        raise SystemExit(f"Missing intuitive shot-editor behavior: {token}")
for obsolete in ('<strong>Feasible side view</strong>', '2nd receiver bounce:'):
    if obsolete in app:
        raise SystemExit(f"Obsolete side-view caption remains: {obsolete}")
if 'if (isBallNodeType(type)) {' not in app or 'addNode(type);' not in app:
    raise SystemExit("Adding a ball must go directly to the intuitive shot editor")
for token in ('.shot-editor-tabs', '.intuitive-landing-table', '.interval-side-figure',
              '.interval-side-representative', '.interval-side-band.outer',
              '.landing-range-handle', '.landing-bounce-distribution',
              '.interval-bounce-band.outer', '.interval-metric-summary',
              '.view-lock-button', '.camera-unlocked', '.interval-metric-summary > div',
              '.dual-range', '.interval-value'):
    if token not in css:
        raise SystemExit(f"Missing intuitive shot-editor styling: {token}")
for token in ('-webkit-appearance:none', 'grid-template-columns:52px minmax(0,1fr) 52px', 'max-width:100%'):
    if token not in css:
        raise SystemExit(f"Missing mobile dual-range containment: {token}")
if 'point[other] >= selections[other][0]' in app:
    raise SystemExit("Shot interval domains must not be conditioned on the other selected intervals")
if 'landing-trajectory-sample' in app or 'landing-trajectory-representative' in app:
    raise SystemExit("The compressed top view must not draw misleading trajectory paths")
if 'difficult to sample' in app or 'Narrow one or more intervals' in app:
    raise SystemExit("Broad allowed intervals must be internally compressed rather than rejected")
if 'id="inspectorCloseBtn"' in html or '<strong>Details</strong>' in html:
    raise SystemExit("Shot inspector must use one hierarchical back/name/AI header")
for token in ('liveTuningInlineHtml(p, node.type)', 'testShotVariationBtn', 'variationDepthField'):
    if token in app:
        raise SystemExit(f"Obsolete manual shot-editor clutter remains: {token}")
if 'distanceTrajectorySvg(' in app:
    raise SystemExit("Obsolete one-dimensional landing-distance visualization remains")
if 'params: { speedMps: 6.26, spinRps: 10, elevationDeg: 10.3, aimDeg: 0 }' not in app:
    raise SystemExit("New-shot default must use the re-solved safe light-topspin ball")
if 'params: { speedMps: 5.0, spinRps: -8, elevationDeg: -16.0, aimDeg: 0 }' not in app:
    raise SystemExit("New-serve default must model two legal table bounces with a post-bounce net crossing")

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
if 'id="liveTuningDialog"' in html or '>Details</button>' in html:
    raise SystemExit("Player tuning must not duplicate its controls in a Details dialog")
for token in ('data-tuning-range="pacePct"', 'data-tuning-range="clearancePct"',
              'data-tuning-range="speedPct"', 'data-tuning-range="spinPct"',
              'data-tuning-delta="1"', 'type="range" min="-50" max="100" step="1"',
              'class="info-disclosure"'):
    if token not in html:
        raise SystemExit(f"Missing compact live-tuning control: {token}")
for token in ('LIVE_TUNING_STORAGE_KEY', 'saveLiveTuningPreference', 'loadLiveTuningPreference'):
    if token not in app:
        raise SystemExit(f"Live tuning must persist outside drill storage: {token}")
for token in ('function trajectoryPlanWarning', 'function trajectoryLandingOutcome',
              'modeled to hit the net', 'modeled to land before crossing the net',
              'Predicted long', 'Predicted off the side',
              'The nominal adjusted shot will be sent instead', 'const trajectoryWarning',
              'trajectoryWarnings', 'Play despite trajectory warning?', 'Play anyway',
              'This is a model warning, not an invalid Nova command'):
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
    'disconnectRobotAfterIdle', 'enterRobotIdleState', 'disconnectAfterIdleMinutes',
    'stopRobotAfterShotIdle', 'stopAfterNoShotMinutes', 'robot.addEventListener("ball", noteRobotShot)',
):
    if token not in app:
        raise SystemExit(f"Missing low-friction connection/safety/edit behavior: {token}")
for token in ('emergencyShutdown()', 'best-effort STOP queued', 'stopForIdle()', 'Sending idle STOP'):
    if token not in ble:
        raise SystemExit(f"Missing BLE page-exit safety behavior: {token}")

# Feature modules: sharing + AI.
for token in (
    'table-tennis-robot-studio/drill', 'makeShareUrl', 'parseShareHash',
):
    if token not in core:
        raise SystemExit(f"Missing feature-core primitive: {token}")
for token in (
    'Share drill', 'AI assist', 'Copy AI request', 'Show QR code', 'SpeechRecognition',
    'promptRequestsFreshDrill', "proposalIntent==='create'", 'Create drill',
    'promptRequestsAppHelp', 'Context used for this request', 'aiGlobalBtn',
):
    if token not in features:
        raise SystemExit(f"Missing integrated feature UI: {token}")

# Library/navigation semantics.
if 'libraryView = { root: "builtin", folderId: "builtin-root", query: "" };' not in app:
    raise SystemExit("Drill browser must start at the Built-in root")
for token in ('className = "library-parent-item"', 'Parent folder', 'path.at(-2)'):
    if token not in app:
        raise SystemExit(f"Missing explicit parent-folder navigation: {token}")
if '.screen-back-button { min-width:48px; min-height:48px; }' not in css:
    raise SystemExit("Back controls must retain a large touch target")
for name in (
    "Drill: Forehand / backhand alternating", "Drill: 2-2 forehand / backhand",
    "Drill: Falkenberg", "Drill: Three spots random", "Shot: No-spin center",
    "Shot: Heavy topspin center", "Shot: Backspin center", "Shot: Short underspin to forehand",
    "Shot: Long wide topspin to backhand", "Match: Short forehand underspin → wide recovery",
    "Match: Short backhand underspin → forehand recovery", "Match: Short receive → random long attack",
    "Match: Backhand exchange → switch", "Match: Weighted rally", "Match: Random pattern mix",
    "Drill: Variable topspin rally", "Drill: Variable short receive",
    "Serve: Short backspin to backhand", "Serve: Short no-spin to middle",
    "Serve: Fast long topspin to backhand", "Serve receive: Short backspin → third-ball attack",
    "Serve receive: Fast long → backhand pressure", "Serve receive: Backspin / no-spin recognition",
    "Serve receive: Short or fast-long random", "Serve receive: Mixed serve + random third ball",
    "Serve receive: Combination mix",
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
if 'name: "Serve / receive"' not in app:
    raise SystemExit("Missing built-in Serve / receive folder")
for token in ("makeBuiltInCatalog", "sanitizeLibrary", "builtIn = true", "stableIds.has(node.referencedDrillId)"):
    if token not in app:
        raise SystemExit(f"Missing separated-library model: {token}")
for token in ('const DEFAULT_LIBRARY_VERSION = 8;', 'DEFAULT_VARIATION_PROFILES', 'DEFAULT_SERVE_PRESETS',
              'variationProfile: "shortNeutral"', 'variationProfile: "short"', 'variationProfile: "rally"',
              'variationProfile: "deep"', 'variationProfile: "spin"',
              'variationProfile: "fast"', 'variationProfile: "serveShort"', 'variationProfile: "serveFast"',
              'function variedPresetShot', 'function presetServe',
              'shot.variation = variationForPreset(DEFAULT_SHOT_PRESETS[key]);'):
    if token not in app:
        raise SystemExit(f"Built-in library variation integration missing: {token}")
if app.count('variationProfile:') != 23:
    raise SystemExit("Every built-in shot and serve preset must select exactly one variation profile")
for token in ('labels: ["Variable topspin"], varied: true',
              'randomLabel: "Variable short underspin"',
              'const shotFactory = varied ? variedPresetShot : presetShot;'):
    if token not in app:
        raise SystemExit(f"Selective built-in variation behavior missing: {token}")

# Responsive structure.
for token in (".desktop-primary-nav", "body.details-open .editor-screen .canvas-shell",
              ".drill-library-card", ".flow-terminal", ".add-node-choice-grid", ".feature-dialog"):
    if token not in css:
        raise SystemExit(f"Missing responsive UI structure: {token}")
if "mobile-primary-nav" in html or "mobile-primary-nav" in css:
    raise SystemExit("Obsolete persistent mobile navigation remains")
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
