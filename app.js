(() => {
  "use strict";

  globalThis.__TTRS_BOOT_OK = false;
  globalThis.__TTRS_BOOT_ERROR = null;

  const STORAGE_KEY = "table-tennis-robot-studio";
  const LIVE_TUNING_STORAGE_KEY = "table-tennis-robot-studio-live-tuning";
  const SCHEMA_VERSION = 1;
  // Trajectory launch coordinates come from the fixed measured pivot chain.
  const ROBOT_GEOMETRY_REFERENCE = "base-back-pivots-v1";
  const SURFACE_WIDTH = 2600;
  const SURFACE_HEIGHT = 1800;
  const MIN_GRAPH_ZOOM = 0.45;
  const MAX_GRAPH_ZOOM = 2.2;
  const NODE_WIDTH = 226;
  const MIN_NODE_Y = 24;
  const MAX_TRANSITIONS = 1200;
  // Community testing historically found 10+ records unreliable on some Nova firmware.
  // Normal playback therefore crosses logical set boundaries but stays at nine records
  // per START until Guided Debug confirms a larger buffer on the user's robot.
  const NOVA_SEQUENCE_RECORD_LIMIT = 9;
  const MOBILE_LAYOUT_CENTER_X = SURFACE_WIDTH / 2;
  const nodeHeightCache = new Map();

  const $ = (id) => document.getElementById(id);
  const RobotGeometry = globalThis.RobotGeometry;
  const GuidedCalibration = globalThis.GuidedCalibration;
  const LaunchModel = globalThis.NovaLaunchModel;
  const DrillAdjustments = globalThis.DrillAdjustments;
  const PoseCalibration = globalThis.PoseCalibration;
  const ShotVariation = globalThis.ShotVariation;
  const els = {
    repetitionsInput: $("repetitionsInput"),
    repetitionsDownBtn: $("repetitionsDownBtn"),
    repetitionsUpBtn: $("repetitionsUpBtn"),
    setDelayInput: $("setDelayInput"),
    playBtn: $("playBtn"),
    playIcon: $("playIcon"),
    playText: $("playText"),
    runStatus: $("runStatus"),
    runProgressBar: $("runProgressBar"),
    robotConnectBtn: $("robotConnectBtn"),
    robotStatusBtn: $("robotStatusBtn"),
    robotStatusText: $("robotStatusText"),
    calibrationBtn: $("calibrationBtn"),
    importBtn: $("importBtn"),
    exportBtn: $("exportBtn"),
    importInput: $("importInput"),
    previewBtn: $("previewBtn"),
    newDrillBtn: $("newDrillBtn"),
    duplicateDrillBtn: $("duplicateDrillBtn"),
    deleteDrillBtn: $("deleteDrillBtn"),
    libraryStatus: $("libraryStatus"),
    drillList: $("drillList"),
    builtInLibraryTab: $("builtInLibraryTab"),
    myDrillsLibraryTab: $("myDrillsLibraryTab"),
    libraryBreadcrumb: $("libraryBreadcrumb"),
    librarySearchInput: $("librarySearchInput"),
    newFolderBtn: $("newFolderBtn"),
    renameFolderBtn: $("renameFolderBtn"),
    deleteFolderBtn: $("deleteFolderBtn"),
    copyBuiltInBtn: $("copyBuiltInBtn"),
    moveDrillBtn: $("moveDrillBtn"),
    folderDialog: $("folderDialog"),
    folderDialogTitle: $("folderDialogTitle"),
    folderNameInput: $("folderNameInput"),
    folderSaveBtn: $("folderSaveBtn"),
    moveDrillDialog: $("moveDrillDialog"),
    moveDrillFolderSelect: $("moveDrillFolderSelect"),
    moveDrillSaveBtn: $("moveDrillSaveBtn"),
    drillNameInput: $("drillNameInput"),
    addShotBtn: $("addShotBtn"),
    addRandomBtn: $("addRandomBtn"),
    addDrillNodeBtn: $("addDrillNodeBtn"),
    addCounterBtn: $("addCounterBtn"),
    deleteSelectionBtn: $("deleteSelectionBtn"),
    fitBtn: $("fitBtn"),
    statusBadge: $("statusBadge"),
    validationList: $("validationList"),
    activeDrillTitle: $("activeDrillTitle"),
    modeText: $("modeText"),
    liveTuningBtn: $("liveTuningBtn"),
    liveTuningSummary: $("liveTuningSummary"),
    saveLiveTunedDrillBtn: $("saveLiveTunedDrillBtn"),
    graphViewport: $("graphViewport"),
    graphSurface: $("graphSurface"),
    graphWorld: $("graphWorld"),
    zoomIndicator: $("zoomIndicator"),
    edgeLayer: $("edgeLayer"),
    nodeLayer: $("nodeLayer"),
    emptyHint: $("emptyHint"),
    inspectorContent: $("inspectorContent"),
    calibrationDialog: $("calibrationDialog"),
    closeCalibrationBtn: $("closeCalibrationBtn"),
    calibrationPoseTab: $("calibrationPoseTab"),
    calibrationTableTab: $("calibrationTableTab"),
    calibrationPosePanel: $("calibrationPosePanel"),
    calibrationTablePanel: $("calibrationTablePanel"),
    calibrationGuidedTab: $("calibrationGuidedTab"),
    calibrationGuidedPanel: $("calibrationGuidedPanel"),
    guidedResetPlanBtn: $("guidedResetPlanBtn"),
    guidedPlacementTable: $("guidedPlacementTable"),
    guidedPlacementGround: $("guidedPlacementGround"),
    guidedPlacementHelp: $("guidedPlacementHelp"),
    guidedDistanceReference: $("guidedDistanceReference"),
    guidedReferenceHint: $("guidedReferenceHint"),
    guidedNozzleXLabel: $("guidedNozzleXLabel"),
    guidedNozzleXInput: $("guidedNozzleXInput"),
    guidedMeasurementOffsetInput: $("guidedMeasurementOffsetInput"),
    guidedNozzleXHint: $("guidedNozzleXHint"),
    guidedTableHeightField: $("guidedTableHeightField"),
    guidedTableHeightInput: $("guidedTableHeightInput"),
    guidedRepeatCountInput: $("guidedRepeatCountInput"),
    guidedElevationMinInput: $("guidedElevationMinInput"),
    guidedElevationMaxInput: $("guidedElevationMaxInput"),
    guidedElevationCountInput: $("guidedElevationCountInput"),
    guidedSpeedMinInput: $("guidedSpeedMinInput"),
    guidedSpeedMaxInput: $("guidedSpeedMaxInput"),
    guidedSpeedCountInput: $("guidedSpeedCountInput"),
    guidedSpeedMinHint: $("guidedSpeedMinHint"),
    guidedSpeedMaxHint: $("guidedSpeedMaxHint"),
    guidedShotCountBadge: $("guidedShotCountBadge"),
    guidedBuildPlanBtn: $("guidedBuildPlanBtn"),
    guidedProgressText: $("guidedProgressText"),
    guidedCurrentElevation: $("guidedCurrentElevation"),
    guidedCurrentSpeed: $("guidedCurrentSpeed"),
    guidedCurrentSpeedMps: $("guidedCurrentSpeedMps"),
    guidedFeedBtn: $("guidedFeedBtn"),
    guidedFeedStatus: $("guidedFeedStatus"),
    guidedDistanceLabel: $("guidedDistanceLabel"),
    guidedDistanceInput: $("guidedDistanceInput"),
    guidedNetHeightField: $("guidedNetHeightField"),
    guidedNetHeightInput: $("guidedNetHeightInput"),
    guidedSaveNextBtn: $("guidedSaveNextBtn"),
    guidedPreviousBtn: $("guidedPreviousBtn"),
    guidedNextBtn: $("guidedNextBtn"),
    guidedMeasurementBody: $("guidedMeasurementBody"),
    guidedMeasurementSummary: $("guidedMeasurementSummary"),
    guidedExportMeasurementsBtn: $("guidedExportMeasurementsBtn"),
    guidedComputeBtn: $("guidedComputeBtn"),
    guidedComputeHelp: $("guidedComputeHelp"),
    guidedComputeStatus: $("guidedComputeStatus"),
    guidedFitBadge: $("guidedFitBadge"),
    guidedResults: $("guidedResults"),
    poseSvg: $("poseSvg"),
    poseLandingSummary: $("poseLandingSummary"),
    poseCalibrationDialog: $("poseCalibrationDialog"),
    poseCalibrationTitle: $("poseCalibrationTitle"),
    closePoseCalibrationBtn: $("closePoseCalibrationBtn"),
    cancelPoseCalibrationBtn: $("cancelPoseCalibrationBtn"),
    savePoseCalibrationBtn: $("savePoseCalibrationBtn"),
    poseCalibrationTableSvg: $("poseCalibrationTableSvg"),
    poseCalibrationGuide: $("poseCalibrationGuide"),
    poseCalibrationConfidence: $("poseCalibrationConfidence"),
    rotationTypeInput: $("rotationTypeInput"),
    gravityInput: $("gravityInput"),
    ballMassInput: $("ballMassInput"),
    airTemperatureInput: $("airTemperatureInput"),
    airPressureInput: $("airPressureInput"),
    windXInput: $("windXInput"),
    windYInput: $("windYInput"),
    windZInput: $("windZInput"),
    dragScaleInput: $("dragScaleInput"),
    magnusScaleInput: $("magnusScaleInput"),
    airGasConstantInput: $("airGasConstantInput"),
    sutherlandMu0Input: $("sutherlandMu0Input"),
    sutherlandT0Input: $("sutherlandT0Input"),
    sutherlandSInput: $("sutherlandSInput"),
    physicsReadouts: $("physicsReadouts"),
    aeroCoefficientTables: $("aeroCoefficientTables"),
    aeroDiagnostics: $("aeroDiagnostics"),
    resetPhysicsBtn: $("resetPhysicsBtn"),
    timeStepInput: $("timeStepInput"),
    maxFlightInput: $("maxFlightInput"),
    rawAtZeroSpeedInput: $("rawAtZeroSpeedInput"),
    rawPerSpeedInput: $("rawPerSpeedInput"),
    rawDeltaPerSpinInput: $("rawDeltaPerSpinInput"),
    upDownAtZeroInput: $("upDownAtZeroInput"),
    upDownPerDegreeInput: $("upDownPerDegreeInput"),
    yawPerPlacementInput: $("yawPerPlacementInput"),
    linearSpeedModelReadout: $("linearSpeedModelReadout"),
    novaScaleTableBody: $("novaScaleTableBody"),
    resetSpinsightBtn: $("resetSpinsightBtn"),
    testSpeedInput: $("testSpeedInput"),
    testSpinInput: $("testSpinInput"),
    testElevationInput: $("testElevationInput"),
    testAimInput: $("testAimInput"),
    simulateTestShotBtn: $("simulateTestShotBtn"),
    testShotConnectionState: $("testShotConnectionState"),
    testShotWireSummary: $("testShotWireSummary"),
    calibrationSideTrajectory: $("calibrationSideTrajectory"),
    tableLengthInput: $("tableLengthInput"),
    tableWidthInput: $("tableWidthInput"),
    netHeightInput: $("netHeightInput"),
    ballDiameterInput: $("ballDiameterInput"),
    resetRegulationBtn: $("resetRegulationBtn"),
    tableDimensionSvg: $("tableDimensionSvg"),
    robotDialog: $("robotDialog"),
    closeRobotDialogBtn: $("closeRobotDialogBtn"),
    robotDialogConnection: $("robotDialogConnection"),
    robotDialogDevice: $("robotDialogDevice"),
    robotDialogSerial: $("robotDialogSerial"),
    robotDialogState: $("robotDialogState"),
    robotBrowserNotice: $("robotBrowserNotice"),
    robotDialogContext: $("robotDialogContext"),
    robotDialogConnectBtn: $("robotDialogConnectBtn"),
    robotRefreshStatusBtn: $("robotRefreshStatusBtn"),
    robotDisconnectBtn: $("robotDisconnectBtn"),
    robotCopyLogBtn: $("robotCopyLogBtn"),
    robotLog: $("robotLog"),
    liveTuningDialog: $("liveTuningDialog"),
    closeLiveTuningBtn: $("closeLiveTuningBtn"),
    doneLiveTuningBtn: $("doneLiveTuningBtn"),
    resetLiveTuningBtn: $("resetLiveTuningBtn"),
    tuningPaceValue: $("tuningPaceValue"),
    tuningClearanceValue: $("tuningClearanceValue"),
    tuningSpinValue: $("tuningSpinValue"),
    tuningSpeedValue: $("tuningSpeedValue"),
    liveTuningImpactLabel: $("liveTuningImpactLabel"),
    liveTuningImpact: $("liveTuningImpact"),
    previewDialog: $("previewDialog"),
    closePreviewBtn: $("closePreviewBtn"),
    previewLimitInput: $("previewLimitInput"),
    rerunPreviewBtn: $("rerunPreviewBtn"),
    previewStats: $("previewStats"),
    previewList: $("previewList"),
    previewStopReason: $("previewStopReason"),
    confirmDialog: $("confirmDialog"),
    confirmTitle: $("confirmTitle"),
    confirmText: $("confirmText"),
    confirmActionBtn: $("confirmActionBtn"),
    toast: $("toast"),
    topBackBtn: $("topBackBtn"),
    topbarContext: $("topbarContext"),
    libraryScreen: $("libraryScreen"),
    runScreen: $("runScreen"),
    editorScreen: $("editorScreen"),
    robotScreen: $("robotScreen"),
    desktopLibraryNavBtn: $("desktopLibraryNavBtn"),
    desktopRunNavBtn: $("desktopRunNavBtn"),
    desktopEditNavBtn: $("desktopEditNavBtn"),
    desktopRobotNavBtn: $("desktopRobotNavBtn"),
    mobileLibraryNavBtn: $("mobileLibraryNavBtn"),
    mobileRunNavBtn: $("mobileRunNavBtn"),
    mobileEditNavBtn: $("mobileEditNavBtn"),
    mobileRobotNavBtn: $("mobileRobotNavBtn"),
    runBackBtn: $("runBackBtn"),
    editorBackBtn: $("editorBackBtn"),
    robotBackBtn: $("robotBackBtn"),
    runDrillTitle: $("runDrillTitle"),
    runDrillDescription: $("runDrillDescription"),
    runDrillMenuBtn: $("runDrillMenuBtn"),
    runEditDrillBtn: $("runEditDrillBtn"),
    runRobotBtn: $("runRobotBtn"),
    runConnectionDot: $("runConnectionDot"),
    runConnectionText: $("runConnectionText"),
    runRobotSetup: $("runRobotSetup"),
    runPoseStatus: $("runPoseStatus"),
    updateRobotPoseBtn: $("updateRobotPoseBtn"),
    saveEffectiveDrillBtn: $("saveEffectiveDrillBtn"),
    editorRunBtn: $("editorRunBtn"),
    drillDetailsBtn: $("drillDetailsBtn"),
    editorAutosaveText: $("editorAutosaveText"),
    inspectorBackBtn: $("inspectorBackBtn"),
    inspectorCloseBtn: $("inspectorCloseBtn"),
    addNodeMenuBtn: $("addNodeMenuBtn"),
    addNodeDialog: $("addNodeDialog"),
    closeAddNodeDialogBtn: $("closeAddNodeDialogBtn"),
    addNodeChoicePanel: $("addNodeChoicePanel"),
    addNodeConfigPanel: $("addNodeConfigPanel"),
    addNodeDialogTitle: $("addNodeDialogTitle"),
    addNodeDialogSubtitle: $("addNodeDialogSubtitle"),
    drillDetailsDialog: $("drillDetailsDialog"),
    closeDrillDetailsBtn: $("closeDrillDetailsBtn"),
    drillDescriptionInput: $("drillDescriptionInput"),
    drillTagsInput: $("drillTagsInput"),
    drillRobotXInput: $("drillRobotXInput"),
    drillRobotYInput: $("drillRobotYInput"),
    drillRobotYawInput: $("drillRobotYawInput"),
    drillDetailsReadonlyNote: $("drillDetailsReadonlyNote"),
    libraryMoreBtn: $("libraryMoreBtn"),
    libraryAdvancedActions: $("libraryAdvancedActions"),
    robotPageDot: $("robotPageDot"),
    robotPageConnection: $("robotPageConnection"),
    robotPageDevice: $("robotPageDevice"),
    robotDiagnosticsBtn: $("robotDiagnosticsBtn"),
    robotSettingsShortcutBtn: $("robotSettingsShortcutBtn"),
    protocolDebugBtn: $("protocolDebugBtn"),
    protocolDebugDialog: $("protocolDebugDialog"),
    closeProtocolDebugBtn: $("closeProtocolDebugBtn"),
    protocolDebugFileInput: $("protocolDebugFileInput"),
    protocolDebugExampleBtn: $("protocolDebugExampleBtn"),
    protocolDebugDownloadBtn: $("protocolDebugDownloadBtn"),
    protocolDebugClearBtn: $("protocolDebugClearBtn"),
    protocolDebugEditor: $("protocolDebugEditor"),
    protocolDebugPauseHeartbeat: $("protocolDebugPauseHeartbeat"),
    protocolDebugValidateBtn: $("protocolDebugValidateBtn"),
    protocolDebugRunSelectionBtn: $("protocolDebugRunSelectionBtn"),
    protocolDebugParseStatus: $("protocolDebugParseStatus"),
    protocolDebugConnectionBadge: $("protocolDebugConnectionBadge"),
    protocolDebugRunState: $("protocolDebugRunState"),
    protocolDebugTimeline: $("protocolDebugTimeline"),
    protocolDebugStopScriptBtn: $("protocolDebugStopScriptBtn"),
    protocolDebugStopNovaBtn: $("protocolDebugStopNovaBtn"),
    protocolDebugRunBtn: $("protocolDebugRunBtn"),
    protocolDebugExecutionLog: $("protocolDebugExecutionLog"),
    protocolDebugDownloadLogBtn: $("protocolDebugDownloadLogBtn"),
  };

  let startupNotice = "";
  let builtInCatalog = null;
  let library = null;
  let libraryView = { root: "builtin", folderId: "builtin-root", query: "" };
  let folderDialogMode = null;
  let selection = null;
  let nodeDrag = null;
  let connectionDrag = null;
  let canvasPan = null;
  let graphZoom = 1;
  let poseDrag = null;
  let suppressClickUntil = 0;
  let toastTimer = null;
  let confirmCallback = null;
  let appView = "library";
  let appHistory = [];
  let inspectorOpen = false;
  let addNodeDraftType = null;
  let playbackToken = 0;
  let playbackRunning = false;
  let calibrationTestRunning = false;
  let calibrationTestMessage = "";
  let calibrationFeedRunning = false;
  let calibrationFeedToken = 0;
  let activeNodeRef = null;
  let activeEdgeRef = null;
  let runtimeCounterDisplay = new Map();
  let calibrationViewTransform = null;
  let robotLogLines = [];
  let protocolDebugLogLines = [];
  let protocolDebugRunToken = 0;
  let protocolDebugRunning = false;
  let stopPromise = null;
  let liveTuning = null;
  const liveTuningCache = new Map();
  let liveTuningRevision = 0;
  let playbackLiveContext = null;
  let playbackUpdateLock = Promise.resolve();
  let liveRetuneTimer = null;
  let liveRetunePending = false;
  let liveRetuneInFlight = false;
  let pendingRobotAction = null;
  let pendingRobotReason = "";
  let poseCalibrationState = null;
  let poseCalibrationDrag = null;
  let poseMeasurementGesture = null;
  let poseStaleAcknowledged = false;
  const shotVariationCache = new Map();
  let shotVariationRng = ShotVariation?.createRng(Date.now());

  const Protocol = globalThis.PongbotProtocol;
  const ProtocolDebug = globalThis.NovaProtocolDebug;
  const RobotController = globalThis.NovaBleController;
  const robot = Protocol && RobotController ? new RobotController() : null;

  function assertRequiredElements() {
    const missing = Object.entries(els)
      .filter(([, element]) => element == null)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(`Missing required page element(s): ${missing.join(", ")}`);
    }
  }

  function initializeLibrary() {
    const loaded = loadLibrary();
    if (loaded) return loaded;
    startupNotice = "Built-in training drills are ready. Your own drills are stored separately under My drills.";
    return makeUserLibrary();
  }

  function makeUserLibrary(calibration = defaultCalibration()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeDrillSource: "builtin",
      activeDrillId: builtInCatalog?.defaultDrillId ?? null,
      calibration: sanitizeCalibration(calibration),
      folders: [],
      drills: [],
    };
  }

  function repairLibraryIfNeeded() {
    if (!library || typeof library !== "object") library = makeUserLibrary();
    if (!Array.isArray(library.drills)) library.drills = [];
    if (!Array.isArray(library.folders)) library.folders = [];
    library.schemaVersion = SCHEMA_VERSION;
    if (!library.calibration) library.calibration = defaultCalibration();

    const folderIds = new Set(library.folders.map(folder => folder.id));
    library.folders = library.folders
      .filter(folder => folder && typeof folder.id === "string" && typeof folder.name === "string")
      .map(folder => ({
        id: folder.id,
        name: String(folder.name || "Folder").trim() || "Folder",
        parentId: folderIds.has(folder.parentId) && folder.parentId !== folder.id ? folder.parentId : null,
      }));
    const validFolderIds = new Set(library.folders.map(folder => folder.id));
    library.drills.forEach(drill => {
      if (!validFolderIds.has(drill.folderId)) drill.folderId = null;
    });

    const source = library.activeDrillSource === "user" ? "user" : "builtin";
    const activeExists = source === "user"
      ? library.drills.some(drill => drill.id === library.activeDrillId)
      : builtInCatalog?.drills.some(drill => drill.id === library.activeDrillId);
    if (!activeExists) {
      const firstUser = library.drills[0];
      if (builtInCatalog?.defaultDrillId) {
        library.activeDrillSource = "builtin";
        library.activeDrillId = builtInCatalog.defaultDrillId;
      } else if (firstUser) {
        library.activeDrillSource = "user";
        library.activeDrillId = firstUser.id;
      } else {
        library.activeDrillSource = "user";
        library.activeDrillId = null;
      }
    }
    return library;
  }

  function makeId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function regulationTable() {
    return { length: 2.74, width: 1.525, netHeight: 0.1525 };
  }

  function spinsightReferenceCurve() {
    return [
      { level: 0.0, maxSpinSetting: 2, maxSpinRps: 13.2, estimated: true },
      { level: 0.5, maxSpinSetting: 3, maxSpinRps: 19.8, estimated: true },
      { level: 1.0, maxSpinSetting: 4, maxSpinRps: 26.4, estimated: true },
      { level: 1.5, maxSpinSetting: 5, maxSpinRps: 28 },
      { level: 2.0, maxSpinSetting: 6, maxSpinRps: 36 },
      { level: 2.5, maxSpinSetting: 7, maxSpinRps: 43 },
      { level: 3.0, maxSpinSetting: 8, maxSpinRps: 52 },
      { level: 3.5, maxSpinSetting: 9, maxSpinRps: 56 },
      { level: 4.0, maxSpinSetting: 10, maxSpinRps: 61 },
      { level: 4.5, maxSpinSetting: 10, maxSpinRps: 66 },
      { level: 5.0, maxSpinSetting: 9, maxSpinRps: 59 },
      { level: 5.5, maxSpinSetting: 8, maxSpinRps: 53 },
      { level: 6.0, maxSpinSetting: 8, maxSpinRps: 53 },
      { level: 6.5, maxSpinSetting: 7, maxSpinRps: 46 },
      { level: 7.0, maxSpinSetting: 6, maxSpinRps: 42 },
      { level: 7.5, maxSpinSetting: 5, maxSpinRps: 33 },
      { level: 8.0, maxSpinSetting: 4, maxSpinRps: 28 },
      { level: 8.5, maxSpinSetting: 3, maxSpinRps: 21 },
      { level: 9.0, maxSpinSetting: 2, maxSpinRps: 16 },
      { level: 9.5, maxSpinSetting: 1, maxSpinRps: 13 },
      { level: 10.0, maxSpinSetting: 0, maxSpinRps: 0 },
    ];
  }
  function dragCoefficientModel() {
    return [
      { speed: 2.5, spinRatio: [0, .3, .7, .95, 1.5, 2.0], cd: [.55, .55, .55, .55, .55, .55] },
      { speed: 7.5, spinRatio: [0, .4, .75, 1.1, 1.3, 2.0], cd: [.49, .49, .55, .48, .53, .53] },
      { speed: 12.5, spinRatio: [0, .4, .62, .95, 1.3, 2.0], cd: [.47, .47, .53, .41, .48, .48] },
      { speed: 17.5, spinRatio: [0, .4, .5, .84, 1.2, 2.0], cd: [.47, .47, .51, .37, .45, .45] },
    ];
  }

  function magnusCoefficientModel() {
    return [
      { speed: 2.0, m: 0, s: .08, omegaBreak: 150, a: -1.852e-7, b: -1.296e-4, c: .0983 },
      { speed: 3.5, m: -1.1e-3, s: .31, omegaBreak: 200, a: -1.667e-7, b: -3.333e-5, c: .1 },
      { speed: 7.5, m: -8.0e-4, s: .37, omegaBreak: 350, a: -2.0e-7, b: 1.7e-4, c: .0587 },
      { speed: 10.5, m: -6.58e-4, s: .375, omegaBreak: 440, a: -2.604e-7, b: 3.646e-4, c: -.0225 },
      { speed: 13.5, m: -5.6e-4, s: .383, omegaBreak: 550, a: -3.571e-7, b: 5.357e-4, c: -.0893 },
      { speed: 17.0, m: -4.48e-4, s: .371, omegaBreak: 650, a: -1.0e-7, b: 2.3e-4, c: -.0375 },
    ];
  }

  function defaultPhysicsCalibration() {
    return {
      ballDiameterM: .04,
      ballMassKg: .0027,
      airTemperatureC: 20,
      airPressureKpa: 101.325,
      dryAirGasConstant: 287.05,
      sutherlandMu0: 1.716e-5,
      sutherlandT0: 273.15,
      sutherlandS: 110.4,
      dragScale: 1,
      magnusScale: 1,
      wind: { x: 0, y: 0, z: 0 },
    };
  }

  function defaultNovaCalibration() {
    const speedModel = LaunchModel.sanitizeLinearModel(LaunchModel.constants.DEFAULT_LINEAR_EXIT_MODEL);
    return {
      rawAtZeroSpeedLevel: 969.9321047526674,
      rawPerSpeedLevel: 630.455868089234,
      rawDeltaPerSpinLevel: 342.036255843120,
      upDownAtZeroDeg: 10,
      upDownPerDegree: 3,
      yawDegreesPerPlacement: 2.2,
      spinsightCurve: spinsightReferenceCurve(),
      speedModel,
    };
  }
  function defaultGuidedCalibration() {
    const plan = GuidedCalibration.buildPlan({
      placement: "ground",
      baseBackXFromNearEdgeM: 0,
      speedModel: defaultNovaCalibration().speedModel,
      elevationMinDeg: 5,
      elevationMaxDeg: 45,
      elevationCount: 5,
      speedMinRaw: 2000,
      speedMaxRaw: 3000,
      speedCount: 6,
    });
    return {
      placement: "ground",
      distanceReference: "base_back",
      baseBackXcm: 0,
      measurementOffsetCm: 0,
      tableHeightCm: 76,
      repeatCount: 3,
      elevationMinDeg: 5,
      elevationMaxDeg: 45,
      elevationCount: 5,
      speedMinRaw: 2000,
      speedMaxRaw: 3000,
      speedCount: 6,
      currentIndex: 0,
      shots: plan.shots || [],
      planSignature: "",
      lastResult: null,
    };
  }
  function defaultCalibration() {
    return {
      geometryReference: ROBOT_GEOMETRY_REFERENCE,
      pose: { x: 0, y: 0, yawDeg: 0 },
      poseSession: PoseCalibration?.sanitizeSession({}, { x: 0, y: 0, yawDeg: 0 }) || null,
      placementMode: "table",
      tableHeight: 0.76,
      table: regulationTable(),
      rotationType: 0,
      gravity: 9.80665,
      timeStep: 0.004,
      maxFlightTime: 4.0,
      physics: defaultPhysicsCalibration(),
      nova: defaultNovaCalibration(),
      testShot: { speedMps: 8.0, spinRps: 22, elevationDeg: 4, aimDeg: 0 },
      guided: defaultGuidedCalibration(),
    };
  }

  function defaultDrill(name = "Custom drill") {
    return {
      id: makeId("drill"),
      name,
      description: "",
      tags: [],
      // Expected physical placement for this drill. x/y refer to the back of the base.
      robotPoseReference: "base_back",
      robotPose: { x: 0, y: 0, yawDeg: 0 },
      startNodeId: null,
      settings: { repetitions: 3, delayBetweenSets: 1.0 },
      nodes: [],
      edges: [],
    };
  }

  function uniqueDrillName(base, excludeId = null) {
    const clean = String(base || "Custom drill").trim() || "Custom drill";
    const used = new Set(library.drills.filter(d => d.id !== excludeId).map(d => d.name.toLowerCase()));
    if (!used.has(clean.toLowerCase())) return clean;
    let i = 2;
    while (used.has(`${clean} ${i}`.toLowerCase())) i += 1;
    return `${clean} ${i}`;
  }

  function uniqueShotName(drill, base = "Shot", excludeId = null) {
    const clean = String(base || "Shot").trim() || "Shot";
    const used = new Set(
      drill.nodes
        .filter(node => node.type === "shot" && node.id !== excludeId)
        .map(node => node.label.toLowerCase())
    );
    if (!used.has(clean.toLowerCase())) return clean;
    const stem = clean.replace(/\s+\d+$/, "");
    let i = 2;
    while (used.has(`${stem} ${i}`.toLowerCase())) i += 1;
    return `${stem} ${i}`;
  }

  function makeShot(drill, label = "Shot") {
    return {
      id: makeId("shot"),
      type: "shot",
      label: uniqueShotName(drill, label),
      x: 300,
      y: 260,
      params: { speedMps: 5.84, spinRps: 0, elevationDeg: 10.3, aimDeg: 0 },
    };
  }

  function makeRandom(label = "Weighted random") {
    return { id: makeId("random"), type: "random", label, x: 300, y: 260 };
  }

  function makeDrillNode(label = "Sub-drill", referencedDrillId = null) {
    return { id: makeId("subdrill"), type: "drill", label, x: 300, y: 260, referencedDrillId };
  }

  function makeCounter(label = "Repeater") {
    return { id: makeId("counter"), type: "counter", label, x: 300, y: 260, startCount: 2, clearOnNodeIds: [] };
  }

  const DEFAULT_LIBRARY_VERSION = 6;

  const DEFAULT_VARIATION_PROFILES = Object.freeze({
    neutral: Object.freeze({ depthCm: 10, lateralCm: 12, clearanceDeltaCm: 2, speedDeltaMps: .5, spinDeltaRps: 2 }),
    shortNeutral: Object.freeze({ depthCm: 8, lateralCm: 8, clearanceDeltaCm: 1.5, speedDeltaMps: .4, spinDeltaRps: 2 }),
    short: Object.freeze({ depthCm: 8, lateralCm: 8, clearanceDeltaCm: 1.5, speedDeltaMps: .4, spinDeltaRps: 4 }),
    rally: Object.freeze({ depthCm: 12, lateralCm: 10, clearanceDeltaCm: 2, speedDeltaMps: .65, spinDeltaRps: 6 }),
    deep: Object.freeze({ depthCm: 7, lateralCm: 7, clearanceDeltaCm: 1.5, speedDeltaMps: .5, spinDeltaRps: 5 }),
    spin: Object.freeze({ depthCm: 10, lateralCm: 10, clearanceDeltaCm: 2, speedDeltaMps: .55, spinDeltaRps: 8 }),
    fast: Object.freeze({ depthCm: 6, lateralCm: 7, clearanceDeltaCm: 1.5, speedDeltaMps: .45, spinDeltaRps: 4 }),
  });

  // Re-solved for the fixed pivot-chain release geometry with the back of the base
  // centered on the near edge. Targets preserve the previous modeled placements.
  const DEFAULT_SHOT_PRESETS = Object.freeze({
    noSpinCenter: {
      label: "No-spin center",
      variationProfile: "neutral",
      params: { speedMps: 5.84, spinRps: 0, elevationDeg: 10.3, aimDeg: 0 },
      target: { xM: 2.154, yM: 0, netClearanceCm: 10.1 },
    },
    shortNoSpin: {
      label: "Short no-spin",
      variationProfile: "shortNeutral",
      params: { speedMps: 4.84, spinRps: 0, elevationDeg: 14.3, aimDeg: 0 },
      target: { xM: 1.950, yM: 0, netClearanceCm: 10.0 },
    },
    shortBackspinForehand: {
      label: "Short underspin to forehand",
      variationProfile: "short",
      params: { speedMps: 4.85, spinRps: -18, elevationDeg: 11.4, aimDeg: 13.8 },
      target: { xM: 1.951, yM: 0.420, netClearanceCm: 8.0 },
    },
    shortBackspinBackhand: {
      label: "Short underspin to backhand",
      variationProfile: "short",
      params: { speedMps: 4.85, spinRps: -18, elevationDeg: 11.4, aimDeg: -13.8 },
      target: { xM: 1.951, yM: -0.420, netClearanceCm: 8.0 },
    },
    topspinForehand: {
      label: "Topspin to forehand",
      variationProfile: "rally",
      params: { speedMps: 7.51, spinRps: 22, elevationDeg: 8.9, aimDeg: 13.5 },
      target: { xM: 2.253, yM: 0.481, netClearanceCm: 10.1 },
    },
    topspinBackhand: {
      label: "Topspin to backhand",
      variationProfile: "rally",
      params: { speedMps: 7.51, spinRps: 22, elevationDeg: 8.9, aimDeg: -13.5 },
      target: { xM: 2.253, yM: -0.481, netClearanceCm: 10.1 },
    },
    deepTopspinForehand: {
      label: "Long wide topspin to forehand",
      variationProfile: "deep",
      params: { speedMps: 8.96, spinRps: 22, elevationDeg: 7.1, aimDeg: 12.8 },
      target: { xM: 2.449, yM: 0.500, netClearanceCm: 10.0 },
    },
    deepTopspinBackhand: {
      label: "Long wide topspin to backhand",
      variationProfile: "deep",
      params: { speedMps: 8.96, spinRps: 22, elevationDeg: 7.1, aimDeg: -12.8 },
      target: { xM: 2.449, yM: -0.500, netClearanceCm: 10.0 },
    },
    topspinElbow: {
      label: "Topspin to elbow",
      variationProfile: "rally",
      params: { speedMps: 7.25, spinRps: 22, elevationDeg: 9.1, aimDeg: 0 },
      target: { xM: 2.252, yM: 0, netClearanceCm: 10.0 },
    },
    heavyTopspin: {
      label: "Heavy topspin center",
      variationProfile: "spin",
      params: { speedMps: 6.90, spinRps: 35, elevationDeg: 11.1, aimDeg: 0 },
      target: { xM: 2.249, yM: 0, netClearanceCm: 12.0 },
    },
    backspinForehand: {
      label: "Backspin to forehand",
      variationProfile: "spin",
      params: { speedMps: 4.96, spinRps: -18, elevationDeg: 13.1, aimDeg: 12.8 },
      target: { xM: 2.082, yM: 0.419, netClearanceCm: 12.1 },
    },
    backspinBackhand: {
      label: "Backspin to backhand",
      variationProfile: "spin",
      params: { speedMps: 4.96, spinRps: -18, elevationDeg: 13.1, aimDeg: -12.8 },
      target: { xM: 2.082, yM: -0.419, netClearanceCm: 12.1 },
    },
    backspinCenter: {
      label: "Backspin center",
      variationProfile: "spin",
      params: { speedMps: 4.84, spinRps: -18, elevationDeg: 13.4, aimDeg: 0 },
      target: { xM: 2.081, yM: 0, netClearanceCm: 12.0 },
    },
    fastDeepForehand: {
      label: "Fast deep to forehand",
      variationProfile: "fast",
      params: { speedMps: 8.58, spinRps: 15, elevationDeg: 7.1, aimDeg: 12.3 },
      target: { xM: 2.450, yM: 0.480, netClearanceCm: 10.0 },
    },
    fastDeepBackhand: {
      label: "Fast deep to backhand",
      variationProfile: "fast",
      params: { speedMps: 8.58, spinRps: 15, elevationDeg: 7.1, aimDeg: -12.3 },
      target: { xM: 2.450, yM: -0.480, netClearanceCm: 10.0 },
    },
    fastDeepCenter: {
      label: "Fast deep center",
      variationProfile: "fast",
      params: { speedMps: 8.31, spinRps: 15, elevationDeg: 7.2, aimDeg: 0 },
      target: { xM: 2.450, yM: 0, netClearanceCm: 10.0 },
    },
    middleForehandTopspin: {
      label: "Topspin to forehand-middle",
      variationProfile: "rally",
      params: { speedMps: 7.28, spinRps: 22, elevationDeg: 9.1, aimDeg: 5.7 },
      target: { xM: 2.249, yM: 0.200, netClearanceCm: 10.0 },
    },
    middleBackhandTopspin: {
      label: "Topspin to backhand-middle",
      variationProfile: "rally",
      params: { speedMps: 7.28, spinRps: 22, elevationDeg: 9.1, aimDeg: -5.7 },
      target: { xM: 2.249, yM: -0.200, netClearanceCm: 10.0 },
    },
  });

  function variationForPreset(preset) {
    const profile = DEFAULT_VARIATION_PROFILES[preset.variationProfile];
    if (!profile) return null;
    const rounded = value => Number(value.toFixed(2));
    return {
      enabled: true,
      placement: { depthCm: profile.depthCm, lateralCm: profile.lateralCm },
      clearance: {
        minCm: rounded(Math.max(.2, preset.target.netClearanceCm - profile.clearanceDeltaCm)),
        maxCm: rounded(preset.target.netClearanceCm + profile.clearanceDeltaCm),
      },
      speed: {
        minMps: rounded(preset.params.speedMps - profile.speedDeltaMps),
        maxMps: rounded(preset.params.speedMps + profile.speedDeltaMps),
      },
      spin: {
        minRps: rounded(preset.params.spinRps - profile.spinDeltaRps),
        maxRps: rounded(preset.params.spinRps + profile.spinDeltaRps),
      },
    };
  }

  function presetShot(drill, key, label = null) {
    const preset = DEFAULT_SHOT_PRESETS[key];
    if (!preset) throw new Error(`Unknown built-in shot preset ${key}`);
    const shot = makeShot(drill, label || preset.label);
    shot.params = { ...preset.params };
    return shot;
  }

  function variedPresetShot(drill, key, label = null) {
    const shot = presetShot(drill, key, label);
    shot.variation = variationForPreset(DEFAULT_SHOT_PRESETS[key]);
    return shot;
  }

  function layoutSequence(nodes) {
    nodes.forEach((node, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      node.x = 150 + column * 320;
      node.y = 220 + row * 230;
    });
  }

  function sequenceDrill(name, steps, {
    repetitions = 12,
    intervalSeconds = .78,
    labels = [],
    varied = false,
  } = {}) {
    const drill = defaultDrill(name);
    drill.settings = { repetitions, delayBetweenSets: intervalSeconds };
    const shotFactory = varied ? variedPresetShot : presetShot;
    const nodes = steps.map((key, index) => shotFactory(drill, key, labels[index] || null));
    layoutSequence(nodes);
    drill.nodes.push(...nodes);
    drill.startNodeId = nodes[0]?.id ?? null;
    nodes.slice(0, -1).forEach((node, index) => {
      drill.edges.push({
        id: makeId("edge"), source: node.id, sourceSlot: "next", target: nodes[index + 1].id,
        weight: 1, delaySeconds: intervalSeconds,
      });
    });
    return drill;
  }

  function singleShotDrill(name, presetKey, { repetitions = 30, intervalSeconds = .8 } = {}) {
    return sequenceDrill(name, [presetKey], { repetitions, intervalSeconds });
  }

  function randomDrill(name, choices, {
    repetitions = 30,
    intervalSeconds = .8,
    randomLabel = "Random placement",
  } = {}) {
    const drill = defaultDrill(name);
    drill.settings = { repetitions, delayBetweenSets: intervalSeconds };
    const random = makeRandom(randomLabel);
    random.x = 170; random.y = 330;
    drill.nodes.push(random);
    drill.startNodeId = random.id;
    choices.forEach((choice, index) => {
      const shot = variedPresetShot(drill, choice.key, choice.label || null);
      shot.x = 560;
      shot.y = 130 + index * 210;
      drill.nodes.push(shot);
      drill.edges.push({
        id: makeId("edge"), source: random.id, sourceSlot: "branch", target: shot.id,
        weight: choice.weight ?? 1, delaySeconds: 0,
      });
    });
    return drill;
  }

  function backhandRandomForehandDrill() {
    const drill = defaultDrill("Drill: Backhand + random forehand");
    drill.settings = { repetitions: 16, delayBetweenSets: .8 };
    const bh = presetShot(drill, "topspinBackhand", "Backhand corner");
    bh.x = 150; bh.y = 330;
    const random = makeRandom("Middle or wide forehand");
    random.x = 475; random.y = 330;
    const middle = variedPresetShot(drill, "middleForehandTopspin", "Forehand from middle");
    middle.x = 820; middle.y = 180;
    const wide = variedPresetShot(drill, "topspinForehand", "Wide forehand");
    wide.x = 820; wide.y = 480;
    drill.nodes.push(bh, random, middle, wide);
    drill.startNodeId = bh.id;
    drill.edges.push(
      { id: makeId("edge"), source: bh.id, sourceSlot: "next", target: random.id, weight: 1, delaySeconds: .8 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: middle.id, weight: 1, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: wide.id, weight: 1, delaySeconds: 0 },
    );
    return drill;
  }

  function forehandBackhandRandomDrill() {
    const drill = defaultDrill("Drill: Forehand, backhand, random");
    drill.settings = { repetitions: 12, delayBetweenSets: .78 };
    const fh = presetShot(drill, "topspinForehand", "Forehand");
    const bh = presetShot(drill, "topspinBackhand", "Backhand");
    const random = makeRandom("Third ball anywhere");
    fh.x = 140; fh.y = 330;
    bh.x = 445; bh.y = 330;
    random.x = 750; random.y = 330;
    const options = [
      variedPresetShot(drill, "topspinBackhand", "Random · backhand"),
      variedPresetShot(drill, "topspinElbow", "Random · elbow"),
      variedPresetShot(drill, "topspinForehand", "Random · forehand"),
    ];
    options.forEach((shot, index) => { shot.x = 1080; shot.y = 100 + index * 230; });
    drill.nodes.push(fh, bh, random, ...options);
    drill.startNodeId = fh.id;
    drill.edges.push(
      { id: makeId("edge"), source: fh.id, sourceSlot: "next", target: bh.id, weight: 1, delaySeconds: .78 },
      { id: makeId("edge"), source: bh.id, sourceSlot: "next", target: random.id, weight: 1, delaySeconds: .78 },
      ...options.map(shot => ({ id: makeId("edge"), source: random.id, sourceSlot: "branch", target: shot.id, weight: 1, delaySeconds: 0 })),
    );
    return drill;
  }

  function openingToRandomRecoveryDrill(name, openingPresetKey, choices, {
    intervalSeconds = .88,
    repetitions = 14,
    randomLabel = "Recover to the next ball",
  } = {}) {
    const drill = defaultDrill(name);
    drill.settings = { repetitions, delayBetweenSets: intervalSeconds };
    const opening = variedPresetShot(drill, openingPresetKey, "Short underspin");
    opening.x = 150; opening.y = 330;
    const random = makeRandom(randomLabel);
    random.x = 500; random.y = 330;
    drill.nodes.push(opening, random);
    drill.startNodeId = opening.id;
    drill.edges.push({ id: makeId("edge"), source: opening.id, sourceSlot: "next", target: random.id, weight: 1, delaySeconds: intervalSeconds });
    choices.forEach((choice, index) => {
      const shot = variedPresetShot(drill, choice.key, choice.label || null);
      shot.x = 860; shot.y = 120 + index * 250;
      drill.nodes.push(shot);
      drill.edges.push({
        id: makeId("edge"), source: random.id, sourceSlot: "branch", target: shot.id,
        weight: choice.weight ?? 1, delaySeconds: 0,
      });
    });
    return drill;
  }

  function shortReceiveRandomAttackDrill() {
    const drill = defaultDrill("Match: Short receive → random long attack");
    drill.settings = { repetitions: 14, delayBetweenSets: .88 };
    const side = makeRandom("Short receive side");
    side.x = 120; side.y = 330;
    const shortBh = variedPresetShot(drill, "shortBackspinBackhand", "Short underspin · backhand");
    const shortFh = variedPresetShot(drill, "shortBackspinForehand", "Short underspin · forehand");
    shortBh.x = 430; shortBh.y = 190;
    shortFh.x = 430; shortFh.y = 470;
    const longRandom = makeRandom("Next attack");
    longRandom.x = 760; longRandom.y = 330;
    const longBh = variedPresetShot(drill, "deepTopspinBackhand", "Long topspin · backhand");
    const longElbow = variedPresetShot(drill, "topspinElbow", "Long topspin · elbow");
    const longFh = variedPresetShot(drill, "deepTopspinForehand", "Long topspin · forehand");
    [longBh, longElbow, longFh].forEach((shot, index) => { shot.x = 1100; shot.y = 90 + index * 240; });
    drill.nodes.push(side, shortBh, shortFh, longRandom, longBh, longElbow, longFh);
    drill.startNodeId = side.id;
    drill.edges.push(
      { id: makeId("edge"), source: side.id, sourceSlot: "branch", target: shortBh.id, weight: 1, delaySeconds: 0 },
      { id: makeId("edge"), source: side.id, sourceSlot: "branch", target: shortFh.id, weight: 1, delaySeconds: 0 },
      { id: makeId("edge"), source: shortBh.id, sourceSlot: "next", target: longRandom.id, weight: 1, delaySeconds: .88 },
      { id: makeId("edge"), source: shortFh.id, sourceSlot: "next", target: longRandom.id, weight: 1, delaySeconds: .88 },
      { id: makeId("edge"), source: longRandom.id, sourceSlot: "branch", target: longBh.id, weight: 3, delaySeconds: 0 },
      { id: makeId("edge"), source: longRandom.id, sourceSlot: "branch", target: longElbow.id, weight: 2, delaySeconds: 0 },
      { id: makeId("edge"), source: longRandom.id, sourceSlot: "branch", target: longFh.id, weight: 3, delaySeconds: 0 },
    );
    return drill;
  }

  function backhandExchangeSwitchDrill() {
    const drill = defaultDrill("Match: Backhand exchange → switch");
    drill.settings = { repetitions: 14, delayBetweenSets: .74 };
    const bh1 = presetShot(drill, "topspinBackhand", "Backhand exchange 1");
    const bh2 = presetShot(drill, "topspinBackhand", "Backhand exchange 2");
    const random = makeRandom("Stay or switch");
    bh1.x = 120; bh1.y = 330; bh2.x = 430; bh2.y = 330; random.x = 740; random.y = 330;
    const stay = variedPresetShot(drill, "topspinBackhand", "Stay backhand");
    const elbow = variedPresetShot(drill, "topspinElbow", "Switch to elbow");
    const wideFh = variedPresetShot(drill, "deepTopspinForehand", "Switch wide forehand");
    [stay, elbow, wideFh].forEach((shot, index) => { shot.x = 1080; shot.y = 90 + index * 240; });
    drill.nodes.push(bh1, bh2, random, stay, elbow, wideFh);
    drill.startNodeId = bh1.id;
    drill.edges.push(
      { id: makeId("edge"), source: bh1.id, sourceSlot: "next", target: bh2.id, weight: 1, delaySeconds: .74 },
      { id: makeId("edge"), source: bh2.id, sourceSlot: "next", target: random.id, weight: 1, delaySeconds: .74 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: stay.id, weight: 4, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: elbow.id, weight: 2, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: wideFh.id, weight: 3, delaySeconds: 0 },
    );
    return drill;
  }

  function weightedMatchRallyDrill() {
    const drill = defaultDrill("Match: Weighted rally");
    drill.settings = { repetitions: 8, delayBetweenSets: .78 };
    const repeater = makeCounter("Seven-ball rally");
    repeater.startCount = 7;
    repeater.x = 120; repeater.y = 330;
    const random = makeRandom("Match placement");
    random.x = 430; random.y = 330;
    const bh = variedPresetShot(drill, "topspinBackhand", "Backhand pressure");
    const elbow = variedPresetShot(drill, "topspinElbow", "Elbow pressure");
    const fh = variedPresetShot(drill, "topspinForehand", "Forehand pressure");
    [bh, elbow, fh].forEach((shot, index) => { shot.x = 780; shot.y = 90 + index * 240; });
    drill.nodes.push(repeater, random, bh, elbow, fh);
    drill.startNodeId = repeater.id;
    drill.edges.push(
      { id: makeId("edge"), source: repeater.id, sourceSlot: "A", target: random.id, weight: 1, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: bh.id, weight: 45, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: elbow.id, weight: 20, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: fh.id, weight: 35, delaySeconds: 0 },
      { id: makeId("edge"), source: bh.id, sourceSlot: "next", target: repeater.id, weight: 1, delaySeconds: .74 },
      { id: makeId("edge"), source: elbow.id, sourceSlot: "next", target: repeater.id, weight: 1, delaySeconds: .74 },
      { id: makeId("edge"), source: fh.id, sourceSlot: "next", target: repeater.id, weight: 1, delaySeconds: .74 },
    );
    return drill;
  }

  function matchPlayMixDrill(patterns) {
    const drill = defaultDrill("Match: Random pattern mix");
    drill.settings = { repetitions: 12, delayBetweenSets: 1.05 };
    const random = makeRandom("Choose a match pattern");
    random.x = 150; random.y = 330;
    drill.nodes.push(random);
    drill.startNodeId = random.id;
    patterns.forEach((entry, index) => {
      const node = makeDrillNode(entry.label, entry.drill.id);
      node.x = 540; node.y = 80 + index * 185;
      drill.nodes.push(node);
      drill.edges.push({
        id: makeId("edge"), source: random.id, sourceSlot: "branch", target: node.id,
        weight: entry.weight ?? 1, delaySeconds: 0,
      });
    });
    return drill;
  }

  function makeSampleLibrary() {
    // Common coaching patterns: alternating FH/BH, 2-2, Falkenberg/two-one,
    // systematic side-to-side footwork, semi-random placement, and three-spot
    // random work. Shot presets are also exposed as simple repeatable drills.
    const alternating = sequenceDrill(
      "Drill: Forehand / backhand alternating",
      ["topspinForehand", "topspinBackhand"],
      { repetitions: 18, intervalSeconds: .78, labels: ["Forehand", "Backhand"] }
    );
    const twoTwo = sequenceDrill(
      "Drill: 2-2 forehand / backhand",
      ["topspinForehand", "topspinForehand", "topspinBackhand", "topspinBackhand"],
      { repetitions: 10, intervalSeconds: .76, labels: ["Forehand 1", "Forehand 2", "Backhand 1", "Backhand 2"] }
    );
    const falkenberg = sequenceDrill(
      "Drill: Falkenberg",
      ["topspinBackhand", "topspinBackhand", "topspinForehand"],
      { repetitions: 12, intervalSeconds: .82, labels: ["Backhand", "Pivot forehand", "Wide forehand"] }
    );
    const threePoint = sequenceDrill(
      "Drill: Three-point footwork",
      ["topspinBackhand", "topspinElbow", "topspinForehand"],
      { repetitions: 14, intervalSeconds: .8, labels: ["Backhand", "Elbow", "Forehand"] }
    );
    const forehandHalf = sequenceDrill(
      "Drill: Forehand half-table footwork",
      ["middleForehandTopspin", "topspinForehand"],
      { repetitions: 18, intervalSeconds: .8, labels: ["Middle forehand", "Wide forehand"] }
    );
    const backhandHalf = sequenceDrill(
      "Drill: Backhand half-table footwork",
      ["middleBackhandTopspin", "topspinBackhand"],
      { repetitions: 18, intervalSeconds: .8, labels: ["Middle backhand", "Wide backhand"] }
    );
    const bhRandomFh = backhandRandomForehandDrill();
    const fhBhRandom = forehandBackhandRandomDrill();
    const threeSpots = randomDrill("Drill: Three spots random", [
      { key: "topspinBackhand", label: "Backhand" },
      { key: "topspinElbow", label: "Elbow" },
      { key: "topspinForehand", label: "Forehand" },
    ], { repetitions: 36, intervalSeconds: .78, randomLabel: "Backhand · elbow · forehand" });
    const spinSwitch = sequenceDrill(
      "Drill: Topspin / backspin switching",
      ["heavyTopspin", "backspinCenter"],
      { repetitions: 16, intervalSeconds: .9, labels: ["Heavy topspin", "Backspin"], varied: true }
    );
    const backspinCorners = sequenceDrill(
      "Drill: Backspin corners",
      ["backspinBackhand", "backspinForehand"],
      { repetitions: 18, intervalSeconds: .92, labels: ["Backspin · backhand", "Backspin · forehand"], varied: true }
    );
    const fastDeepRandom = randomDrill("Drill: Fast deep random", [
      { key: "fastDeepBackhand", label: "Deep backhand" },
      { key: "fastDeepCenter", label: "Deep elbow" },
      { key: "fastDeepForehand", label: "Deep forehand" },
    ], { repetitions: 30, intervalSeconds: .72, randomLabel: "Fast deep · three spots" });
    const variableTopspin = sequenceDrill(
      "Drill: Variable topspin rally",
      ["topspinElbow"],
      { repetitions: 36, intervalSeconds: .8, labels: ["Variable topspin"], varied: true }
    );
    const variableShortReceive = randomDrill("Drill: Variable short receive", [
      { key: "shortBackspinBackhand", label: "Variable short · backhand" },
      { key: "shortBackspinForehand", label: "Variable short · forehand" },
    ], { repetitions: 30, intervalSeconds: .95, randomLabel: "Variable short underspin" });

    const forehandFlickRecovery = openingToRandomRecoveryDrill(
      "Match: Short forehand underspin → wide recovery",
      "shortBackspinForehand",
      [
        { key: "deepTopspinBackhand", label: "Long wide topspin · backhand", weight: 1 },
        { key: "deepTopspinForehand", label: "Long wide topspin · forehand", weight: 1 },
      ],
      { randomLabel: "Recover to either wide corner" }
    );
    const backhandFlickForehandRecovery = sequenceDrill(
      "Match: Short backhand underspin → forehand recovery",
      ["shortBackspinBackhand", "deepTopspinForehand", "deepTopspinForehand"],
      { repetitions: 12, intervalSeconds: .86, labels: ["Short backhand underspin", "Wide forehand recovery 1", "Wide forehand recovery 2"], varied: true }
    );
    const shortReceiveRandom = shortReceiveRandomAttackDrill();
    const backhandSwitch = backhandExchangeSwitchDrill();
    const weightedRally = weightedMatchRallyDrill();
    const matchMix = matchPlayMixDrill([
      { drill: forehandFlickRecovery, label: "FH flick + recovery", weight: 2 },
      { drill: backhandFlickForehandRecovery, label: "BH flick + FH recovery", weight: 2 },
      { drill: shortReceiveRandom, label: "Short receive + random attack", weight: 3 },
      { drill: backhandSwitch, label: "Backhand exchange + switch", weight: 3 },
      { drill: weightedRally, label: "Weighted rally", weight: 4 },
    ]);

    const shotDrills = [
      singleShotDrill("Shot: No-spin center", "noSpinCenter"),
      singleShotDrill("Shot: Short no-spin", "shortNoSpin", { intervalSeconds: .9 }),
      singleShotDrill("Shot: Short underspin to forehand", "shortBackspinForehand", { intervalSeconds: .95 }),
      singleShotDrill("Shot: Short underspin to backhand", "shortBackspinBackhand", { intervalSeconds: .95 }),
      singleShotDrill("Shot: Topspin to forehand", "topspinForehand"),
      singleShotDrill("Shot: Topspin to backhand", "topspinBackhand"),
      singleShotDrill("Shot: Long wide topspin to forehand", "deepTopspinForehand", { intervalSeconds: .76 }),
      singleShotDrill("Shot: Long wide topspin to backhand", "deepTopspinBackhand", { intervalSeconds: .76 }),
      singleShotDrill("Shot: Topspin to elbow", "topspinElbow"),
      singleShotDrill("Shot: Heavy topspin center", "heavyTopspin", { intervalSeconds: .85 }),
      singleShotDrill("Shot: Backspin center", "backspinCenter", { intervalSeconds: .95 }),
      singleShotDrill("Shot: Fast deep center", "fastDeepCenter", { intervalSeconds: .72 }),
    ];

    return {
      drills: [
        alternating,
        twoTwo,
        falkenberg,
        threePoint,
        forehandHalf,
        backhandHalf,
        bhRandomFh,
        fhBhRandom,
        threeSpots,
        spinSwitch,
        backspinCorners,
        fastDeepRandom,
        variableTopspin,
        variableShortReceive,
        forehandFlickRecovery,
        backhandFlickForehandRecovery,
        shortReceiveRandom,
        backhandSwitch,
        weightedRally,
        matchMix,
        ...shotDrills,
      ],
    };
  }


  const BUILT_IN_FOLDER_DEFS = Object.freeze([
    { id: "builtin-shots", name: "Shots", parentId: "builtin-root" },
    { id: "builtin-footwork", name: "Footwork", parentId: "builtin-root" },
    { id: "builtin-placement", name: "Placement", parentId: "builtin-root" },
    { id: "builtin-spin", name: "Spin", parentId: "builtin-root" },
    { id: "builtin-random", name: "Random / match-like", parentId: "builtin-root" },
  ]);

  const BUILT_IN_FOLDER_BY_NAME = Object.freeze({
    "Drill: Forehand / backhand alternating": "builtin-footwork",
    "Drill: 2-2 forehand / backhand": "builtin-footwork",
    "Drill: Falkenberg": "builtin-footwork",
    "Drill: Three-point footwork": "builtin-footwork",
    "Drill: Forehand half-table footwork": "builtin-footwork",
    "Drill: Backhand half-table footwork": "builtin-footwork",
    "Drill: Backhand + random forehand": "builtin-placement",
    "Drill: Forehand, backhand, random": "builtin-placement",
    "Drill: Three spots random": "builtin-random",
    "Drill: Topspin / backspin switching": "builtin-spin",
    "Drill: Backspin corners": "builtin-spin",
    "Drill: Fast deep random": "builtin-random",
    "Drill: Variable topspin rally": "builtin-random",
    "Drill: Variable short receive": "builtin-random",
    "Match: Short forehand underspin → wide recovery": "builtin-random",
    "Match: Short backhand underspin → forehand recovery": "builtin-random",
    "Match: Short receive → random long attack": "builtin-random",
    "Match: Backhand exchange → switch": "builtin-random",
    "Match: Weighted rally": "builtin-random",
    "Match: Random pattern mix": "builtin-random",
    "Shot: No-spin center": "builtin-shots",
    "Shot: Short no-spin": "builtin-shots",
    "Shot: Short underspin to forehand": "builtin-shots",
    "Shot: Short underspin to backhand": "builtin-shots",
    "Shot: Topspin to forehand": "builtin-shots",
    "Shot: Topspin to backhand": "builtin-shots",
    "Shot: Long wide topspin to forehand": "builtin-shots",
    "Shot: Long wide topspin to backhand": "builtin-shots",
    "Shot: Topspin to elbow": "builtin-shots",
    "Shot: Heavy topspin center": "builtin-shots",
    "Shot: Backspin center": "builtin-shots",
    "Shot: Fast deep center": "builtin-shots",
  });

  function builtInDisplayName(name) {
    return String(name || "").replace(/^(?:Drill|Shot|Match):\s*/, "");
  }

  function stableBuiltInId(name) {
    const slug = builtInDisplayName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "drill";
    return `builtin-${slug}`;
  }

  function makeBuiltInCatalog() {
    const sample = makeSampleLibrary();
    const stableIds = new Map(sample.drills.map(drill => [drill.id, stableBuiltInId(drill.name)]));
    const drills = sample.drills.map(drill => {
      drill.id = stableIds.get(drill.id);
      drill.libraryFolderId = BUILT_IN_FOLDER_BY_NAME[drill.name] || "builtin-random";
      drill.builtIn = true;
      const folderName = BUILT_IN_FOLDER_DEFS.find(folder => folder.id === drill.libraryFolderId)?.name || "Training";
      const hasShotVariation = drill.nodes.some(node => node.type === "shot" && node.variation?.enabled);
      drill.tags = [...new Set([folderName.toLowerCase(), drill.name.startsWith("Match:") ? "match-like" : "training"].filter(Boolean))];
      drill.description = drill.description || (drill.name.startsWith("Match:")
        ? "Match-like robot pattern with realistic placement, shot and timing variation."
        : folderName === "Shots"
          ? "Repeatable single-shot feed for technique and calibration-aware practice."
          : hasShotVariation
            ? `${folderName} training pattern with controlled physical shot variation.`
            : `${folderName} training pattern from the built-in library.`);
      for (const node of drill.nodes || []) {
        if (node.type === "drill" && stableIds.has(node.referencedDrillId)) node.referencedDrillId = stableIds.get(node.referencedDrillId);
      }
      return drill;
    });
    const alternating = drills.find(drill => drill.name === "Drill: Forehand / backhand alternating");
    return {
      version: DEFAULT_LIBRARY_VERSION,
      folders: BUILT_IN_FOLDER_DEFS.map(folder => ({ ...folder })),
      drills,
      defaultDrillId: alternating?.id ?? drills[0]?.id ?? null,
    };
  }

  function allDrills() {
    return [...(builtInCatalog?.drills || []), ...(library?.drills || [])];
  }

  function isActiveBuiltIn() {
    return library?.activeDrillSource === "builtin";
  }

  function activeDrillEditable() {
    return !isActiveBuiltIn();
  }

  function setActiveDrill(source, id, { save = true } = {}) {
    const normalizedSource = source === "user" ? "user" : "builtin";
    const drill = normalizedSource === "user"
      ? library.drills.find(item => item.id === id)
      : builtInCatalog.drills.find(item => item.id === id);
    if (!drill) return false;
    library.activeDrillSource = normalizedSource;
    library.activeDrillId = drill.id;
    if (save) saveLibrary();
    return true;
  }

  function activeDrill() {
    repairLibraryIfNeeded();
    if (library.activeDrillSource === "user") return library.drills.find(d => d.id === library.activeDrillId) ?? null;
    return builtInCatalog?.drills.find(d => d.id === library.activeDrillId) ?? builtInCatalog?.drills[0] ?? library.drills[0] ?? null;
  }

  function getDrill(id) { return allDrills().find(d => d.id === id) ?? null; }
  function getNode(drill, id) { return drill?.nodes.find(n => n.id === id) ?? null; }
  function getEdge(drill, id) { return drill?.edges.find(e => e.id === id) ?? null; }
  function outgoing(drill, nodeId) { return drill.edges.filter(e => e.source === nodeId); }
  function incoming(drill, nodeId) { return drill.edges.filter(e => e.target === nodeId); }
  function edgeForSlot(drill, nodeId, slot) { return drill.edges.find(e => e.source === nodeId && e.sourceSlot === slot) ?? null; }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function sanitizeCalibration(raw = {}) {
    const base = defaultCalibration();
    const pose = raw.pose || {};
    const test = raw.testShot || {};
    const table = raw.table || {};
    const physicsRaw = raw.physics || {};
    const physicsBase = base.physics;
    const windRaw = physicsRaw.wind || {};
    const novaRaw = raw.nova || {};
    const novaBase = base.nova;
    const guidedRaw = raw.guided || {};
    const guidedBase = base.guided;
    const rawCurve = Array.isArray(novaRaw.spinsightCurve) ? novaRaw.spinsightCurve : novaBase.spinsightCurve;
    const curveByLevel = new Map(rawCurve.map(point => [Number(point?.level), point]));
    const sanitizedCurve = novaBase.spinsightCurve.map(defaultPoint => {
      const point = curveByLevel.get(defaultPoint.level) || defaultPoint;
      return {
        level: defaultPoint.level,
        maxSpinSetting: clamp(point.maxSpinSetting, 0, 10, defaultPoint.maxSpinSetting),
        maxSpinRps: clamp(point.maxSpinRps, 0, 200, defaultPoint.maxSpinRps),
        estimated: Boolean(defaultPoint.estimated),
      };
    });
    const speedModel = LaunchModel
      ? LaunchModel.sanitizeLinearModel(novaRaw.speedModel || novaBase.speedModel)
      : { ...novaBase.speedModel, ...(novaRaw.speedModel || {}) };
    const guidedShots = Array.isArray(guidedRaw.shots) ? guidedRaw.shots.map((shot, index) => ({
      id: String(shot?.id || `cal-${index + 1}`),
      index,
      rawSpeed: clamp(shot?.rawSpeed, 400, 7500, 2025),
      elevationDeg: clamp(shot?.elevationDeg, -20, 60, 10),
      distanceCm: shot?.distanceCm === null || shot?.distanceCm === "" || shot?.distanceCm === undefined ? null : finite(shot.distanceCm, null),
      netClearanceCm: shot?.netClearanceCm === null || shot?.netClearanceCm === "" || shot?.netClearanceCm === undefined ? null : finite(shot.netClearanceCm, null),
      saved: Boolean(shot?.saved),
    })) : guidedBase.shots;
    const sanitizedPose = {
      x: clamp(pose.x, -1.5, 4.2, base.pose.x),
      y: clamp(pose.y, -2, 2, base.pose.y),
      yawDeg: clamp(pose.yawDeg, -180, 180, base.pose.yawDeg),
    };
    return {
      geometryReference: ROBOT_GEOMETRY_REFERENCE,
      pose: sanitizedPose,
      poseSession: { ...PoseCalibration.sanitizeSession(raw.poseSession || {}, sanitizedPose), pose: sanitizedPose },
      placementMode: raw.placementMode === "ground" ? "ground" : "table",
      tableHeight: clamp(raw.tableHeight, .4, 1.2, base.tableHeight),
      table: {
        length: clamp(table.length, .5, 10, base.table.length),
        width: clamp(table.width, .3, 5, base.table.width),
        netHeight: clamp(table.netHeight, .01, 1, base.table.netHeight),
      },
      rotationType: Math.round(clamp(raw.rotationType, 0, 7, base.rotationType)),
      gravity: clamp(raw.gravity, 1, 20, base.gravity),
      timeStep: clamp(raw.timeStep, .001, .02, base.timeStep),
      maxFlightTime: clamp(raw.maxFlightTime, .5, 10, base.maxFlightTime),
      physics: {
        ballDiameterM: clamp(
          physicsRaw.ballDiameterM,
          .01,
          .1,
          physicsBase.ballDiameterM
        ),
        ballMassKg: clamp(physicsRaw.ballMassKg, .0005, .02, physicsBase.ballMassKg),
        airTemperatureC: clamp(physicsRaw.airTemperatureC, -30, 60, physicsBase.airTemperatureC),
        airPressureKpa: clamp(physicsRaw.airPressureKpa, 70, 110, physicsBase.airPressureKpa),
        dryAirGasConstant: clamp(physicsRaw.dryAirGasConstant, 250, 330, physicsBase.dryAirGasConstant),
        sutherlandMu0: clamp(physicsRaw.sutherlandMu0, 1e-6, 1e-4, physicsBase.sutherlandMu0),
        sutherlandT0: clamp(physicsRaw.sutherlandT0, 150, 500, physicsBase.sutherlandT0),
        sutherlandS: clamp(physicsRaw.sutherlandS, 1, 500, physicsBase.sutherlandS),
        dragScale: clamp(physicsRaw.dragScale, .1, 3, physicsBase.dragScale),
        magnusScale: clamp(physicsRaw.magnusScale, .1, 3, physicsBase.magnusScale),
        wind: {
          x: clamp(windRaw.x, -10, 10, physicsBase.wind.x),
          y: clamp(windRaw.y, -10, 10, physicsBase.wind.y),
          z: clamp(windRaw.z, -10, 10, physicsBase.wind.z),
        },
      },
      nova: {
        rawAtZeroSpeedLevel: clamp(novaRaw.rawAtZeroSpeedLevel, 0, 20000, novaBase.rawAtZeroSpeedLevel),
        rawPerSpeedLevel: clamp(novaRaw.rawPerSpeedLevel, .0001, 5000, novaBase.rawPerSpeedLevel),
        rawDeltaPerSpinLevel: clamp(novaRaw.rawDeltaPerSpinLevel, .0001, 5000, novaBase.rawDeltaPerSpinLevel),
        upDownAtZeroDeg: clamp(novaRaw.upDownAtZeroDeg, -100, 200, novaBase.upDownAtZeroDeg),
        upDownPerDegree: clamp(novaRaw.upDownPerDegree, .01, 30, novaBase.upDownPerDegree),
        yawDegreesPerPlacement: clamp(novaRaw.yawDegreesPerPlacement, .01, 30, novaBase.yawDegreesPerPlacement),
        spinsightCurve: sanitizedCurve,
        speedModel,
      },
      guided: {
        placement: guidedRaw.placement === "table" ? "table" : "ground",
        distanceReference: guidedRaw.placement === "table"
          ? (["net","near_edge","nozzle","base_back"].includes(guidedRaw.distanceReference) ? guidedRaw.distanceReference : guidedBase.distanceReference)
          : "base_back",
        baseBackXcm: guidedRaw.placement === "table" ? clamp(guidedRaw.baseBackXcm, -300, 300, 0) : 0,
        measurementOffsetCm: clamp(guidedRaw.measurementOffsetCm, -200, 200, guidedBase.measurementOffsetCm),
        tableHeightCm: clamp(guidedRaw.tableHeightCm, 40, 120, guidedBase.tableHeightCm),
        repeatCount: Math.round(clamp(guidedRaw.repeatCount, 1, 12, guidedBase.repeatCount)),
        elevationMinDeg: clamp(guidedRaw.elevationMinDeg, -20, 60, guidedBase.elevationMinDeg),
        elevationMaxDeg: clamp(guidedRaw.elevationMaxDeg, -20, 60, guidedBase.elevationMaxDeg),
        elevationCount: Math.round(clamp(guidedRaw.elevationCount, 2, 12, guidedBase.elevationCount)),
        speedMinRaw: Math.round(clamp(guidedRaw.speedMinRaw, 400, 7500, guidedBase.speedMinRaw)),
        speedMaxRaw: Math.round(clamp(guidedRaw.speedMaxRaw, 400, 7500, guidedBase.speedMaxRaw)),
        speedCount: Math.round(clamp(guidedRaw.speedCount, 2, 8, guidedBase.speedCount)),
        currentIndex: Math.max(0, Math.round(finite(guidedRaw.currentIndex, 0))),
        shots: guidedShots,
        planSignature: typeof guidedRaw.planSignature === "string" ? guidedRaw.planSignature : "",
        lastResult: guidedRaw.lastResult?.modelKind === "affine-raw-speed-v1" ? guidedRaw.lastResult : null,
      },
      testShot: {
        speedMps: clamp(test.speedMps, 1, 20, base.testShot.speedMps),
        spinRps: clamp(test.spinRps, -120, 120, base.testShot.spinRps),
        elevationDeg: clamp(test.elevationDeg, -20, 45, base.testShot.elevationDeg),
        aimDeg: clamp(test.aimDeg, -60, 60, base.testShot.aimDeg),
      },
    };
  }

  function sanitizeDrill(raw, allIds) {
    const drill = defaultDrill(String(raw?.name || "Custom drill"));
    drill.id = String(raw?.id || makeId("drill"));
    const rawNodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
    drill.nodes = rawNodes
      .filter(n => ["shot", "random", "drill", "counter"].includes(n?.type))
      .map(n => {
        const common = {
          id: String(n.id || makeId(n.type)),
          type: n.type,
          label: String(n.label || n.type),
          x: clamp(n.x, 0, SURFACE_WIDTH - NODE_WIDTH, 200),
          y: clamp(n.y, MIN_NODE_Y, SURFACE_HEIGHT - 200, 200),
        };
        if (n.type === "shot") {
          const p = n.params || {};
          common.params = {
            speedMps: clamp(p.speedMps, 1, 20, 8),
            spinRps: clamp(p.spinRps, -120, 120, 0),
            elevationDeg: clamp(p.elevationDeg, -20, 45, 4),
            aimDeg: clamp(p.aimDeg, -60, 60, 0),
          };
          common.variation = n.variation?.enabled
            ? ShotVariation.normalizeVariation(n.variation, common.params)
            : null;
        } else if (n.type === "drill") {
          common.referencedDrillId = allIds.has(String(n.referencedDrillId)) ? String(n.referencedDrillId) : null;
        } else if (n.type === "counter") {
          common.startCount = Math.max(0, Math.round(finite(n.startCount, 1)));
          common.clearOnNodeIds = Array.isArray(n.clearOnNodeIds) ? n.clearOnNodeIds.map(String) : [];
        }
        return common;
      });

    const nodeIds = new Set(drill.nodes.map(n => n.id));
    drill.nodes.forEach(n => {
      if (n.type === "counter") n.clearOnNodeIds = n.clearOnNodeIds.filter(id => nodeIds.has(id) && id !== n.id);
    });

    drill.edges = (Array.isArray(raw?.edges) ? raw.edges : [])
      .filter(e => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
      .map(e => ({
        id: String(e.id || makeId("edge")),
        source: String(e.source),
        sourceSlot: ["next", "branch", "A", "B"].includes(e.sourceSlot) ? e.sourceSlot : "next",
        target: String(e.target),
        weight: clamp(e.weight, .01, 100000, 1),
        delaySeconds: clamp(e.delaySeconds, 0, 3600, 0),
      }));

    drill.description = String(raw?.description || "").trim().slice(0, 600);
    drill.tags = Array.isArray(raw?.tags)
      ? [...new Set(raw.tags.map(tag => String(tag).trim()).filter(Boolean))].slice(0, 20)
      : String(raw?.tags || "").split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 20);
    const rawPose = raw?.robotPose || {};
    drill.robotPoseReference = "base_back";
    drill.robotPose = {
      x: clamp(rawPose.x, -1.5, 4.2, 0),
      y: clamp(rawPose.y, -2, 2, 0),
      yawDeg: clamp(rawPose.yawDeg, -180, 180, 0),
    };

    const settings = raw?.settings || {};
    const repetitions = Math.round(finite(settings.repetitions, 1));
    drill.settings = {
      repetitions: repetitions <= 0 ? 0 : Math.min(999999, repetitions),
      delayBetweenSets: clamp(settings.delayBetweenSets, 0, 3600, 0),
    };
    drill.startNodeId = nodeIds.has(String(raw?.startNodeId)) ? String(raw.startNodeId) : (drill.nodes[0]?.id ?? null);
    return drill;
  }

  function sanitizeFolder(rawFolder, knownIds) {
    const id = String(rawFolder?.id || makeId("folder"));
    return {
      id,
      name: String(rawFolder?.name || "Folder").trim().slice(0, 90) || "Folder",
      parentId: knownIds.has(String(rawFolder?.parentId)) && String(rawFolder?.parentId) !== id
        ? String(rawFolder.parentId)
        : null,
    };
  }

  function sanitizeLibrary(raw) {
    if (raw?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.drills)) {
      throw new Error(`Unsupported drill file. Expected schemaVersion ${SCHEMA_VERSION}.`);
    }
    const rawFolders = Array.isArray(raw.folders) ? raw.folders : [];
    const folderIds = new Set(rawFolders.map(folder => String(folder?.id || "")).filter(Boolean));
    const folders = rawFolders.map(folder => sanitizeFolder(folder, folderIds));
    const validFolderIds = new Set(folders.map(folder => folder.id));
    const preliminaryIds = new Set([
      ...builtInCatalog.drills.map(drill => drill.id),
      ...raw.drills.map(d => String(d.id || makeId("drill"))),
    ]);
    const drills = raw.drills.map(d => {
      const drill = sanitizeDrill(d, preliminaryIds);
      drill.folderId = validFolderIds.has(String(d?.folderId)) ? String(d.folderId) : null;
      return drill;
    });
    const desiredSource = raw.activeDrillSource === "user" ? "user" : "builtin";
    const desiredId = String(raw.activeDrillId || "");
    const userExists = drills.some(drill => drill.id === desiredId);
    const builtInExists = builtInCatalog.drills.some(drill => drill.id === desiredId);
    const source = desiredSource === "user" && userExists ? "user" : builtInExists ? "builtin" : drills.length ? "user" : "builtin";
    const activeId = source === "user" ? (userExists ? desiredId : drills[0]?.id ?? null) : (builtInExists ? desiredId : builtInCatalog.defaultDrillId);
    return {
      schemaVersion: SCHEMA_VERSION,
      activeDrillSource: source,
      activeDrillId: activeId,
      calibration: sanitizeCalibration(raw.calibration),
      folders,
      drills,
    };
  }

  function saveLibrary() {
    try {
      repairLibraryIfNeeded();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      if (els.libraryStatus) {
        const builtInCount = builtInCatalog?.drills.length || 0;
        const userCount = library.drills.length;
        els.libraryStatus.textContent = `${builtInCount} built-in · ${userCount} My drill${userCount === 1 ? "" : "s"}`;
      }
    } catch (error) {
      console.warn("Could not save drill library", error);
      if (els.libraryStatus) els.libraryStatus.textContent = "Browser storage is unavailable; My drills will last only until this page closes.";
    }
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return sanitizeLibrary(JSON.parse(raw));
    } catch (error) {
      console.warn(`Could not load ${STORAGE_KEY}`, error);
      return null;
    }
  }

  function saveLiveTuningPreference() {
    try {
      localStorage.setItem(LIVE_TUNING_STORAGE_KEY, JSON.stringify(DrillAdjustments.normalizeTuning(liveTuning)));
    } catch (error) {
      console.warn("Could not save Live tuning preference", error);
    }
  }

  function loadLiveTuningPreference() {
    try {
      const raw = localStorage.getItem(LIVE_TUNING_STORAGE_KEY);
      if (!raw) return { ...DrillAdjustments.DEFAULT_TUNING };
      return DrillAdjustments.normalizeTuning(JSON.parse(raw));
    } catch (error) {
      console.warn("Could not load Live tuning preference", error);
      return { ...DrillAdjustments.DEFAULT_TUNING };
    }
  }

  function commit({ render = true, message = null } = {}) {
    saveLibrary();
    if (render) renderAll();
    if (message) toast(message);
  }

  function repetitionsDisplay(value) {
    return value <= 0 ? "∞" : String(value);
  }

  function setRepetitions(value) {
    const drill = activeDrill();
    if (!drill) return;
    const normalized = Math.round(finite(value, 0));
    drill.settings.repetitions = normalized <= 0 ? 0 : Math.min(999999, normalized);
    els.repetitionsInput.value = repetitionsDisplay(drill.settings.repetitions);
    if (activeDrillEditable()) saveLibrary();
  }

  function currentSettingsToHeader() {
    const drill = activeDrill();
    if (!drill) return;
    els.repetitionsInput.value = repetitionsDisplay(drill.settings.repetitions);
    els.setDelayInput.value = drill.settings.delayBetweenSets;
  }

  function appViewLabel(view) {
    return view === "run" ? "Run drill" : view === "editor" ? "Drill editor" : view === "robot" ? "Robot" : "Drill library";
  }

  function navigateApp(view, { push = true, allowBuiltInEditor = false } = {}) {
    const normalized = ["library", "run", "editor", "robot"].includes(view) ? view : "library";
    if (normalized === "editor" && isActiveBuiltIn() && !allowBuiltInEditor) {
      const drill = activeDrill();
      askConfirm(
        "Copy this drill to edit it?",
        `“${builtInDisplayName(drill?.name || "Built-in drill")}” is part of the read-only library. Create your own copy and open it in the editor?`,
        () => { copyActiveBuiltInToMyDrills(); navigateApp("editor", { push: true, allowBuiltInEditor: true }); },
        { actionLabel: "Copy & edit", actionClass: "primary" }
      );
      return;
    }
    if (normalized === "run" && !activeDrill()) view = "library";
    if (normalized === "editor" && !activeDrill()) view = "library";
    const next = ["library", "run", "editor", "robot"].includes(view) ? view : "library";
    if (push && next !== appView) appHistory.push(appView);
    appView = next;
    inspectorOpen = false;
    selection = next === "editor" ? selection : selection;
    document.body.dataset.appView = next;
    const screens = { library: els.libraryScreen, run: els.runScreen, editor: els.editorScreen, robot: els.robotScreen };
    Object.entries(screens).forEach(([key, screen]) => { if (screen) screen.hidden = key !== next; });
    const navs = [els.desktopLibraryNavBtn, els.desktopRunNavBtn, els.desktopEditNavBtn, els.desktopRobotNavBtn, els.mobileLibraryNavBtn, els.mobileRunNavBtn, els.mobileEditNavBtn, els.mobileRobotNavBtn];
    navs.forEach(button => {
      if (!button) return;
      const active = button.dataset.appNav === next;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (els.topbarContext) els.topbarContext.textContent = appViewLabel(next);
    if (els.topBackBtn) els.topBackBtn.hidden = appHistory.length === 0;
    document.body.classList.remove("details-open");
    if (next === "editor") setTimeout(() => { renderGraph(); fitGraph(); }, 20);
    renderRunPage();
    renderRobotSetupSummary();
  }

  function goBackApp() {
    inspectorOpen = false;
    document.body.classList.remove("details-open");
    const previous = appHistory.pop();
    if (previous) navigateApp(previous, { push: false });
    else navigateApp("library", { push: false });
  }

  function openInspectorScreen() {
    inspectorOpen = Boolean(selection);
    document.body.classList.toggle("details-open", inspectorOpen);
  }

  function closeInspectorScreen() {
    inspectorOpen = false;
    selection = null;
    document.body.classList.remove("details-open");
    renderInspector();
    renderGraph();
  }

  function activeDrillDescription(drill = activeDrill()) {
    if (!drill) return "Select a drill from the library to start a session.";
    if (drill.description) return drill.description;
    const tags = Array.isArray(drill.tags) && drill.tags.length ? ` · ${drill.tags.join(" · ")}` : "";
    return `${drill.nodes.filter(node => node.type === "shot").length} shot node${drill.nodes.filter(node => node.type === "shot").length === 1 ? "" : "s"}${tags}`;
  }

  function drillPose(drill = activeDrill()) {
    const p = drill?.robotPose || library?.calibration?.pose || { x: 0, y: 0, yawDeg: 0 };
    return { x: finite(p.x, 0), y: finite(p.y, 0), yawDeg: finite(p.yawDeg, 0) };
  }
  function currentRobotPose() {
    const p = library?.calibration?.pose || { x: 0, y: 0, yawDeg: 0 };
    return { x: finite(p.x, 0), y: finite(p.y, 0), yawDeg: finite(p.yawDeg, 0) };
  }
  function poseDifference(reference, current = currentRobotPose()) {
    return {
      distanceM: Math.hypot(current.x - reference.x, current.y - reference.y),
      yawDeg: Math.abs(current.yawDeg - reference.yawDeg),
    };
  }
  function poseNeedsCompensation(reference, current = currentRobotPose()) {
    const difference = poseDifference(reference, current);
    return difference.distanceM > .001 || difference.yawDeg > .05;
  }
  function robotSetupMiniSvg(currentPose = currentRobotPose()) {
    const table = library?.calibration?.table || regulationTable();
    const w = 250, h = 118, pad = 12;
    const sx = (w - pad * 2) / table.length;
    const sy = (h - pad * 2) / table.width;
    const ray = 28;
    const marker = (pose, color) => {
      const x = pad + pose.x * sx;
      const y = h / 2 - pose.y * sy;
      const a = radians(pose.yawDeg);
      return `<circle cx="${x}" cy="${y}" r="7" fill="${color}"/><line x1="${x}" y1="${y}" x2="${x+Math.cos(a)*ray}" y2="${y-Math.sin(a)*ray}" stroke="${color}" stroke-width="3"/>`;
    };
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Saved robot position"><rect x="${pad}" y="${pad}" width="${w-pad*2}" height="${h-pad*2}" rx="4" fill="#123047" stroke="#6f8196"/><line x1="${w/2}" x2="${w/2}" y1="${pad}" y2="${h-pad}" stroke="#d7e0e9"/>${marker(currentPose,"#55c98c")}</svg>`;
  }

  function renderRobotSetupSummary() {
    if (!els.runRobotSetup) return;
    const drill = activeDrill();
    if (!drill) { els.runRobotSetup.innerHTML = `<p class="helper">Choose a drill first.</p>`; return; }
    const current = currentRobotPose();
    const session = library.calibration.poseSession;
    const stale = PoseCalibration.isStale(session);
    els.runRobotSetup.innerHTML = `<div class="robot-setup-mini">${robotSetupMiniSvg(current)}</div>`;
    if (els.runPoseStatus) {
      const uncertainty = session?.uncertainty || PoseCalibration.DEFAULT_UNCERTAINTY;
      els.runPoseStatus.textContent = stale
        ? `Position check recommended · last verified ${session?.verifiedAt ? `${Math.floor(PoseCalibration.ageDays(session.verifiedAt))} days ago` : "never"}`
        : session?.verifiedAt
          ? `Position verified · estimated uncertainty ±${fmt(uncertainty.xCm,1)} cm / ±${fmt(uncertainty.yCm,1)} cm / ±${fmt(uncertainty.yawDeg,1)}°`
          : `Position saved recently but not verified · estimated uncertainty ±${fmt(uncertainty.xCm,1)} cm / ±${fmt(uncertainty.yCm,1)} cm / ±${fmt(uncertainty.yawDeg,1)}°`;
      els.runPoseStatus.classList.toggle("active", stale);
    }
  }

  function renderRunPage() {
    const drill = activeDrill();
    if (els.runDrillTitle) els.runDrillTitle.textContent = drill ? (isActiveBuiltIn() ? builtInDisplayName(drill.name) : drill.name) : "Choose a drill";
    if (els.runDrillDescription) els.runDrillDescription.textContent = activeDrillDescription(drill);
    renderRobotSetupSummary();
  }

  function openDrillDetails() {
    const drill = activeDrill();
    if (!drill) return;
    const readOnly = isActiveBuiltIn();
    els.drillNameInput.value = readOnly ? builtInDisplayName(drill.name) : drill.name;
    els.drillDescriptionInput.value = drill.description || "";
    els.drillTagsInput.value = (drill.tags || []).join(", ");
    const pose = drillPose(drill);
    els.drillRobotXInput.value = pose.x;
    els.drillRobotYInput.value = pose.y;
    els.drillRobotYawInput.value = pose.yawDeg;
    [els.drillNameInput, els.drillDescriptionInput, els.drillTagsInput, els.drillRobotXInput, els.drillRobotYInput, els.drillRobotYawInput].forEach(input => { if (input) input.disabled = readOnly; });
    els.drillDetailsReadonlyNote.hidden = !readOnly;
    els.drillDetailsReadonlyNote.innerHTML = readOnly ? `<div><strong>Built-in drill</strong><span>Built-ins update with the app. Copy it to My drills to change its metadata or graph.</span></div>` : "";
    els.copyBuiltInBtn.hidden = !readOnly;
    els.moveDrillBtn.hidden = readOnly;
    els.deleteDrillBtn.hidden = readOnly;
    els.drillDetailsDialog.showModal();
  }

  function renderAll() {
    repairLibraryIfNeeded();
    renderDrillList();
    renderGraph();
    renderInspector();
    renderValidation();
    currentSettingsToHeader();
    renderLiveTuning();
    const drill = activeDrill();
    const displayName = drill ? (isActiveBuiltIn() ? builtInDisplayName(drill.name) : drill.name) : "No drill";
    els.activeDrillTitle.textContent = displayName;
    els.drillNameInput.value = displayName === "No drill" ? "" : displayName;
    els.emptyHint.hidden = Boolean(drill?.nodes.length);
    renderLibraryEditState();
    renderRunPage();
  }

  function libraryFolderDefs(root = libraryView.root) {
    return root === "builtin" ? builtInCatalog.folders : library.folders;
  }

  function libraryRootFolderId(root = libraryView.root) {
    return root === "builtin" ? "builtin-root" : null;
  }

  function folderById(root, id) {
    if (root === "builtin") return builtInCatalog.folders.find(folder => folder.id === id) ?? null;
    return library.folders.find(folder => folder.id === id) ?? null;
  }

  function folderPath(root, folderId) {
    const rootCrumb = { id: libraryRootFolderId(root), name: root === "builtin" ? "Built-in" : "My drills" };
    if (folderId === rootCrumb.id || (root === "user" && folderId == null)) return [rootCrumb];
    const path = [];
    let cursor = folderById(root, folderId);
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      path.unshift(cursor);
      cursor = folderById(root, cursor.parentId);
    }
    return [rootCrumb, ...path];
  }

  function folderLabelForDrill(root, drill) {
    const folderId = root === "builtin" ? drill.libraryFolderId : drill.folderId;
    return folderPath(root, folderId).map(item => item.name).slice(1).join(" / ") || (root === "builtin" ? "Built-in" : "My drills");
  }

  function childFolders(root, folderId) {
    const normalized = root === "builtin" ? folderId : (folderId || null);
    return libraryFolderDefs(root)
      .filter(folder => (folder.parentId || null) === (normalized || null))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function drillsInFolder(root, folderId) {
    if (root === "builtin") return builtInCatalog.drills.filter(drill => drill.libraryFolderId === folderId);
    return library.drills.filter(drill => (drill.folderId || null) === (folderId || null));
  }

  function folderItemCount(root, folder) {
    return drillsInFolder(root, folder.id).length + childFolders(root, folder.id).length;
  }

  function renderLibraryBreadcrumb() {
    els.libraryBreadcrumb.replaceChildren();
    const path = folderPath(libraryView.root, libraryView.folderId);
    path.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-crumb";
      button.textContent = item.name;
      button.disabled = index === path.length - 1;
      button.addEventListener("click", () => {
        libraryView.folderId = item.id;
        libraryView.query = "";
        els.librarySearchInput.value = "";
        renderDrillList();
      });
      els.libraryBreadcrumb.appendChild(button);
      if (index < path.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = "›";
        sep.className = "library-crumb-separator";
        els.libraryBreadcrumb.appendChild(sep);
      }
    });
  }

  function selectLibraryRoot(root) {
    libraryView.root = root === "user" ? "user" : "builtin";
    libraryView.folderId = libraryRootFolderId(libraryView.root);
    libraryView.query = "";
    els.librarySearchInput.value = "";
    renderDrillList();
    renderLibraryEditState();
  }

  function selectLibraryDrill(source, drill, destination = "run") {
    stopPlayback();
    setActiveDrill(source, drill.id, { save: false });
    selection = null;
    commit();
    navigateApp(destination, { push: true });
    if (destination === "editor") setTimeout(fitGraph, 30);
  }

  function renderDrillList() {
    els.drillList.replaceChildren();
    els.builtInLibraryTab.classList.toggle("active", libraryView.root === "builtin");
    els.myDrillsLibraryTab.classList.toggle("active", libraryView.root === "user");
    renderLibraryBreadcrumb();

    const query = String(libraryView.query || "").trim().toLowerCase();
    if (!query) {
      for (const folder of childFolders(libraryView.root, libraryView.folderId)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "library-folder-item";
        button.innerHTML = `<span class="library-folder-icon">▣</span><span><strong>${escapeHtml(folder.name)}</strong><small>${folderItemCount(libraryView.root, folder)} items</small></span><span class="folder-chevron">›</span>`;
        button.addEventListener("click", () => {
          libraryView.folderId = folder.id;
          renderDrillList();
          renderLibraryEditState();
        });
        els.drillList.appendChild(button);
      }
    }

    const allInRoot = libraryView.root === "builtin" ? builtInCatalog.drills : library.drills;
    const pool = query
      ? allInRoot.filter(drill => {
          const haystack = `${drill.name} ${drill.description || ""} ${(drill.tags || []).join(" ")} ${folderLabelForDrill(libraryView.root, drill)}`.toLowerCase();
          return haystack.includes(query);
        })
      : drillsInFolder(libraryView.root, libraryView.folderId);

    for (const drill of pool) {
      const source = libraryView.root;
      const card = document.createElement("article");
      card.className = "drill-library-card";
      const run = document.createElement("button");
      run.type = "button";
      run.className = "drill-library-open";
      const displayName = source === "builtin" ? builtInDisplayName(drill.name) : drill.name;
      const folderText = query ? folderLabelForDrill(source, drill) : "";
      const tagText = (drill.tags || []).slice(0, 3).join(" · ");
      run.innerHTML = `<span class="drill-card-copy"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(drill.description || tagText || `${drill.nodes.length} graph nodes`)}${folderText ? ` · ${escapeHtml(folderText)}` : ""}</small></span><span class="drill-card-action">Run ›</span>`;
      run.addEventListener("click", () => selectLibraryDrill(source, drill, "run"));

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "drill-card-edit";
      edit.setAttribute("aria-label", `Edit ${displayName}`);
      edit.title = source === "builtin" ? "View built-in drill" : "Edit drill";
      edit.textContent = "✎";
      edit.addEventListener("click", event => {
        event.stopPropagation();
        selectLibraryDrill(source, drill, "editor");
      });
      card.append(run, edit);
      els.drillList.appendChild(card);
    }

    if (!els.drillList.childElementCount) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.innerHTML = libraryView.root === "user"
        ? `<strong>${query ? "No matching drills" : "This folder is empty"}</strong><span>${query ? "Try another search." : "Create a drill or folder here."}</span>`
        : `<strong>No matching presets</strong><span>Try another search.</span>`;
      els.drillList.appendChild(empty);
    }
    renderLibraryEditState();
  }

  function renderLibraryEditState() {
    if (!library || !builtInCatalog) return;
    const builtIn = isActiveBuiltIn();
    const currentFolder = libraryView.root === "user" ? folderById("user", libraryView.folderId) : null;
    els.newDrillBtn.hidden = false;
    els.newFolderBtn.hidden = libraryView.root !== "user";
    els.renameFolderBtn.hidden = libraryView.root !== "user" || !currentFolder;
    els.deleteFolderBtn.hidden = libraryView.root !== "user" || !currentFolder;
    els.copyBuiltInBtn.hidden = !builtIn;
    els.duplicateDrillBtn.hidden = builtIn;
    els.moveDrillBtn.hidden = builtIn;
    els.deleteDrillBtn.hidden = builtIn;

    els.drillNameInput.disabled = builtIn;
    els.addShotBtn.disabled = builtIn;
    els.addRandomBtn.disabled = builtIn;
    els.addDrillNodeBtn.disabled = builtIn;
    els.addCounterBtn.disabled = builtIn;
    els.deleteSelectionBtn.disabled = builtIn;

    const inspector = els.inspectorContent;
    inspector.querySelectorAll("input,select,textarea,button").forEach(control => {
      if (!control.classList.contains("builtin-copy-inline")) control.disabled = builtIn;
    });
    inspector.querySelector(".builtin-readonly-note")?.remove();
    if (builtIn && activeDrill()) {
      const note = document.createElement("div");
      note.className = "builtin-readonly-note";
      note.innerHTML = `<div><strong>Built-in preset</strong><span>Play, preview and Live tuning are available. Copy it to My drills before editing the graph or shot settings.</span></div>`;
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "button compact primary builtin-copy-inline";
      copy.textContent = "Copy to My drills";
      copy.addEventListener("click", copyActiveBuiltInToMyDrills);
      note.appendChild(copy);
      inspector.prepend(note);
    }

    const builtInCount = builtInCatalog.drills.length;
    const userCount = library.drills.length;
    els.libraryStatus.textContent = `${builtInCount} built-in · ${userCount} My drill${userCount === 1 ? "" : "s"}`;
  }

  function nodeHeightKey(drill, node) {
    return `${drill?.id || "drill"}:${node?.id || "node"}`;
  }

  function estimatedNodeHeight(drill, node) {
    if (node.type === "shot") return 222;
    if (node.type === "random") return Math.max(112, 74 + (outgoing(drill, node.id).length + 1) * 27);
    if (node.type === "counter") return 116;
    return 112;
  }

  function nodeMinimumHeight(drill, node) {
    // Branch handles are positioned around the outside of Random/Repeater cards, so
    // these two types need enough body height for their ports even when their text is short.
    if (node.type === "random") return Math.max(108, 74 + (outgoing(drill, node.id).length + 1) * 27);
    if (node.type === "counter") return 108;
    return 0;
  }

  function nodeHeight(drill, node) {
    return nodeHeightCache.get(nodeHeightKey(drill, node)) || estimatedNodeHeight(drill, node);
  }

  function measureRenderedNodeHeights(drill) {
    let changed = false;
    els.nodeLayer.querySelectorAll(".flow-node[data-node-id]").forEach(article => {
      const node = getNode(drill, article.dataset.nodeId);
      if (!node) return;
      const measured = Math.max(1, Math.ceil(article.offsetHeight));
      const key = nodeHeightKey(drill, node);
      if (Math.abs((nodeHeightCache.get(key) || 0) - measured) > 1) {
        nodeHeightCache.set(key, measured);
        changed = true;
      }
    });
    return changed;
  }

  function mobileGraphLayoutEnabled() {
    return Boolean(globalThis.matchMedia?.("(max-width: 760px)")?.matches);
  }

  function mobileLayoutMap(drill) {
    const map = new Map();
    if (!drill?.nodes?.length) return map;

    // Layer the graph by distance from START. Nodes in the same branch depth share
    // a row and are spread horizontally. This keeps the mobile reading direction
    // vertical while preventing sibling branches from being drawn on top of each other.
    const depth = new Map();
    const start = getNode(drill, drill.startNodeId);
    const queue = [];
    if (start) { depth.set(start.id, 0); queue.push(start); }
    while (queue.length) {
      const node = queue.shift();
      const d = depth.get(node.id) || 0;
      for (const edge of outgoing(drill, node.id)) {
        const target = getNode(drill, edge.target);
        if (!target || depth.has(target.id)) continue;
        depth.set(target.id, d + 1);
        queue.push(target);
      }
    }

    let orphanDepth = Math.max(0, ...depth.values()) + 1;
    for (const node of drill.nodes) {
      if (!depth.has(node.id)) depth.set(node.id, orphanDepth++);
    }

    const levels = new Map();
    for (const node of drill.nodes) {
      const d = depth.get(node.id) || 0;
      if (!levels.has(d)) levels.set(d, []);
      levels.get(d).push(node);
    }

    let y = 180;
    const horizontalGap = 48;
    const verticalGap = 92;
    for (const d of [...levels.keys()].sort((a,b) => a-b)) {
      const nodes = levels.get(d).slice().sort((a,b) => (a.y - b.y) || (a.x - b.x));
      const totalWidth = nodes.length * NODE_WIDTH + Math.max(0, nodes.length - 1) * horizontalGap;
      const startX = clamp(MOBILE_LAYOUT_CENTER_X - totalWidth / 2, 40, SURFACE_WIDTH - totalWidth - 40, 40);
      let levelHeight = 0;
      nodes.forEach((node, index) => {
        map.set(node.id, { x: startX + index * (NODE_WIDTH + horizontalGap), y });
        levelHeight = Math.max(levelHeight, nodeHeight(drill, node));
      });
      y += levelHeight + verticalGap;
    }
    return map;
  }

  function desktopBuiltInLayoutMap(drill) {
    const map = new Map();
    if (!drill?.nodes?.length) return map;

    const depth = new Map();
    const start = getNode(drill, drill.startNodeId);
    const queue = [];
    if (start) { depth.set(start.id, 0); queue.push(start); }
    while (queue.length) {
      const node = queue.shift();
      const d = depth.get(node.id) || 0;
      for (const edge of outgoing(drill, node.id)) {
        const target = getNode(drill, edge.target);
        if (!target || depth.has(target.id)) continue;
        depth.set(target.id, d + 1);
        queue.push(target);
      }
    }
    let orphanDepth = Math.max(0, ...depth.values()) + 1;
    for (const node of drill.nodes) if (!depth.has(node.id)) depth.set(node.id, orphanDepth++);

    const levels = new Map();
    for (const node of drill.nodes) {
      const d = depth.get(node.id) || 0;
      if (!levels.has(d)) levels.set(d, []);
      levels.get(d).push(node);
    }

    const x0 = 300;
    const horizontalGap = 130;
    const verticalGap = 52;
    const centerY = SURFACE_HEIGHT / 2;
    for (const d of [...levels.keys()].sort((a,b) => a-b)) {
      const nodes = levels.get(d).slice().sort((a,b) => (a.y - b.y) || (a.x - b.x));
      const totalHeight = nodes.reduce((sum,node) => sum + nodeHeight(drill,node), 0) + Math.max(0,nodes.length-1) * verticalGap;
      let y = clamp(centerY - totalHeight / 2, MIN_NODE_Y, SURFACE_HEIGHT - totalHeight - MIN_NODE_Y, MIN_NODE_Y);
      for (const node of nodes) {
        map.set(node.id, { x: x0 + d * (NODE_WIDTH + horizontalGap), y });
        y += nodeHeight(drill,node) + verticalGap;
      }
    }
    return map;
  }

  function visualNodePosition(drill, node) {
    if (mobileGraphLayoutEnabled()) return mobileLayoutMap(drill).get(node.id) || { x: MOBILE_LAYOUT_CENTER_X - NODE_WIDTH / 2, y: node.y };
    // Built-in presets are read-only, so a deterministic layered layout is safer
    // than preserving old hand-authored coordinates that may no longer fit compact cards.
    if (isActiveBuiltIn()) return desktopBuiltInLayoutMap(drill).get(node.id) || { x: node.x, y: node.y };
    return { x: node.x, y: node.y };
  }

  function syntheticEndpointPositions(drill) {
    const positions = drill.nodes.map(node => ({ node, ...visualNodePosition(drill, node) }));
    if (!positions.length) return mobileGraphLayoutEnabled()
      ? { start: { x: MOBILE_LAYOUT_CENTER_X, y: 120 }, end: { x: MOBILE_LAYOUT_CENTER_X, y: 330 } }
      : { start: { x: 90, y: 300 }, end: { x: 500, y: 300 } };
    if (mobileGraphLayoutEnabled()) {
      const minY = Math.min(...positions.map(p => p.y));
      const maxY = Math.max(...positions.map(p => p.y + nodeHeight(drill, p.node)));
      return { start: { x: MOBILE_LAYOUT_CENTER_X, y: Math.max(40, minY - 95) }, end: { x: MOBILE_LAYOUT_CENTER_X, y: maxY + 75 } };
    }
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + NODE_WIDTH));
    const startNode = getNode(drill, drill.startNodeId);
    const sp = startNode ? visualNodePosition(drill, startNode) : positions[0];
    return { start: { x: Math.max(30, minX - 120), y: sp.y + nodeHeight(drill, startNode || positions[0].node)/2 - 22 }, end: { x: maxX + 90, y: sp.y + 20 } };
  }

  function outputPosition(drill, node, edge = null, slot = null, add = false) {
    const h = nodeHeight(drill, node);
    const pos = visualNodePosition(drill, node);
    if (mobileGraphLayoutEnabled()) {
      if (node.type === "counter") {
        const actualSlot = slot || edge?.sourceSlot || "A";
        return { x: pos.x + (actualSlot === "A" ? NODE_WIDTH * .36 : NODE_WIDTH * .64), y: pos.y + h };
      }
      if (node.type === "random") {
        const edges = outgoing(drill, node.id);
        const index = add ? edges.length : Math.max(0, edges.findIndex(e => e.id === edge?.id));
        const count = Math.max(1, edges.length + (add ? 1 : 0));
        return { x: pos.x + NODE_WIDTH * ((index + 1) / (count + 1)), y: pos.y + h };
      }
      return { x: pos.x + NODE_WIDTH / 2, y: pos.y + h };
    }
    if (node.type === "shot" || node.type === "drill") return { x: pos.x + NODE_WIDTH, y: pos.y + h / 2 };
    if (node.type === "counter") {
      const actualSlot = slot || edge?.sourceSlot || "A";
      return { x: pos.x + NODE_WIDTH, y: pos.y + (actualSlot === "A" ? 51 : 86) };
    }
    const edges = outgoing(drill, node.id);
    const index = add ? edges.length : Math.max(0, edges.findIndex(e => e.id === edge?.id));
    return { x: pos.x + NODE_WIDTH, y: pos.y + 61 + index * 27 };
  }

  function renderSyntheticEndpoints(drill) {
    const points = syntheticEndpointPositions(drill);
    const makeTerminal = (kind, label, point) => {
      const el = document.createElement("div");
      el.className = `flow-terminal ${kind}`;
      el.textContent = label;
      el.style.left = `${point.x - 55}px`;
      el.style.top = `${point.y - 22}px`;
      els.nodeLayer.appendChild(el);
      return el;
    };
    makeTerminal("start", "START", points.start);
    makeTerminal("end", "END", points.end);

    const drawSynthetic = (from, to) => {
      const mobile = mobileGraphLayoutEnabled();
      const d = mobile
        ? `M ${from.x} ${from.y} C ${from.x} ${from.y + 38}, ${to.x} ${to.y - 38}, ${to.x} ${to.y}`
        : `M ${from.x} ${from.y} C ${from.x + 45} ${from.y}, ${to.x - 45} ${to.y}, ${to.x} ${to.y}`;
      els.edgeLayer.appendChild(svg("path", { d, class: "synthetic-edge", "marker-end": "url(#arrow)" }));
    };

    const startNode = getNode(drill, drill.startNodeId);
    if (startNode) {
      const pos = visualNodePosition(drill, startNode);
      const target = mobileGraphLayoutEnabled()
        ? { x: pos.x + NODE_WIDTH / 2, y: pos.y }
        : { x: pos.x, y: pos.y + nodeHeight(drill, startNode) / 2 };
      const from = mobileGraphLayoutEnabled()
        ? { x: points.start.x, y: points.start.y + 22 }
        : { x: points.start.x + 55, y: points.start.y };
      drawSynthetic(from, target);
    } else {
      const from = mobileGraphLayoutEnabled() ? { x: points.start.x, y: points.start.y + 22 } : { x: points.start.x + 55, y: points.start.y };
      const to = mobileGraphLayoutEnabled() ? { x: points.end.x, y: points.end.y - 22 } : { x: points.end.x - 55, y: points.end.y };
      drawSynthetic(from, to);
    }

    const terminals = drill.nodes.filter(node => outgoing(drill, node.id).length === 0);
    terminals.forEach((node, index) => {
      const pos = visualNodePosition(drill, node);
      const from = mobileGraphLayoutEnabled()
        ? { x: pos.x + NODE_WIDTH / 2, y: pos.y + nodeHeight(drill, node) }
        : { x: pos.x + NODE_WIDTH, y: pos.y + nodeHeight(drill, node) / 2 };
      const to = mobileGraphLayoutEnabled()
        ? { x: points.end.x + (index - (terminals.length - 1)/2) * 12, y: points.end.y - 22 }
        : { x: points.end.x - 55, y: points.end.y + (index - (terminals.length - 1)/2) * 10 };
      drawSynthetic(from, to);
    });
  }

  function renderGraph(heightReflowPass = false) {
    const drill = activeDrill();
    els.nodeLayer.replaceChildren();
    els.edgeLayer.replaceChildren();
    if (!drill) return;

    for (const node of drill.nodes) {
      const article = document.createElement("article");
      article.className = `flow-node ${node.type}`;
      article.dataset.nodeId = node.id;
      const displayPos = visualNodePosition(drill, node);
      article.style.left = `${displayPos.x}px`;
      article.style.top = `${displayPos.y}px`;
      const minHeight = nodeMinimumHeight(drill, node);
      if (minHeight) article.style.minHeight = `${minHeight}px`;
      if (selection?.kind === "node" && selection.id === node.id) article.classList.add("selected");
      if (activeNodeRef?.drillId === drill.id && activeNodeRef?.nodeId === node.id) article.classList.add("playing");

      const band = document.createElement("div");
      band.className = "node-band";
      article.appendChild(band);

      const body = document.createElement("div");
      body.className = "node-body";
      const titleRow = document.createElement("div");
      titleRow.className = "node-title-row";
      const title = document.createElement("h3");
      title.className = "node-title";
      title.textContent = node.label;
      const kind = document.createElement("span");
      kind.className = "node-kind";
      kind.textContent = node.type === "shot" ? "Shot" : node.type === "random" ? "Random" : node.type === "drill" ? "Sub-drill" : "Repeater";
      titleRow.append(title, kind);
      body.appendChild(titleRow);

      const summary = document.createElement("div");
      summary.className = "node-summary";
      if (node.type === "shot") {
        const p = node.params;
        const prediction = predictTrajectory(p);
        summary.innerHTML = `
          <div class="shot-metrics">
            <span class="shot-metric speed-metric" title="Ball speed"><span class="metric-icon speed-icon" aria-hidden="true"><span class="speed-ball"></span></span><span class="shot-metric-value">${fmt(p.speedMps,1)}</span><span class="shot-metric-unit">m/s</span></span>
            <span class="shot-metric spin-metric" title="${p.spinRps < 0 ? "Underspin" : p.spinRps > 0 ? "Topspin" : "No spin"}"><span class="metric-icon spin-ball-icon ${p.spinRps < 0 ? "underspin" : p.spinRps > 0 ? "topspin" : "no-spin"}" aria-hidden="true"><span class="spin-ball-core"></span></span><span class="spin-direction-symbol ${p.spinRps < 0 ? "underspin" : p.spinRps > 0 ? "topspin" : "no-spin"}" aria-hidden="true">${p.spinRps < 0 ? "↓" : p.spinRps > 0 ? "↑" : "•"}</span><span class="shot-metric-value">${fmt(Math.abs(p.spinRps),1)}</span><span class="shot-metric-unit">rps</span></span>
          </div>
          <span class="clearance-chip">${clearanceHtml(prediction)}</span>`;
        body.appendChild(summary);
        const mini = document.createElement("div");
        mini.className = "mini-trajectory-grid";
        mini.innerHTML = `${miniTopTrajectorySvg(prediction)}${miniSideTrajectorySvg(prediction)}`;
        body.appendChild(mini);
      } else if (node.type === "random") {
        const branches = outgoing(drill, node.id);
        summary.innerHTML = `<strong>${branches.length} weighted paths</strong><br>${branches.length ? "One path is selected each visit" : "No path: set ends"}`;
        body.appendChild(summary);
      } else if (node.type === "drill") {
        const ref = getDrill(node.referencedDrillId);
        summary.innerHTML = `<strong>${escapeHtml(ref?.name || "Choose a drill")}</strong><br>Runs once, then continues`;
        body.appendChild(summary);
      } else {
        const runtime = runtimeCounterDisplay.get(`${drill.id}:${node.id}`);
        const shownCount = runtime == null ? node.startCount : runtime;
        const countLabel = runtime == null
          ? (shownCount === 1 ? "repetition" : "repetitions")
          : "remaining";
        summary.innerHTML = `<span class="repeater-count-chip">${shownCount}</span><span class="repeater-count-label">${countLabel}</span>`;
        body.appendChild(summary);
      }
      article.appendChild(body);

      const input = document.createElement("span");
      input.className = "port input";
      article.appendChild(input);

      renderOutputPorts(drill, node, article);

      article.addEventListener("pointerdown", onNodePointerDown);
      article.addEventListener("click", onNodeClick);
      els.nodeLayer.appendChild(article);
    }

    // Cards size themselves to their actual contents. Re-run once if a browser
    // measurement differs from the cached routing height so ports/edges/layout use
    // the same geometry as the visible card.
    if (measureRenderedNodeHeights(drill) && !heightReflowPass) {
      renderGraph(true);
      return;
    }

    renderEdges(drill);
    renderSyntheticEndpoints(drill);
  }

  function renderOutputPorts(drill, node, article) {
    if (node.type === "shot" || node.type === "drill") {
      const edge = outgoing(drill, node.id)[0] ?? null;
      article.appendChild(makePort(drill, node, edge, "next", false));
      return;
    }

    if (node.type === "counter") {
      for (const slot of ["A", "B"]) {
        const edge = edgeForSlot(drill, node.id, slot);
        const caption = document.createElement("span");
        caption.className = "port-caption";
        caption.style.top = `${slot === "A" ? 51 : 86}px`;
        caption.textContent = slot === "A" ? "Repeat" : "Finish";
        article.appendChild(caption);
        article.appendChild(makePort(drill, node, edge, slot, false));
      }
      return;
    }

    for (const edge of outgoing(drill, node.id)) article.appendChild(makePort(drill, node, edge, "branch", false));
    article.appendChild(makePort(drill, node, null, "branch", true));
  }

  function makePort(drill, node, edge, slot, add) {
    const pos = outputPosition(drill, node, edge, slot, add);
    const port = document.createElement("button");
    port.type = "button";
    port.className = `port output-port${add ? " add-port" : ""}${slot === "A" ? " slot-a" : ""}${slot === "B" ? " slot-b" : ""}`;
    const displayPos = visualNodePosition(drill, node);
    port.style.top = `${pos.y - displayPos.y}px`;
    if (mobileGraphLayoutEnabled()) {
      port.classList.add("vertical-port");
      port.style.left = `${pos.x - displayPos.x - 8}px`;
      port.style.right = "auto";
    }
    port.dataset.nodeId = node.id;
    port.dataset.edgeId = edge?.id || "";
    port.dataset.slot = slot;
    port.dataset.add = add ? "1" : "0";
    port.textContent = add ? "+" : slot === "A" ? "↻" : slot === "B" ? "✓" : "";
    port.title = edge ? "Drag to reconnect; drop in empty space to remove" : "Drag to create connection";
    port.addEventListener("pointerdown", onPortPointerDown);
    port.addEventListener("click", event => event.stopPropagation());
    return port;
  }

  function svg(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    return element;
  }

  function renderEdges(drill) {
    els.edgeLayer.replaceChildren();
    const defs = svg("defs");
    const marker = svg("marker", { id: "arrow", markerWidth: "10", markerHeight: "10", refX: "8", refY: "3", orient: "auto", markerUnits: "strokeWidth" });
    marker.appendChild(svg("path", { d: "M0,0 L0,6 L9,3 z", fill: "#75849a" }));
    defs.appendChild(marker);
    els.edgeLayer.appendChild(defs);

    const previousRoutes = [];
    const routed = [];

    // Routing order is permanently tied to the edge array, never selection.
    drill.edges.forEach((edge, index) => {
      const source = getNode(drill, edge.source);
      const target = getNode(drill, edge.target);
      if (!source || !target) return;
      const from = outputPosition(drill, source, edge, edge.sourceSlot, false);
      const targetPos = visualNodePosition(drill, target);
      const to = mobileGraphLayoutEnabled()
        ? { x: targetPos.x + NODE_WIDTH / 2, y: targetPos.y }
        : { x: targetPos.x, y: targetPos.y + nodeHeight(drill, target) / 2 };
      const route = mobileGraphLayoutEnabled()
        ? {
            points: [from, to],
            path: `M ${from.x} ${from.y} C ${from.x} ${from.y + 52}, ${to.x} ${to.y - 52}, ${to.x} ${to.y}`,
            label: { x: (from.x + to.x) / 2 + 34, y: (from.y + to.y) / 2 },
          }
        : routeEdge(drill, edge, from, to, previousRoutes, index);
      previousRoutes.push(route.points);
      routed.push({ edge, source, route });
    });

    // Painting order may change for emphasis, but routes do not.
    routed.sort((a, b) => {
      const aSelected = selection?.kind === "edge" && selection.id === a.edge.id ? 1 : 0;
      const bSelected = selection?.kind === "edge" && selection.id === b.edge.id ? 1 : 0;
      const aActive = activeEdgeRef?.drillId === drill.id && activeEdgeRef?.edgeId === a.edge.id ? 1 : 0;
      const bActive = activeEdgeRef?.drillId === drill.id && activeEdgeRef?.edgeId === b.edge.id ? 1 : 0;
      return (aSelected + aActive) - (bSelected + bActive);
    });

    for (const { edge, source, route } of routed) {
      const group = svg("g", { "data-edge-id": edge.id, class: "edge-group" });
      const underlay = svg("path", { d: route.path, class: "edge-underlay" });
      const hit = svg("path", { d: route.path, class: "edge-hit" });
      const path = svg("path", {
        d: route.path,
        class: `edge${selection?.kind === "edge" && selection.id === edge.id ? " selected" : ""}${activeEdgeRef?.drillId === drill.id && activeEdgeRef?.edgeId === edge.id ? " playing" : ""}`,
        "marker-end": "url(#arrow)"
      });
      group.append(underlay, hit, path);

      const labelParts = [];
      if (source.type === "random") labelParts.push(`w ${fmt(edge.weight)}`);
      if (source.type === "counter") labelParts.push(edge.sourceSlot === "A" ? "Repeat" : "Finish");
      labelParts.push(`${fmt(edge.delaySeconds, 2)}s`);
      const label = labelParts.join(" · ");
      const width = Math.max(44, 15 + label.length * 7);
      const rect = svg("rect", { x: String(route.label.x - width / 2), y: String(route.label.y - 11), width: String(width), height: "21", rx: "8", class: "edge-label-bg" });
      const text = svg("text", { x: String(route.label.x), y: String(route.label.y + 4), class: "edge-label" });
      text.textContent = label;
      group.append(rect, text);

      group.addEventListener("click", event => {
        event.stopPropagation();
        selection = { kind: "edge", id: edge.id };
        renderAll();
        openInspectorScreen();
      });
      els.edgeLayer.appendChild(group);
    }

    if (connectionDrag) {
      const source = getNode(drill, connectionDrag.sourceNodeId);
      if (source) {
        const edge = connectionDrag.edgeId ? getEdge(drill, connectionDrag.edgeId) : null;
        const from = outputPosition(drill, source, edge, connectionDrag.slot, connectionDrag.add);
        const to = connectionDrag.currentPoint;
        const path = `M ${from.x} ${from.y} C ${from.x + 90} ${from.y}, ${to.x - 90} ${to.y}, ${to.x} ${to.y}`;
        els.edgeLayer.appendChild(svg("path", { d: path, class: "temp-edge" }));
      }
    }
  }

  function routeEdge(drill, edge, from, to, previousRoutes, index) {
    const source = getNode(drill, edge.source);
    const target = getNode(drill, edge.target);
    const start = { x: from.x + 24, y: from.y };
    const end = { x: to.x - 24, y: to.y };
    const obstacles = drill.nodes
      .filter(node => node.id !== source?.id && node.id !== target?.id)
      .map(node => ({ x1: node.x - 18, y1: node.y - 18, x2: node.x + NODE_WIDTH + 18, y2: node.y + nodeHeight(drill, node) + 18 }));
    const candidates = [];
    const spread = [0, 42, -42, 84, -84, 126, -126];

    if (end.x - start.x > 55) {
      const middle = (start.x + end.x) / 2;
      for (const offset of spread) {
        const laneX = clamp(middle + offset + (index % 3 - 1) * 9, start.x + 18, end.x - 18, middle);
        candidates.push([from, start, { x: laneX, y: start.y }, { x: laneX, y: end.y }, end, to]);
      }
    }

    const top = Math.min(from.y, to.y) - 68;
    const bottom = Math.max(from.y, to.y) + 68;
    for (const offset of [0, 48, 96, 144]) {
      const yTop = Math.max(12, top - offset - (index % 3) * 8);
      const yBottom = Math.min(SURFACE_HEIGHT - 12, bottom + offset + (index % 3) * 8);
      candidates.push([from, start, { x: start.x, y: yTop }, { x: end.x, y: yTop }, end, to]);
      candidates.push([from, start, { x: start.x, y: yBottom }, { x: end.x, y: yBottom }, end, to]);
    }

    const rightLane = Math.min(SURFACE_WIDTH - 16, Math.max(from.x, to.x + NODE_WIDTH) + 70 + (index % 5) * 28);
    candidates.push([from, { x: rightLane, y: from.y }, { x: rightLane, y: to.y }, to]);

    let best = null;
    let bestScore = Infinity;
    for (const raw of candidates) {
      const points = simplifyOrthogonal(raw);
      const score = routeScore(points, obstacles, previousRoutes);
      if (score < bestScore) { bestScore = score; best = points; }
    }
    best ||= [from, to];
    return { points: best, path: roundedOrthogonalPath(best, 12), label: routeLabelPoint(best) };
  }

  function simplifyOrthogonal(points) {
    const compact = [];
    for (const point of points) {
      const last = compact.at(-1);
      if (!last || Math.abs(last.x - point.x) > .1 || Math.abs(last.y - point.y) > .1) compact.push({ ...point });
    }
    let changed = true;
    while (changed && compact.length > 2) {
      changed = false;
      for (let i = 1; i < compact.length - 1; i += 1) {
        const a = compact[i - 1], b = compact[i], c = compact[i + 1];
        if ((Math.abs(a.x - b.x) < .1 && Math.abs(b.x - c.x) < .1) || (Math.abs(a.y - b.y) < .1 && Math.abs(b.y - c.y) < .1)) {
          compact.splice(i, 1); changed = true; break;
        }
      }
    }
    return compact;
  }

  function routeScore(points, obstacles, previousRoutes) {
    let score = (points.length - 2) * 15;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i], b = points[i + 1];
      score += Math.hypot(b.x - a.x, b.y - a.y) * .02;
      for (const box of obstacles) if (segmentHitsBox(a, b, box)) score += 10000;
      for (const route of previousRoutes) {
        for (let j = 0; j < route.length - 1; j += 1) score += segmentConflict(a, b, route[j], route[j + 1]);
      }
    }
    return score;
  }

  function segmentHitsBox(a, b, box) {
    if (Math.abs(a.y - b.y) < .1) {
      const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
      return a.y >= box.y1 && a.y <= box.y2 && maxX >= box.x1 && minX <= box.x2;
    }
    if (Math.abs(a.x - b.x) < .1) {
      const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      return a.x >= box.x1 && a.x <= box.x2 && maxY >= box.y1 && minY <= box.y2;
    }
    return false;
  }

  function segmentConflict(a, b, c, d) {
    const aHorizontal = Math.abs(a.y - b.y) < .1;
    const cHorizontal = Math.abs(c.y - d.y) < .1;
    if (aHorizontal && cHorizontal && Math.abs(a.y - c.y) < 8) {
      const overlap = Math.min(Math.max(a.x,b.x), Math.max(c.x,d.x)) - Math.max(Math.min(a.x,b.x), Math.min(c.x,d.x));
      return overlap > 0 ? 220 + overlap * .4 : 0;
    }
    if (!aHorizontal && !cHorizontal && Math.abs(a.x - c.x) < 8) {
      const overlap = Math.min(Math.max(a.y,b.y), Math.max(c.y,d.y)) - Math.max(Math.min(a.y,b.y), Math.min(c.y,d.y));
      return overlap > 0 ? 220 + overlap * .4 : 0;
    }
    const h1 = aHorizontal ? [a,b] : cHorizontal ? [c,d] : null;
    const v1 = !aHorizontal ? [a,b] : !cHorizontal ? [c,d] : null;
    if (h1 && v1) {
      const hx1 = Math.min(h1[0].x,h1[1].x), hx2 = Math.max(h1[0].x,h1[1].x);
      const vy1 = Math.min(v1[0].y,v1[1].y), vy2 = Math.max(v1[0].y,v1[1].y);
      if (v1[0].x >= hx1 && v1[0].x <= hx2 && h1[0].y >= vy1 && h1[0].y <= vy2) return 45;
    }
    return 0;
  }

  function roundedOrthogonalPath(points, radius) {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = points[i - 1], current = points[i], next = points[i + 1];
      const inLength = Math.hypot(current.x - prev.x, current.y - prev.y);
      const outLength = Math.hypot(next.x - current.x, next.y - current.y);
      const r = Math.min(radius, inLength / 2, outLength / 2);
      const before = { x: current.x + (prev.x - current.x) / (inLength || 1) * r, y: current.y + (prev.y - current.y) / (inLength || 1) * r };
      const after = { x: current.x + (next.x - current.x) / (outLength || 1) * r, y: current.y + (next.y - current.y) / (outLength || 1) * r };
      path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
    }
    const last = points.at(-1);
    path += ` L ${last.x} ${last.y}`;
    return path;
  }

  function routeLabelPoint(points) {
    let best = { length: -1, a: points[0], b: points.at(-1) };
    for (let i = 1; i < points.length - 2; i += 1) {
      const a = points[i], b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > best.length) best = { length, a, b };
    }
    return { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 - 10 };
  }

  function applyGraphZoom(nextZoom, anchorClientX = null, anchorClientY = null) {
    const oldZoom = graphZoom;
    const zoom = clamp(nextZoom, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM, oldZoom);
    if (Math.abs(zoom - oldZoom) < 0.0001) return;

    const viewportRect = els.graphViewport.getBoundingClientRect();
    const anchorX = anchorClientX == null
      ? els.graphViewport.clientWidth / 2
      : anchorClientX - viewportRect.left;
    const anchorY = anchorClientY == null
      ? els.graphViewport.clientHeight / 2
      : anchorClientY - viewportRect.top;

    // Keep the world coordinate underneath the pointer fixed while scaling.
    const worldX = (els.graphViewport.scrollLeft + anchorX) / oldZoom;
    const worldY = (els.graphViewport.scrollTop + anchorY) / oldZoom;

    graphZoom = zoom;
    els.graphWorld.style.transform = `scale(${graphZoom})`;
    els.graphSurface.style.width = `${SURFACE_WIDTH * graphZoom}px`;
    els.graphSurface.style.height = `${SURFACE_HEIGHT * graphZoom}px`;
    els.zoomIndicator.textContent = `${Math.round(graphZoom * 100)}%`;

    els.graphViewport.scrollLeft = worldX * graphZoom - anchorX;
    els.graphViewport.scrollTop = worldY * graphZoom - anchorY;
  }

  function onGraphWheel(event) {
    if (nodeDrag || connectionDrag || canvasPan || poseDrag) return;
    event.preventDefault();

    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= els.graphViewport.clientHeight;

    // Exponential scaling behaves well for both wheel notches and trackpads.
    const factor = Math.exp(-delta * 0.00145);
    applyGraphZoom(graphZoom * factor, event.clientX, event.clientY);
  }

  function isCanvasBackgroundTarget(target) {
    if (!(target instanceof Element)) return false;
    return !target.closest(".flow-node, .edge-group, .output-port");
  }

  function onCanvasPointerDown(event) {
    if (event.button !== 0) return;
    if (nodeDrag || connectionDrag || poseDrag) return;
    if (!isCanvasBackgroundTarget(event.target)) return;

    canvasPan = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: els.graphViewport.scrollLeft,
      startScrollTop: els.graphViewport.scrollTop,
      moved: false,
    };

    els.graphViewport.classList.add("panning");
    els.graphViewport.setPointerCapture?.(event.pointerId);
    document.addEventListener("pointermove", onCanvasPointerMove);
    document.addEventListener("pointerup", onCanvasPointerUp, { once: true });
  }

  function onCanvasPointerMove(event) {
    if (!canvasPan || event.pointerId !== canvasPan.pointerId) return;
    const dx = event.clientX - canvasPan.startClientX;
    const dy = event.clientY - canvasPan.startClientY;

    if (!canvasPan.moved && Math.hypot(dx, dy) >= 4) {
      canvasPan.moved = true;
    }
    if (!canvasPan.moved) return;

    event.preventDefault();
    els.graphViewport.scrollLeft = canvasPan.startScrollLeft - dx;
    els.graphViewport.scrollTop = canvasPan.startScrollTop - dy;
  }

  function onCanvasPointerUp(event) {
    document.removeEventListener("pointermove", onCanvasPointerMove);
    if (!canvasPan) return;

    if (canvasPan.moved) {
      // Prevent the synthetic click after a drag from clearing selection.
      suppressClickUntil = performance.now() + 180;
    }

    els.graphViewport.releasePointerCapture?.(canvasPan.pointerId);
    els.graphViewport.classList.remove("panning");
    canvasPan = null;
  }

  function onNodePointerDown(event) {
    if (event.button !== 0 || event.target.closest(".output-port")) return;
    const article = event.currentTarget;
    const drill = activeDrill();
    const node = getNode(drill, article.dataset.nodeId);
    if (!node) return;
    if (!activeDrillEditable() || mobileGraphLayoutEnabled()) {
      selection = { kind: "node", id: node.id };
      renderAll();
      openInspectorScreen();
      return;
    }
    event.preventDefault();
    selection = { kind: "node", id: node.id };
    nodeDrag = {
      nodeId: node.id,
      article,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      moved: false,
    };
    article.setPointerCapture?.(event.pointerId);
    document.addEventListener("pointermove", onNodePointerMove);
    document.addEventListener("pointerup", onNodePointerUp, { once: true });
    renderInspector();
  }

  function onNodePointerMove(event) {
    if (!nodeDrag || event.pointerId !== nodeDrag.pointerId) return;
    const drill = activeDrill();
    const node = getNode(drill, nodeDrag.nodeId);
    if (!node) return;
    const screenDx = event.clientX - nodeDrag.startClientX;
    const screenDy = event.clientY - nodeDrag.startClientY;
    if (Math.abs(screenDx) > 2 || Math.abs(screenDy) > 2) nodeDrag.moved = true;
    const dx = screenDx / graphZoom;
    const dy = screenDy / graphZoom;
    node.x = clamp(nodeDrag.startX + dx, 0, SURFACE_WIDTH - NODE_WIDTH, node.x);
    node.y = clamp(nodeDrag.startY + dy, MIN_NODE_Y, SURFACE_HEIGHT - nodeHeight(drill, node), node.y);
    nodeDrag.article.style.left = `${node.x}px`;
    nodeDrag.article.style.top = `${node.y}px`;
    renderEdges(drill);
  }

  function onNodePointerUp() {
    document.removeEventListener("pointermove", onNodePointerMove);
    if (nodeDrag?.moved) {
      suppressClickUntil = performance.now() + 120;
      saveLibrary();
    }
    nodeDrag = null;
  }

  function onNodeClick(event) {
    event.stopPropagation();
    if (performance.now() < suppressClickUntil) return;
    selection = { kind: "node", id: event.currentTarget.dataset.nodeId };
    renderAll();
    openInspectorScreen();
  }

  function onPortPointerDown(event) {
    if (event.button !== 0) return;
    if (!activeDrillEditable()) { toast("Built-in presets are read-only. Copy it to My drills to change paths."); return; }
    event.preventDefault();
    event.stopPropagation();
    const drill = activeDrill();
    const port = event.currentTarget;
    connectionDrag = {
      sourceNodeId: port.dataset.nodeId,
      edgeId: port.dataset.edgeId || null,
      slot: port.dataset.slot,
      add: port.dataset.add === "1",
      currentPoint: clientToSurface(event.clientX, event.clientY),
    };
    els.modeText.textContent = "Drop on a node to connect; drop in empty space to disconnect";
    document.addEventListener("pointermove", onConnectionPointerMove);
    document.addEventListener("pointerup", onConnectionPointerUp, { once: true });
    renderGraph();
  }

  function onConnectionPointerMove(event) {
    if (!connectionDrag) return;
    connectionDrag.currentPoint = clientToSurface(event.clientX, event.clientY);
    document.querySelectorAll(".flow-node.drop-target").forEach(el => el.classList.remove("drop-target"));
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest(".flow-node");
    targetElement?.classList.add("drop-target");
    renderEdges(activeDrill());
  }

  function onConnectionPointerUp(event) {
    document.removeEventListener("pointermove", onConnectionPointerMove);
    const drill = activeDrill();
    const drag = connectionDrag;
    connectionDrag = null;
    document.querySelectorAll(".flow-node.drop-target").forEach(el => el.classList.remove("drop-target"));
    els.modeText.textContent = "Drag background to pan · wheel to zoom";
    if (!drag || !drill) return;

    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest(".flow-node");
    const targetId = targetElement?.dataset.nodeId || null;
    const existing = drag.edgeId ? getEdge(drill, drag.edgeId) : null;

    if (!targetId) {
      if (existing) {
        drill.edges = drill.edges.filter(e => e.id !== existing.id);
        selection = null;
        commit({ message: "Path removed; this branch may now end the set" });
      } else renderAll();
      return;
    }

    if (existing) {
      existing.target = targetId;
      selection = { kind: "edge", id: existing.id };
      commit({ message: "Path reconnected" });
      return;
    }

    if ((drag.slot === "next" || drag.slot === "A" || drag.slot === "B") && edgeForSlot(drill, drag.sourceNodeId, drag.slot)) {
      toast("That output already has a path.");
      renderAll();
      return;
    }

    const edge = {
      id: makeId("edge"),
      source: drag.sourceNodeId,
      sourceSlot: drag.slot,
      target: targetId,
      weight: 1,
      delaySeconds: 0,
    };
    drill.edges.push(edge);
    selection = { kind: "edge", id: edge.id };
    commit({ message: "Path created" });
  }

  function clientToSurface(clientX, clientY) {
    const rect = els.graphWorld.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / graphZoom, 0, SURFACE_WIDTH, 0),
      y: clamp((clientY - rect.top) / graphZoom, 0, SURFACE_HEIGHT, 0),
    };
  }

  function rectanglesOverlap(a, b, margin = 0) {
    return !(
      a.x2 + margin <= b.x1 ||
      a.x1 >= b.x2 + margin ||
      a.y2 + margin <= b.y1 ||
      a.y1 >= b.y2 + margin
    );
  }

  function nodeRectangle(drill, node, x = node.x, y = node.y) {
    return {
      x1: x,
      y1: y,
      x2: x + NODE_WIDTH,
      y2: y + nodeHeight(drill, node),
    };
  }

  function findFreeNodePosition(drill, node) {
    const viewportLeft = els.graphViewport.scrollLeft / graphZoom;
    const viewportTop = els.graphViewport.scrollTop / graphZoom;
    const viewportWidth = els.graphViewport.clientWidth / graphZoom;
    const viewportHeight = els.graphViewport.clientHeight / graphZoom;
    const nodeH = nodeHeight(drill, node);
    const baseX = clamp(
      viewportLeft + viewportWidth / 2 - NODE_WIDTH / 2,
      0,
      SURFACE_WIDTH - NODE_WIDTH,
      200
    );
    const baseY = clamp(
      viewportTop + viewportHeight / 2 - nodeH / 2,
      MIN_NODE_Y,
      SURFACE_HEIGHT - nodeH,
      200
    );

    const existing = drill.nodes.map(candidate => nodeRectangle(drill, candidate));
    const xStep = NODE_WIDTH + 34;
    const yStep = Math.max(146, nodeH + 30);
    const candidates = [{ x: baseX, y: baseY }];

    // Expanding rectangular spiral around the viewport centre.
    for (let ring = 1; ring <= 9; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        candidates.push({ x: baseX + dx * xStep, y: baseY - ring * yStep });
        candidates.push({ x: baseX + dx * xStep, y: baseY + ring * yStep });
      }
      for (let dy = -ring + 1; dy <= ring - 1; dy += 1) {
        candidates.push({ x: baseX - ring * xStep, y: baseY + dy * yStep });
        candidates.push({ x: baseX + ring * xStep, y: baseY + dy * yStep });
      }
    }

    for (const raw of candidates) {
      const x = clamp(raw.x, 0, SURFACE_WIDTH - NODE_WIDTH, baseX);
      const y = clamp(raw.y, MIN_NODE_Y, SURFACE_HEIGHT - nodeH, baseY);
      const proposed = nodeRectangle(drill, node, x, y);
      if (existing.every(rect => !rectanglesOverlap(proposed, rect, 26))) {
        return { x, y };
      }
    }

    // Whole-surface fallback for a very dense graph.
    for (let y = MIN_NODE_Y; y <= SURFACE_HEIGHT - nodeH; y += yStep) {
      for (let x = 0; x <= SURFACE_WIDTH - NODE_WIDTH; x += xStep) {
        const proposed = nodeRectangle(drill, node, x, y);
        if (existing.every(rect => !rectanglesOverlap(proposed, rect, 20))) {
          return { x, y };
        }
      }
    }

    return { x: baseX, y: baseY };
  }

  function addNode(type, draft = {}) {
    if (!activeDrillEditable()) { toast("Copy this built-in preset to My drills before editing it."); return null; }
    let drill = activeDrill();
    if (!drill) {
      const created = defaultDrill("New drill");
      created.folderId = libraryView.root === "user" ? (libraryView.folderId || null) : null;
      library.drills.push(created);
      library.activeDrillSource = "user";
      library.activeDrillId = created.id;
      drill = created;
    }
    let node;
    if (type === "shot") {
      node = makeShot(drill, String(draft.label || "Shot"));
      node.params = {
        speedMps: clamp(draft.speedMps, 1, 20, node.params.speedMps),
        spinRps: clamp(draft.spinRps, -120, 120, node.params.spinRps),
        elevationDeg: clamp(draft.elevationDeg, -20, 45, node.params.elevationDeg),
        aimDeg: clamp(draft.aimDeg, -60, 60, node.params.aimDeg),
      };
    } else if (type === "random") {
      node = makeRandom(String(draft.label || "Weighted random"));
    } else if (type === "drill") {
      node = makeDrillNode(String(draft.label || "Sub-drill"), draft.referencedDrillId || allDrills().find(d => d.id !== drill.id)?.id || null);
    } else {
      node = makeCounter(String(draft.label || "Repeater"));
      node.startCount = Math.max(0, Math.round(finite(draft.startCount, 2)));
    }

    const selectedEdge = selection?.kind === "edge" ? getEdge(drill, selection.id) : null;
    const selectedNode = selection?.kind === "node" ? getNode(drill, selection.id) : null;
    const placement = findFreeNodePosition(drill, node);
    node.x = placement.x;
    node.y = placement.y;
    drill.nodes.push(node);

    if (!drill.startNodeId) {
      drill.startNodeId = node.id;
    } else if (selectedEdge) {
      const oldTarget = selectedEdge.target;
      selectedEdge.target = node.id;
      drill.edges.push({ id: makeId("edge"), source: node.id, sourceSlot: node.type === "counter" ? "B" : node.type === "random" ? "branch" : "next", target: oldTarget, weight: 1, delaySeconds: 0 });
    } else if (selectedNode) {
      if (selectedNode.type === "random") {
        drill.edges.push({ id: makeId("edge"), source: selectedNode.id, sourceSlot: "branch", target: node.id, weight: 1, delaySeconds: 0 });
      } else if (!outgoing(drill, selectedNode.id).length) {
        drill.edges.push({ id: makeId("edge"), source: selectedNode.id, sourceSlot: selectedNode.type === "counter" ? "B" : "next", target: node.id, weight: 1, delaySeconds: 0 });
      }
    }

    selection = { kind: "node", id: node.id };
    commit({ message: `${node.label} added` });
    openInspectorScreen();
    return node;
  }

  function openAddNodeMenu() {
    if (!activeDrillEditable()) { toast("Copy this built-in preset to My drills before editing it."); return; }
    addNodeDraftType = null;
    els.addNodeDialogTitle.textContent = "Add to drill";
    els.addNodeDialogSubtitle.textContent = selection?.kind === "edge" ? "The new step will be inserted into the selected path." : selection?.kind === "node" ? "The new step will be connected after the selected node when possible." : "Choose what to add.";
    els.addNodeChoicePanel.hidden = false;
    els.addNodeConfigPanel.hidden = true;
    els.addNodeConfigPanel.replaceChildren();
    els.addNodeDialog.showModal();
  }

  function newShotPreviewHtml(params) {
    const prediction = predictTrajectory(params);
    return `<div class="new-shot-preview"><div><small>Top view</small>${topTrajectorySvg(prediction, 600, 250)}</div><div><small>Side view</small>${sideTrajectorySvg(prediction, 600, 230)}</div></div>`;
  }

  function openAddNodeConfig(type) {
    addNodeDraftType = type;
    els.addNodeChoicePanel.hidden = true;
    els.addNodeConfigPanel.hidden = false;
    const titles = { shot: "Add shot", random: "Add random choice", counter: "Add repeat / loop", drill: "Add sub-drill" };
    els.addNodeDialogTitle.textContent = titles[type] || "Add node";
    els.addNodeDialogSubtitle.textContent = "Configure it first. Nothing is added until you press Add.";
    if (type === "shot") {
      const p = { speedMps: 5.84, spinRps: 0, elevationDeg: 10.3, aimDeg: 0 };
      els.addNodeConfigPanel.innerHTML = `
        <label class="field"><span>Name</span><input id="newNodeNameField" type="text" maxlength="90" value="Shot"></label>
        <div class="shot-parameter-stack">
          <label class="field shot-parameter-row"><span>Ball speed</span><span class="numeric-stepper"><button class="stepper-button" type="button" data-create-step="newShotSpeedField" data-delta="-0.1">−</button><span class="input-with-unit"><input id="newShotSpeedField" type="number" min="1" max="20" step="0.1" value="${p.speedMps}"><small>m/s</small></span><button class="stepper-button" type="button" data-create-step="newShotSpeedField" data-delta="0.1">+</button></span></label>
          <label class="field shot-parameter-row"><span>Spin</span><span class="numeric-stepper"><button class="stepper-button" type="button" data-create-step="newShotSpinField" data-delta="-1">−</button><span class="input-with-unit"><input id="newShotSpinField" type="number" min="-120" max="120" step="1" value="0"><small>rps</small></span><button class="stepper-button" type="button" data-create-step="newShotSpinField" data-delta="1">+</button></span></label>
          <label class="field shot-parameter-row"><span>Elevation</span><span class="input-with-unit"><input id="newShotElevationField" type="number" min="-20" max="45" step="0.5" value="12.5"><small>°</small></span></label>
          <label class="field shot-parameter-row"><span>Aim left/right</span><span class="input-with-unit"><input id="newShotAimField" type="number" min="-60" max="60" step="0.5" value="0"><small>°</small></span></label>
        </div>
        <div id="newShotPreview">${newShotPreviewHtml(p)}</div>
        <div class="dialog-action-row"><button id="cancelCreateNodeBtn" class="button ghost" type="button">Cancel</button><button id="confirmCreateNodeBtn" class="button primary" type="button">Add shot</button></div>`;
      const refresh = () => {
        const params = { speedMps: finite($("newShotSpeedField")?.value, p.speedMps), spinRps: finite($("newShotSpinField")?.value, 0), elevationDeg: finite($("newShotElevationField")?.value, 12.5), aimDeg: finite($("newShotAimField")?.value, 0) };
        $("newShotPreview").innerHTML = newShotPreviewHtml(params);
      };
      ["newShotSpeedField","newShotSpinField","newShotElevationField","newShotAimField"].forEach(id => $(id)?.addEventListener("input", refresh));
      els.addNodeConfigPanel.querySelectorAll("[data-create-step]").forEach(button => button.addEventListener("click", () => {
        const input = $(button.dataset.createStep); if (!input) return;
        const next = finite(input.value, 0) + finite(button.dataset.delta, 0);
        input.value = String(Math.min(finite(input.max, Infinity), Math.max(finite(input.min, -Infinity), next)));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }));
    } else if (type === "random") {
      els.addNodeConfigPanel.innerHTML = `<label class="field"><span>Name</span><input id="newNodeNameField" type="text" maxlength="90" value="Weighted random"></label><p class="helper">After creating it, add branches from the node or use + with the random node selected.</p><div class="dialog-action-row"><button id="cancelCreateNodeBtn" class="button ghost" type="button">Cancel</button><button id="confirmCreateNodeBtn" class="button primary" type="button">Add random choice</button></div>`;
    } else if (type === "counter") {
      els.addNodeConfigPanel.innerHTML = `<label class="field"><span>Name</span><input id="newNodeNameField" type="text" maxlength="90" value="Repeater"></label><label class="field"><span>Starting repetitions</span><input id="newCounterStartField" type="number" min="0" max="100000" step="1" value="2"></label><div class="dialog-action-row"><button id="cancelCreateNodeBtn" class="button ghost" type="button">Cancel</button><button id="confirmCreateNodeBtn" class="button primary" type="button">Add repeater</button></div>`;
    } else {
      els.addNodeConfigPanel.innerHTML = `<label class="field"><span>Name</span><input id="newNodeNameField" type="text" maxlength="90" value="Sub-drill"></label><label class="field"><span>Reusable drill</span><select id="newReferencedDrillField">${drillOptions(null, activeDrill()?.id)}</select></label><div class="dialog-action-row"><button id="cancelCreateNodeBtn" class="button ghost" type="button">Cancel</button><button id="confirmCreateNodeBtn" class="button primary" type="button">Add sub-drill</button></div>`;
    }
    $("cancelCreateNodeBtn")?.addEventListener("click", () => { els.addNodeDialog.close(); });
    $("confirmCreateNodeBtn")?.addEventListener("click", () => {
      const draft = { label: $("newNodeNameField")?.value?.trim() || titles[type] };
      if (type === "shot") Object.assign(draft, { speedMps: finite($("newShotSpeedField")?.value, 5.97), spinRps: finite($("newShotSpinField")?.value, 0), elevationDeg: finite($("newShotElevationField")?.value, 12.5), aimDeg: finite($("newShotAimField")?.value, 0) });
      if (type === "counter") draft.startCount = finite($("newCounterStartField")?.value, 2);
      if (type === "drill") draft.referencedDrillId = $("newReferencedDrillField")?.value || null;
      addNode(type, draft);
      els.addNodeDialog.close();
    });
  }

  function deleteSelection() {
    if (!activeDrillEditable()) { toast("Built-in presets are read-only. Copy it to My drills to edit."); return; }
    const drill = activeDrill();
    if (!drill || !selection) return;
    if (selection.kind === "edge") {
      drill.edges = drill.edges.filter(e => e.id !== selection.id);
      selection = null;
      inspectorOpen = false;
      document.body.classList.remove("details-open");
      commit({ message: "Path removed" });
      return;
    }

    const node = getNode(drill, selection.id);
    if (!node) return;
    drill.nodes = drill.nodes.filter(n => n.id !== node.id);
    drill.edges = drill.edges.filter(e => e.source !== node.id && e.target !== node.id);
    for (const candidate of drill.nodes) {
      if (candidate.type === "counter") candidate.clearOnNodeIds = candidate.clearOnNodeIds.filter(id => id !== node.id);
    }
    if (drill.startNodeId === node.id) drill.startNodeId = drill.nodes[0]?.id ?? null;
    selection = null;
    inspectorOpen = false;
    document.body.classList.remove("details-open");
    commit({ message: `Deleted “${node.label}”` });
  }

  function renderInspector() {
    const drill = activeDrill();
    if (!drill || !selection) {
      els.inspectorContent.innerHTML = `<div class="empty-inspector"><h2>Inspector</h2><p>Select a node or connection.</p></div>`;
      return;
    }
    if (selection.kind === "edge") {
      const edge = getEdge(drill, selection.id);
      if (!edge) { selection = null; renderInspector(); return; }
      renderEdgeInspector(drill, edge);
      return;
    }
    const node = getNode(drill, selection.id);
    if (!node) { selection = null; renderInspector(); return; }
    renderNodeInspector(drill, node);
  }

  function nodeOptions(drill, selectedId = null, includeNone = true) {
    const options = [];
    if (includeNone) options.push(`<option value="">End set — no next node</option>`);
    for (const node of drill.nodes) {
      options.push(`<option value="${attr(node.id)}"${node.id === selectedId ? " selected" : ""}>${escapeHtml(node.label)} · ${node.type}</option>`);
    }
    return options.join("");
  }

  function drillOptions(selectedId, excludeId) {
    const rows = [`<option value="">Choose reusable drill</option>`];
    for (const drill of allDrills()) {
      if (drill.id === excludeId) continue;
      rows.push(`<option value="${attr(drill.id)}"${drill.id === selectedId ? " selected" : ""}>${escapeHtml(drill.name)}</option>`);
    }
    return rows.join("");
  }

  function renderNodeInspector(drill, node) {
    const typeName = node.type === "shot" ? "Single shot" : node.type === "random" ? "Weighted randomization" : node.type === "drill" ? "Reusable sub-drill" : "Repeater";
    let html = `
      <div class="inspector-heading">
        <div><h2>${escapeHtml(node.label)}</h2><p class="inspector-subtitle">${typeName}</p></div>
        <button id="setStartInspectorBtn" class="button compact ghost" type="button"${drill.startNodeId === node.id ? " disabled" : ""}>${drill.startNodeId === node.id ? "First step" : "Make first step"}</button>
      </div>
      <label class="field"><span>Name</span><input id="nodeNameField" type="text" maxlength="90" value="${attr(node.label)}"></label>
    `;

    if (node.type === "shot") html += shotInspectorHtml(node);
    else if (node.type === "random") html += randomInspectorHtml(drill, node);
    else if (node.type === "drill") html += drillNodeInspectorHtml(drill, node);
    else html += counterInspectorHtml(drill, node);

    html += incomingHtml(drill, node);
    els.inspectorContent.innerHTML = html;
    bindCommonInspector(drill, node);
    if (node.type === "shot") bindShotInspector(drill, node);
    else if (node.type === "random") bindRandomInspector(drill, node);
    else if (node.type === "drill") bindDrillNodeInspector(drill, node);
    else bindCounterInspector(drill, node);
  }

  function shotInspectorHtml(node) {
    const p = node.params;
    const prediction = predictTrajectory(p);
    const variation = node.variation?.enabled ? ShotVariation.normalizeVariation(node.variation, p, prediction.net?.clearanceM) : null;
    const nominalClearanceCm = Number.isFinite(prediction.net?.clearanceM) ? prediction.net.clearanceM * 100 : 8;
    return `
      <p class="spin-explainer"><strong>Spin:</strong> negative values mean underspin; positive values mean topspin. Rotations per second describe the ball directly.</p>
      ${liveTuningInlineHtml(p)}
      <div class="shot-parameter-stack">
        <label class="field shot-parameter-row"><span>Ball speed</span><span class="numeric-stepper"><button class="stepper-button" type="button" data-step-target="shotSpeedField" data-step-delta="-0.1" aria-label="Decrease ball speed by 0.1 metres per second">−</button><span class="input-with-unit"><input id="shotSpeedField" type="number" min="1" max="20" step="0.1" value="${p.speedMps}"><small>m/s</small></span><button class="stepper-button" type="button" data-step-target="shotSpeedField" data-step-delta="0.1" aria-label="Increase ball speed by 0.1 metres per second">+</button></span></label>
        <label class="field shot-parameter-row"><span>Spin</span><span class="numeric-stepper"><button class="stepper-button" type="button" data-step-target="shotSpinField" data-step-delta="-1" aria-label="Decrease ball rotation by 1 rotation per second">−</button><span class="input-with-unit"><input id="shotSpinField" type="number" min="-120" max="120" step="1" value="${p.spinRps}"><small>rps</small></span><button class="stepper-button" type="button" data-step-target="shotSpinField" data-step-delta="1" aria-label="Increase ball rotation by 1 rotation per second">+</button></span></label>
        <label class="field shot-parameter-row"><span>Elevation</span><span class="input-with-unit"><input id="shotElevationField" type="number" min="-20" max="45" step="0.5" value="${p.elevationDeg}"><small>°</small></span></label>
        <label class="field shot-parameter-row"><span>Aim left/right</span><span class="input-with-unit"><input id="shotAimField" type="number" min="-60" max="60" step="0.5" value="${p.aimDeg}"><small>°</small></span></label>
      </div>
      <div class="shot-view-stack">
        <div><p class="helper">Predicted top view</p>${topTrajectorySvg(prediction, 600, 280)}</div>
        <div><p class="helper">Predicted side view</p>${sideTrajectorySvg(prediction, 600, 300)}</div>
      </div>
      <div class="landing-card">${landingDescription(prediction)}</div>
      ${novaEstimateHtml(p)}
      <details class="shot-variation-section"${variation ? " open" : ""}>
        <summary><span><strong>Shot variation</strong><small>Sample only physically solved shots</small></span><input id="shotVariationEnabled" type="checkbox"${variation ? " checked" : ""} aria-label="Enable shot variation"></summary>
        <div class="shot-variation-body">
          <p class="helper">Landing position and net clearance are sampled as outcomes. Speed, spin, elevation and aim are solved together on the feasible shot manifold. Invalid targets are rejected, never clamped.</p>
          <div class="field-grid two">
            <label class="field"><span>Landing depth spread</span><span class="input-with-unit"><input id="variationDepthField" type="number" min="0" max="120" step="1" value="${variation?.placement.depthCm ?? 15}"><small>± cm</small></span></label>
            <label class="field"><span>Lateral spread</span><span class="input-with-unit"><input id="variationLateralField" type="number" min="0" max="120" step="1" value="${variation?.placement.lateralCm ?? 20}"><small>± cm</small></span></label>
            <label class="field"><span>Min net clearance</span><span class="input-with-unit"><input id="variationClearanceMinField" type="number" min="0.2" max="80" step="0.1" value="${variation?.clearance.minCm ?? fmt(nominalClearanceCm,1)}"><small>cm</small></span></label>
            <label class="field"><span>Max net clearance</span><span class="input-with-unit"><input id="variationClearanceMaxField" type="number" min="0.2" max="80" step="0.1" value="${variation?.clearance.maxCm ?? fmt(nominalClearanceCm,1)}"><small>cm</small></span></label>
            <label class="field"><span>Min speed</span><span class="input-with-unit"><input id="variationSpeedMinField" type="number" min="1" max="20" step="0.1" value="${variation?.speed.minMps ?? fmt(Math.max(1,p.speedMps-.6),1)}"><small>m/s</small></span></label>
            <label class="field"><span>Max speed</span><span class="input-with-unit"><input id="variationSpeedMaxField" type="number" min="1" max="20" step="0.1" value="${variation?.speed.maxMps ?? fmt(Math.min(20,p.speedMps+.6),1)}"><small>m/s</small></span></label>
            <label class="field"><span>Min spin</span><span class="input-with-unit"><input id="variationSpinMinField" type="number" min="-120" max="120" step="1" value="${variation?.spin.minRps ?? fmt(Math.max(-120,p.spinRps-5),0)}"><small>rps</small></span></label>
            <label class="field"><span>Max spin</span><span class="input-with-unit"><input id="variationSpinMaxField" type="number" min="-120" max="120" step="1" value="${variation?.spin.maxRps ?? fmt(Math.min(120,p.spinRps+5),0)}"><small>rps</small></span></label>
          </div>
          <button id="testShotVariationBtn" class="button ghost wide" type="button"${variation ? "" : " disabled"}>Test 12 varied shots</button>
          <p id="shotVariationTestResult" class="helper" aria-live="polite">${variation ? "Tap Test to measure feasibility and solve time on this device." : "Enable variation to configure and test this shot family."}</p>
        </div>
      </details>
      <section class="connection-section">
        <h3>Then…</h3>
        ${singleConnectionRowHtml(activeDrill(), node, outgoing(activeDrill(), node.id)[0] ?? null, "next")}
      </section>
    `;
  }

  function randomInspectorHtml(drill, node) {
    const rows = outgoing(drill, node.id).map(edge => randomConnectionRowHtml(drill, edge)).join("");
    return `
      <p class="helper">Every visit chooses one path using relative weights. Branches may lead to shots, counters, or reusable drills.</p>
      <div class="add-row">
        <label class="field"><span>Add path to</span><select id="randomAddTarget">${nodeOptions(drill, null, false)}</select></label>
        <button id="randomAddBtn" class="button" type="button">Add</button>
      </div>
      <section class="connection-section">
        <h3>Weighted paths</h3>
        <div id="randomRows">${rows || `<p class="helper">No paths. Reaching this node currently ends the set.</p>`}</div>
      </section>
    `;
  }

  function drillNodeInspectorHtml(drill, node) {
    return `
      <label class="field"><span>Reusable drill</span><select id="referencedDrillField">${drillOptions(node.referencedDrillId, drill.id)}</select></label>
      <p class="helper">The selected drill runs until its path ends. Execution then returns here and follows this node’s outgoing path.</p>
      <section class="connection-section">
        <h3>After sub-drill completes…</h3>
        ${singleConnectionRowHtml(drill, node, outgoing(drill, node.id)[0] ?? null, "next")}
      </section>
    `;
  }

  function counterInspectorHtml(drill, node) {
    const a = edgeForSlot(drill, node.id, "A");
    const b = edgeForSlot(drill, node.id, "B");
    const checkRows = drill.nodes
      .filter(candidate => candidate.id !== node.id)
      .map(candidate => `
        <label class="check-row">
          <input type="checkbox" data-clear-node="${attr(candidate.id)}"${node.clearOnNodeIds.includes(candidate.id) ? " checked" : ""}>
          <span>${escapeHtml(candidate.label)}</span>
        </label>
      `).join("");

    return `
      <div class="counter-state-card">If repetitions remain: subtract 1 and take Repeat. Otherwise reset to the starting value and take Finish. Repeater state resets for every set and every sub-drill call.</div>
      <label class="field"><span>Starting repetitions</span><input id="counterStartField" type="number" min="0" max="100000" step="1" value="${node.startCount}"></label>
      <section class="connection-section">
        <h3>Repeat output</h3>
        ${counterConnectionRowHtml(drill, node, a, "A")}
        <h3>Finish output</h3>
        ${counterConnectionRowHtml(drill, node, b, "B")}
      </section>
      <section class="connection-section">
        <h3>Reset when these nodes are triggered</h3>
        <p class="helper">Useful when another control-flow path should clear this Repeater’s memory.</p>
        <div class="check-list">${checkRows || `<p class="helper">No other nodes exist.</p>`}</div>
      </section>
    `;
  }

  function incomingHtml(drill, node) {
    const edges = incoming(drill, node.id);
    return `
      <section class="connection-section">
        <h3>Incoming paths</h3>
        ${edges.length ? edges.map(edge => {
          const source = getNode(drill, edge.source);
          return `<button class="button wide ghost incoming-edge-button" data-edge-id="${attr(edge.id)}" type="button">← ${escapeHtml(source?.label || "Missing")} · ${fmt(edge.delaySeconds,2)}s</button>`;
        }).join("") : `<p class="helper">No incoming paths.</p>`}
      </section>
    `;
  }

  function singleConnectionRowHtml(drill, node, edge, slot) {
    return `
      <div class="connection-row" data-edge-row="${attr(edge?.id || "")}">
        <label><span>Next node</span><select class="edge-target-field" data-edge-id="${attr(edge?.id || "")}" data-source-id="${attr(node.id)}" data-slot="${slot}">${nodeOptions(drill, edge?.target || null, true)}</select></label>
        <button class="remove-connection" data-remove-edge="${attr(edge?.id || "")}" type="button" title="Remove path"${edge ? "" : " disabled"}>×</button>
      </div>
      ${edge ? `<p class="edge-timing-help">Click the edge or its ${fmt(edge.delaySeconds,2)}s label on the canvas to edit timing.</p>` : ""}
    `;
  }

  function randomConnectionRowHtml(drill, edge) {
    return `
      <div class="connection-row four">
        <label><span>Weight</span><input class="edge-weight-field" data-edge-id="${attr(edge.id)}" type="number" min="0.01" max="100000" step="0.01" value="${edge.weight}"></label>
        <label><span>Target</span><select class="edge-target-field" data-edge-id="${attr(edge.id)}">${nodeOptions(drill, edge.target, false)}</select></label>
        <button class="remove-connection" data-remove-edge="${attr(edge.id)}" type="button">×</button>
      </div>
      <p class="edge-timing-help">Timing: ${fmt(edge.delaySeconds,2)}s. Click this edge on the canvas to change it.</p>
    `;
  }

  function counterConnectionRowHtml(drill, node, edge, slot) {
    return `
      <div class="connection-row" data-edge-row="${attr(edge?.id || "")}">
        <label><span>Target</span><select class="edge-target-field" data-edge-id="${attr(edge?.id || "")}" data-source-id="${attr(node.id)}" data-slot="${slot}">${nodeOptions(drill, edge?.target || null, true)}</select></label>
        <button class="remove-connection" data-remove-edge="${attr(edge?.id || "")}" type="button"${edge ? "" : " disabled"}>×</button>
      </div>
      ${edge ? `<p class="edge-timing-help">Click the ${slot === "A" ? "Repeat" : "Finish"} edge on the canvas to edit its ${fmt(edge.delaySeconds,2)}s delay.</p>` : ""}
    `;
  }

  function bindCommonInspector(drill, node) {
    $("setStartInspectorBtn")?.addEventListener("click", () => {
      drill.startNodeId = node.id;
      commit({ message: "Start node updated" });
    });
    $("nodeNameField")?.addEventListener("change", event => {
      const requested = event.target.value.trim() || typeDefaultName(node.type);
      node.label = node.type === "shot" ? uniqueShotName(drill, requested, node.id) : requested;
      if (node.type === "shot" && node.label !== requested) toast(`Shot renamed to “${node.label}” to keep names unique.`);
      commit();
    });
    els.inspectorContent.querySelectorAll(".incoming-edge-button").forEach(button => button.addEventListener("click", () => {
      selection = { kind: "edge", id: button.dataset.edgeId };
      renderAll();
    }));
  }

  function bindShotInspector(drill, node) {
    bindNumberField("shotSpeedField", value => node.params.speedMps = clamp(value, 1, 20, 8));
    bindNumberField("shotSpinField", value => node.params.spinRps = clamp(value, -120, 120, 0));
    bindNumberField("shotElevationField", value => node.params.elevationDeg = clamp(value, -20, 45, 4));
    bindNumberField("shotAimField", value => node.params.aimDeg = clamp(value, -60, 60, 0));
    $("shotVariationEnabled")?.addEventListener("change", event => {
      if (!event.target.checked) {
        node.variation = null;
      } else {
        const prediction = predictTrajectory(node.params);
        const clearanceCm = Number.isFinite(prediction.net?.clearanceM) ? prediction.net.clearanceM * 100 : 8;
        node.variation = ShotVariation.normalizeVariation({
          enabled: true,
          placement: { depthCm: 15, lateralCm: 20 },
          clearance: { minCm: clearanceCm, maxCm: clearanceCm },
          speed: { minMps: node.params.speedMps - .6, maxMps: node.params.speedMps + .6 },
          spin: { minRps: node.params.spinRps - 5, maxRps: node.params.spinRps + 5 },
        }, node.params, prediction.net?.clearanceM);
      }
      shotVariationCache.clear();
      commit();
    });
    const variationFields = [
      ["variationDepthField", ["placement", "depthCm"]],
      ["variationLateralField", ["placement", "lateralCm"]],
      ["variationClearanceMinField", ["clearance", "minCm"]],
      ["variationClearanceMaxField", ["clearance", "maxCm"]],
      ["variationSpeedMinField", ["speed", "minMps"]],
      ["variationSpeedMaxField", ["speed", "maxMps"]],
      ["variationSpinMinField", ["spin", "minRps"]],
      ["variationSpinMaxField", ["spin", "maxRps"]],
    ];
    variationFields.forEach(([id, path]) => $(id)?.addEventListener("change", event => {
      if (!node.variation?.enabled) return;
      node.variation[path[0]][path[1]] = finite(event.target.value, node.variation[path[0]][path[1]]);
      node.variation = ShotVariation.normalizeVariation(node.variation, node.params);
      shotVariationCache.clear();
      commit();
    }));
    $("testShotVariationBtn")?.addEventListener("click", () => {
      const output = $("shotVariationTestResult");
      if (!output) return;
      output.textContent = "Solving 12 varied shots…";
      setTimeout(() => {
        const profile = profileShotVariation(node, 12);
        output.textContent = profile.ok
          ? `${profile.accepted}/12 feasible · ${fmt(profile.elapsedMs,1)} ms total · ${fmt(profile.elapsedMs / Math.max(1, profile.accepted),1)} ms/shot · ${fmt(profile.evaluationsPerShot,1)} trajectory evaluations/shot.`
          : profile.reason;
      }, 0);
    });
    els.inspectorContent.querySelectorAll("[data-step-target][data-step-delta]").forEach(button => button.addEventListener("click", () => {
      const input = $(button.dataset.stepTarget);
      if (!input) return;
      const min = Number.isFinite(Number(input.min)) ? Number(input.min) : -Infinity;
      const max = Number.isFinite(Number(input.max)) ? Number(input.max) : Infinity;
      const delta = finite(button.dataset.stepDelta, 0);
      const decimals = Math.max(0, (String(input.step).split(".")[1] || "").length);
      const next = Math.min(max, Math.max(min, finite(input.value, 0) + delta));
      input.value = next.toFixed(decimals);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }));
    bindConnectionRows(drill);
  }

  function bindRandomInspector(drill, node) {
    $("randomAddBtn")?.addEventListener("click", () => {
      const target = $("randomAddTarget")?.value;
      if (!target) return;
      drill.edges.push({ id: makeId("edge"), source: node.id, sourceSlot: "branch", target, weight: 1, delaySeconds: 0 });
      commit({ message: "Weighted path added" });
    });
    bindConnectionRows(drill);
  }

  function bindDrillNodeInspector(drill, node) {
    $("referencedDrillField")?.addEventListener("change", event => {
      node.referencedDrillId = event.target.value || null;
      commit();
    });
    bindConnectionRows(drill);
  }

  function bindCounterInspector(drill, node) {
    bindNumberField("counterStartField", value => node.startCount = Math.max(0, Math.round(finite(value, 0))));
    els.inspectorContent.querySelectorAll("[data-clear-node]").forEach(input => input.addEventListener("change", () => {
      const id = input.dataset.clearNode;
      if (input.checked && !node.clearOnNodeIds.includes(id)) node.clearOnNodeIds.push(id);
      if (!input.checked) node.clearOnNodeIds = node.clearOnNodeIds.filter(item => item !== id);
      commit({ render: false });
    }));
    bindConnectionRows(drill);
  }

  function bindConnectionRows(drill) {
    els.inspectorContent.querySelectorAll(".edge-target-field").forEach(select => select.addEventListener("change", () => {
      const edgeId = select.dataset.edgeId;
      let edge = edgeId ? getEdge(drill, edgeId) : null;
      const target = select.value || null;
      if (!target) {
        if (edge) drill.edges = drill.edges.filter(item => item.id !== edge.id);
        selection = selection?.kind === "edge" ? null : selection;
        commit({ message: "Path removed; reaching this output ends the set" });
        return;
      }
      if (!edge) {
        edge = {
          id: makeId("edge"),
          source: select.dataset.sourceId,
          sourceSlot: select.dataset.slot || "next",
          target,
          weight: 1,
          delaySeconds: 0,
        };
        drill.edges.push(edge);
      } else {
        edge.target = target;
      }
      commit();
    }));


    els.inspectorContent.querySelectorAll(".edge-weight-field").forEach(input => input.addEventListener("change", () => {
      const edge = getEdge(drill, input.dataset.edgeId);
      if (!edge) return;
      edge.weight = clamp(input.value, .01, 100000, 1);
      commit();
    }));

    els.inspectorContent.querySelectorAll("[data-remove-edge]").forEach(button => button.addEventListener("click", () => {
      const edgeId = button.dataset.removeEdge;
      if (!edgeId) return;
      drill.edges = drill.edges.filter(edge => edge.id !== edgeId);
      if (selection?.kind === "edge" && selection.id === edgeId) selection = null;
      commit({ message: "Path removed" });
    }));
  }

  function renderEdgeInspector(drill, edge) {
    const source = getNode(drill, edge.source);
    const target = getNode(drill, edge.target);
    els.inspectorContent.innerHTML = `
      <div class="inspector-heading"><div><h2>Connection</h2><p class="inspector-subtitle">${escapeHtml(source?.label || "Missing")} → ${escapeHtml(target?.label || "Missing")}</p></div></div>
      ${source?.type === "counter" ? `<div class="counter-state-card">Repeater output: ${edge.sourceSlot === "A" ? "Repeat" : "Finish"}</div>` : ""}
      <label class="field"><span>Target node</span><select id="edgeInspectorTarget">${nodeOptions(drill, edge.target, false)}</select></label>
      ${source?.type === "random" ? `<label class="field"><span>Relative weight</span><input id="edgeInspectorWeight" type="number" min=".01" max="100000" step=".01" value="${edge.weight}"></label>` : ""}
      <div class="landing-card"><strong>Edge timing</strong><br>The source node completes, then this delay elapses before the target node begins. Nova encodes 0.667–2.00 s as a 1.5–0.5 Hz pre-pause; longer delays are split across batches.</div>
      <label class="field"><span>Delay before target</span><span class="input-with-unit"><input id="edgeInspectorDelay" type="number" min="0" max="3600" step=".05" value="${edge.delaySeconds}"><small>s</small></span></label>
      <button id="edgeInspectorRemove" class="button wide danger" type="button">Remove connection</button>
    `;
    $("edgeInspectorTarget")?.addEventListener("change", event => { edge.target = event.target.value; commit(); });
    $("edgeInspectorWeight")?.addEventListener("change", event => { edge.weight = clamp(event.target.value, .01, 100000, 1); commit(); });
    $("edgeInspectorDelay")?.addEventListener("change", event => { edge.delaySeconds = clamp(event.target.value, 0, 3600, 0); commit(); });
    $("edgeInspectorRemove")?.addEventListener("click", () => {
      drill.edges = drill.edges.filter(item => item.id !== edge.id);
      selection = null;
      commit({ message: "Connection removed" });
    });
  }

  function bindNumberField(id, setter) {
    $(id)?.addEventListener("change", event => {
      setter(event.target.value);
      commit();
    });
  }

  function typeDefaultName(type) {
    return type === "shot" ? "Shot" : type === "random" ? "Weighted random" : type === "drill" ? "Sub-drill" : "Repeater";
  }

  function validateDrill(drill) {
    const errors = [];
    const warnings = [];
    if (!drill.nodes.length) errors.push("The drill has no nodes.");
    if (!getNode(drill, drill.startNodeId)) errors.push("Choose a valid start node.");

    const seenShotNames = new Set();
    for (const node of drill.nodes) {
      if (node.type === "shot") {
        const key = node.label.toLowerCase();
        if (seenShotNames.has(key)) errors.push(`Shot name “${node.label}” is not unique.`);
        seenShotNames.add(key);
        if (outgoing(drill, node.id).length > 1) errors.push(`“${node.label}” may have only one outgoing path.`);
      }
      if (node.type === "drill") {
        if (!node.referencedDrillId) errors.push(`“${node.label}” does not reference a drill.`);
        if (node.referencedDrillId === drill.id) errors.push(`“${node.label}” directly references its own drill.`);
        if (outgoing(drill, node.id).length > 1) errors.push(`“${node.label}” may have only one outgoing path.`);
      }
      if (node.type === "random" && outgoing(drill, node.id).some(edge => !(edge.weight > 0))) {
        errors.push(`“${node.label}” has a non-positive weight.`);
      }
      if (node.type === "counter") {
        for (const slot of ["A", "B"]) {
          if (drill.edges.filter(edge => edge.source === node.id && edge.sourceSlot === slot).length > 1) {
            errors.push(`“${node.label}” has more than one ${slot === "A" ? "Repeat" : "Finish"} path.`);
          }
        }
      }
    }

    const recursion = findDrillRecursion(drill.id, [], new Set());
    if (recursion) errors.push(`Sub-drill recursion detected: ${recursion.map(id => getDrill(id)?.name || id).join(" → ")}`);

    const reachable = new Set();
    const stack = drill.startNodeId ? [drill.startNodeId] : [];
    while (stack.length) {
      const id = stack.pop();
      if (reachable.has(id)) continue;
      reachable.add(id);
      outgoing(drill, id).forEach(edge => stack.push(edge.target));
    }
    drill.nodes.filter(node => !reachable.has(node.id)).forEach(node => warnings.push(`“${node.label}” is unreachable.`));

    // START and END are structural editor concepts. START maps to startNodeId; END is
    // represented by at least one reachable node with no outgoing connection. Keeping
    // END implicit preserves the compact execution format while preventing drills that
    // can only cycle forever.
    const reachableTerminal = drill.nodes.some(node => reachable.has(node.id) && outgoing(drill, node.id).length === 0);
    if (drill.nodes.length && !reachableTerminal) errors.push("At least one reachable path must finish at END.");

    return { valid: errors.length === 0, errors, warnings, messages: [...errors, ...warnings] };
  }

  function findDrillRecursion(drillId, stack, visiting) {
    if (visiting.has(drillId)) {
      const start = stack.indexOf(drillId);
      return [...stack.slice(start), drillId];
    }
    const drill = getDrill(drillId);
    if (!drill) return null;
    visiting.add(drillId);
    stack.push(drillId);
    for (const node of drill.nodes.filter(n => n.type === "drill" && n.referencedDrillId)) {
      const found = findDrillRecursion(node.referencedDrillId, stack, visiting);
      if (found) return found;
    }
    stack.pop();
    visiting.delete(drillId);
    return null;
  }

  function renderValidation() {
    const drill = activeDrill();
    const result = drill ? validateDrill(drill) : { valid: false, errors: ["No drill."], warnings: [], messages: ["No drill."] };
    els.statusBadge.className = `status-badge ${result.valid ? "valid" : "invalid"}`;
    els.statusBadge.textContent = result.valid ? "Valid structure" : `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`;
    els.validationList.replaceChildren();
    const rows = result.messages.length ? result.messages.slice(0, 8) : ["A missing outgoing path ends a set.", "Cycles are allowed; Repeaters can make them finite."];
    for (const message of rows) {
      const li = document.createElement("li");
      li.textContent = message;
      els.validationList.appendChild(li);
    }
  }

  function spinWords(spin) {
    if (Math.abs(spin) < .05) return "0 rps · no spin";
    return `${fmt(Math.abs(spin),1)} rps · ${spin < 0 ? "underspin" : "topspin"}`;
  }

  function signed(value, digits = 1) {
    const number = finite(value, 0);
    if (Math.abs(number) < Math.pow(10, -digits) / 2) return fmt(0, digits);
    return `${number > 0 ? "+" : ""}${fmt(number, digits)}`;
  }

  function estimatedNovaSettings(params, calibration = library.calibration) {
    const nova = calibration.nova;
    const speedModel = LaunchModel.sanitizeLinearModel(nova.speedModel);
    const requestedRaw = LaunchModel.rawFromExitSpeed(params.speedMps, speedModel);
    const baseRaw = LaunchModel.clampRawToHardware(requestedRaw);
    const speedLevel = LaunchModel.levelFromRaw(baseRaw, nova);
    const cap = LaunchModel.spinCapacityAtLevel(speedLevel, nova.spinsightCurve);
    const maxSpinSetting = cap.maxSpinSetting;
    const maxSpinRps = cap.maxSpinRps;
    const requestedSpinRps = Math.abs(params.spinRps);
    const spinLevel = LaunchModel.spinSettingFromRps(speedLevel, params.spinRps, { clampToMeasuredCapacity: true, curve: nova.spinsightCurve });
    const spinLimited = requestedSpinRps > maxSpinRps + .05;
    const delta = nova.rawDeltaPerSpinLevel * spinLevel;
    const swapped = calibration.rotationType >= 4;
    const desiredWheelA = swapped ? baseRaw - delta : baseRaw + delta;
    const desiredWheelB = swapped ? baseRaw + delta : baseRaw - delta;
    const wheelA = Math.floor(clamp(desiredWheelA, 400, 7500, 400));
    const wheelB = Math.floor(clamp(desiredWheelB, 400, 7500, 400));
    const baseRawLimited = Math.abs(baseRaw - requestedRaw) > .01;
    const wheelRawLimited = Math.abs(wheelA - desiredWheelA) > 1.01 || Math.abs(wheelB - desiredWheelB) > 1.01;
    const hardwareLimited = baseRawLimited || wheelRawLimited;
    const speedExtrapolated = !LaunchModel.isRawCalibrated(requestedRaw, speedModel);
    const modeledBaseRaw = (wheelA + wheelB) / 2;
    const modeledExitSpeedMps = LaunchModel.exitSpeedFromRaw(modeledBaseRaw, speedModel);
    const modeledSpinRps = LaunchModel.spinRpsFromRawWheels(swapped ? wheelB : wheelA, swapped ? wheelA : wheelB, nova);
    const upDown = Math.round(clamp(nova.upDownAtZeroDeg + nova.upDownPerDegree * params.elevationDeg, -50, 100, 0));
    const placement = clamp(params.aimDeg / nova.yawDegreesPerPlacement, -10, 10, 0);
    return { wheelA, wheelB, upDown, placement, speedLevel, spinLevel, maxSpinSetting, maxSpinRps,
      limited: spinLimited, spinLimited, speedExtrapolated, hardwareLimited, baseRawLimited, wheelRawLimited,
      requestedRaw, baseRaw, modeledBaseRaw, modeledExitSpeedMps, modeledSpinRps,
      calibratedRange: LaunchModel.calibratedSpeedRange(speedModel) };
  }
  function novaEstimateHtml(params) {
    const estimate = estimatedNovaSettings(params);
    const warnings = [];
    if (estimate.speedExtrapolated && estimate.calibratedRange) warnings.push(`Speed uses linear extrapolation outside the measured calibration range (${fmt(estimate.calibratedRange.minMps,1)}–${fmt(estimate.calibratedRange.maxMps,1)} m/s).`);
    if (estimate.baseRawLimited) warnings.push("Requested speed requires a base raw input outside 400…7500; the base command is clipped at the hardware boundary.");
    if (estimate.wheelRawLimited) warnings.push("The requested spin differential pushes an individual wheel outside 400…7500 raw; individual wheel commands are clipped and the displayed modeled speed/spin reflect the clipped commands.");
    if (estimate.limited) warnings.push(`Requested spin exceeds the Spinsight-derived capability at this speed (${fmt(estimate.maxSpinRps,1)} rps maximum); the spin command is clamped.`);
    return `<div class="nova-estimate">
      <span>Estimated Nova settings</span>
      <dl>
        <div><dt>Wheel A</dt><dd>${estimate.wheelA}</dd></div>
        <div><dt>Wheel B</dt><dd>${estimate.wheelB}</dd></div>
        <div><dt>Modeled exit speed</dt><dd>${fmt(estimate.modeledExitSpeedMps,2)} m/s</dd></div>
        <div><dt>Modeled rotation</dt><dd>${signed(estimate.modeledSpinRps,1)} rps</dd></div>
        <div><dt>Speed setting</dt><dd>${fmt(estimate.speedLevel,2)}</dd></div>
        <div><dt>Spin setting</dt><dd>${signed(estimate.spinLevel,2)}</dd></div>
        <div><dt>Up/down</dt><dd>${signed(estimate.upDown,0)}</dd></div>
        <div><dt>Placement</dt><dd>${signed(estimate.placement,2)}</dd></div>
      </dl>
      <p>${warnings.length ? warnings.join(" ") : `Exit speed is one affine raw-wheel-input model (intercept + slope × raw). Spinsight data are used only for speed-dependent spin capacity.`}</p>
    </div>`;
  }
  function airProperties(calibration = library.calibration) {
    const p = calibration.physics;
    const temperatureK = p.airTemperatureC + 273.15;
    const pressurePa = p.airPressureKpa * 1000;
    const density = pressurePa / (p.dryAirGasConstant * temperatureK);
    const dynamicViscosity = p.sutherlandMu0
      * Math.pow(temperatureK / p.sutherlandT0, 1.5)
      * (p.sutherlandT0 + p.sutherlandS)
      / (temperatureK + p.sutherlandS);
    const kinematicViscosity = dynamicViscosity / density;
    return { temperatureK, pressurePa, density, dynamicViscosity, kinematicViscosity };
  }

  function interpolatePiecewise(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs.at(-1)) return ys.at(-1);
    for (let index = 1; index < xs.length; index += 1) {
      if (x <= xs[index]) {
        const ratio = (x - xs[index - 1]) / (xs[index] - xs[index - 1] || 1);
        return ys[index - 1] + ratio * (ys[index] - ys[index - 1]);
      }
    }
    return ys.at(-1);
  }

  function dragCoefficientAt(speed, omegaMagnitude, calibration = library.calibration) {
    const rows = dragCoefficientModel();
    const clippedSpeed = clamp(speed, rows[0].speed, 30, rows[0].speed);
    const radius = calibration.physics.ballDiameterM / 2;
    const spinRatio = clippedSpeed > 1e-9 ? radius * omegaMagnitude / clippedSpeed : 0;
    const rowValue = row => interpolatePiecewise(spinRatio, row.spinRatio, row.cd);

    if (clippedSpeed <= rows[0].speed) return rowValue(rows[0]) * calibration.physics.dragScale;
    if (clippedSpeed <= rows.at(-1).speed) {
      for (let index = 1; index < rows.length; index += 1) {
        const right = rows[index];
        const left = rows[index - 1];
        if (clippedSpeed <= right.speed) {
          const ratio = (clippedSpeed - left.speed) / (right.speed - left.speed || 1);
          return (rowValue(left) + ratio * (rowValue(right) - rowValue(left)))
            * calibration.physics.dragScale;
        }
      }
    }

    // The source model linearly extrapolates above 17.5 m/s to about 30 m/s.
    const left = rows.at(-2);
    const right = rows.at(-1);
    const ratio = (clippedSpeed - right.speed) / (right.speed - left.speed || 1);
    const extrapolated = rowValue(right) + ratio * (rowValue(right) - rowValue(left));
    return clamp(extrapolated, .15, .9, rowValue(right)) * calibration.physics.dragScale;
  }

  function magnusRowValue(row, omegaMagnitude) {
    const value = omegaMagnitude <= row.omegaBreak
      ? row.m * omegaMagnitude + row.s
      : row.a * omegaMagnitude * omegaMagnitude + row.b * omegaMagnitude + row.c;
    return Math.max(0, value);
  }

  function magnusCoefficientAt(speed, omegaMagnitude, calibration = library.calibration) {
    const rows = magnusCoefficientModel();
    const clippedSpeed = clamp(speed, rows[0].speed, rows.at(-1).speed, rows[0].speed);
    if (clippedSpeed <= rows[0].speed) {
      return magnusRowValue(rows[0], omegaMagnitude) * calibration.physics.magnusScale;
    }
    for (let index = 1; index < rows.length; index += 1) {
      const right = rows[index];
      const left = rows[index - 1];
      if (clippedSpeed <= right.speed) {
        const ratio = (clippedSpeed - left.speed) / (right.speed - left.speed || 1);
        const value = magnusRowValue(left, omegaMagnitude)
          + ratio * (magnusRowValue(right, omegaMagnitude) - magnusRowValue(left, omegaMagnitude));
        return Math.max(0, value) * calibration.physics.magnusScale;
      }
    }
    return magnusRowValue(rows.at(-1), omegaMagnitude) * calibration.physics.magnusScale;
  }

  function aerodynamicState(velocity, omega, calibration = library.calibration) {
    const p = calibration.physics;
    const air = airProperties(calibration);
    const relativeVelocity = {
      x: velocity.x - p.wind.x,
      y: velocity.y - p.wind.y,
      z: velocity.z - p.wind.z,
    };
    const speed = Math.hypot(relativeVelocity.x, relativeVelocity.y, relativeVelocity.z);
    const omegaMagnitude = Math.hypot(omega.x, omega.y, omega.z);
    const radius = p.ballDiameterM / 2;
    const reynolds = speed * p.ballDiameterM / air.kinematicViscosity;
    const spinRatio = speed > 1e-9 ? radius * omegaMagnitude / speed : 0;
    const dragCoefficient = dragCoefficientAt(speed, omegaMagnitude, calibration);
    const magnusCoefficient = magnusCoefficientAt(speed, omegaMagnitude, calibration);
    return {
      air,
      relativeVelocity,
      speed,
      omegaMagnitude,
      reynolds,
      spinRatio,
      dragCoefficient,
      magnusCoefficient,
    };
  }

  function flightAcceleration(velocity, omega, calibration = library.calibration) {
    const p = calibration.physics;
    const aero = aerodynamicState(velocity, omega, calibration);
    const radius = p.ballDiameterM / 2;
    const area = Math.PI * radius * radius;
    const volume = 4 / 3 * Math.PI * radius * radius * radius;
    const mass = p.ballMassKg;
    const v = aero.relativeVelocity;
    const dragFactor = -.5 * aero.dragCoefficient * aero.air.density * area * aero.speed / mass;
    const drag = {
      x: dragFactor * v.x,
      y: dragFactor * v.y,
      z: dragFactor * v.z,
    };

    // The source equation is -Cm*rho*V*(v × omega).
    // omega × v is the equivalent positive cross-product form.
    const omegaCrossVelocity = {
      x: omega.y * v.z - omega.z * v.y,
      y: omega.z * v.x - omega.x * v.z,
      z: omega.x * v.y - omega.y * v.x,
    };
    const magnusFactor = aero.magnusCoefficient * aero.air.density * volume / mass;
    const magnus = {
      x: magnusFactor * omegaCrossVelocity.x,
      y: magnusFactor * omegaCrossVelocity.y,
      z: magnusFactor * omegaCrossVelocity.z,
    };
    return {
      x: drag.x + magnus.x,
      y: drag.y + magnus.y,
      z: drag.z + magnus.z - calibration.gravity,
    };
  }

  function rk4FlightStep(position, velocity, omega, dt, calibration) {
    const a1 = flightAcceleration(velocity, omega, calibration);
    const v2 = {
      x: velocity.x + a1.x * dt / 2,
      y: velocity.y + a1.y * dt / 2,
      z: velocity.z + a1.z * dt / 2,
    };
    const a2 = flightAcceleration(v2, omega, calibration);
    const v3 = {
      x: velocity.x + a2.x * dt / 2,
      y: velocity.y + a2.y * dt / 2,
      z: velocity.z + a2.z * dt / 2,
    };
    const a3 = flightAcceleration(v3, omega, calibration);
    const v4 = {
      x: velocity.x + a3.x * dt,
      y: velocity.y + a3.y * dt,
      z: velocity.z + a3.z * dt,
    };
    const a4 = flightAcceleration(v4, omega, calibration);

    const nextVelocity = {
      x: velocity.x + dt / 6 * (a1.x + 2 * a2.x + 2 * a3.x + a4.x),
      y: velocity.y + dt / 6 * (a1.y + 2 * a2.y + 2 * a3.y + a4.y),
      z: velocity.z + dt / 6 * (a1.z + 2 * a2.z + 2 * a3.z + a4.z),
    };
    const nextPosition = {
      x: position.x + dt / 6 * (velocity.x + 2 * v2.x + 2 * v3.x + v4.x),
      y: position.y + dt / 6 * (velocity.y + 2 * v2.y + 2 * v3.y + v4.y),
      z: position.z + dt / 6 * (velocity.z + 2 * v2.z + 2 * v3.z + v4.z),
    };
    return { position: nextPosition, velocity: nextVelocity };
  }

  function predictTrajectory(params, calibration = null) {
    const baseCalibration = calibration || library.calibration;
    const c = calibration ? baseCalibration : { ...baseCalibration, pose: { ...drillPose(activeDrill()) } };
    const table = c.table;
    const netX = table.length / 2;
    const ballRadius = c.physics.ballDiameterM / 2;
    if (!RobotGeometry) throw new Error("Robot geometry module did not load.");
    const yaw = radians(c.pose.yawDeg + params.aimDeg);
    const elevation = radians(params.elevationDeg);
    const groundPlacement = c.placementMode === "ground";
    const supportZ = groundPlacement ? -c.tableHeight : 0;
    let position = RobotGeometry.releasePoint({
      baseX: c.pose.x,
      baseY: c.pose.y,
      baseYawDeg: c.pose.yawDeg,
      aimDeg: params.aimDeg,
      elevationDeg: params.elevationDeg,
      supportZ,
    });
    let velocity = {
      x: params.speedMps * Math.cos(elevation) * Math.cos(yaw),
      y: params.speedMps * Math.cos(elevation) * Math.sin(yaw),
      z: params.speedMps * Math.sin(elevation),
    };
    const omegaMagnitude = params.spinRps * Math.PI * 2;
    const omega = {
      x: -Math.sin(yaw) * omegaMagnitude,
      y: Math.cos(yaw) * omegaMagnitude,
      z: 0,
    };
    const initialAero = aerodynamicState(velocity, omega, c);
    const points = [{ ...position, t: 0 }];
    let landing = null;
    let net = { crossed: false, hit: false, z: null, y: null, clearanceM: null };
    let t = 0;
    let step = 0;
    const sampleEvery = Math.max(1, Math.round(.018 / c.timeStep));
    let groundEdgeBlocked = false;

    while (t < c.maxFlightTime && !landing) {
      const previous = { ...position };
      const advanced = rk4FlightStep(position, velocity, omega, c.timeStep, c);
      position = advanced.position;
      velocity = advanced.velocity;
      t += c.timeStep;
      step += 1;

      if (!net.crossed && crossedPlane(previous.x, position.x, netX)) {
        const ratio = (netX - previous.x) / (position.x - previous.x || 1);
        const z = previous.z + ratio * (position.z - previous.z);
        const y = previous.y + ratio * (position.y - previous.y);
        const clearanceM = z - ballRadius - table.netHeight;
        net = {
          crossed: true,
          hit: Math.abs(y) <= table.width / 2 + ballRadius && clearanceM < 0,
          z,
          y,
          clearanceM,
        };
      }

      if (groundPlacement && !groundEdgeBlocked && previous.x < 0 && position.x >= 0) {
        const ratio = (0 - previous.x) / (position.x - previous.x || 1);
        const edgeZ = previous.z + ratio * (position.z - previous.z);
        if (edgeZ < ballRadius) {
          groundEdgeBlocked = true;
          break;
        }
      }

      if (groundPlacement && position.x < 0) {
        const floorContactZ = -c.tableHeight + ballRadius;
        if (previous.z > floorContactZ && position.z <= floorContactZ && position.z < previous.z) break;
      }

      if (previous.z > ballRadius && position.z <= ballRadius) {
        const ratio = (previous.z - ballRadius) / (previous.z - position.z || 1);
        const landingX = previous.x + ratio * (position.x - previous.x);
        if (!groundPlacement || landingX >= 0) {
          landing = {
            x: landingX,
            y: previous.y + ratio * (position.y - previous.y),
            z: ballRadius,
            t: t - c.timeStep + ratio * c.timeStep,
          };
        }
      }

      if (step % sampleEvery === 0 || landing) points.push({ ...position, t });
      if (position.z < -1.2 || Math.abs(position.x) > 15 || Math.abs(position.y) > 10) break;
    }

    if (landing) points.push({ ...landing });
    const onTable = Boolean(
      landing
      && landing.x >= 0
      && landing.x <= table.length
      && Math.abs(landing.y) <= table.width / 2
    );
    let status = "unknown";
    if (groundEdgeBlocked) status = "edge";
    else if (net.hit) status = "net";
    else if (onTable) status = "table";
    else if (landing) status = "miss";
    const finalAero = aerodynamicState(velocity, omega, c);
    return {
      points,
      landing,
      onTable,
      status,
      net,
      table,
      ballRadius,
      diagnostics: {
        initial: initialAero,
        final: finalAero,
        massKg: c.physics.ballMassKg,
        diameterM: c.physics.ballDiameterM,
      },
    };
  }

  function crossedPlane(a, b, plane) {
    return (a <= plane && b >= plane) || (a >= plane && b <= plane);
  }

  function clearanceHtml(prediction) {
    if (!prediction.net.crossed || prediction.net.clearanceM == null) return `<span class="trajectory-warning">Net not crossed</span>`;
    const cm = prediction.net.clearanceM * 100;
    const cls = cm < 0 ? "trajectory-miss" : cm < 2 ? "trajectory-warning" : "trajectory-safe";
    const text = `${cm >= 0 ? "+" : ""}${fmt(cm,1)} cm net clearance`;
    return `<span class="${cls}">${text}</span>`;
  }

  function landingDescription(prediction) {
    const clearance = clearanceHtml(prediction);
    if (prediction.status === "edge") return `<strong class="trajectory-miss">Predicted table-edge contact</strong>.`;
    if (prediction.status === "net") return `<strong class="trajectory-miss">Predicted net contact</strong> · ${clearance}.`;
    if (!prediction.landing) return `<strong class="trajectory-warning">No landing found</strong> · ${clearance}.`;
    const className = prediction.onTable ? "trajectory-safe" : "trajectory-miss";
    const result = prediction.onTable ? "Predicted on the table" : "Predicted outside the table";
    return `<strong class="${className}">${result}</strong> · x ${fmt(prediction.landing.x,2)} m, y ${fmt(prediction.landing.y,2)} m, flight ${fmt(prediction.landing.t,2)} s.<br>${clearance}`;
  }

  function metricTransform(width, height, bounds, padding = 20) {
    const spanX = Math.max(.001, bounds.maxX - bounds.minX);
    const spanY = Math.max(.001, bounds.maxY - bounds.minY);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const usedW = spanX * scale;
    const usedH = spanY * scale;
    const left = (width - usedW) / 2;
    const top = (height - usedH) / 2;
    return {
      scale, bounds,
      sx: x => left + (x - bounds.minX) * scale,
      sy: y => top + (bounds.maxY - y) * scale,
      wx: x => bounds.minX + (x - left) / scale,
      wy: y => bounds.maxY - (y - top) / scale,
    };
  }

  function topBounds(prediction, calibration, margin = .28) {
    const table = calibration.table;
    const xs = prediction.points.map(p => p.x).concat([0, table.length, calibration.pose.x]);
    const ys = prediction.points.map(p => p.y).concat([-table.width/2, table.width/2, calibration.pose.y]);
    return { minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin, minY: Math.min(...ys) - margin, maxY: Math.max(...ys) + margin };
  }

  function topTrajectorySvg(prediction, width = 600, height = 310) {
    const c = library.calibration;
    const table = c.table;
    const tr = metricTransform(width, height, topBounds(prediction, c, .24), 18);
    const color = prediction.status === "table" ? "#55c98c" : prediction.status === "net" ? "#e76a73" : "#e4b85c";
    const path = prediction.points.map((point, index) => `${index ? "L" : "M"} ${fmt(tr.sx(point.x),2)} ${fmt(tr.sy(point.y),2)}`).join(" ");
    const rx = tr.sx(c.pose.x), ry = tr.sy(c.pose.y);
    return `<svg class="shot-top-view" viewBox="0 0 ${width} ${height}" role="img" aria-label="Predicted top view and landing position">
      <rect x="${tr.sx(0)}" y="${tr.sy(table.width/2)}" width="${tr.sx(table.length)-tr.sx(0)}" height="${tr.sy(-table.width/2)-tr.sy(table.width/2)}" rx="4" fill="#183e58" stroke="#7fa2bb" stroke-width="2"/>
      <line x1="${tr.sx(table.length/2)}" y1="${tr.sy(table.width/2)}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(-table.width/2)}" stroke="#d4dbe5" stroke-width="3"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4"/>
      <circle cx="${rx}" cy="${ry}" r="7" fill="#32bda2" stroke="#d5fff6" stroke-width="2"/>
      ${prediction.landing ? `<circle cx="${tr.sx(prediction.landing.x)}" cy="${tr.sy(prediction.landing.y)}" r="6" fill="${color}"/>` : ""}
    </svg>`;
  }

  function miniPreviewBounds(calibration) {
    const table = calibration.table;
    const xPad = Math.max(.06, table.length * .025);
    const yPad = Math.max(.05, table.width * .035);
    return {
      minX: Math.min(-xPad, calibration.pose.x - xPad),
      maxX: Math.max(table.length + xPad, calibration.pose.x + xPad),
      minY: Math.min(-table.width / 2 - yPad, calibration.pose.y - yPad),
      maxY: Math.max(table.width / 2 + yPad, calibration.pose.y + yPad),
    };
  }

  function miniTopTrajectorySvg(prediction) {
    const c = library.calibration;
    const table = c.table;
    const width = 188, height = 98;
    const bounds = miniPreviewBounds(c);
    const tr = metricTransform(width, height, bounds, 3);
    const color = prediction.status === "table" ? "#55c98c" : prediction.status === "net" ? "#e76a73" : "#e4b85c";
    const clipId = `mini-top-${Math.random().toString(36).slice(2)}`;
    const path = prediction.points.map((point,index) => `${index ? "L" : "M"} ${fmt(tr.sx(point.x),2)} ${fmt(tr.sy(point.y),2)}`).join(" ");
    return `<svg class="mini-trajectory mini-top-trajectory" viewBox="0 0 ${width} ${height}" aria-label="Predicted top view">
      <defs><clipPath id="${clipId}"><rect x="1" y="1" width="${width-2}" height="${height-2}" rx="5"/></clipPath></defs>
      <g clip-path="url(#${clipId})">
        <rect x="${tr.sx(0)}" y="${tr.sy(table.width/2)}" width="${tr.sx(table.length)-tr.sx(0)}" height="${tr.sy(-table.width/2)-tr.sy(table.width/2)}" fill="#17384e" stroke="#7897ad" stroke-width="1"/>
        <line x1="${tr.sx(table.length/2)}" y1="${tr.sy(table.width/2)}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(-table.width/2)}" stroke="#c9d2dc" stroke-width="1.5"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="${tr.sx(c.pose.x)}" cy="${tr.sy(c.pose.y)}" r="3.5" fill="#32bda2"/>
        ${prediction.landing ? `<circle cx="${tr.sx(prediction.landing.x)}" cy="${tr.sy(prediction.landing.y)}" r="3" fill="${color}"/>` : ""}
      </g>
    </svg>`;
  }

  function miniSideTrajectorySvg(prediction) {
    const c = library.calibration;
    const table = c.table;
    const width = 188, height = 48;
    const xPad = Math.max(.06, table.length * .025);
    const minX = Math.min(-xPad, c.pose.x - xPad);
    const maxX = Math.max(table.length + xPad, c.pose.x + xPad);
    const visibleMaxZ = Math.max(
      (prediction.points[0]?.z ?? .24) + .05,
      table.netHeight + .06,
      Math.min(.85, Math.max(...prediction.points.map(point => point.z)) + .035)
    );
    const bounds = { minX, maxX, minY: -.015, maxY: visibleMaxZ };
    const tr = metricTransform(width, height, bounds, 2);
    const color = prediction.status === "table" ? "#55c98c" : prediction.status === "net" ? "#e76a73" : "#e4b85c";
    const clipId = `mini-side-${Math.random().toString(36).slice(2)}`;
    const path = prediction.points.map((point,index) => `${index ? "L" : "M"} ${fmt(tr.sx(point.x),2)} ${fmt(tr.sy(point.z),2)}`).join(" ");
    return `<svg class="mini-trajectory mini-side-trajectory" viewBox="0 0 ${width} ${height}" aria-label="Predicted side view">
      <defs><clipPath id="${clipId}"><rect x="1" y="1" width="${width-2}" height="${height-2}" rx="5"/></clipPath></defs>
      <g clip-path="url(#${clipId})">
        <line x1="${tr.sx(0)}" y1="${tr.sy(0)}" x2="${tr.sx(table.length)}" y2="${tr.sy(0)}" stroke="#7890aa" stroke-width="2"/>
        <line x1="${tr.sx(table.length/2)}" y1="${tr.sy(0)}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(table.netHeight)}" stroke="#d2d9e2" stroke-width="1.5"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
      </g>
    </svg>`;
  }

  function sideTrajectorySvg(prediction, width = 760, height = 330) {
    const c = library.calibration;
    const table = c.table;
    const xs = prediction.points.map(p => p.x).concat([c.pose.x, 0, table.length]);
    const maxZ = Math.max(prediction.points[0]?.z ?? .24, ...prediction.points.map(p => p.z), table.netHeight) + .12;
    const bounds = { minX: Math.min(...xs) - .25, maxX: Math.max(...xs) + .25, minY: -.08, maxY: maxZ };
    const tr = metricTransform(width, height, bounds, 24);
    const color = prediction.status === "table" ? "#55c98c" : prediction.status === "net" ? "#e76a73" : "#e4b85c";
    const path = prediction.points.map((point,index) => `${index ? "L" : "M"} ${fmt(tr.sx(point.x),2)} ${fmt(tr.sy(point.z),2)}`).join(" ");
    const surfaceY = tr.sy(0);
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scale-accurate side trajectory">
      <line x1="${tr.sx(0)}" y1="${surfaceY}" x2="${tr.sx(table.length)}" y2="${surfaceY}" stroke="#7890aa" stroke-width="6"/>
      <line x1="${tr.sx(table.length/2)}" y1="${surfaceY}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(table.netHeight)}" stroke="#d2d9e2" stroke-width="4"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4"/>
      ${prediction.landing ? `<circle cx="${tr.sx(prediction.landing.x)}" cy="${tr.sy(prediction.ballRadius)}" r="6" fill="${color}"/>` : ""}
      <text x="${tr.sx(table.length/2)+8}" y="${tr.sy(table.netHeight)-6}" fill="#d7dee7" font-size="12">${fmt(table.netHeight*100,2)} cm net</text>
    </svg>`;
  }

  function radians(deg) { return deg * Math.PI / 180; }
  function degrees(rad) { return rad * 180 / Math.PI; }

  function setCalibrationTab(tab) {
    const active = ["guided", "pose", "table"].includes(tab) ? tab : "guided";
    els.calibrationGuidedPanel.hidden = active !== "guided";
    els.calibrationPosePanel.hidden = active !== "pose";
    els.calibrationTablePanel.hidden = active !== "table";
    els.calibrationGuidedTab.classList.toggle("active", active === "guided");
    els.calibrationPoseTab.classList.toggle("active", active === "pose");
    els.calibrationTableTab.classList.toggle("active", active === "table");
  }

  function currentPoseSession() {
    const session = PoseCalibration.sanitizeSession(library.calibration.poseSession || {}, library.calibration.pose);
    session.pose = { ...currentRobotPose() };
    library.calibration.poseSession = session;
    return session;
  }

  const MANUAL_POSE_PRIOR = Object.freeze({ xCm: 5, yCm: 5, yawDeg: 3, landingCm: 5, measurementCm: 2 });
  const MAX_POSE_CALIBRATION_SHOTS = 7;
  const POSE_TABLE_VIEW = Object.freeze({ left: 43, top: 40, width: 334, height: 600 });

  function predictedIncidenceDeg(prediction) {
    const points = prediction?.points || [];
    if (points.length < 2) return 30;
    const end = points[points.length - 1];
    let previous = points[points.length - 2];
    for (let index = points.length - 2; index >= 0; index -= 1) {
      if (Math.abs(points[index].z - end.z) >= .01) { previous = points[index]; break; }
    }
    const horizontal = Math.hypot(end.x - previous.x, end.y - previous.y);
    return clamp(degrees(Math.atan2(Math.abs(end.z - previous.z), Math.max(.001, horizontal))), 8, 85, 30);
  }

  function verificationShotForTarget(target, pose = currentRobotPose()) {
    const calibration = calibrationAtPose(pose);
    const aimDeg = degrees(Math.atan2(target.y - pose.y, target.x - pose.x)) - pose.yawDeg;
    const deep = target.x > library.calibration.table.length * .72;
    const seeds = deep
      ? [[7.2,16,10],[6.5,4,14],[8,-4,8]]
      : [[5.4,4,13],[4.8,-10,17],[6,12,10]];
    const range = LaunchModel.hardwareSpeedRange(library.calibration.nova.speedModel);
    const candidates = seeds.map(([speedMps, spinRps, elevationDeg]) => {
      const seed = { speedMps, spinRps, elevationDeg, aimDeg };
      const solution = DrillAdjustments.solveShotGoals(seed, {
        targetLanding: { x: target.x, y: target.y }, targetClearanceM: target.clearanceCm / 100,
        desiredSpeedMps: speedMps, desiredSpinRps: spinRps,
      }, candidate => predictTrajectory(candidate, calibration), {
        ...tuningElevationBounds(), minSpeedMps: range.minMps, maxSpeedMps: range.maxMps,
        landingScaleM: .012, clearanceScaleM: .006, speedScaleMps: .8, spinScaleRps: 10,
        maxIterations: 8, maxEvaluations: 24,
      });
      if (!solution?.prediction?.landing || solution.prediction.net?.hit) return null;
      const landingMiss = Math.hypot(solution.prediction.landing.x - target.x, solution.prediction.landing.y - target.y);
      const clearanceMiss = Math.abs(solution.prediction.net.clearanceM - target.clearanceCm / 100);
      return { ...solution, verificationScore: landingMiss / .08 + clearanceMiss / .03, landingMiss, clearanceMiss };
    }).filter(Boolean).sort((a,b) => a.verificationScore - b.verificationScore);
    const best = candidates[0];
    if (!best || best.landingMiss > .12 || best.clearanceMiss > .05) return null;
    const release = best.prediction.points?.[0] || pose;
    const flightDistanceM = Math.hypot(best.prediction.landing.x - finite(release.x, pose.x), best.prediction.landing.y - finite(release.y, pose.y));
    const incidenceDeg = predictedIncidenceDeg(best.prediction);
    const shotSigmaCm = Math.max(MANUAL_POSE_PRIOR.landingCm, GuidedCalibration.measurementSigmaM(flightDistanceM, incidenceDeg, { distanceNoisePerM: .015 }) * 100);
    return { ...best, incidenceDeg, shotSigmaCm };
  }

  function poseTablePoint(pose) {
    const table = library.calibration.table;
    return {
      x: POSE_TABLE_VIEW.left + POSE_TABLE_VIEW.width / 2 - pose.y / table.width * POSE_TABLE_VIEW.width,
      y: POSE_TABLE_VIEW.top + POSE_TABLE_VIEW.height - pose.x / table.length * POSE_TABLE_VIEW.height,
    };
  }

  function poseFromTablePoint(point, yawDeg = 0) {
    const table = library.calibration.table;
    return PoseCalibration.sanitizePose({
      x: clamp((POSE_TABLE_VIEW.top + POSE_TABLE_VIEW.height - point.y) / POSE_TABLE_VIEW.height * table.length, 0, table.length, 0),
      y: clamp((POSE_TABLE_VIEW.left + POSE_TABLE_VIEW.width / 2 - point.x) / POSE_TABLE_VIEW.width * table.width, -table.width / 2, table.width / 2, 0),
      yawDeg,
    });
  }

  function initializePoseCalibration() {
    const session = currentPoseSession();
    const uncertainty = PoseCalibration.sanitizeUncertainty(session.uncertainty || MANUAL_POSE_PRIOR);
    const pose = { ...currentRobotPose() };
    const covariance = PoseCalibration.sanitizeCovariance(session.covariance, uncertainty);
    const plan = PoseCalibration.planCalibrationSequence(library.calibration.table, pose, uncertainty, { covariance, maxShots: 4 });
    poseCalibrationState = {
      pose,
      uncertainty,
      covariance,
      targets: plan.sequence,
      planStatus: plan.status,
      currentTarget: null,
      mode: "position",
      observations: [],
      landingMarks: [],
      recentTargets: [],
      shotsFired: 0,
      acceptedCount: 0,
      currentWatchGroup: null,
      verificationAttempted: false,
      verificationPassed: false,
      confidenceLimited: false,
      manuallyMoved: false,
      measurementViewport: null,
    };
  }

  function renderPoseCalibrationTable() {
    const state = poseCalibrationState;
    if (!state) return;
    const table = library.calibration.table;
    const view = POSE_TABLE_VIEW;
    const robot = poseTablePoint(state.pose);
    const yaw = radians(state.pose.yawDeg);
    const handle = { x: robot.x - Math.sin(yaw) * 76, y: robot.y - Math.cos(yaw) * 76 };
    const sigmaX = state.uncertainty.yCm / 100 / table.width * view.width;
    const sigmaY = state.uncertainty.xCm / 100 / table.length * view.height;
    const currentTarget = state.currentTarget;
    const gridCm = currentTarget?.gridCm || PoseCalibration.gridResolutionCm(state.uncertainty);
    const planGrid = state.mode === "position" ? "" : `<g class="pose-plan-grid">${[
      ...Array.from({ length: Math.floor(table.length * 100 / gridCm) + 1 }, (_, index) => {
        const y = poseTablePoint({ x: index * gridCm / 100, y: 0 }).y;
        return `<line x1="${view.left}" x2="${view.left + view.width}" y1="${y}" y2="${y}"/>`;
      }),
      ...Array.from({ length: Math.floor(table.width * 100 / gridCm) + 1 }, (_, index) => {
        const x = poseTablePoint({ x: 0, y: table.width / 2 - index * gridCm / 100 }).x;
        return `<line x1="${x}" x2="${x}" y1="${view.top}" y2="${view.top + view.height}"/>`;
      }),
    ].join("")}</g>`;
    const visibleTargets = state.mode === "position" ? [] : state.targets.slice(0, 1);
    const targets = visibleTargets.map((target, index) => {
      const point = poseTablePoint(target);
      const active = target.id === currentTarget?.id && state.mode !== "position";
      const observed = state.observations.some(item => item.targetId === target.id);
      return `<g class="pose-target ${active ? "active" : ""} ${observed ? "observed" : ""}">
        <circle cx="${point.x}" cy="${point.y}" r="${active ? 14 : 11}"/>${active ? "" : `<text x="${point.x}" y="${point.y + 4}">${index + 1}</text>`}
      </g>`;
    }).join("");
    const landings = state.landingMarks.map(mark => {
      const point = poseTablePoint(mark);
      return `<g class="pose-actual-landing"><path d="M ${point.x-7} ${point.y-7} L ${point.x+7} ${point.y+7} M ${point.x+7} ${point.y-7} L ${point.x-7} ${point.y+7}"/></g>`;
    }).join("");
    els.poseCalibrationTableSvg.innerHTML = `
      <rect class="pose-table-surface" x="${view.left}" y="${view.top}" width="${view.width}" height="${view.height}" rx="8" data-pose-table-hit="1"/>
      ${planGrid}
      <line class="pose-table-centre" x1="${view.left + view.width/2}" x2="${view.left + view.width/2}" y1="${view.top}" y2="${view.top + view.height}"/>
      <line class="pose-table-net" x1="${view.left}" x2="${view.left + view.width}" y1="${view.top + view.height/2}" y2="${view.top + view.height/2}"/>
      <text class="pose-table-label" x="${view.left + view.width/2}" y="${view.top + 22}">far end</text>
      <text class="pose-table-label pose-table-label-near" x="${view.left + 12}" y="${view.top + view.height - 12}">near edge</text>
      ${targets}${landings}
      <ellipse class="pose-uncertainty" cx="${robot.x}" cy="${robot.y}" rx="${Math.max(5,sigmaX)}" ry="${Math.max(5,sigmaY)}" transform="rotate(${-state.pose.yawDeg} ${robot.x} ${robot.y})"/>
      <line class="pose-direction-line" x1="${robot.x}" y1="${robot.y}" x2="${handle.x}" y2="${handle.y}"/>
      <g class="pose-robot" transform="translate(${robot.x} ${robot.y}) rotate(${-state.pose.yawDeg})" data-pose-drag="position">
        <rect x="-22" y="-47" width="44" height="47" rx="10"/><circle cx="0" cy="-31" r="7"/><path d="M -12 -8 L 12 -8"/>
      </g>
      <g class="pose-rotation-handle" data-pose-drag="rotation"><circle cx="${handle.x}" cy="${handle.y}" r="17"/><path d="M ${handle.x-7} ${handle.y} A 8 8 0 1 1 ${handle.x+6} ${handle.y-5}"/></g>
      `;
  }

  function poseMeasurementViewport(state, target, baseView, plotAspect) {
    if (!state.measurementViewport || state.measurementViewport.targetId !== target.id) {
      let longitudinalSpan = baseView.maxX - baseView.minX;
      let lateralSpan = baseView.maxY - baseView.minY;
      if (lateralSpan / longitudinalSpan > plotAspect) longitudinalSpan = lateralSpan / plotAspect;
      else lateralSpan = longitudinalSpan * plotAspect;
      state.measurementViewport = {
        targetId: target.id,
        centerX: (baseView.minX + baseView.maxX) / 2,
        centerY: (baseView.minY + baseView.maxY) / 2,
        baseLongitudinalSpan: longitudinalSpan,
        baseLateralSpan: lateralSpan,
        baseGridCm: baseView.gridCm,
        zoom: 1,
      };
    }
    const viewport = state.measurementViewport;
    const longitudinalSpan = viewport.baseLongitudinalSpan / viewport.zoom;
    const lateralSpan = viewport.baseLateralSpan / viewport.zoom;
    const desiredGridCm = viewport.baseGridCm / viewport.zoom;
    const gridCm = [1, 2, 5, 10, 20, 50].reduce((best, step) => Math.abs(step - desiredGridCm) < Math.abs(best - desiredGridCm) ? step : best);
    return {
      ...baseView,
      minX: viewport.centerX - longitudinalSpan / 2,
      maxX: viewport.centerX + longitudinalSpan / 2,
      minY: viewport.centerY - lateralSpan / 2,
      maxY: viewport.centerY + lateralSpan / 2,
      gridCm,
    };
  }

  function poseObservationMapSvg(target, baseView = null) {
    const table = library.calibration.table;
    const initialView = baseView || PoseCalibration.localMeasurementView(table, target, poseCalibrationState?.uncertainty, {
      pose: poseCalibrationState?.pose, covariance: poseCalibrationState?.covariance,
    });
    const viewWidth = 360;
    const viewHeight = window.matchMedia("(max-width: 760px)").matches ? 620 : 500;
    const maxPlotWidth = viewWidth, maxPlotHeight = viewHeight;
    const view = poseMeasurementViewport(poseCalibrationState, target, initialView, maxPlotWidth / maxPlotHeight);
    const longitudinalSpan = view.maxX - view.minX;
    const lateralSpan = view.maxY - view.minY;
    const pixelsPerMetre = Math.min(maxPlotWidth / lateralSpan, maxPlotHeight / longitudinalSpan);
    const plotWidth = lateralSpan * pixelsPerMetre;
    const plotHeight = longitudinalSpan * pixelsPerMetre;
    const plotLeft = (viewWidth - plotWidth) / 2;
    const plotTop = (viewHeight - plotHeight) / 2;
    const plotRight = plotLeft + plotWidth;
    const plotBottom = plotTop + plotHeight;
    const gridCm = view.gridCm;
    const stepM = gridCm / 100;
    const sx = y => plotLeft + (view.maxY - y) * pixelsPerMetre;
    const sy = x => plotTop + (view.maxX - x) * pixelsPerMetre;
    const inX = value => value >= view.minX - 1e-6 && value <= view.maxX + 1e-6;
    const inY = value => value >= view.minY - 1e-6 && value <= view.maxY + 1e-6;
    const expectedX = sx(target.y), expectedY = sy(target.x);
    const landingCovariance = PoseCalibration.expectedLandingCovariance(target, poseCalibrationState?.pose, poseCalibrationState?.covariance, poseCalibrationState?.uncertainty);
    const screenA = landingCovariance[1][1], screenB = landingCovariance[0][1], screenC = landingCovariance[0][0];
    const eigenSpread = Math.sqrt(Math.max(0, (screenA-screenC)**2 + 4*screenB**2));
    const eigenMajor = Math.max(1e-10, (screenA+screenC+eigenSpread)/2);
    const eigenMinor = Math.max(1e-10, (screenA+screenC-eigenSpread)/2);
    const confidence99 = Math.sqrt(9.210340371976184);
    const expectedEllipse = {
      rx: Math.sqrt(eigenMajor)*confidence99*pixelsPerMetre,
      ry: Math.sqrt(eigenMinor)*confidence99*pixelsPerMetre,
      angleDeg: Math.atan2(2*screenB,screenA-screenC)*90/Math.PI,
    };
    const tableMinX = Math.max(0, view.minX), tableMaxX = Math.min(table.length, view.maxX);
    const tableMinY = Math.max(-table.width/2, view.minY), tableMaxY = Math.min(table.width/2, view.maxY);
    const tableRect = tableMinX < tableMaxX && tableMinY < tableMaxY
      ? `<rect class="pose-feedback-table" x="${sx(tableMaxY)}" y="${sy(tableMaxX)}" width="${(tableMaxY-tableMinY)*pixelsPerMetre}" height="${(tableMaxX-tableMinX)*pixelsPerMetre}"/>` : "";
    const edgeWidth = Math.max(1.5, .02 * pixelsPerMetre);
    const centreWidth = Math.max(.65, .003 * pixelsPerMetre);
    const tableMarkings = `<g class="pose-table-markings" clip-path="url(#pose-feedback-plot-clip)">
      <line class="edge-line endline" x1="${sx(table.width/2)}" x2="${sx(-table.width/2)}" y1="${sy(.01)}" y2="${sy(.01)}" stroke-width="${edgeWidth}"/>
      <line class="edge-line endline" x1="${sx(table.width/2)}" x2="${sx(-table.width/2)}" y1="${sy(table.length-.01)}" y2="${sy(table.length-.01)}" stroke-width="${edgeWidth}"/>
      <line class="edge-line sideline" x1="${sx(table.width/2-.01)}" x2="${sx(table.width/2-.01)}" y1="${sy(0)}" y2="${sy(table.length)}" stroke-width="${edgeWidth}"/>
      <line class="edge-line sideline" x1="${sx(-table.width/2+.01)}" x2="${sx(-table.width/2+.01)}" y1="${sy(0)}" y2="${sy(table.length)}" stroke-width="${edgeWidth}"/>
      <line class="centre-line" x1="${sx(0)}" x2="${sx(0)}" y1="${sy(0)}" y2="${sy(table.length)}" stroke-width="${centreWidth}"/>
    </g>`;
    const netOverhangM = .1525;
    const netY = sy(table.length/2);
    const netLeft = sx(table.width/2 + netOverhangM);
    const netRight = sx(-table.width/2 - netOverhangM);
    const netMarkup = inX(table.length/2) ? `<g class="pose-net" clip-path="url(#pose-feedback-plot-clip)">
      <line class="pose-net-shadow" x1="${netLeft}" x2="${netRight}" y1="${netY}" y2="${netY}"/>
      <line class="pose-net-mesh" x1="${netLeft}" x2="${netRight}" y1="${netY}" y2="${netY}"/>
      <circle class="pose-net-post" cx="${netLeft}" cy="${netY}" r="4"/><circle class="pose-net-post" cx="${netRight}" cy="${netY}" r="4"/>
    </g>` : "";
    const horizontalLandmarks = [
      { value: 0, label: "NEAR ENDLINE", kind: "near-endline" },
      { value: table.length/2, label: "NET", kind: "net" },
      { value: table.length, label: "FAR ENDLINE", kind: "far-endline" },
    ].filter(item => inX(item.value));
    const verticalLandmarks = [
      { value: table.width/2, label: "LEFT SIDELINE", kind: "left-sideline" },
      { value: 0, label: "CENTRE LINE", kind: "centre-line" },
      { value: -table.width/2, label: "RIGHT SIDELINE", kind: "right-sideline" },
    ].filter(item => inY(item.value));
    const yGridValues = [];
    const xGridValues = [];
    for (let value = view.yReference.value + Math.ceil((view.minY-view.yReference.value)/stepM-1e-9)*stepM; value <= view.maxY+1e-6; value += stepM) yGridValues.push(value);
    for (let value = view.xReference.value + Math.ceil((view.minX-view.xReference.value)/stepM-1e-9)*stepM; value <= view.maxX+1e-6; value += stepM) xGridValues.push(value);
    const gridMarkup = `<g class="pose-observation-grid" clip-path="url(#pose-feedback-plot-clip)">
      ${xGridValues.map(value => `<line x1="${plotLeft}" x2="${plotRight}" y1="${sy(value)}" y2="${sy(value)}"/>`).join("")}
      ${yGridValues.map(value => `<line x1="${sx(value)}" x2="${sx(value)}" y1="${plotTop}" y2="${plotBottom}"/>`).join("")}
    </g>`;
    const horizontalPlacement = line => {
      const lineY = sy(line.value);
      const away = lineY < expectedY ? -1 : 1;
      return {
        numberY: Math.max(9, Math.min(viewHeight-5, lineY + away*(away < 0 ? 7 : 13))),
        labelY: Math.max(9, Math.min(viewHeight-5, lineY + away*(away < 0 ? 20 : 26))),
      };
    };
    const verticalPlacement = line => {
      const lineX = sx(line.value);
      const away = lineX < expectedX ? -1 : 1;
      return {
        numberX: Math.max(4, Math.min(viewWidth-4, lineX + away*7)),
        labelX: Math.max(8, Math.min(viewWidth-8, lineX + away*20)),
        anchor: away < 0 ? "end" : "start",
      };
    };
    const rulerNumbers = [
      ...horizontalLandmarks.flatMap(line => {
        const { numberY } = horizontalPlacement(line);
        return yGridValues.map(value => ({ x: Math.max(10, Math.min(viewWidth-10, sx(value))), y: numberY, text: Math.round(Math.abs(value-view.yReference.value)*100), anchor: "middle" }));
      }),
      ...verticalLandmarks.flatMap(line => {
        const { numberX, anchor } = verticalPlacement(line);
        return xGridValues.map(value => ({ x: numberX, y: Math.max(9, Math.min(viewHeight-5, sy(value)+3)), text: Math.round(Math.abs(value-view.xReference.value)*100), anchor }));
      }),
    ].map(item => `<text class="pose-axis-number" x="${item.x}" y="${item.y}" text-anchor="${item.anchor}">${item.text}</text>`).join("");
    const landmarkLabels = [
      ...horizontalLandmarks.map(line => {
        const { labelY } = horizontalPlacement(line);
        return `<text class="pose-landmark-label horizontal" x="${plotRight-3}" y="${labelY}">${line.label}</text>`;
      }),
      ...verticalLandmarks.map(line => {
        const { labelX } = verticalPlacement(line);
        return `<text class="pose-landmark-label vertical" transform="translate(${labelX} ${plotBottom-3}) rotate(-90)">${line.label}</text>`;
      }),
    ].join("");
    return `<div class="pose-map-shell"><svg class="pose-observation-map" viewBox="0 0 ${viewWidth} ${viewHeight}"
      data-view-width="${viewWidth}" data-view-height="${viewHeight}" data-plot-left="${plotLeft}" data-plot-top="${plotTop}"
      data-plot-width="${plotWidth}" data-plot-height="${plotHeight}" data-min-x="${view.minX}" data-max-x="${view.maxX}"
      data-min-y="${view.minY}" data-max-y="${view.maxY}" data-grid-cm="${gridCm}"
      data-reference-x="${view.xReference.value}" data-reference-y="${view.yReference.value}"
      role="img" aria-label="Zoomable equal-scale landing view. All numbers are centimetres. The translucent ellipse is the modeled 99 percent landing region. Tap the observed first-bounce position, including outside the table.">
      <defs><clipPath id="pose-feedback-plot-clip"><rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" rx="7"/></clipPath></defs>
      <rect class="pose-feedback-background" x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" rx="7"/>
      ${tableRect}${gridMarkup}${tableMarkings}${netMarkup}
      <ellipse class="pose-expected-region" cx="${expectedX}" cy="${expectedY}" rx="${expectedEllipse.rx}" ry="${expectedEllipse.ry}" transform="rotate(${expectedEllipse.angleDeg} ${expectedX} ${expectedY})" clip-path="url(#pose-feedback-plot-clip)"/>
      ${rulerNumbers}${landmarkLabels}
      <rect class="pose-observation-hit" x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" rx="7"/>
    </svg></div>`;
  }

  function refreshPosePlan(state, verification = false) {
    const plan = PoseCalibration.planCalibrationSequence(library.calibration.table, state.pose, state.uncertainty, {
      covariance: state.covariance, recentTargets: state.recentTargets, currentWatchGroup: state.currentWatchGroup,
      maxShots: verification ? 1 : Math.min(4, MAX_POSE_CALIBRATION_SHOTS - state.shotsFired), verification,
    });
    state.targets = plan.sequence;
    state.planStatus = plan.status;
  }

  function choosePoseTarget(state, verification = false) {
    refreshPosePlan(state, verification);
    const plannedIds = new Set(state.targets.map(target => target.id));
    const fallbacks = PoseCalibration.proposeCalibrationTargets(library.calibration.table, state.pose, state.uncertainty, {
      covariance: state.covariance, recentTargets: state.recentTargets, currentWatchGroup: state.currentWatchGroup, verification,
    }).filter(target => !plannedIds.has(target.id)).slice(0, 24);
    const ordered = [...state.targets, ...fallbacks];
    for (const target of ordered) {
      const solution = verificationShotForTarget(target, state.pose);
      if (solution) {
        const selected = { ...target, incidenceDeg: solution.incidenceDeg, shotSigmaCm: solution.shotSigmaCm, shotSolution: solution, isVerification: verification };
        state.targets = [selected];
        return selected;
      }
    }
    return null;
  }

  function poseEstimateReadyForVerification(state) {
    return state.acceptedCount >= 1
      && PoseCalibration.calibrationStatus(library.calibration.table, state.pose, state.covariance, state.uncertainty).converged;
  }

  function renderPoseCalibrationGuide() {
    const state = poseCalibrationState;
    if (!state) return;
    const target = state.currentTarget;
    const status = PoseCalibration.calibrationStatus(library.calibration.table, state.pose, state.covariance, state.uncertainty);
    const position = `<div class="pose-readout"><span>${Math.round(state.pose.x*100)} cm from near edge</span><span>${Math.abs(state.pose.y) < .005 ? "centred" : `${Math.round(Math.abs(state.pose.y)*100)} cm ${state.pose.y > 0 ? "left" : "right"}`}</span><span>${signed(state.pose.yawDeg,1)}°</span></div>`;
    if (state.mode === "position") {
      els.poseCalibrationGuide.innerHTML = `<p class="pose-step">Step 1</p><h3>Match the physical robot</h3><p>Drag the robot body to move it and the round handle to aim it. Calibration placements are chosen after this pose is set, then recalculated after every answer.</p>${position}<button class="button primary wide" type="button" data-pose-action="start">Start calibration</button>`;
    } else if (state.mode === "ready") {
      const phase = target?.isVerification ? "Final verification" : `Calibration shot ${state.shotsFired + 1}`;
      const remaining = target?.isVerification ? "Independent check—not used to tighten the estimate." : `Pose adds about ${fmt(status.worstPoseLandingCm,1)} cm at worst; stop goal is the modeled ${fmt(status.acceptableLandingCm,1)} cm ball noise.`;
      els.poseCalibrationGuide.innerHTML = `<p class="pose-step">${phase}</p><h3>Aim for the blue target</h3><p><strong>${escapeHtml(target?.watchInstruction || "Watch the first bounce.")}</strong><br>${escapeHtml(target?.coordinateLabel || "")}<br>${remaining}</p><button class="button primary wide pose-fire-calibration" type="button" data-pose-action="fire" ${target?.shotSolution ? "" : "disabled"}>Fire calibration shot</button>${target?.shotSolution ? "" : `<p class="pose-warning">No safe shot is feasible from the current position.</p>`}`;
    } else if (state.mode === "firing") {
      els.poseCalibrationGuide.innerHTML = `<p class="pose-step">${target?.isVerification ? "Final verification" : `Calibration shot ${state.shotsFired + 1}`}</p><h3>Serving one ball…</h3><p>Watch the first bounce relative to the highlighted ${escapeHtml(target?.reference || "landmark")}.</p><button class="button primary wide" type="button" disabled>Waiting for Nova</button>`;
    } else if (state.mode === "feedback") {
      const measurementView = PoseCalibration.localMeasurementView(library.calibration.table, target, state.uncertainty, { pose: state.pose, covariance: state.covariance });
      els.poseCalibrationGuide.innerHTML = `${poseObservationMapSvg(target, measurementView)}<button class="button primary wide pose-fire-calibration" type="button" data-pose-action="fire">Fire calibration shot</button>`;
    } else {
      const result = state.verificationPassed ? "Independent verification passed." : state.confidenceLimited ? "Maximum calibration shots reached; keep the wider uncertainty in mind." : "The pose estimate has been refined.";
      els.poseCalibrationGuide.innerHTML = `<p class="pose-step">Complete</p><h3>Pose refined</h3><p>${result} Save it for playback.</p>${position}`;
    }
    const u = state.uncertainty;
    els.poseCalibrationConfidence.innerHTML = `<span>Calibration accuracy</span><strong>Pose contribution ≤ ${fmt(status.worstPoseLandingCm,1)} cm · modeled ball noise ${fmt(status.acceptableLandingCm,1)} cm</strong><small>Pose: ±${fmt(u.xCm,1)} cm / ±${fmt(u.yCm,1)} cm / ±${fmt(u.yawDeg,1)}°. The process stops when further pose precision would be hidden by normal landing dispersion.</small>`;
    const verificationActive = ["ready", "firing", "feedback"].includes(state.mode);
    els.poseCalibrationConfidence.hidden = verificationActive;
    els.savePoseCalibrationBtn.parentElement.hidden = verificationActive;
    els.savePoseCalibrationBtn.textContent = state.verificationPassed ? "Save calibrated pose" : "Save position";
    els.savePoseCalibrationBtn.disabled = state.mode === "firing" || state.mode === "feedback";
  }

  function renderPoseCalibration() {
    els.poseCalibrationTitle.textContent = poseCalibrationState?.mode === "position"
      ? "Position the robot"
      : poseCalibrationState?.mode === "feedback" ? "Mark the first bounce" : "Calibrate robot pose";
    els.poseCalibrationDialog.classList.toggle("pose-feedback-mode", poseCalibrationState?.mode === "feedback");
    renderPoseCalibrationTable();
    renderPoseCalibrationGuide();
  }

  function openPoseCalibration() {
    initializePoseCalibration();
    renderPoseCalibration();
    els.poseCalibrationDialog.showModal();
  }

  function closePoseCalibration() {
    poseCalibrationDrag = null;
    poseMeasurementGesture = null;
    poseCalibrationState = null;
    els.poseCalibrationDialog.close();
  }

  function resetPoseVerificationAfterManualMove() {
    const state = poseCalibrationState;
    if (!state) return;
    state.uncertainty = PoseCalibration.sanitizeUncertainty(MANUAL_POSE_PRIOR);
    state.covariance = PoseCalibration.covarianceFromUncertainty(state.uncertainty);
    const plan = PoseCalibration.planCalibrationSequence(library.calibration.table, state.pose, state.uncertainty, { covariance: state.covariance, maxShots: 4 });
    state.targets = plan.sequence;
    state.planStatus = plan.status;
    state.currentTarget = null;
    state.mode = "position";
    state.observations = [];
    state.landingMarks = [];
    state.recentTargets = [];
    state.shotsFired = 0;
    state.acceptedCount = 0;
    state.currentWatchGroup = null;
    state.verificationAttempted = false;
    state.verificationPassed = false;
    state.confidenceLimited = false;
    state.manuallyMoved = true;
    state.measurementViewport = null;
  }

  function poseSvgEventPoint(event) {
    const svg = els.poseCalibrationTableSvg;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / 420, rect.height / 700);
    const offsetX = (rect.width - 420 * scale) / 2;
    const offsetY = (rect.height - 700 * scale) / 2;
    return { x: (event.clientX - rect.left - offsetX) / scale, y: (event.clientY - rect.top - offsetY) / scale };
  }

  function beginPoseCalibrationDrag(event) {
    if (!poseCalibrationState || poseCalibrationState.mode === "firing" || poseCalibrationState.mode === "feedback") return;
    const control = event.target.closest("[data-pose-drag]");
    if (!control) return;
    poseCalibrationDrag = { kind: control.dataset.poseDrag, pointerId: event.pointerId };
    els.poseCalibrationTableSvg.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function updatePoseCalibrationDrag(event) {
    if (!poseCalibrationDrag || poseCalibrationDrag.pointerId !== event.pointerId || !poseCalibrationState) return;
    const point = poseSvgEventPoint(event);
    if (poseCalibrationDrag.kind === "position") {
      poseCalibrationState.pose = poseFromTablePoint(point, poseCalibrationState.pose.yawDeg);
    } else {
      const robot = poseTablePoint(poseCalibrationState.pose);
      poseCalibrationState.pose.yawDeg = clamp(degrees(Math.atan2(-(point.x - robot.x), -(point.y - robot.y))), -180, 180, 0);
    }
    resetPoseVerificationAfterManualMove();
    renderPoseCalibration();
  }

  function endPoseCalibrationDrag(event) {
    if (poseCalibrationDrag?.pointerId !== event.pointerId) return;
    poseCalibrationDrag = null;
    els.poseCalibrationTableSvg.releasePointerCapture?.(event.pointerId);
  }

  function startPoseVerification() {
    if (!poseCalibrationState) return;
    poseCalibrationState.uncertainty = PoseCalibration.sanitizeUncertainty(MANUAL_POSE_PRIOR);
    poseCalibrationState.covariance = PoseCalibration.covarianceFromUncertainty(poseCalibrationState.uncertainty);
    poseCalibrationState.recentTargets = [];
    poseCalibrationState.shotsFired = 0;
    poseCalibrationState.acceptedCount = 0;
    poseCalibrationState.currentWatchGroup = null;
    poseCalibrationState.verificationAttempted = false;
    poseCalibrationState.currentTarget = choosePoseTarget(poseCalibrationState, false);
    poseCalibrationState.mode = "ready";
    poseCalibrationState.observations = [];
    poseCalibrationState.landingMarks = [];
    renderPoseCalibration();
  }

  async function fireCurrentPoseVerification() {
    const state = poseCalibrationState;
    const target = state?.currentTarget;
    const solution = target?.shotSolution;
    if (!state || !target || !solution) { toast("This verification target is not feasible from the current position."); return; }
    state.mode = "firing";
    renderPoseCalibration();
    await runCalibrationTestShot(solution.params, `${target.label} verification`, () => {
      if (!poseCalibrationState) return;
      poseCalibrationState.mode = "feedback";
      renderPoseCalibration();
    });
    if (poseCalibrationState?.mode === "firing" && !calibrationTestRunning) {
      poseCalibrationState.mode = "ready";
      renderPoseCalibration();
    }
  }

  function finishPoseObservation(observation) {
    const state = poseCalibrationState;
    if (!state || state.mode !== "feedback") return;
    const target = state.currentTarget;
    const hasMeasurement = observation.longitudinalErrorCm != null || observation.lateralErrorCm != null;
    const normalizedComponents = [];
    if (observation.longitudinalErrorCm != null) normalizedComponents.push(observation.longitudinalErrorCm / Math.hypot(observation.shotSigmaCm, observation.humanSigmaLongitudinalCm));
    if (observation.lateralErrorCm != null) normalizedComponents.push(observation.lateralErrorCm / Math.hypot(observation.shotSigmaCm, observation.humanSigmaLateralCm));
    const verificationZ = normalizedComponents.length ? Math.sqrt(normalizedComponents.reduce((sum, value) => sum + value * value, 0) / normalizedComponents.length) : Infinity;
    let estimate = null;
    if (target.isVerification && hasMeasurement && verificationZ <= 2) {
      state.verificationPassed = true;
      observation.accepted = true;
    } else {
      estimate = PoseCalibration.estimatePoseObservation(state.pose, state.covariance, observation, state.uncertainty);
      observation.accepted = estimate.accepted;
      observation.downweighted = estimate.downweighted;
      if (estimate.accepted) {
        state.pose = estimate.correctedPose;
        state.covariance = estimate.covariance;
        state.uncertainty = estimate.uncertainty;
        state.acceptedCount += 1;
      }
      if (target.isVerification) state.verificationAttempted = false;
    }
    state.observations.push(observation);
    if (hasMeasurement) state.landingMarks.push({
      x: target.x + (observation.longitudinalErrorCm || 0) / 100,
      y: target.y + (observation.lateralErrorCm || 0) / 100,
      targetId: target.id,
    });
    state.shotsFired += 1;
    state.recentTargets.push({ id: target.id, x: target.x, y: target.y, watchGroup: target.watchGroup });
    state.currentWatchGroup = target.watchGroup;
    if (state.verificationPassed) {
      state.mode = "complete";
    } else if (state.shotsFired >= MAX_POSE_CALIBRATION_SHOTS) {
      state.confidenceLimited = true;
      state.mode = "complete";
    } else {
      const shouldVerify = !state.verificationAttempted && poseEstimateReadyForVerification(state);
      if (shouldVerify) state.verificationAttempted = true;
      state.currentTarget = choosePoseTarget(state, shouldVerify);
      state.mode = state.currentTarget ? "ready" : "complete";
      if (!state.currentTarget) state.confidenceLimited = true;
    }
    renderPoseCalibration();
  }

  function recordPoseObservationFromMap(event, svg) {
    const state = poseCalibrationState;
    const target = state?.currentTarget;
    if (!state || state.mode !== "feedback" || !target) return;
    const mapped = poseMapPhysicalPoint(event, svg);
    if (!mapped?.inside) return;
    const { actual, scale, plotWidth, maxY, minY } = mapped;
    const table = library.calibration.table;
    const cmPerCssPixel = (maxY - minY) * 100 / (plotWidth * scale);
    const measurement = PoseCalibration.feedbackMeasurementNoise(table, actual, {
      gridCm: finite(svg.dataset.gridCm, 10), pointerSigmaCm: Math.max(1.5, cmPerCssPixel * 5),
      longitudinalGridOriginM: finite(svg.dataset.referenceX, 0), lateralGridOriginM: finite(svg.dataset.referenceY, -table.width/2),
    });
    const outside = measurement.outsideLongitudinal || measurement.outsideLateral;
    finishPoseObservation({
      targetId: target.id, kind: "table", quality: outside ? "outside-tap" : "tap", targetX: target.x, targetY: target.y,
      longitudinalErrorCm: (actual.x - target.x) * 100,
      lateralErrorCm: (actual.y - target.y) * 100,
      humanSigmaLongitudinalCm: measurement.longitudinalSigmaCm,
      humanSigmaLateralCm: measurement.lateralSigmaCm,
      outsideLongitudinal: measurement.outsideLongitudinal,
      outsideLateral: measurement.outsideLateral,
      shotSigmaCm: target.shotSigmaCm,
    });
  }

  function poseMapPhysicalPoint(event, svg) {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const viewWidth = finite(svg.dataset.viewWidth, 360);
    const viewHeight = finite(svg.dataset.viewHeight, 460);
    const scale = Math.min(rect.width / viewWidth, rect.height / viewHeight);
    const point = { x: (event.clientX - rect.left - (rect.width-viewWidth*scale)/2) / scale, y: (event.clientY - rect.top - (rect.height-viewHeight*scale)/2) / scale };
    const plotLeft = finite(svg.dataset.plotLeft, 28);
    const plotTop = finite(svg.dataset.plotTop, 11);
    const plotWidth = finite(svg.dataset.plotWidth, 304);
    const plotHeight = finite(svg.dataset.plotHeight, 438);
    const minX = finite(svg.dataset.minX, 0);
    const maxX = finite(svg.dataset.maxX, library.calibration.table.length);
    const minY = finite(svg.dataset.minY, -library.calibration.table.width/2);
    const maxY = finite(svg.dataset.maxY, library.calibration.table.width/2);
    const actual = {
      x: maxX - (point.y - plotTop) / plotHeight * (maxX - minX),
      y: maxY - (point.x - plotLeft) / plotWidth * (maxY - minY),
    };
    return {
      actual, scale, plotWidth, plotHeight, minX, maxX, minY, maxY,
      inside: point.x >= plotLeft && point.x <= plotLeft+plotWidth && point.y >= plotTop && point.y <= plotTop+plotHeight,
    };
  }

  function changePoseMeasurementZoom(factor, anchor = null) {
    const state = poseCalibrationState;
    const target = state?.currentTarget;
    const viewport = state?.measurementViewport;
    if (!state || state.mode !== "feedback" || !target || !viewport) return;
    const oldZoom = viewport.zoom;
    const newZoom = clamp(oldZoom * factor, .5, 6, oldZoom);
    if (anchor) {
      const ratio = oldZoom / newZoom;
      viewport.centerX = anchor.x - (anchor.x-viewport.centerX) * ratio;
      viewport.centerY = anchor.y - (anchor.y-viewport.centerY) * ratio;
    }
    viewport.zoom = newZoom;
    renderPoseCalibrationGuide();
  }

  function rebasePoseMeasurementGesture() {
    if (!poseMeasurementGesture || !poseCalibrationState?.measurementViewport) return;
    const points = [...poseMeasurementGesture.points.values()];
    poseMeasurementGesture.startViewport = { ...poseCalibrationState.measurementViewport };
    poseMeasurementGesture.startPoints = points.map(point => ({ ...point }));
    if (points.length >= 2) {
      poseMeasurementGesture.startDistance = Math.hypot(points[1].x-points[0].x, points[1].y-points[0].y);
      poseMeasurementGesture.startMidpoint = { x: (points[0].x+points[1].x)/2, y: (points[0].y+points[1].y)/2 };
    }
  }

  function beginPoseMeasurementGesture(event, svg) {
    if (!poseCalibrationState || poseCalibrationState.mode !== "feedback") return;
    if (!poseMeasurementGesture) poseMeasurementGesture = { points: new Map(), origins: new Map(), maxMovement: 0, hadMultiple: false };
    const point = { x: event.clientX, y: event.clientY };
    poseMeasurementGesture.points.set(event.pointerId, point);
    poseMeasurementGesture.origins.set(event.pointerId, point);
    if (poseMeasurementGesture.points.size > 1) poseMeasurementGesture.hadMultiple = true;
    els.poseCalibrationGuide.setPointerCapture?.(event.pointerId);
    rebasePoseMeasurementGesture();
    event.preventDefault();
  }

  function updatePoseMeasurementGesture(event) {
    const gesture = poseMeasurementGesture;
    const viewport = poseCalibrationState?.measurementViewport;
    if (!gesture?.points.has(event.pointerId) || !viewport) return;
    gesture.points.set(event.pointerId, { x:event.clientX, y:event.clientY });
    const origin = gesture.origins.get(event.pointerId);
    gesture.maxMovement = Math.max(gesture.maxMovement, Math.hypot(event.clientX-origin.x,event.clientY-origin.y));
    const svg = els.poseCalibrationGuide.querySelector(".pose-observation-map");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width/finite(svg.dataset.viewWidth,360), rect.height/finite(svg.dataset.viewHeight,460));
    const cssPlotWidth = finite(svg.dataset.plotWidth,304) * scale;
    const cssPlotHeight = finite(svg.dataset.plotHeight,438) * scale;
    const points = [...gesture.points.values()];
    const start = gesture.startViewport;
    const startLongitudinalSpan = start.baseLongitudinalSpan / start.zoom;
    const startLateralSpan = start.baseLateralSpan / start.zoom;
    if (points.length >= 2) {
      const distance = Math.max(10, Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));
      const midpoint = { x:(points[0].x+points[1].x)/2, y:(points[0].y+points[1].y)/2 };
      viewport.zoom = clamp(start.zoom * distance/Math.max(10,gesture.startDistance), .5, 6, start.zoom);
      viewport.centerY = start.centerY + (midpoint.x-gesture.startMidpoint.x) * startLateralSpan/cssPlotWidth;
      viewport.centerX = start.centerX + (midpoint.y-gesture.startMidpoint.y) * startLongitudinalSpan/cssPlotHeight;
    } else {
      viewport.centerY = start.centerY + (points[0].x-gesture.startPoints[0].x) * startLateralSpan/cssPlotWidth;
      viewport.centerX = start.centerX + (points[0].y-gesture.startPoints[0].y) * startLongitudinalSpan/cssPlotHeight;
    }
    const table = library.calibration.table;
    viewport.centerX = clamp(viewport.centerX, -1.5, table.length+1.5, start.centerX);
    viewport.centerY = clamp(viewport.centerY, -table.width/2-1.5, table.width/2+1.5, start.centerY);
    renderPoseCalibrationGuide();
    event.preventDefault();
  }

  function endPoseMeasurementGesture(event) {
    const gesture = poseMeasurementGesture;
    if (!gesture?.points.has(event.pointerId)) return;
    gesture.points.delete(event.pointerId);
    els.poseCalibrationGuide.releasePointerCapture?.(event.pointerId);
    if (gesture.points.size) {
      rebasePoseMeasurementGesture();
    } else {
      const isTap = !gesture.hadMultiple && gesture.maxMovement < 6 && event.type !== "pointercancel";
      poseMeasurementGesture = null;
      if (isTap) recordPoseObservationFromMap(event, els.poseCalibrationGuide.querySelector(".pose-observation-map"));
    }
    event.preventDefault();
  }

  function zoomPoseMeasurementWithWheel(event, svg) {
    const mapped = poseMapPhysicalPoint(event, svg);
    if (!mapped?.inside) return;
    changePoseMeasurementZoom(Math.exp(-event.deltaY*.002), mapped.actual);
    event.preventDefault();
  }

  function savePoseCalibration() {
    const state = poseCalibrationState;
    if (!state) return;
    const now = new Date().toISOString();
    library.calibration.pose = { ...state.pose };
    library.calibration.poseSession = PoseCalibration.sanitizeSession({
      ...currentPoseSession(), pose: state.pose, uncertainty: state.uncertainty, covariance: state.covariance,
      updatedAt: now, verifiedAt: state.verificationPassed ? now : null,
      observations: state.observations,
    }, state.pose);
    poseStaleAcknowledged = state.verificationPassed;
    liveTuningCache.clear(); shotVariationCache.clear();
    saveLibrary(); renderCalibration(); renderRunPage();
    closePoseCalibration();
    toast(state.verificationPassed ? "Calibrated robot pose saved" : state.confidenceLimited ? "Robot position saved with limited confidence" : "Robot position saved");
  }

  function renderCalibration() {
    const c = library.calibration;
    els.rotationTypeInput.value = String(c.rotationType);
    els.gravityInput.value = c.gravity;
    els.ballMassInput.value = c.physics.ballMassKg * 1000;
    els.airTemperatureInput.value = c.physics.airTemperatureC;
    els.airPressureInput.value = c.physics.airPressureKpa;
    els.windXInput.value = c.physics.wind.x;
    els.windYInput.value = c.physics.wind.y;
    els.windZInput.value = c.physics.wind.z;
    els.dragScaleInput.value = c.physics.dragScale;
    els.magnusScaleInput.value = c.physics.magnusScale;
    els.airGasConstantInput.value = c.physics.dryAirGasConstant;
    els.sutherlandMu0Input.value = c.physics.sutherlandMu0;
    els.sutherlandT0Input.value = c.physics.sutherlandT0;
    els.sutherlandSInput.value = c.physics.sutherlandS;
    els.timeStepInput.value = c.timeStep;
    els.maxFlightInput.value = c.maxFlightTime;
    els.rawAtZeroSpeedInput.value = c.nova.rawAtZeroSpeedLevel;
    els.rawPerSpeedInput.value = c.nova.rawPerSpeedLevel;
    els.rawDeltaPerSpinInput.value = c.nova.rawDeltaPerSpinLevel;
    els.upDownAtZeroInput.value = c.nova.upDownAtZeroDeg;
    els.upDownPerDegreeInput.value = c.nova.upDownPerDegree;
    els.yawPerPlacementInput.value = c.nova.yawDegreesPerPlacement;
    els.testSpeedInput.value = c.testShot.speedMps;
    els.testSpinInput.value = c.testShot.spinRps;
    els.testElevationInput.value = c.testShot.elevationDeg;
    els.testAimInput.value = c.testShot.aimDeg;
    els.tableLengthInput.value = c.table.length;
    els.tableWidthInput.value = c.table.width;
    els.netHeightInput.value = c.table.netHeight;
    els.ballDiameterInput.value = c.physics.ballDiameterM;
    renderGuidedCalibration();
    renderNovaScaleTable();
    renderPhysicsReadouts();
    renderAerodynamicTables();
    renderCalibrationGraphics();
    renderCalibrationTestShotPanel();
    renderTableDimensionGraphic();
  }

  function renderPhysicsReadouts() {
    const air = airProperties();
    els.physicsReadouts.innerHTML = `
      <div><span>Dry-air density</span><strong>${fmt(air.density,4)} kg/m³</strong></div>
      <div><span>Dynamic viscosity</span><strong>${air.dynamicViscosity.toExponential(4)} Pa·s</strong></div>
      <div><span>Kinematic viscosity</span><strong>${air.kinematicViscosity.toExponential(4)} m²/s</strong></div>
      <div><span>Ball mass</span><strong>${fmt(library.calibration.physics.ballMassKg * 1000,2)} g</strong></div>`;
  }

  function renderAerodynamicTables() {
    const dragRows = dragCoefficientModel().map(row => `
      <tr>
        <th>${fmt(row.speed,1)} m/s</th>
        <td>${row.spinRatio.map(value => fmt(value,2)).join(", ")}</td>
        <td>${row.cd.map(value => fmt(value,2)).join(", ")}</td>
      </tr>`).join("");
    const magnusRows = magnusCoefficientModel().map(row => `
      <tr>
        <th>${fmt(row.speed,1)} m/s</th>
        <td>${row.m.toExponential(3)}</td>
        <td>${fmt(row.s,4)}</td>
        <td>${fmt(row.omegaBreak,0)}</td>
        <td>${row.a.toExponential(3)}</td>
        <td>${row.b.toExponential(3)}</td>
        <td>${fmt(row.c,4)}</td>
      </tr>`).join("");
    els.aeroCoefficientTables.innerHTML = `
      <h4>Drag coefficient C<sub>D</sub></h4>
      <div class="coefficient-table-wrap">
        <table class="coefficient-table">
          <thead><tr><th>Reference speed</th><th>Spin-ratio breakpoints</th><th>C<sub>D</sub> values</th></tr></thead>
          <tbody>${dragRows}</tbody>
        </table>
      </div>
      <h4>Magnus coefficient C<sub>M</sub></h4>
      <div class="coefficient-table-wrap">
        <table class="coefficient-table magnus-table">
          <thead><tr><th>Speed</th><th>m</th><th>s</th><th>ω break</th><th>a</th><th>b</th><th>c</th></tr></thead>
          <tbody>${magnusRows}</tbody>
        </table>
      </div>`;

    const prediction = predictTrajectory(library.calibration.testShot);
    const d = prediction.diagnostics.initial;
    els.aeroDiagnostics.innerHTML = `
      <h4>Current test-shot launch diagnostics</h4>
      <dl>
        <div><dt>Reynolds number</dt><dd>${fmt(d.reynolds,0)}</dd></div>
        <div><dt>Spin ratio</dt><dd>${fmt(d.spinRatio,3)}</dd></div>
        <div><dt>Drag coefficient</dt><dd>${fmt(d.dragCoefficient,4)}</dd></div>
        <div><dt>Magnus coefficient</dt><dd>${fmt(d.magnusCoefficient,4)}</dd></div>
        <div><dt>Relative air speed</dt><dd>${fmt(d.speed,3)} m/s</dd></div>
        <div><dt>Angular speed</dt><dd>${fmt(d.omegaMagnitude,1)} rad/s</dd></div>
      </dl>`;
  }

  function renderNovaScaleTable() {
    const nova = library.calibration.nova;
    const speedModel = LaunchModel.sanitizeLinearModel(nova.speedModel);
    if (els.linearSpeedModelReadout) {
      const range = LaunchModel.calibratedSpeedRange(speedModel);
      els.linearSpeedModelReadout.innerHTML = `<strong>Global speed line:</strong> v = ${fmt(speedModel.interceptMps,6)} + ${fmt(speedModel.slopeMpsPerRaw,9)} × raw m/s. ${range ? `Measured calibration range ${Math.round(speedModel.calibratedRawMin)}–${Math.round(speedModel.calibratedRawMax)} raw (${fmt(range.minMps,2)}–${fmt(range.maxMps,2)} m/s); outside it the same line is extrapolated.` : ""}`;
    }
    els.novaScaleTableBody.replaceChildren();
    nova.spinsightCurve.forEach((point, index) => {
      const raw = LaunchModel.rawFromLevel(point.level, nova);
      const speedMps = LaunchModel.exitSpeedFromRaw(raw, speedModel);
      const row = document.createElement("tr");
      if (point.estimated) row.classList.add("estimated-row");
      row.innerHTML = `
        <th>${fmt(point.level,1)}${point.estimated ? `<small>estimated spin capacity</small>` : ""}</th>
        <td><strong>${fmt(speedMps,2)} m/s</strong><small>${fmt(speedMps * 3.6,1)} km/h · raw ${Math.round(raw)}</small></td>
        <td><input data-nova-index="${index}" data-nova-field="maxSpinSetting" type="number" min="0" max="10" step=".1" value="${point.maxSpinSetting}"></td>
        <td><span class="table-input-unit"><input data-nova-index="${index}" data-nova-field="maxSpinRps" type="number" min="0" max="200" step=".1" value="${point.maxSpinRps}"><small>rps</small></span></td>`;
      els.novaScaleTableBody.appendChild(row);
    });
  }
  function renderCalibrationGraphics() {
    const c = library.calibration;
    const p = predictTrajectory(c.testShot, c);
    calibrationViewTransform = metricTransform(760, 470, topBounds(p, c, .34), 30);
    const tr = calibrationViewTransform;
    const table = c.table;
    const rx = tr.sx(c.pose.x), ry = tr.sy(c.pose.y);
    const arrowLength = Math.max(42, tr.scale * .32);
    const yaw = radians(c.pose.yawDeg);
    const ax = rx + Math.cos(yaw) * arrowLength;
    const ay = ry - Math.sin(yaw) * arrowLength;
    const color = p.status === "table" ? "#55c98c" : p.status === "net" ? "#e76a73" : "#e4b85c";
    const path = p.points.map((point,index) => `${index ? "L" : "M"} ${fmt(tr.sx(point.x),2)} ${fmt(tr.sy(point.y),2)}`).join(" ");

    els.poseSvg.innerHTML = `
      <rect x="${tr.sx(0)}" y="${tr.sy(table.width/2)}" width="${tr.sx(table.length)-tr.sx(0)}" height="${tr.sy(-table.width/2)-tr.sy(table.width/2)}" rx="6" fill="#173e58" stroke="#83a6bd" stroke-width="3"/>
      <line x1="${tr.sx(table.length/2)}" y1="${tr.sy(table.width/2)}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(-table.width/2)}" stroke="#d7dee7" stroke-width="4"/>
      <text x="${tr.sx(.05)}" y="${tr.sy(table.width/2)-9}" fill="#9fb0c2" font-size="13">Near edge · X = 0</text>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4"/>
      ${p.landing ? `<circle cx="${tr.sx(p.landing.x)}" cy="${tr.sy(p.landing.y)}" r="8" fill="${color}"/>` : ""}
      <circle data-pose-drag="position" cx="${rx}" cy="${ry}" r="18" fill="#32bda2" stroke="#d5fff6" stroke-width="3" style="cursor:grab"/>
      <line x1="${rx}" y1="${ry}" x2="${ax}" y2="${ay}" stroke="#f3cf8e" stroke-width="5"/>
      <circle data-pose-drag="yaw" cx="${ax}" cy="${ay}" r="10" fill="#e4a84c" stroke="#fff0ce" stroke-width="3" style="cursor:crosshair"/>
      <text x="${rx+22}" y="${ry+5}" fill="#dffbf5" font-size="13">Robot</text>
      <text x="${tr.sx(table.length)+8}" y="${tr.sy(-table.width/2)}" fill="#9fb0c2" font-size="12">${fmt(table.length,3)} × ${fmt(table.width,3)} m</text>
    `;
    els.poseLandingSummary.innerHTML = landingDescription(p);
    els.calibrationSideTrajectory.innerHTML = sideTrajectorySvg(p, 760, 330).replace(/^<svg[^>]*>|<\/svg>$/g, "");

    els.poseSvg.querySelectorAll("[data-pose-drag]").forEach(element => element.addEventListener("pointerdown", event => {
      event.preventDefault();
      poseDrag = { mode: element.dataset.poseDrag };
      document.addEventListener("pointermove", onPosePointerMove);
      document.addEventListener("pointerup", onPosePointerUp, { once: true });
    }));
  }

  function renderTableDimensionGraphic() {
    const t = library.calibration.table;
    const width = 760, height = 430;
    const scale = Math.min(175, (width - 190) / t.length, 245 / t.width);
    const x0 = 125;
    const topY = 48;
    const topW = t.length * scale;
    const topH = t.width * scale;
    const sideY = Math.max(355, topY + topH + 65);
    const netH = t.netHeight * scale;
    els.tableDimensionSvg.innerHTML = `
      <text x="30" y="30" fill="#dce4ed" font-size="15" font-weight="700">Top view</text>
      <rect x="${x0}" y="${topY}" width="${topW}" height="${topH}" rx="5" fill="#173e58" stroke="#83a6bd" stroke-width="3"/>
      <line x1="${x0+topW/2}" y1="${topY}" x2="${x0+topW/2}" y2="${topY+topH}" stroke="#d7dee7" stroke-width="4"/>
      <line x1="${x0}" y1="${topY-20}" x2="${x0+topW}" y2="${topY-20}" stroke="#e4a84c" stroke-width="2"/>
      <text x="${x0+topW/2}" y="${topY-26}" text-anchor="middle" fill="#f1cf94" font-size="13">length ${fmt(t.length,3)} m</text>
      <line x1="${x0-22}" y1="${topY}" x2="${x0-22}" y2="${topY+topH}" stroke="#e4a84c" stroke-width="2"/>
      <text x="${x0-30}" y="${topY+topH/2}" text-anchor="middle" transform="rotate(-90 ${x0-30} ${topY+topH/2})" fill="#f1cf94" font-size="13">width ${fmt(t.width,3)} m</text>
      <text x="30" y="${sideY-28}" fill="#dce4ed" font-size="15" font-weight="700">Side profile · table surface and net at the same scale</text>
      <line x1="${x0}" y1="${sideY}" x2="${x0+topW}" y2="${sideY}" stroke="#7890aa" stroke-width="7"/>
      <line x1="${x0+topW/2}" y1="${sideY}" x2="${x0+topW/2}" y2="${sideY-netH}" stroke="#d7dee7" stroke-width="4"/>
      <text x="${x0+topW/2+10}" y="${sideY-netH-8}" fill="#d7dee7" font-size="13">net ${fmt(t.netHeight,4)} m</text>
    `;
  }

  function onPosePointerMove(event) {
    if (!poseDrag) return;
    const rect = els.poseSvg.getBoundingClientRect();
    const vx = (event.clientX - rect.left) / rect.width * 760;
    const vy = (event.clientY - rect.top) / rect.height * 470;
    if (!calibrationViewTransform) return;
    const wx = calibrationViewTransform.wx(vx);
    const wy = calibrationViewTransform.wy(vy);
    const c = library.calibration;

    if (poseDrag.mode === "position") {
      c.pose.x = clamp(wx, -1.5, c.table.length + 1.5, c.pose.x);
      c.pose.y = clamp(wy, -c.table.width, c.table.width, c.pose.y);
    } else {
      c.pose.yawDeg = clamp(degrees(Math.atan2(wy - c.pose.y, wx - c.pose.x)), -180, 180, c.pose.yawDeg);
    }
    saveLibrary();
    renderCalibration();
    renderGraph();
  }

  function onPosePointerUp() {
    document.removeEventListener("pointermove", onPosePointerMove);
    poseDrag = null;
  }

  function guidedState() {
    if (!library.calibration.guided) library.calibration.guided = defaultGuidedCalibration();
    const g = library.calibration.guided;
    if (!Array.isArray(g.shots) || !g.shots.length) rebuildGuidedPlan(false);
    g.currentIndex = Math.min(Math.max(0, Math.round(finite(g.currentIndex, 0))), Math.max(0, g.shots.length - 1));
    return g;
  }

  function guidedCurrentShot() {
    const g = guidedState();
    return g.shots[g.currentIndex] || null;
  }

  function guidedBaseBackXMetres(g = guidedState()) {
    return finite(g.baseBackXcm, 0) / 100;
  }
  function guidedSpeedEstimate(raw) {
    const model = library.calibration.nova.speedModel;
    return LaunchModel.exitSpeedFromRaw(raw, model);
  }
  function guidedPlanSignature(g = guidedState()) {
    const model = LaunchModel.sanitizeLinearModel(library.calibration.nova.speedModel);
    const table = library.calibration.table;
    return JSON.stringify([
      ROBOT_GEOMETRY_REFERENCE,
      g.placement, g.distanceReference, finite(g.baseBackXcm, 0), finite(g.measurementOffsetCm, 0),
      finite(g.elevationMinDeg, 0), finite(g.elevationMaxDeg, 0), finite(g.elevationCount, 0),
      finite(g.speedMinRaw, 0), finite(g.speedMaxRaw, 0), finite(g.speedCount, 0),
      finite(model?.interceptMps, 0), finite(model?.slopeMpsPerRaw, 0),
      finite(model?.calibratedRawMin, 0), finite(model?.calibratedRawMax, 0),
      finite(table?.length, 2.74), finite(table?.netHeight, .1525),
    ]);
  }
  function syncGuidedConfigFromInputs() {
    const g = guidedState();
    g.placement = els.guidedPlacementGround.checked ? "ground" : "table";
    g.distanceReference = g.placement === "ground" ? "base_back" : els.guidedDistanceReference.value;
    g.baseBackXcm = g.placement === "ground" ? 0 : clamp(els.guidedNozzleXInput.value, -300, 300, 0);
    g.measurementOffsetCm = clamp(els.guidedMeasurementOffsetInput.value, -200, 200, 0);
    g.tableHeightCm = clamp(els.guidedTableHeightInput.value, 40, 120, 76);
    g.repeatCount = Math.round(clamp(els.guidedRepeatCountInput.value, 1, 12, 3));
    g.elevationMinDeg = clamp(els.guidedElevationMinInput.value, -20, 60, g.placement === "ground" ? 5 : 10);
    g.elevationMaxDeg = clamp(els.guidedElevationMaxInput.value, -20, 60, g.placement === "ground" ? 45 : 30);
    g.elevationCount = Math.round(clamp(els.guidedElevationCountInput.value, 2, 12, 5));
    g.speedMinRaw = Math.round(clamp(els.guidedSpeedMinInput.value, 400, 7500, 2000));
    g.speedMaxRaw = Math.round(clamp(els.guidedSpeedMaxInput.value, 400, 7500, 3000));
    g.speedCount = Math.round(clamp(els.guidedSpeedCountInput.value, 2, 8, g.placement === "ground" ? 6 : 3));
    return g;
  }
  function rebuildGuidedPlan(preserve = true) {
    const g = library.calibration.guided || defaultGuidedCalibration();
    const previous = preserve && Array.isArray(g.shots) ? g.shots : [];
    const previousCurrent = previous[g.currentIndex || 0] || null;
    const previousCurrentKey = previousCurrent ? `${previousCurrent.rawSpeed}|${previousCurrent.elevationDeg}` : null;
    const byKey = new Map(previous.map(shot => [`${shot.rawSpeed}|${shot.elevationDeg}`, shot]));
    const plan = GuidedCalibration.buildPlan({
      placement: g.placement,
      distanceReference: g.distanceReference,
      baseBackXFromNearEdgeM: guidedBaseBackXMetres(g),
      measurementOffsetM: finite(g.measurementOffsetCm, 0) / 100,
      speedModel: library.calibration.nova.speedModel,
      tableLengthM: library.calibration.table.length,
      netXFromNearEdgeM: library.calibration.table.length / 2,
      netHeightM: library.calibration.table.netHeight,
      elevationMinDeg: g.elevationMinDeg,
      elevationMaxDeg: g.elevationMaxDeg,
      elevationCount: g.elevationCount,
      speedMinRaw: g.speedMinRaw,
      speedMaxRaw: g.speedMaxRaw,
      speedCount: g.speedCount,
    });
    g.shots = plan.shots.map(shot => {
      const old = byKey.get(`${shot.rawSpeed}|${shot.elevationDeg}`);
      return old ? { ...shot, distanceCm: old.distanceCm, netClearanceCm: old.netClearanceCm, saved: old.saved } : shot;
    });
    const preservedIndex = previousCurrentKey ? g.shots.findIndex(shot => `${shot.rawSpeed}|${shot.elevationDeg}` === previousCurrentKey) : -1;
    g.currentIndex = preservedIndex >= 0 ? preservedIndex : Math.min(g.currentIndex || 0, Math.max(0, g.shots.length - 1));
    g.planSignature = guidedPlanSignature(g);
    g.lastResult = null;
    library.calibration.guided = g;
    saveLibrary();
  }
  function setGuidedPlacement(placement) {
    const g = guidedState();
    if (placement === g.placement) return;
    g.placement = placement;
    if (placement === "ground") {
      g.distanceReference = "base_back";
      g.baseBackXcm = 0;
      g.elevationMinDeg = 5;
      g.elevationMaxDeg = 45;
      g.elevationCount = 5;
      g.speedMinRaw = 2000;
      g.speedMaxRaw = 3000;
      g.speedCount = 6;
      for (const shot of g.shots || []) shot.netClearanceCm = null;
    } else {
      g.distanceReference = "net";
      g.baseBackXcm = 0;
      g.elevationMinDeg = 10;
      g.elevationMaxDeg = 30;
      g.elevationCount = 5;
      g.speedMinRaw = 2000;
      g.speedMaxRaw = 3000;
      g.speedCount = 3;
    }
    g.currentIndex = 0;
    rebuildGuidedPlan(false);
    renderGuidedCalibration();
  }
  function renderGuidedCalibration() {
    const g = guidedState();
    if (g.planSignature !== guidedPlanSignature(g)) rebuildGuidedPlan(true);
    const ground = g.placement === "ground";
    els.guidedPlacementTable.checked = !ground;
    els.guidedPlacementGround.checked = ground;
    if (ground) { g.distanceReference = "base_back"; g.baseBackXcm = 0; }
    els.guidedDistanceReference.value = g.distanceReference;
    els.guidedDistanceReference.disabled = ground;
    els.guidedNozzleXInput.value = g.baseBackXcm;
    els.guidedNozzleXInput.disabled = ground;
    els.guidedMeasurementOffsetInput.value = g.measurementOffsetCm ?? 0;
    els.guidedTableHeightInput.value = g.tableHeightCm;
    els.guidedRepeatCountInput.value = g.repeatCount;
    els.guidedElevationMinInput.value = g.elevationMinDeg;
    els.guidedElevationMaxInput.value = g.elevationMaxDeg;
    els.guidedElevationCountInput.value = g.elevationCount;
    els.guidedSpeedMinInput.value = g.speedMinRaw;
    els.guidedSpeedMaxInput.value = g.speedMaxRaw;
    els.guidedSpeedCountInput.value = g.speedCount;
    els.guidedTableHeightField.hidden = true;
    els.calibrationGuidedPanel.classList.toggle("ground-mode", ground);
    els.guidedNozzleXLabel.textContent = "Base back from near edge";
    els.guidedNozzleXHint.textContent = ground ? "Ground calibration defines the back of the base as x = 0." : "Position of the back of the base relative to the near table edge.";
    els.guidedPlacementHelp.innerHTML = ground
      ? `<strong>Ground setup:</strong> place the robot on a flat floor and measure from the <strong>back of the base</strong> to first ground contact. Geometry is fixed; only the two coefficients of the speed line are fitted.`
      : `<strong>Table setup:</strong> x refers to the <strong>back of the base</strong>. The fixed yaw/pitch pivot chain determines the moving release point.`;
    const refText = g.distanceReference === "base_back" ? "0 cm at the back of the robot base; positive is forward along the shot."
      : g.distanceReference === "net" ? "0 cm at the net; positive is toward the opponent."
      : g.distanceReference === "near_edge" ? "0 cm at the near table edge; positive is toward the net."
      : "0 cm directly below the moving wheel/release point; positive is forward.";
    els.guidedReferenceHint.textContent = refText;
    els.guidedDistanceLabel.textContent = ground ? "Distance from back of base" : "Landing distance";
    els.guidedNetHeightInput.disabled = ground;
    if (ground) els.guidedNetHeightInput.value = "";
    els.guidedComputeHelp.textContent = "One global line v = intercept + slope × raw is fitted directly to all included shots. Per-shot distance σ scales as predicted distance / sin(predicted incidence), then iterative 3.5-MAD rejects inconsistent standardized residuals.";
    els.guidedSpeedMinHint.textContent = `≈ ${fmt(guidedSpeedEstimate(g.speedMinRaw),2)} m/s from current linear calibration`;
    els.guidedSpeedMaxHint.textContent = `≈ ${fmt(guidedSpeedEstimate(g.speedMaxRaw),2)} m/s from current linear calibration`;
    els.guidedShotCountBadge.textContent = `${g.shots.length} shots · sorted by predicted distance`;
    const shot = guidedCurrentShot();
    if (shot) {
      els.guidedProgressText.textContent = `${g.currentIndex + 1} / ${g.shots.length}`;
      els.guidedCurrentElevation.textContent = `${fmt(shot.elevationDeg,1)}°`;
      els.guidedCurrentSpeed.textContent = `${Math.round(shot.rawSpeed)}`;
      const predicted = Number.isFinite(shot.predictedDistanceM) ? ` · predicted ${fmt(shot.predictedDistanceM * 100,0)} cm` : "";
      els.guidedCurrentSpeedMps.textContent = `≈ ${fmt(guidedSpeedEstimate(shot.rawSpeed),2)} m/s${predicted}`;
      els.guidedDistanceInput.value = shot.distanceCm ?? "";
      els.guidedNetHeightInput.value = ground ? "" : (shot.netClearanceCm ?? "");
    }
    els.guidedPreviousBtn.disabled = g.currentIndex <= 0;
    els.guidedNextBtn.disabled = g.currentIndex >= g.shots.length - 1;
    els.guidedFeedBtn.textContent = calibrationFeedRunning ? "Stop shooting" : "Start shooting";
    els.guidedFeedBtn.classList.toggle("running", calibrationFeedRunning);
    const snap = robot?.snapshot?.();
    if (calibrationFeedRunning) els.guidedFeedStatus.textContent = `Feeding ${g.repeatCount} repeated balls at 0.5 Hz for the current setting. Stop at any time.`;
    else if (!snap?.browserSupported && !snap?.connected) els.guidedFeedStatus.textContent = "Live shooting needs Web Bluetooth in a compatible Chromium browser. Data entry and fitting still work offline.";
    else if (!snap?.connected) els.guidedFeedStatus.textContent = "Press Start shooting to connect Nova and begin a low-pace repeated feed.";
    else els.guidedFeedStatus.textContent = "Nova connected. Start shooting uses equal wheel inputs and 0.5 Hz feed.";
    renderGuidedMeasurementTable();
    renderGuidedResult();
  }
  function renderGuidedMeasurementTable() {
    const g = guidedState();
    const distanceCount = g.shots.filter(s => s.distanceCm != null).length;
    const heightCount = g.shots.filter(s => s.netClearanceCm != null).length;
    const visited = g.shots.filter(s => s.saved).length;
    const ground = g.placement === "ground";
    els.guidedMeasurementSummary.innerHTML = ground
      ? `<span>${visited}/${g.shots.length} visited</span><span>${distanceCount} ground distances</span>`
      : `<span>${visited}/${g.shots.length} visited</span><span>${distanceCount} distances</span><span>${heightCount} net heights</span>`;
    els.guidedMeasurementBody.innerHTML = g.shots.map((shot, index) => {
      const active = index === g.currentIndex ? " active" : "";
      const status = shot.saved ? (shot.distanceCm == null && shot.netClearanceCm == null ? "skipped" : "saved") : "pending";
      return `<tr class="${active}" data-guided-row="${index}"><td>${index + 1}</td><td>${fmt(shot.elevationDeg,1)}°</td><td>${Math.round(shot.rawSpeed)}</td><td>${shot.distanceCm == null ? "—" : `${fmt(shot.distanceCm,1)} cm`}</td><td class="net-height-column">${shot.netClearanceCm == null ? "—" : `${fmt(shot.netClearanceCm,1)} cm`}</td><td><span class="measurement-state ${status}">${status}</span></td></tr>`;
    }).join("");
  }

  function saveGuidedCurrentInputs() {
    const shot = guidedCurrentShot();
    if (!shot) return;
    const distanceRaw = String(els.guidedDistanceInput.value).trim();
    const heightRaw = String(els.guidedNetHeightInput.value).trim();
    shot.distanceCm = distanceRaw === "" ? null : finite(distanceRaw, null);
    shot.netClearanceCm = guidedState().placement === "ground" ? null : (heightRaw === "" ? null : finite(heightRaw, null));
    shot.saved = true;
    guidedState().lastResult = null;
    saveLibrary();
  }

  function moveGuidedCurrent(delta) {
    const g = guidedState();
    g.currentIndex = Math.max(0, Math.min(g.shots.length - 1, g.currentIndex + delta));
    saveLibrary();
    renderGuidedCalibration();
  }

  async function saveGuidedAndNext() {
    const restartFeed = calibrationFeedRunning;
    if (restartFeed) await stopGuidedFeed();
    saveGuidedCurrentInputs();
    const g = guidedState();
    if (g.currentIndex < g.shots.length - 1) g.currentIndex += 1;
    saveLibrary();
    renderGuidedCalibration();
    if (restartFeed) await startGuidedFeed();
  }

  function guidedDirectPacket() {
    if (!Protocol) throw new Error("Robot protocol module is unavailable.");
    const g = guidedState();
    const shot = guidedCurrentShot();
    if (!shot) throw new Error("No calibration shot is selected.");
    const record = Protocol.packBallRecord({
      wheelA: Math.round(shot.rawSpeed),
      wheelB: Math.round(shot.rawSpeed),
      pitchDeg: shot.elevationDeg,
      yawDeg: 0,
      frequencyHz: 0.5,
      count: g.repeatCount,
    });
    return {
      packet: Protocol.buildStartPacket([record], { mode: 1, value: 1, sequence: 0 }),
      expectedDurationMs: g.repeatCount * 2000,
      shot,
    };
  }

  async function startGuidedFeed() {
    if (calibrationFeedRunning) return;
    if (playbackRunning || calibrationTestRunning || robotIsActive()) {
      toast("Stop the current robot activity before starting calibration feed.");
      return;
    }
    if (!robot) {
      toast("Robot controller module is unavailable.");
      return;
    }
    calibrationFeedRunning = true;
    calibrationFeedToken += 1;
    const token = calibrationFeedToken;
    renderGuidedCalibration();
    try {
      if (!robot.connected || !robot.authenticated) {
        calibrationFeedRunning = false;
        requestRobotConnection("Guided calibration shooting", () => startGuidedFeed());
        return;
      }
      while (calibrationFeedRunning && token === calibrationFeedToken) {
        await robot.ensureReadyForStart();
        if (!calibrationFeedRunning || token !== calibrationFeedToken) break;
        const direct = guidedDirectPacket();
        await robot.startBatch(direct.packet, {
          timeoutMs: Math.max(20000, direct.expectedDurationMs + 12000),
          expectedDurationMs: direct.expectedDurationMs,
          description: `guided calibration raw ${direct.shot.rawSpeed}, ${fmt(direct.shot.elevationDeg,1)} deg, repeated ${guidedState().repeatCount}`,
        });
      }
    } catch (error) {
      if (calibrationFeedRunning && token === calibrationFeedToken) toast(`Calibration feed stopped: ${error instanceof Error ? error.message : error}`);
    } finally {
      if (token === calibrationFeedToken) calibrationFeedRunning = false;
      updateRobotUI();
      renderGuidedCalibration();
    }
  }

  async function stopGuidedFeed() {
    if (!calibrationFeedRunning) return;
    calibrationFeedRunning = false;
    calibrationFeedToken += 1;
    renderGuidedCalibration();
    if (robot?.connected && robotIsActive()) {
      try { await robot.stopAndWaitFree(); } catch (error) { toast(`Stop not confirmed: ${error.message}`); }
    }
    updateRobotUI();
    renderGuidedCalibration();
  }

  async function toggleGuidedFeed() {
    if (calibrationFeedRunning) await stopGuidedFeed();
    else await startGuidedFeed();
  }

  function guidedFitSetup() {
    const g = guidedState();
    return {
      placement: g.placement,
      distanceReference: g.distanceReference,
      baseBackXFromNearEdgeM: guidedBaseBackXMetres(g),
      tableLengthM: library.calibration.table.length,
      netXFromNearEdgeM: library.calibration.table.length / 2,
      netHeightM: library.calibration.table.netHeight,
      measurementOffsetM: finite(g.measurementOffsetCm, 0) / 100,
      distanceNoisePerM: 0.015,
      madThreshold: 3.5,
      maxMadIterations: 8,
      netClearanceSigmaM: 0.01,
      speedModel: library.calibration.nova.speedModel,
      dt: 0.004,
    };
  }
  function computeGuidedCalibration() {
    syncGuidedConfigFromInputs();
    saveGuidedCurrentInputs();
    els.guidedComputeBtn.disabled = true;
    els.guidedComputeStatus.textContent = "Computing weighted robust two-parameter fit…";
    els.guidedFitBadge.textContent = "Computing";
    const g = guidedState();
    try {
      g.lastResult = GuidedCalibration.calibrate(g.shots, guidedFitSetup());
      saveLibrary();
      els.guidedComputeStatus.textContent = `Calibration computed: ${g.lastResult.distanceCount} used, ${g.lastResult.distanceRejectedCount} MAD-rejected. Review before applying.`;
      renderGuidedResult();
    } catch (error) {
      g.lastResult = null;
      els.guidedFitBadge.textContent = "Needs data";
      els.guidedFitBadge.className = "status-badge invalid";
      els.guidedComputeStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally { els.guidedComputeBtn.disabled = false; }
  }
  function residualGroupMeans(rows, key) {
    const groups = new Map();
    for (const row of rows || []) {
      if (!Number.isFinite(row?.distanceErrorM) || !Number.isFinite(Number(row?.[key]))) continue;
      const value = Number(row[key]);
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(row.distanceErrorM * 100);
    }
    return [...groups.entries()].sort((a,b) => a[0] - b[0]).map(([value, errors]) => ({
      value,
      meanCm: errors.reduce((sum, error) => sum + error, 0) / errors.length,
      count: errors.length,
    }));
  }

  function guidedResidualChartSvg(rows, key, title, xLabel) {
    const valid = (rows || []).filter(row => Number.isFinite(row?.distanceErrorM) && Number.isFinite(Number(row?.[key])));
    if (!valid.length) return `<div class="residual-chart-empty">No distance residuals available.</div>`;
    const width = 620, height = 250;
    const pad = { left: 52, right: 18, top: 34, bottom: 42 };
    const xs = valid.map(row => Number(row[key]));
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const errorsCm = valid.map(row => row.distanceErrorM * 100);
    const rawMax = Math.max(1, ...errorsCm.map(Math.abs));
    const yMax = Math.max(2, Math.ceil(rawMax / 2) * 2);
    const sx = value => pad.left + (xMax === xMin ? 0.5 : (value - xMin) / (xMax - xMin)) * (width - pad.left - pad.right);
    const sy = value => pad.top + (yMax - value) / (2 * yMax) * (height - pad.top - pad.bottom);
    const zeroY = sy(0);
    const groups = residualGroupMeans(valid, key);
    const meansPath = groups.map((group, index) => `${index ? "L" : "M"}${sx(group.value).toFixed(1)},${sy(group.meanCm).toFixed(1)}`).join(" ");
    const uniqueX = [...new Set(xs)].sort((a,b) => a-b);
    const xTicks = uniqueX.length <= 8 ? uniqueX : [xMin, xMax];
    const pointMarkup = valid.map(row => {
      const errorCm = row.distanceErrorM * 100;
      const measured = Number.isFinite(row.distanceM) ? `${fmt(row.distanceM * 100,1)} cm measured` : "measurement unavailable";
      const predicted = Number.isFinite(row.predictedDistanceM) ? `${fmt(row.predictedDistanceM * 100,1)} cm predicted` : "prediction unavailable";
      return `<circle cx="${sx(Number(row[key])).toFixed(1)}" cy="${sy(errorCm).toFixed(1)}" r="4.2" class="residual-point"><title>Raw ${Math.round(row.rawSpeed)} · ${fmt(row.elevationDeg,1)}° · ${measured} · ${predicted} · error ${errorCm >= 0 ? "+" : ""}${fmt(errorCm,2)} cm</title></circle>`;
    }).join("");
    const meansMarkup = groups.map(group => `<circle cx="${sx(group.value).toFixed(1)}" cy="${sy(group.meanCm).toFixed(1)}" r="5.2" class="residual-mean"><title>Group mean ${group.meanCm >= 0 ? "+" : ""}${fmt(group.meanCm,2)} cm · ${group.count} shots</title></circle>`).join("");
    return `<figure class="residual-chart-card">
      <figcaption><strong>${escapeHtml(title)}</strong><small>Predicted − measured landing distance</small></figcaption>
      <svg class="residual-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${width-pad.right}" y2="${zeroY.toFixed(1)}" class="residual-zero"/>
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height-pad.bottom}" class="residual-axis"/>
        <line x1="${pad.left}" y1="${height-pad.bottom}" x2="${width-pad.right}" y2="${height-pad.bottom}" class="residual-axis"/>
        <text x="${pad.left-8}" y="${sy(yMax)+4}" text-anchor="end" class="residual-tick">+${fmt(yMax,0)}</text>
        <text x="${pad.left-8}" y="${zeroY+4}" text-anchor="end" class="residual-tick">0</text>
        <text x="${pad.left-8}" y="${sy(-yMax)+4}" text-anchor="end" class="residual-tick">−${fmt(yMax,0)}</text>
        <text x="15" y="${height/2}" transform="rotate(-90 15 ${height/2})" text-anchor="middle" class="residual-axis-label">error (cm)</text>
        ${xTicks.map(value => `<g><line x1="${sx(value)}" y1="${height-pad.bottom}" x2="${sx(value)}" y2="${height-pad.bottom+5}" class="residual-axis"/><text x="${sx(value)}" y="${height-pad.bottom+19}" text-anchor="middle" class="residual-tick">${key === "rawSpeed" ? Math.round(value) : `${fmt(value,0)}°`}</text></g>`).join("")}
        <text x="${(pad.left+width-pad.right)/2}" y="${height-5}" text-anchor="middle" class="residual-axis-label">${escapeHtml(xLabel)}</text>
        ${meansPath ? `<path d="${meansPath}" class="residual-mean-line"/>` : ""}
        ${pointMarkup}${meansMarkup}
      </svg>
      <div class="residual-legend"><span><i class="residual-point-key"></i>shot</span><span><i class="residual-mean-key"></i>group mean</span></div>
    </figure>`;
  }

  function guidedResidualDiagnosticsMarkup(result) {
    const rows = (result.residualRows || []).filter(row => Number.isFinite(row?.distanceErrorM));
    if (!rows.length) return "";
    const included = rows.filter(row => row.included !== false);
    const rejected = rows.filter(row => row.included === false);
    const diagnostics = result.distanceDiagnostics || GuidedCalibration.summarizeDistanceResiduals(included);
    const biasCm = diagnostics?.meanErrorM == null ? null : diagnostics.meanErrorM * 100;
    const elevTrendCmPer10 = diagnostics?.elevationTrendMPerDeg == null ? null : diagnostics.elevationTrendMPerDeg * 1000;
    const speedTrendCmPer100 = diagnostics?.speedTrendMPerRaw == null ? null : diagnostics.speedTrendMPerRaw * 10000;
    const rejectedMarkup = rejected.length ? `<ul>${rejected.map(row => `<li>raw ${Math.round(row.rawSpeed)}, ${fmt(row.elevationDeg,1)}°: error ${fmt(row.distanceErrorM * 100,2)} cm · σ ${fmt(row.measurementSigmaM * 100,2)} cm · z ${fmt(row.standardizedResidual,2)}</li>`).join("")}</ul>` : "<p>No distance measurements were rejected.</p>";
    return `<section class="fit-diagnostics">
      <div class="fit-diagnostics-heading"><div><h4>Robust fit diagnostics</h4><p>Residuals are standardized by the distance/incidence uncertainty before iterative MAD rejection. The motor model always remains one line.</p></div><button id="guidedDownloadResidualsBtn" class="button ghost" type="button">Download residuals CSV</button></div>
      <div class="fit-diagnostic-stats">
        <div><span>Used / rejected</span><strong>${result.distanceCount} / ${result.distanceRejectedCount || 0}</strong></div>
        <div><span>Mean bias</span><strong>${biasCm == null ? "—" : `${biasCm >= 0 ? "+" : ""}${fmt(biasCm,2)} cm`}</strong></div>
        <div><span>Elevation trend</span><strong>${elevTrendCmPer10 == null ? "—" : `${elevTrendCmPer10 >= 0 ? "+" : ""}${fmt(elevTrendCmPer10,2)} cm / 10°`}</strong></div>
        <div><span>Speed trend</span><strong>${speedTrendCmPer100 == null ? "—" : `${speedTrendCmPer100 >= 0 ? "+" : ""}${fmt(speedTrendCmPer100,2)} cm / 100 raw`}</strong></div>
      </div>
      <div class="residual-chart-grid">${guidedResidualChartSvg(rows, "elevationDeg", "Residual by elevation", "elevation")}${guidedResidualChartSvg(rows, "rawSpeed", "Residual by wheel input", "raw wheel input")}</div>
      <div class="pitch-geometry-note"><strong>Fixed geometry</strong><p>Base→yaw 24.2 cm; yaw→pitch 7.5 cm; pitch→wheels 7.5 cm; yaw pivot height 24.0 cm. None are fitted.</p>${rejectedMarkup}</div>
    </section>`;
  }
  function exportGuidedMeasurements() {
    const g = guidedState();
    const header = ["index","raw_speed","elevation_deg","entered_distance_cm","measurement_offset_cm","corrected_distance_cm","net_clearance_cm","visited"];
    const offset = finite(g.measurementOffsetCm, 0);
    const rows = (g.shots || []).map((shot, index) => [
      index + 1,
      shot.rawSpeed,
      shot.elevationDeg,
      shot.distanceCm ?? "",
      offset,
      shot.distanceCm == null ? "" : finite(shot.distanceCm, 0) + offset,
      shot.netClearanceCm ?? "",
      Boolean(shot.saved),
    ].join(","));
    protocolDebugDownload(`nova-calibration-measurements-${new Date().toISOString().slice(0,10)}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
    toast("Calibration measurements exported");
  }

  function downloadGuidedResiduals() {
    const result = guidedState().lastResult;
    const rows = (result?.residualRows || []).filter(row => Number.isFinite(row?.distanceErrorM));
    if (!rows.length) { toast("No residual data to download"); return; }
    const header = ["raw_speed","elevation_deg","entered_distance_cm","corrected_distance_cm","predicted_distance_cm","error_cm","measurement_sigma_cm","incidence_deg","standardized_residual","included","rejection_iteration","measurement_offset_cm","measured_net_clearance_cm","predicted_net_clearance_cm","clearance_error_cm"];
    const body = rows.map(row => [
      row.rawSpeed, row.elevationDeg,
      row.enteredDistanceM == null ? "" : row.enteredDistanceM * 100,
      row.distanceM == null ? "" : row.distanceM * 100,
      row.predictedDistanceM == null ? "" : row.predictedDistanceM * 100,
      row.distanceErrorM == null ? "" : row.distanceErrorM * 100,
      row.measurementSigmaM == null ? "" : row.measurementSigmaM * 100,
      row.incidenceDeg == null ? "" : row.incidenceDeg,
      row.standardizedResidual == null ? "" : row.standardizedResidual,
      row.included == null ? "" : row.included,
      row.rejectionIteration ?? "",
      (result.measurementOffsetM || 0) * 100,
      row.netClearanceM == null ? "" : row.netClearanceM * 100,
      row.predictedClearanceM == null ? "" : row.predictedClearanceM * 100,
      row.clearanceErrorM == null ? "" : row.clearanceErrorM * 100,
    ].map(value => typeof value === "number" ? Number(value.toFixed(6)) : value).join(","));
    protocolDebugDownload("nova-calibration-residuals.csv", [header.join(","), ...body].join("\n"), "text/csv");
    toast("Calibration residuals downloaded");
  }
  function renderGuidedResult() {
    const g = guidedState();
    const result = g.lastResult;
    if (!result) {
      els.guidedResults.hidden = true;
      if (!els.guidedComputeStatus.textContent) els.guidedFitBadge.textContent = "Not computed";
      if (!els.guidedComputeStatus.textContent) els.guidedFitBadge.className = "status-badge neutral";
      return;
    }
    const good = result.distanceRmseM != null && result.distanceRmseM <= 0.05;
    els.guidedFitBadge.textContent = good ? "Good fit" : "Review fit";
    els.guidedFitBadge.className = `status-badge ${good ? "valid" : "neutral"}`;
    const sampleRaws = [result.speedModel.calibratedRawMin, 2200, 2400, 2600, 2800, result.speedModel.calibratedRawMax]
      .filter((raw, index, values) => Number.isFinite(raw) && values.indexOf(raw) === index)
      .sort((a, b) => a - b);
    const samples = sampleRaws.map(raw => ({ raw, speedMps: LaunchModel.exitSpeedFromRaw(raw, result.speedModel) }));
    const clearanceLine = result.placement === "ground" ? "Not used in flat-ground mode" : (result.clearanceRmseM == null ? "No net-height measurements used" : `Net-height RMSE ${fmt(result.clearanceRmseM * 100,2)} cm (${result.clearanceCount} values)`);
    els.guidedResults.innerHTML = `
      <div class="fit-summary-grid">
        <div><span>Mechanical geometry</span><strong>Fixed</strong><small>24.2 → 7.5 → 7.5 cm · pivot height 24.0 cm</small></div>
        <div><span>Speed model</span><strong>2 parameters</strong><small>intercept + slope × raw; no knots</small></div>
        <div><span>Landing RMSE</span><strong>${result.distanceRmseM == null ? "—" : `${fmt(result.distanceRmseM * 100,2)} cm`}</strong><small>${result.distanceCount} used · ${result.distanceRejectedCount || 0} rejected</small></div>
        <div><span>Vertical check</span><strong>${result.clearanceRmseM == null ? "—" : `${fmt(result.clearanceRmseM * 100,2)} cm`}</strong><small>${clearanceLine}</small></div>
      </div>
      <div class="speed-map-result">
        <h4>Global linear raw wheel input → launch speed</h4>
        <p class="fit-equation">v = ${fmt(result.speedModel.interceptMps,6)} + ${fmt(result.speedModel.slopeMpsPerRaw,9)} × raw <span>m/s · calibrated raw ${Math.round(result.speedModel.calibratedRawMin)}–${Math.round(result.speedModel.calibratedRawMax)}</span></p>
        ${samples.map(p => `<div><span>${Math.round(p.raw)}</span><strong>${fmt(p.speedMps,3)} m/s</strong><small>derived from the same line</small></div>`).join("")}
      </div>
      ${guidedResidualDiagnosticsMarkup(result)}
      <button id="guidedApplyResultBtn" class="button primary wide" type="button">Apply speed calibration to Robot Studio</button>`;
    els.guidedResults.hidden = false;
    $("guidedApplyResultBtn")?.addEventListener("click", applyGuidedCalibrationResult);
    $("guidedDownloadResidualsBtn")?.addEventListener("click", downloadGuidedResiduals);
  }
  function applyGuidedCalibrationResult() {
    const result = guidedState().lastResult;
    if (!result) return;
    library.calibration.geometryReference = ROBOT_GEOMETRY_REFERENCE;
    library.calibration.nova.speedModel = LaunchModel.sanitizeLinearModel(result.speedModel);
    saveLibrary();
    renderAll();
    renderCalibration();
    toast("Linear Nova speed calibration applied; fixed geometry and robot pose were left unchanged");
  }
  function bindGuidedCalibrationInputs() {
    els.calibrationGuidedTab.addEventListener("click", () => setCalibrationTab("guided"));
    els.guidedPlacementTable.addEventListener("change", () => { if (els.guidedPlacementTable.checked) setGuidedPlacement("table"); });
    els.guidedPlacementGround.addEventListener("change", () => { if (els.guidedPlacementGround.checked) setGuidedPlacement("ground"); });
    els.guidedDistanceReference.addEventListener("change", () => { if (guidedState().placement !== "ground") guidedState().distanceReference = els.guidedDistanceReference.value; saveLibrary(); renderGuidedCalibration(); });
    els.guidedMeasurementOffsetInput.addEventListener("change", () => { const g = guidedState(); g.measurementOffsetCm = clamp(els.guidedMeasurementOffsetInput.value, -200, 200, 0); g.planSignature = ""; g.lastResult = null; saveLibrary(); renderGuidedCalibration(); });
    els.guidedBuildPlanBtn.addEventListener("click", () => {
      try { syncGuidedConfigFromInputs(); rebuildGuidedPlan(true); renderGuidedCalibration(); toast("Calibration test plan updated"); }
      catch (error) { toast(error instanceof Error ? error.message : String(error)); }
    });
    els.guidedResetPlanBtn.addEventListener("click", () => { library.calibration.guided = defaultGuidedCalibration(); saveLibrary(); renderGuidedCalibration(); toast("Calibration plan reset to recommended defaults"); });
    els.guidedSaveNextBtn.addEventListener("click", () => { void saveGuidedAndNext(); });
    els.guidedPreviousBtn.addEventListener("click", () => moveGuidedCurrent(-1));
    els.guidedNextBtn.addEventListener("click", () => moveGuidedCurrent(1));
    els.guidedFeedBtn.addEventListener("click", () => { void toggleGuidedFeed(); });
    els.guidedComputeBtn.addEventListener("click", computeGuidedCalibration);
    els.guidedExportMeasurementsBtn?.addEventListener("click", exportGuidedMeasurements);
    els.guidedMeasurementBody.addEventListener("click", event => {
      const row = event.target.closest("tr[data-guided-row]");
      if (!row) return;
      guidedState().currentIndex = clamp(row.dataset.guidedRow, 0, guidedState().shots.length - 1, 0);
      saveLibrary();
      renderGuidedCalibration();
    });
  }

  function bindCalibrationInputs() {
    const bindings = [
      [els.rotationTypeInput, value => library.calibration.rotationType = Math.round(clamp(value, 0, 7, 0))],
      [els.gravityInput, value => library.calibration.gravity = clamp(value, 1, 20, 9.80665)],
      [els.ballDiameterInput, value => library.calibration.physics.ballDiameterM = clamp(value, .01, .1, .04)],
      [els.ballMassInput, value => library.calibration.physics.ballMassKg = clamp(Number(value) / 1000, .0005, .02, .0027)],
      [els.airTemperatureInput, value => library.calibration.physics.airTemperatureC = clamp(value, -30, 60, 20)],
      [els.airPressureInput, value => library.calibration.physics.airPressureKpa = clamp(value, 70, 110, 101.325)],
      [els.windXInput, value => library.calibration.physics.wind.x = clamp(value, -10, 10, 0)],
      [els.windYInput, value => library.calibration.physics.wind.y = clamp(value, -10, 10, 0)],
      [els.windZInput, value => library.calibration.physics.wind.z = clamp(value, -10, 10, 0)],
      [els.dragScaleInput, value => library.calibration.physics.dragScale = clamp(value, .1, 3, 1)],
      [els.magnusScaleInput, value => library.calibration.physics.magnusScale = clamp(value, .1, 3, 1)],
      [els.airGasConstantInput, value => library.calibration.physics.dryAirGasConstant = clamp(value, 250, 330, 287.05)],
      [els.sutherlandMu0Input, value => library.calibration.physics.sutherlandMu0 = clamp(value, 1e-6, 1e-4, 1.716e-5)],
      [els.sutherlandT0Input, value => library.calibration.physics.sutherlandT0 = clamp(value, 150, 500, 273.15)],
      [els.sutherlandSInput, value => library.calibration.physics.sutherlandS = clamp(value, 1, 500, 110.4)],
      [els.timeStepInput, value => library.calibration.timeStep = clamp(value, .001, .02, .004)],
      [els.maxFlightInput, value => library.calibration.maxFlightTime = clamp(value, .5, 10, 4)],
      [els.rawAtZeroSpeedInput, value => library.calibration.nova.rawAtZeroSpeedLevel = clamp(value, 0, 20000, 969.9321047526674)],
      [els.rawPerSpeedInput, value => library.calibration.nova.rawPerSpeedLevel = clamp(value, .0001, 5000, 630.455868089234)],
      [els.rawDeltaPerSpinInput, value => library.calibration.nova.rawDeltaPerSpinLevel = clamp(value, .0001, 5000, 342.036255843120)],
      [els.upDownAtZeroInput, value => library.calibration.nova.upDownAtZeroDeg = clamp(value, -100, 200, 10)],
      [els.upDownPerDegreeInput, value => library.calibration.nova.upDownPerDegree = clamp(value, .01, 30, 3)],
      [els.yawPerPlacementInput, value => library.calibration.nova.yawDegreesPerPlacement = clamp(value, .01, 30, 2.2)],
      [els.testSpeedInput, value => library.calibration.testShot.speedMps = clamp(value, 1, 20, 8)],
      [els.testSpinInput, value => library.calibration.testShot.spinRps = clamp(value, -120, 120, 0)],
      [els.testElevationInput, value => library.calibration.testShot.elevationDeg = clamp(value, -20, 45, 4)],
      [els.testAimInput, value => library.calibration.testShot.aimDeg = clamp(value, -60, 60, 0)],
      [els.tableLengthInput, value => library.calibration.table.length = clamp(value, .5, 10, 2.74)],
      [els.tableWidthInput, value => library.calibration.table.width = clamp(value, .3, 5, 1.525)],
      [els.netHeightInput, value => library.calibration.table.netHeight = clamp(value, .01, 1, .1525)],
    ];
    for (const [element, setter] of bindings) element.addEventListener("change", () => {
      setter(element.value);
      saveLibrary();
      renderCalibration();
      renderRunPage();
      renderGraph();
      renderInspector();
    });
    bindGuidedCalibrationInputs();
    els.calibrationPoseTab.addEventListener("click", () => setCalibrationTab("pose"));
    els.calibrationTableTab.addEventListener("click", () => setCalibrationTab("table"));
    els.novaScaleTableBody.addEventListener("change", event => {
      const input = event.target.closest("[data-nova-index][data-nova-field]");
      if (!input) return;
      const index = Number(input.dataset.novaIndex);
      const field = input.dataset.novaField;
      const point = library.calibration.nova.spinsightCurve[index];
      if (!point) return;
      if (field === "maxSpinSetting") point.maxSpinSetting = clamp(input.value, 0, 10, point.maxSpinSetting);
      if (field === "maxSpinRps") point.maxSpinRps = clamp(input.value, 0, 200, point.maxSpinRps);
      saveLibrary();
      renderCalibration();
      renderGraph();
      renderInspector();
    });
    els.resetPhysicsBtn.addEventListener("click", () => {
      library.calibration.physics = defaultPhysicsCalibration();
      library.calibration.gravity = 9.80665;
      library.calibration.timeStep = .004;
      library.calibration.maxFlightTime = 4;
      saveLibrary();
      renderCalibration();
      renderGraph();
      renderInspector();
      toast("Published flight-model defaults restored");
    });
    els.resetSpinsightBtn.addEventListener("click", () => {
      library.calibration.nova.spinsightCurve = spinsightReferenceCurve();
      saveLibrary();
      renderCalibration();
      renderGraph();
      renderInspector();
      toast("Spin-capacity defaults restored; the linear speed calibration was preserved");
    });
    els.resetRegulationBtn.addEventListener("click", () => {
      library.calibration.table = regulationTable();
      saveLibrary();
      renderCalibration();
      renderGraph();
      renderInspector();
      toast("Regulation table dimensions restored");
    });
    els.simulateTestShotBtn.addEventListener("click", () => {
      void runCalibrationTestShot();
    });
  }

  function robotIsActive() {
    return Boolean(robot?.connected && [4, 5, 6, 7, 60].includes(robot.wireState));
  }

  function liveTrajectoryTuningIsActive() {
    return DrillAdjustments.hasActiveTuning({ ...liveTuning, pacePct: 0 });
  }

  function formatTuningPercent(value) {
    const n = Math.round(finite(value, 0));
    return `${n > 0 ? "+" : ""}${n}%`;
  }

  function tunedDelaySeconds(seconds) {
    return DrillAdjustments.delayWithPace(seconds, liveTuning);
  }

  function tuningElevationBounds() {
    const nova = library.calibration.nova;
    const slope = finite(nova.upDownPerDegree, 0);
    let minElevationDeg = -20;
    let maxElevationDeg = 45;
    if (Math.abs(slope) > 1e-9) {
      const a = (-50 - finite(nova.upDownAtZeroDeg, 10)) / slope;
      const b = (100 - finite(nova.upDownAtZeroDeg, 10)) / slope;
      minElevationDeg = Math.max(minElevationDeg, Math.min(a, b));
      maxElevationDeg = Math.min(maxElevationDeg, Math.max(a, b));
    }
    return { minElevationDeg, maxElevationDeg };
  }

  function liveTuningOptions() {
    const range = LaunchModel.hardwareSpeedRange(library.calibration.nova.speedModel);
    return {
      ...tuningElevationBounds(),
      minSpeedMps: range.minMps,
      maxSpeedMps: range.maxMps,
      landingToleranceM: .04,
      clearanceToleranceM: .01,
      minNetClearanceM: .002,
    };
  }
  function calibrationAtPose(pose) {
    return { ...library.calibration, pose: { ...pose } };
  }
  function adjustedShotForRuntime(baseParams, drillId = activeDrill()?.id) {
    const params = {
      speedMps: finite(baseParams?.speedMps, 8),
      spinRps: finite(baseParams?.spinRps, 0),
      elevationDeg: finite(baseParams?.elevationDeg, 4),
      aimDeg: finite(baseParams?.aimDeg, 0),
    };
    const owner = getDrill(drillId);
    const referencePose = owner ? drillPose(owner) : currentRobotPose();
    const currentPose = currentRobotPose();
    const poseChanged = poseNeedsCompensation(referencePose, currentPose);
    const referenceCalibration = calibrationAtPose(referencePose);
    const currentCalibration = calibrationAtPose(currentPose);
    const basePrediction = predictTrajectory(params, referenceCalibration);
    if (!liveTrajectoryTuningIsActive() && !poseChanged) {
      return { params, basePrediction, prediction: basePrediction, landingErrorM: 0, clearanceErrorM: 0, targetClearanceM: basePrediction?.net?.clearanceM ?? null, warnings: [], changed: false, feasible: true, evaluations: 0, poseCompensated: false };
    }
    const cacheKey = JSON.stringify([drillId, params, liveTuning, referencePose, currentPose, library.calibration.nova, library.calibration.physics]);
    const cached = liveTuningCache.get(cacheKey);
    if (cached) return cached;
    const result = DrillAdjustments.applyShotTuning(
      params,
      liveTuning,
      candidate => predictTrajectory(candidate, currentCalibration),
      { ...liveTuningOptions(), basePrediction, forceSolve: poseChanged, preserveClearance: poseChanged }
    );
    result.poseCompensated = poseChanged;
    if (liveTuningCache.size > 120) liveTuningCache.clear();
    liveTuningCache.set(cacheKey, result);
    return result;
  }

  function liveTuningShotForPreview() {
    const drill = activeDrill();
    if (!drill) return null;
    if (selection?.kind === "node") {
      const selected = getNode(drill, selection.id);
      if (selected?.type === "shot") return selected;
    }
    return drill.nodes.find(node => node.type === "shot") || null;
  }

  function renderLiveTuning() {
    liveTuning = DrillAdjustments.normalizeTuning(liveTuning);
    const values = [
      [els.tuningPaceValue, "pacePct"],
      [els.tuningClearanceValue, "clearancePct"],
      [els.tuningSpinValue, "spinPct"],
      [els.tuningSpeedValue, "speedPct"],
    ];
    for (const [output, key] of values) {
      if (output) {
        output.textContent = formatTuningPercent(liveTuning[key]);
        output.closest(".tuning-control")?.classList.toggle("active", Math.abs(liveTuning[key]) > 1e-9);
      }
      document.querySelectorAll(`[data-tuning-output="${key}"]`).forEach(runOutput => {
        runOutput.textContent = formatTuningPercent(liveTuning[key]);
        runOutput.closest(".session-adjustment")?.classList.toggle("active", Math.abs(liveTuning[key]) > 1e-9);
      });
    }
    const activeEntries = Object.entries(liveTuning).filter(([, value]) => Math.abs(value) > 1e-9);
    els.liveTuningBtn?.classList.toggle("active", activeEntries.length > 0);
    if (els.liveTuningSummary) els.liveTuningSummary.textContent = activeEntries.length ? `${activeEntries.length} active` : "No adjustments";

    const drill = activeDrill();
    const shot = liveTuningShotForPreview();
    if (!shot) {
      els.liveTuningImpactLabel.textContent = "No shot available";
      els.liveTuningImpact.innerHTML = `<p class="helper">The selected drill has no direct shot node to preview.</p>`;
      return;
    }
    els.liveTuningImpactLabel.textContent = `All balls · example: ${shot.label}`;
    const result = adjustedShotForRuntime(shot.params, drill.id);
    const base = result.basePrediction || predictTrajectory(shot.params, calibrationAtPose(drillPose(drill)));
    const tuned = result.prediction || base;
    const baseClearance = base?.net?.clearanceM;
    const tunedClearance = tuned?.net?.clearanceM;
    const landingShiftCm = Number.isFinite(result.landingErrorM) ? result.landingErrorM * 100 : null;
    const warnings = result.warnings || [];
    els.liveTuningImpact.innerHTML = `
      <div class="live-tuning-impact-grid">
        <div><span>Speed</span><strong>${fmt(shot.params.speedMps,2)} → ${fmt(result.params.speedMps,2)} m/s</strong><small>effective shot</small></div>
        <div><span>Spin</span><strong>${signed(shot.params.spinRps,1)} → ${signed(result.params.spinRps,1)} rps</strong><small>effective shot</small></div>
        <div><span>Elevation</span><strong>${signed(shot.params.elevationDeg,1)}° → ${signed(result.params.elevationDeg,1)}°</strong><small>solver compensation</small></div>
        <div><span>Landing shift</span><strong>${landingShiftCm == null ? "—" : `${fmt(landingShiftCm,1)} cm`}</strong><small>modeled distance</small></div>
        <div><span>Net clearance</span><strong>${baseClearance == null ? "—" : `${fmt(baseClearance * 100,1)} cm`} → ${tunedClearance == null ? "—" : `${fmt(tunedClearance * 100,1)} cm`}</strong><small>bottom of ball over net</small></div>
        <div><span>Scope</span><strong>Every ball</strong><small>including sub-drills</small></div>
        <div><span>Stored drill</span><strong>Unchanged</strong><small>runtime layer only</small></div>
      </div>
      ${warnings.length ? `<p class="live-tuning-impact-warning">${escapeHtml(warnings.join(" "))}</p>` : ""}
    `;
  }

  function requestImmediateLiveRetune() {
    liveTuningRevision += 1;
    if (!playbackRunning || calibrationTestRunning) return;
    liveRetunePending = true;
    if (liveRetuneTimer) clearTimeout(liveRetuneTimer);
    liveRetuneTimer = setTimeout(() => {
      liveRetuneTimer = null;
      void flushImmediateLiveRetune();
    }, 90);
    els.runStatus.textContent = "Applying live tuning to the rolling feed…";
  }
  function stepLiveTuning(key, delta) {
    if (!(key in liveTuning)) return;
    liveTuning = DrillAdjustments.normalizeTuning({ ...liveTuning, [key]: liveTuning[key] + delta });
    liveTuningCache.clear();
    saveLiveTuningPreference();
    requestImmediateLiveRetune();
    renderLiveTuning();
    renderInspector();
  }

  function resetLiveTuning() {
    liveTuning = { ...DrillAdjustments.DEFAULT_TUNING };
    liveTuningCache.clear();
    saveLiveTuningPreference();
    requestImmediateLiveRetune();
    renderLiveTuning();
    renderInspector();
  }

  function liveTuningInlineHtml(baseParams) {
    if (!liveTrajectoryTuningIsActive()) return "";
    const result = adjustedShotForRuntime(baseParams);
    const shift = Number.isFinite(result.landingErrorM) ? `${fmt(result.landingErrorM * 100,1)} cm` : "unknown";
    return `<div class="live-tuning-inline"><strong>Live tuning is active.</strong> Effective shot: ${fmt(result.params.speedMps,2)} m/s · ${signed(result.params.spinRps,1)} rps · ${signed(result.params.elevationDeg,1)}°. Modeled landing shift: ${shift}. Stored values below are unchanged.</div>`;
  }

  function variationEnvironment(drillId, runtime = false) {
    const drill = getDrill(drillId) || activeDrill();
    const calibration = calibrationAtPose(runtime ? currentRobotPose() : drillPose(drill));
    return {
      calibration,
      evaluate: params => predictTrajectory(params, calibration),
    };
  }

  function variationCacheEntry(shot, baseParams, runtime = false) {
    if (!shot.variation?.enabled) return null;
    const environment = variationEnvironment(shot.drillId, runtime);
    const cacheKey = JSON.stringify([runtime, shot.drillId, shot.nodeId, baseParams, shot.variation, environment.calibration]);
    let entry = shotVariationCache.get(cacheKey);
    if (entry) return entry;
    const prepared = ShotVariation.prepare(baseParams, shot.variation, environment.evaluate);
    entry = { prepared, evaluate: environment.evaluate };
    if (shotVariationCache.size >= 48) shotVariationCache.clear();
    shotVariationCache.set(cacheKey, entry);
    return entry;
  }

  function variedShotParams(shot, baseParams, runtime = false) {
    if (!shot.variation?.enabled) return { params: baseParams, result: null };
    const entry = variationCacheEntry(shot, baseParams, runtime);
    if (!entry?.prepared?.ok) return { params: null, error: entry?.prepared?.reason || "Variation preparation failed." };
    const result = ShotVariation.sample(entry.prepared, entry.evaluate, shotVariationRng, {
      attempts: 5,
      maxIterations: 7,
      landingToleranceM: .012,
      clearanceToleranceM: .004,
    });
    return result
      ? { params: result.params, result }
      : { params: null, error: "No feasible varied shot was found after five bounded attempts. Reduce the requested position, clearance, speed, or spin range." };
  }

  function profileShotVariation(node, count = 12) {
    if (!node?.variation?.enabled) return { ok: false, reason: "Shot variation is not enabled." };
    const owner = allDrills().find(drill => drill.nodes.some(candidate => candidate.id === node.id)) || activeDrill();
    const environment = variationEnvironment(owner?.id);
    const started = performance.now();
    const prepared = ShotVariation.prepare(node.params, node.variation, environment.evaluate);
    if (!prepared.ok) return { ok: false, reason: prepared.reason };
    const batch = ShotVariation.sampleMany(prepared, Math.max(1, Math.min(100, Math.round(count))), environment.evaluate, ShotVariation.createRng(0x51f15e), {
      attempts: 5,
      maxIterations: 7,
      landingToleranceM: .012,
      clearanceToleranceM: .004,
    });
    const elapsedMs = performance.now() - started;
    return {
      ok: batch.results.length > 0,
      reason: batch.results.length ? "" : "No feasible samples were found. Reduce the requested variation ranges.",
      accepted: batch.results.length,
      failed: batch.failures.length,
      elapsedMs,
      preparationMs: prepared.preparedMs,
      evaluations: prepared.evaluations,
      evaluationsPerShot: (prepared.evaluations - 5) / Math.max(1, batch.results.length),
      results: batch.results,
    };
  }

  function compileRobotSet(drillId) {
    const context = { shots: [], transitions: 0, warnings: [] };
    const result = compileRobotInvocation(drillId, context, [], 0);
    if (!result.ok) throw new Error(result.reason);
    return {
      shots: context.shots,
      trailingDelay: result.pendingDelay,
      warnings: context.warnings,
      transitions: context.transitions,
    };
  }

  function compileRobotInvocation(drillId, context, callStack, incomingDelay) {
    if (callStack.includes(drillId)) return { ok: false, reason: "Recursive sub-drill call blocked.", pendingDelay: incomingDelay };
    const drill = getDrill(drillId);
    if (!drill) return { ok: false, reason: "Referenced drill is missing.", pendingDelay: incomingDelay };
    let node = getNode(drill, drill.startNodeId);
    const stack = [...callStack, drillId];
    let pendingDelay = Math.max(0, finite(incomingDelay, 0));

    // Repeater memory is scoped to this invocation. Every sub-drill call gets
    // a fresh map; calling a sub-drill never resets the parent's map.
    const repeaters = new Map(
      drill.nodes.filter(candidate => candidate.type === "counter")
        .map(repeater => [repeater.id, repeater.startCount])
    );

    while (node) {
      context.transitions += 1;
      if (context.transitions > MAX_TRANSITIONS) {
        return { ok: false, reason: "Transition guard reached; the flow may never end.", pendingDelay };
      }

      for (const repeater of drill.nodes.filter(candidate => candidate.type === "counter" && candidate.clearOnNodeIds.includes(node.id))) {
        repeaters.set(repeater.id, repeater.startCount);
      }

      let edge = null;
      if (node.type === "shot") {
        // Keep the compiled traversal immutable and based on stored drill values.
        // Live tuning is layered over every shot later, when the robot execution
        // plan is built. That makes retuning non-destructive and lets a running
        // traversal be re-planned without re-sampling random/counter nodes.
        context.shots.push({
          drillId,
          nodeId: node.id,
          label: node.label,
          params: { ...node.params },
          baseParams: { ...node.params },
          variation: node.variation?.enabled ? structuredClone(node.variation) : null,
          tuningApplied: false,
          delayBefore: pendingDelay,
        });
        pendingDelay = 0;
        edge = outgoing(drill, node.id)[0] ?? null;
      } else if (node.type === "random") {
        edge = weightedChoice(outgoing(drill, node.id));
      } else if (node.type === "drill") {
        if (!node.referencedDrillId) return { ok: false, reason: `“${node.label}” has no reusable drill selected.`, pendingDelay };
        const nested = compileRobotInvocation(node.referencedDrillId, context, stack, pendingDelay);
        if (!nested.ok) return nested;
        pendingDelay = nested.pendingDelay;
        edge = outgoing(drill, node.id)[0] ?? null;
      } else if (node.type === "counter") {
        const remaining = repeaters.get(node.id) ?? node.startCount;
        if (remaining > 0) {
          repeaters.set(node.id, remaining - 1);
          edge = edgeForSlot(drill, node.id, "A");
        } else {
          repeaters.set(node.id, node.startCount);
          edge = edgeForSlot(drill, node.id, "B");
        }
      }

      if (!edge) return { ok: true, reason: "Flow ended", pendingDelay };
      // Store the drill's raw delay. Pace tuning is applied when the execution
      // plan is built, just like speed/spin/clearance tuning.
      pendingDelay += Math.max(0, finite(edge.delaySeconds, 0));
      node = getNode(drill, edge.target);
      if (!node) return { ok: false, reason: "A connection points to a missing node.", pendingDelay };
    }

    return { ok: true, reason: "Flow ended", pendingDelay };
  }

  function robotShotPreflight(shot) {
    const c = library.calibration;
    const estimate = estimatedNovaSettings(shot.params, c);
    const errors = [];
    const warnings = [];
    const upDown = c.nova.upDownAtZeroDeg + c.nova.upDownPerDegree * shot.params.elevationDeg;
    const placement = shot.params.aimDeg / c.nova.yawDegreesPerPlacement;
    const hardwareRange = LaunchModel.hardwareSpeedRange(c.nova.speedModel);
    if (upDown < -50 - 1e-6 || upDown > 100 + 1e-6) {
      errors.push(`“${shot.label}”: elevation ${fmt(shot.params.elevationDeg,1)}° maps to Nova Up/down ${fmt(upDown,1)}, outside -50…100.`);
    }
    if (Math.abs(placement) > 10 + 1e-6) {
      errors.push(`“${shot.label}”: aim ${fmt(shot.params.aimDeg,1)}° maps to placement ${fmt(placement,1)}, outside -10…10.`);
    }
    if (estimate.speedExtrapolated && estimate.calibratedRange) {
      warnings.push(`“${shot.label}”: ${fmt(shot.params.speedMps,1)} m/s is outside the measured calibration range (${fmt(estimate.calibratedRange.minMps,1)}…${fmt(estimate.calibratedRange.maxMps,1)} m/s); the same affine line is extrapolated.`);
    }
    if (estimate.baseRawLimited) {
      warnings.push(`“${shot.label}”: requested speed needs a base raw input outside ${hardwareRange.minRaw}…${hardwareRange.maxRaw}; the base command is clipped at the boundary.`);
    }
    if (estimate.wheelRawLimited) {
      warnings.push(`“${shot.label}”: the spin differential pushes an individual wheel outside 400…7500 raw; individual wheel commands are clipped.`);
    }
    if (estimate.limited) {
      warnings.push(`“${shot.label}”: requested ${fmt(Math.abs(shot.params.spinRps),1)} rps exceeds the calibrated ${fmt(estimate.maxSpinRps,1)} rps capacity at this speed; spin is clamped.`);
    }
    return { estimate, errors, warnings };
  }
  function novaFrequencyForDelay(delaySeconds) {
    const desired = Math.max(0, finite(delaySeconds, 0));
    const minDelay = 1 / 1.5; // 0.667 s at the robot's 1.5 Hz maximum
    const maxDelay = 1 / .5;  // 2.000 s at the robot's 0.5 Hz minimum
    const encodedDelay = clamp(desired || minDelay, minDelay, maxDelay, minDelay);
    return {
      desiredDelay: desired,
      encodedDelay,
      frequencyHz: Protocol.frequencyHzFromDelaySeconds(encodedDelay),
      tooFast: desired > 0 && desired < minDelay - 1e-6,
      tooSlow: desired > maxDelay + 1e-6,
      extraHostDelay: desired > maxDelay ? desired - maxDelay : 0,
    };
  }

  function buildRobotExecutionPlan(compiled, { maxBatchSize = NOVA_SEQUENCE_RECORD_LIMIT } = {}) {
    if (!Protocol) throw new Error("Protocol module is unavailable");
    if (!compiled.shots.length) throw new Error("This traversal contains no shots to send to the robot.");

    const warnings = [...compiled.warnings];
    const errors = [];
    const prepared = [];
    const batchLimit = Math.max(1, Math.min(NOVA_SEQUENCE_RECORD_LIMIT, Math.trunc(finite(maxBatchSize, NOVA_SEQUENCE_RECORD_LIMIT)) || NOVA_SEQUENCE_RECORD_LIMIT));

    for (let index = 0; index < compiled.shots.length; index += 1) {
      const baseShot = compiled.shots[index];
      // Pose compensation and every active live modifier share one solve. This
      // avoids order-dependent stacking and uses each sub-drill's authored pose.
      const directPrediction = baseShot.skipRuntimeAdjustments
        ? predictTrajectory(baseShot.params, calibrationAtPose(currentRobotPose()))
        : null;
      const adjusted = baseShot.skipRuntimeAdjustments
        ? { params: { ...baseShot.params }, basePrediction: directPrediction, prediction: directPrediction, warnings: [], changed: false, feasible: true, evaluations: 0 }
        : adjustedShotForRuntime(baseShot.params, baseShot.drillId);
      const runtimeVariationShot = baseShot.variation?.enabled
        ? { ...baseShot, variation: variationShiftedToEffectiveShot(baseShot.variation, baseShot.params, adjusted) }
        : baseShot;
      const variation = baseShot.skipRuntimeAdjustments
        ? { params: adjusted.params, result: null }
        : variedShotParams(runtimeVariationShot, adjusted.params, true);
      const shot = {
        ...baseShot,
        params: { ...(variation.params || adjusted.params) },
        baseParams: { ...baseShot.params },
        tuningApplied: adjusted.changed,
        variationApplied: Boolean(variation.result),
        variationResult: variation.result || null,
      };
      if (adjusted.warnings?.length) warnings.push(...adjusted.warnings.map(message => `“${shot.label}”: ${message}`));
      if (!adjusted.feasible) errors.push(`“${shot.label}”: no feasible trajectory was found for the current robot position and live adjustments.`);
      if (variation.error) errors.push(`“${shot.label}”: ${variation.error}`);
      const preflight = robotShotPreflight(shot);
      errors.push(...preflight.errors);
      warnings.push(...preflight.warnings);

      // The fifth 32-bit field is frequency in Hz. Community stopwatch data
      // shows the pre-pause before this ball is 1/f: 0.5..1.5 Hz corresponds
      // to 2.00..0.667 s. Edge delays are therefore attached to the TARGET
      // shot, not the source shot. Pace is a runtime layer too.
      const timing = novaFrequencyForDelay(tunedDelaySeconds(baseShot.delayBefore));
      if (index > 0 && timing.tooFast) {
        warnings.push(`“${compiled.shots[index - 1].label}” → “${shot.label}”: ${fmt(timing.desiredDelay,2)} s is faster than the Nova timing range; ${fmt(timing.encodedDelay,3)} s will be used.`);
      }
      if (index > 0 && timing.tooSlow) {
        warnings.push(`“${compiled.shots[index - 1].label}” → “${shot.label}”: ${fmt(timing.desiredDelay,2)} s exceeds the Nova's 2.00 s per-ball pre-pause; the flow will split batches and wait the remaining ${fmt(timing.extraHostDelay,2)} s in the controller.`);
      }

      const wheelA = Math.trunc(clamp(preflight.estimate.wheelA, 400, 7500, 400));
      const wheelB = Math.trunc(clamp(preflight.estimate.wheelB, 400, 7500, 400));
      const record = Protocol.packBallRecord({
        wheelA,
        wheelB,
        pitchDeg: shot.params.elevationDeg,
        yawDeg: shot.params.aimDeg,
        frequencyHz: timing.frequencyHz,
        count: 1,
      });
      prepared.push({
        ...shot,
        sourceIndex: Number.isInteger(baseShot.sourceIndex) ? baseShot.sourceIndex : index,
        wheelA,
        wheelB,
        frequencyHz: timing.frequencyHz,
        encodedDelay: timing.encodedDelay,
        desiredDelay: timing.desiredDelay,
        forceBoundaryBefore: index > 0 && timing.tooSlow,
        hostDelayBefore: timing.extraHostDelay,
        record,
      });
    }

    if (![0, 4].includes(library.calibration.rotationType)) {
      errors.push(`Physical head orientation type ${library.calibration.rotationType} is not enabled for real Play yet. Use standard topspin/underspin type 0 or reversed-wheels type 4; the side/mixed spin axes still need physical verification.`);
    }
    if (errors.length) throw new Error(errors.join(" "));

    const batches = [];
    let current = [];
    let pendingHostDelay = 0;

    const flush = () => {
      if (!current.length) return;
      const packet = Protocol.buildStartPacket(current.map(item => item.record), {
        mode: 1,   // one-run/repetition packet used by the working community client
        value: 1,
        sequence: 0,
      });
      const encodedSeconds = current.reduce((sum, item) => sum + item.encodedDelay, 0);
      batches.push({
        shots: current,
        packet,
        liveUpdatePacket: Protocol.buildLiveAdjustPacket(current.map(item => item.record)),
        encodedSeconds,
        hostDelayBefore: pendingHostDelay,
        tuningRevision: liveTuningRevision,
      });
      current = [];
      pendingHostDelay = 0;
    };

    for (const shot of prepared) {
      if (shot.forceBoundaryBefore && current.length) {
        flush();
        pendingHostDelay = shot.hostDelayBefore;
      }
      if (current.length >= batchLimit) {
        flush();
      }
      // For a long delay before the first shot, wait before starting the first
      // batch, then let the record's 0.5 Hz pre-pause provide the final 2 s.
      if (!batches.length && !current.length && shot.hostDelayBefore > 0) {
        pendingHostDelay = shot.hostDelayBefore;
      }
      current.push(shot);
    }
    flush();

    if (prepared.length > batchLimit) {
      warnings.push(batchLimit === 1
        ? "Live tuning responsiveness is active: balls are sent one at a time so the next ball can use a changed modifier. Ready→Start overhead can slightly affect the fastest paces."
        : `This sequence exceeds the ${batchLimit}-record transport window and is split there. Ordinary set boundaries do not cause STOP/START.`);
    }

    return {
      trailingDelay: tunedDelaySeconds(compiled.trailingDelay),
      batches,
      warnings: [...new Set(warnings)],
      shotCount: prepared.length,
    };
  }

  function rebuildPlaybackBatchForLiveTuning(batch) {
    const sourceShots = batch.shots.map(shot => ({
      ...shot,
      params: { ...shot.baseParams },
      baseParams: { ...shot.baseParams },
      record: undefined,
    }));
    const rebuilt = buildRobotExecutionPlan({ shots: sourceShots, warnings: [], trailingDelay: 0 }, {
      maxBatchSize: NOVA_SEQUENCE_RECORD_LIMIT,
    });
    const shots = rebuilt.batches.flatMap(item => item.shots);
    if (shots.length !== batch.shots.length) {
      throw new Error(`live adjustment rebuilt ${shots.length} records for a ${batch.shots.length}-record sequence`);
    }
    if (rebuilt.batches.length > 1) {
      rebuilt.warnings.push("The slower live pace needs a host-side delay that cannot be inserted into an already-running sequence; this buffer uses the Nova's slowest encoded pace.");
    }
    const records = shots.map(shot => shot.record);
    return {
      ...batch,
      shots,
      packet: Protocol.buildStartPacket(records, { mode: 1, value: 1, sequence: 0 }),
      liveUpdatePacket: Protocol.buildLiveAdjustPacket(records),
      encodedSeconds: shots.reduce((sum, shot) => sum + shot.encodedDelay, 0),
      hostDelayBefore: rebuilt.batches[0]?.hostDelayBefore ?? batch.hostDelayBefore,
      tuningRevision: liveTuningRevision,
      retuneWarnings: rebuilt.warnings,
    };
  }

  function enqueuePlaybackUpdate(task) {
    const run = playbackUpdateLock.catch(() => {}).then(task);
    playbackUpdateLock = run.catch(() => {});
    return run;
  }

  async function flushImmediateLiveRetune() {
    if (liveRetuneInFlight) return;
    liveRetuneInFlight = true;
    try {
      while (liveRetunePending && playbackRunning && !calibrationTestRunning) {
        liveRetunePending = false;
        const revision = liveTuningRevision;
        const context = playbackLiveContext;
        if (!context || context.token !== playbackToken) {
          els.runStatus.textContent = "Live tuning will apply to the next shot pack.";
          break;
        }

        await enqueuePlaybackUpdate(async () => {
          if (playbackLiveContext !== context || !playbackRunning || context.token !== playbackToken) return;
          const queued = Boolean(context.queuedBatch);
          const original = queued ? context.queuedBatch : context.currentBatch;
          if (!original) return;
          const remainingFraction = queued
            ? null
            : clamp((context.expectedEndAt - performance.now()) / Math.max(1, original.encodedSeconds * 1000), 0, 1, 0);
          const replacement = rebuildPlaybackBatchForLiveTuning(original);
          await robot.updateActiveSequence(replacement.liveUpdatePacket, {
            description: queued ? "live-tuned queued shot pack" : "live-tuned active shot pack",
          });
          if (playbackLiveContext !== context || !playbackRunning || context.token !== playbackToken) return;
          if (queued && context.queuedBatch === original) {
            context.queuedBatch = replacement;
          } else if (!queued && context.currentBatch === original) {
            context.currentBatch = replacement;
            context.expectedEndAt = performance.now() + replacement.encodedSeconds * remainingFraction * 1000;
          }
          if (replacement.retuneWarnings?.length) robot.log(`Live tuning warning: ${replacement.retuneWarnings[0]}`, "warn");
          els.runStatus.textContent = queued
            ? "Live tuning applied to the queued shot pack."
            : "Live tuning applied to the active shot pack.";
        });
        if (revision !== liveTuningRevision) liveRetunePending = true;
      }
    } catch (error) {
      robot?.log(`Live tuning update failed: ${error.message}`, "warn");
      els.runStatus.textContent = "Live tuning will apply to the next shot pack.";
    } finally {
      liveRetuneInFlight = false;
      if (liveRetunePending && playbackRunning && !liveRetuneTimer) {
        liveRetuneTimer = setTimeout(() => {
          liveRetuneTimer = null;
          void flushImmediateLiveRetune();
        }, 90);
      }
    }
  }

  function buildCalibrationTestExecutionPlan(params = library.calibration.testShot, label = "Calibration test shot") {
    const c = library.calibration;
    return buildRobotExecutionPlan({
      shots: [{
        drillId: "__calibration__",
        nodeId: "__test_shot__",
        label,
        params: { ...params },
        skipRuntimeAdjustments: true,
        delayBefore: 0,
      }],
      warnings: [],
      trailingDelay: 0,
    });
  }

  function renderCalibrationTestShotPanel() {
    if (!els.testShotConnectionState || !els.testShotWireSummary || !els.simulateTestShotBtn) return;

    const snapshot = robot?.snapshot() || {
      connected: false,
      authenticated: false,
      browserSupported: false,
      ready: false,
      phase: "unavailable",
      wireState: null,
      stateName: "Unknown",
    };

    let plan = null;
    let planError = "";
    try {
      plan = buildCalibrationTestExecutionPlan();
    } catch (error) {
      planError = error instanceof Error ? error.message : String(error);
    }

    if (plan?.batches?.length) {
      const shot = plan.batches[0].shots[0];
      const estimate = estimatedNovaSettings(library.calibration.testShot);
      els.testShotWireSummary.innerHTML = `
        <span><strong>Nova speed</strong> ${fmt(estimate.speedLevel,2)}</span>
        <span><strong>Nova spin</strong> ${signed(estimate.spinLevel,2)}</span>
        <span><strong>Wheel A</strong> ${shot.wheelA} raw</span>
        <span><strong>Wheel B</strong> ${shot.wheelB} raw</span>
        <span><strong>Pitch</strong> ${signed(shot.params.elevationDeg,1)}°</span>
        <span><strong>Yaw</strong> ${signed(shot.params.aimDeg,1)}°</span>
        <span><strong>Pre-pause</strong> ${fmt(shot.encodedDelay,3)} s</span>
        <span><strong>Frequency</strong> ${fmt(shot.frequencyHz,3)} Hz</span>
        <span><strong>Count</strong> 1 ball</span>`;
    } else {
      els.testShotWireSummary.textContent = planError || "Unable to build the physical command.";
    }

    els.simulateTestShotBtn.classList.toggle("running", calibrationTestRunning);

    if (calibrationTestRunning) {
      els.simulateTestShotBtn.disabled = false;
      els.simulateTestShotBtn.textContent = "Stop test shot";
      els.testShotConnectionState.textContent = calibrationTestMessage || "Preparing or serving one physical test ball…";
      return;
    }

    if (playbackRunning || robotIsActive()) {
      els.simulateTestShotBtn.disabled = true;
      els.simulateTestShotBtn.textContent = "Nova busy";
      els.testShotConnectionState.textContent = "Stop the current drill or robot activity before firing a calibration shot.";
      return;
    }

    if (planError) {
      els.simulateTestShotBtn.disabled = true;
      els.simulateTestShotBtn.textContent = "Test shot unavailable";
      els.testShotConnectionState.textContent = planError;
      return;
    }

    if (!snapshot.browserSupported && !snapshot.connected) {
      els.simulateTestShotBtn.disabled = false;
      els.simulateTestShotBtn.textContent = "Connection help";
      els.testShotConnectionState.textContent = browserBluetoothInstructions();
      return;
    }

    els.simulateTestShotBtn.disabled = false;
    if (!snapshot.connected) {
      els.simulateTestShotBtn.textContent = "Connect & fire one test ball";
      els.testShotConnectionState.textContent = calibrationTestMessage || "The button will open the Nova chooser, authenticate, wait for Ready, then fire exactly one ball.";
    } else if (!snapshot.authenticated) {
      els.simulateTestShotBtn.textContent = "Preparing Nova…";
      els.testShotConnectionState.textContent = calibrationTestMessage || "Connected; waiting for authentication.";
    } else if (snapshot.ready) {
      els.simulateTestShotBtn.textContent = "Fire one test ball";
      els.testShotConnectionState.textContent = calibrationTestMessage || "Nova Ready. The preview above and the wire settings below use the same calibration values.";
    } else {
      els.simulateTestShotBtn.textContent = "Fire when Ready";
      els.testShotConnectionState.textContent = calibrationTestMessage || `Nova is ${snapshot.stateName}; the controller will only Start after Ready.`;
    }
  }

  async function runCalibrationTestShot(params = library.calibration.testShot, label = "Calibration test shot", onComplete = null) {
    if (calibrationTestRunning) {
      await stopPlayback();
      return;
    }
    if (playbackRunning || robotIsActive()) {
      toast("Stop the current drill before firing a calibration test shot.");
      return;
    }
    if (!robot) {
      calibrationTestMessage = "Robot controller module is unavailable.";
      renderCalibrationTestShotPanel();
      toast(calibrationTestMessage);
      return;
    }

    let plan;
    try {
      plan = buildCalibrationTestExecutionPlan(params, label);
    } catch (error) {
      calibrationTestMessage = error instanceof Error ? error.message : String(error);
      renderCalibrationTestShotPanel();
      toast(calibrationTestMessage);
      return;
    }

    playbackToken += 1;
    const token = playbackToken;
    calibrationTestRunning = true;
    calibrationTestMessage = robot.connected ? "Waiting for Nova Ready…" : "Opening Nova chooser…";
    updatePlayButton();
    renderCalibrationTestShotPanel();

    try {
      if (!robot.connected || !robot.authenticated) {
        calibrationTestRunning = false;
        requestRobotConnection(label, () => runCalibrationTestShot(params, label, onComplete));
        return;
      }

      calibrationTestMessage = "Checking Nova state…";
      renderCalibrationTestShotPanel();
      await robot.ensureReadyForStart();
      if (!calibrationTestRunning || token !== playbackToken) return;

      if (plan.warnings.length) {
        plan.warnings.forEach(message => robot.log(`Calibration test warning: ${message}`, "warn"));
        toast(plan.warnings[0]);
      }

      const batch = plan.batches[0];
      const shot = batch.shots[0];
      calibrationTestMessage = `Serving one ball · A ${shot.wheelA} raw · B ${shot.wheelB} raw`;
      renderCalibrationTestShotPanel();

      const timeoutMs = Math.max(20000, Math.ceil((batch.encodedSeconds + 12) * 1000));
      await robot.startBatch(batch.packet, {
        timeoutMs,
        expectedDurationMs: batch.encodedSeconds * 1000,
        description: `${label} (${fmt(shot.params.speedMps,1)} m/s, ${signed(shot.params.spinRps,1)} rps)`,
      });

      if (!calibrationTestRunning || token !== playbackToken) return;
      calibrationTestMessage = "Test shot complete · Nova Ready";
      toast(`${label} complete · Nova Ready`);
      if (typeof onComplete === "function") onComplete();
    } catch (error) {
      if (token === playbackToken) {
        calibrationTestMessage = `Test shot stopped: ${error instanceof Error ? error.message : String(error)}`;
        toast(calibrationTestMessage);
        if (robot.connected && robotIsActive()) {
          await robot.stopAndWaitFree().catch(stopError => {
            robot.log(`Calibration test cleanup Stop was not confirmed: ${stopError.message}`, "error");
          });
        }
      }
    } finally {
      if (token === playbackToken) {
        calibrationTestRunning = false;
        updatePlayButton();
        updateRobotUI();
        renderCalibrationTestShotPanel();
      }
    }
  }

  function compilePlaybackWindow(drill, completedSets, configuredSets, infinite, carryDelay = 0, maxRecords = NOVA_SEQUENCE_RECORD_LIMIT) {
    const shots = [];
    const warnings = [];
    let setsIncluded = 0;
    let trailingDelay = 0;
    let nextCarryDelay = Math.max(0, finite(carryDelay, 0));
    const limit = Math.max(1, Math.min(NOVA_SEQUENCE_RECORD_LIMIT, Math.trunc(maxRecords) || NOVA_SEQUENCE_RECORD_LIMIT));

    while ((infinite || completedSets + setsIncluded < configuredSets) && shots.length < limit) {
      const compiled = compileRobotSet(drill.id);
      if (!compiled.shots.length) break;
      if (shots.length && shots.length + compiled.shots.length > limit) break;
      const setNumber = completedSets + setsIncluded + 1;
      const setShots = compiled.shots.map((shot, index) => ({
        ...shot,
        logicalSet: setNumber,
        delayBefore: Math.max(0, finite(shot.delayBefore, 0)) + (index === 0 ? nextCarryDelay : 0),
      }));
      shots.push(...setShots);
      warnings.push(...compiled.warnings);
      setsIncluded += 1;
      trailingDelay = Math.max(0, finite(compiled.trailingDelay, 0));
      nextCarryDelay = trailingDelay + Math.max(0, finite(drill.settings.delayBetweenSets, 0));
      if (shots.length >= limit) break;
    }
    return { shots, warnings, setsIncluded, trailingDelay, nextCarryDelay };
  }

  async function startPlayback() {
    if (calibrationTestRunning) { toast("Stop the calibration test shot first."); return; }
    const drill = activeDrill();
    if (!drill) return;
    const validation = validateDrill(drill);
    if (!validation.valid) { toast("Fix drill errors before playing."); return; }
    if (!poseStaleAcknowledged && PoseCalibration.isStale(currentPoseSession())) {
      askConfirm(
        "Check the robot position?",
        "This saved position has not been used or checked in two weeks. If the robot may have moved, cancel and choose Update pose. Otherwise continue with the saved position.",
        () => { poseStaleAcknowledged = true; void startPlayback(); },
        { actionLabel: "Continue with saved pose", actionClass: "primary" }
      );
      return;
    }
    if (!robot) { toast("Robot controller module did not load."); return; }
    if (!robot.connected || !robot.authenticated) {
      requestRobotConnection("Play drill", () => startPlayback());
      return;
    }

    playbackToken += 1;
    const token = playbackToken;
    playbackRunning = true;
    liveRetunePending = false;
    if (liveRetuneTimer) clearTimeout(liveRetuneTimer);
    liveRetuneTimer = null;
    playbackLiveContext = null;
    activeNodeRef = null;
    activeEdgeRef = null;
    runtimeCounterDisplay = new Map();
    updatePlayButton();
    currentPoseSession().lastRobotUseAt = new Date().toISOString();
    saveLibrary();

    const configured = drill.settings.repetitions;
    const infinite = configured <= 0;
    let completed = 0;
    let planned = 0;
    let carryDelay = 0;
    let pendingBatches = [];
    let warningsShown = false;

    const reportWarnings = warnings => {
      if (warningsShown || !warnings.length) return;
      warningsShown = true;
      warnings.forEach(message => robot.log(`Plan warning: ${message}`, "warn"));
      toast(warnings[0]);
    };
    const planMore = () => {
      if (!infinite && planned >= configured) return false;
      runtimeCounterDisplay = new Map();
      const window = compilePlaybackWindow(drill, planned, configured, infinite, carryDelay, NOVA_SEQUENCE_RECORD_LIMIT);
      if (!window.shots.length || !window.setsIncluded) throw new Error("The drill produced no playable shots.");
      const plan = buildRobotExecutionPlan({ shots: window.shots, warnings: window.warnings, trailingDelay: 0 }, { maxBatchSize: NOVA_SEQUENCE_RECORD_LIMIT });
      for (let index = 0; index < plan.batches.length; index += 1) {
        const batch = plan.batches[index];
        const lastSet = batch.shots.at(-1)?.logicalSet ?? null;
        const sameSetContinues = lastSet != null && plan.batches.slice(index + 1).some(next => next.shots.some(shot => shot.logicalSet === lastSet));
        batch.completedSetThrough = sameSetContinues ? null : lastSet;
      }
      pendingBatches.push(...plan.batches);
      planned += window.setsIncluded;
      carryDelay = window.nextCarryDelay;
      reportWarnings(plan.warnings);
      return true;
    };
    const takeNextBatch = () => {
      while (!pendingBatches.length) {
        if (!planMore()) return null;
      }
      let batch = pendingBatches.shift();
      if (batch.tuningRevision !== liveTuningRevision) {
        batch = rebuildPlaybackBatchForLiveTuning(batch);
        if (batch.retuneWarnings?.length) reportWarnings(batch.retuneWarnings);
      }
      return batch;
    };
    const markBatchComplete = batch => {
      if (Number.isFinite(batch.completedSetThrough)) completed = Math.max(completed, batch.completedSetThrough);
      updateProgress(completed, configured, infinite, infinite ? `∞ · ${completed} repetitions completed` : `${completed} of ${configured} repetitions completed`);
    };
    const showActiveBatch = (batch, message) => {
      const firstShot = batch.shots[0];
      activeNodeRef = { drillId: firstShot.drillId, nodeId: firstShot.nodeId };
      activeEdgeRef = null;
      if (firstShot.drillId === activeDrill()?.id) renderGraph();
      const firstSet = firstShot.logicalSet || completed + 1;
      const lastSet = batch.shots.at(-1)?.logicalSet || firstSet;
      const setText = firstSet === lastSet ? `set ${firstSet}` : `sets ${firstSet}–${lastSet}`;
      els.runStatus.textContent = `${setText} · ${message} · ${batch.shots.length} ball${batch.shots.length === 1 ? "" : "s"}`;
      return setText;
    };
    const updateLeadSeconds = batch => {
      const tail = batch.shots.slice(-Math.min(2, batch.shots.length)).reduce((sum, shot) => sum + shot.encodedDelay, 0);
      return clamp(tail, .75, 2, 1.25);
    };
    const waitForUpdatePoint = async context => {
      while (playbackRunning && token === playbackToken && playbackLiveContext === context) {
        const updateAt = context.expectedEndAt - updateLeadSeconds(context.currentBatch) * 1000;
        const remainingMs = updateAt - performance.now();
        if (remainingMs <= 0) return;
        await sleep(Math.min(100, remainingMs), token);
      }
    };

    try {
      await robot.ensureReadyForStart();
      let nextBatch = takeNextBatch();
      while (nextBatch && playbackRunning && token === playbackToken) {
        if (nextBatch.hostDelayBefore > 0) {
          await waitWithStatus(nextBatch.hostDelayBefore, token, "Long requested delay");
          if (!playbackRunning || token !== playbackToken) break;
          if (nextBatch.tuningRevision !== liveTuningRevision) nextBatch = rebuildPlaybackBatchForLiveTuning(nextBatch);
        }

        let currentBatch = nextBatch;
        const setText = showActiveBatch(currentBatch, "starting rolling feed");
        const doneBaseline = await robot.beginBatch(currentBatch.packet, {
          description: `${setText}, rolling feed (${currentBatch.shots.length} balls)`,
        });
        const liveContext = {
          token,
          currentBatch,
          queuedBatch: null,
          expectedEndAt: performance.now() + currentBatch.encodedSeconds * 1000,
        };
        playbackLiveContext = liveContext;
        nextBatch = null;

        while (playbackRunning && token === playbackToken) {
          let candidate = takeNextBatch();
          if (!candidate || candidate.hostDelayBefore > 0) {
            const remainingMs = Math.max(0, liveContext.expectedEndAt - performance.now());
            await robot.waitForBatchComplete(doneBaseline, Math.max(20000, remainingMs + 12000), remainingMs);
            markBatchComplete(liveContext.currentBatch);
            nextBatch = candidate;
            if (playbackLiveContext === liveContext) playbackLiveContext = null;
            break;
          }

          await waitForUpdatePoint(liveContext);
          if (!playbackRunning || token !== playbackToken) break;
          showActiveBatch(liveContext.currentBatch, `queueing next ${candidate.shots.length}-ball pack`);
          try {
            candidate = await enqueuePlaybackUpdate(async () => {
              if (playbackLiveContext !== liveContext || !playbackRunning || token !== playbackToken) return null;
              if (candidate.tuningRevision !== liveTuningRevision) candidate = rebuildPlaybackBatchForLiveTuning(candidate);
              await robot.updateActiveSequence(candidate.liveUpdatePacket, {
                description: `next ${candidate.shots.length}-ball pack`,
              });
              liveContext.queuedBatch = candidate;
              return candidate;
            });
          } catch (error) {
            robot.log(`Rolling live update failed; falling back to a new START after this pack: ${error.message}`, "warn");
            const remainingMs = Math.max(0, liveContext.expectedEndAt - performance.now());
            await robot.waitForBatchComplete(doneBaseline, Math.max(20000, remainingMs + 12000), remainingMs);
            markBatchComplete(liveContext.currentBatch);
            nextBatch = candidate;
            if (playbackLiveContext === liveContext) playbackLiveContext = null;
            break;
          }
          if (!candidate || !playbackRunning || token !== playbackToken) break;

          els.runStatus.textContent = `Continuous feed · next ${candidate.shots.length}-ball pack queued`;
          await waitUntilPlaybackDeadline(liveContext.expectedEndAt, token);
          if (!playbackRunning || token !== playbackToken) break;
          markBatchComplete(liveContext.currentBatch);
          await enqueuePlaybackUpdate(async () => {
            if (playbackLiveContext !== liveContext || !playbackRunning || token !== playbackToken) return;
            currentBatch = liveContext.queuedBatch || candidate;
            liveContext.currentBatch = currentBatch;
            liveContext.queuedBatch = null;
            liveContext.expectedEndAt += currentBatch.encodedSeconds * 1000;
          });
          showActiveBatch(currentBatch, "rolling feed");
        }
        if (playbackLiveContext === liveContext) playbackLiveContext = null;
      }

      if (playbackRunning && token === playbackToken) {
        els.runStatus.textContent = infinite ? `Stopped after ${completed} repetitions` : `Finished ${completed} repetitions · Nova Ready`;
        if (!infinite) els.runProgressBar.style.width = "100%";
      }
    } catch (error) {
      if (token === playbackToken && playbackRunning) {
        els.runStatus.textContent = `Stopped: ${error.message}`;
        toast(error.message);
        if (robot.connected && robotIsActive()) await robot.stopAndWaitFree().catch(stopError => robot.log(`Emergency cleanup Stop was not confirmed: ${stopError.message}`, "error"));
      }
    } finally {
      if (token === playbackToken) {
        playbackRunning = false;
        liveRetunePending = false;
        if (liveRetuneTimer) clearTimeout(liveRetuneTimer);
        liveRetuneTimer = null;
        playbackLiveContext = null;
        activeNodeRef = null;
        activeEdgeRef = null;
        updatePlayButton();
        renderGraph();
      }
    }
  }
  async function waitWithStatus(seconds, token, prefix) {
    const duration = Math.max(0, finite(seconds, 0));
    if (duration <= 0) return;
    const start = performance.now();
    while (playbackRunning && token === playbackToken) {
      const elapsed = (performance.now() - start) / 1000;
      const remaining = duration - elapsed;
      if (remaining <= 0) return;
      els.runStatus.textContent = `${prefix} ${fmt(remaining,1)}s`;
      await sleep(Math.min(100, remaining * 1000), token);
    }
  }

  async function waitUntilPlaybackDeadline(deadlineMs, token) {
    while (playbackRunning && token === playbackToken) {
      const remainingMs = deadlineMs - performance.now();
      if (remainingMs <= 0) return;
      await sleep(Math.min(100, remainingMs), token);
    }
  }

  function sleep(ms, token) {
    return new Promise(resolve => setTimeout(() => resolve(token === playbackToken), ms));
  }

  async function stopPlayback() {
    if (stopPromise) return stopPromise;
    const hadCalibrationTest = calibrationTestRunning;
    const needsRobotStop = Boolean(robot?.connected && robot.authenticated && robot.wireState !== 3 && robot.wireState !== 0 && robot.wireState != null);
    if (!playbackRunning && !calibrationTestRunning && !needsRobotStop) return;

    playbackRunning = false;
    liveRetunePending = false;
    if (liveRetuneTimer) clearTimeout(liveRetuneTimer);
    liveRetuneTimer = null;
    playbackLiveContext = null;
    calibrationTestRunning = false;
    if (hadCalibrationTest) calibrationTestMessage = needsRobotStop ? "Stopping calibration test shot…" : "Calibration test shot canceled.";
    playbackToken += 1;
    activeNodeRef = null;
    activeEdgeRef = null;
    els.runStatus.textContent = needsRobotStop ? "Stopping Nova…" : "Stopped";
    updatePlayButton();
    renderGraph();

    stopPromise = (async () => {
      if (needsRobotStop) {
        try {
          await robot.stopAndWaitFree();
          els.runStatus.textContent = "Stopped · Nova Ready";
        } catch (error) {
          els.runStatus.textContent = `Stop not confirmed: ${error.message}`;
          toast("Nova did not confirm Ready after Stop. Keep the physical power switch accessible.");
          robot.log(`Stop not confirmed: ${error.message}`, "error");
        }
      }
    })();

    try {
      await stopPromise;
    } finally {
      stopPromise = null;
      updatePlayButton();
      updateRobotUI();
      renderCalibrationTestShotPanel();
    }
  }

  function updatePlayButton() {
    const active = playbackRunning || calibrationTestRunning || calibrationFeedRunning || robotIsActive();
    const stopping = robot?.phase === "stopping";
    els.playBtn.classList.toggle("running", active || stopping);
    els.playIcon.textContent = active || stopping ? "■" : "▶";
    els.playText.textContent = stopping ? "Stopping…" : active ? "Stop" : "Play";
  }

  function updateProgress(completed, total, infinite, text) {
    els.runStatus.textContent = text;
    if (infinite) {
      els.runProgressBar.style.width = `${Math.min(95, 10 + (completed % 10) * 9)}%`;
    } else {
      els.runProgressBar.style.width = `${total ? completed / total * 100 : 0}%`;
    }
  }

  function weightedChoice(edges) {
    if (!edges.length) return null;
    const total = edges.reduce((sum, edge) => sum + Math.max(0, edge.weight), 0);
    let value = Math.random() * total;
    for (const edge of edges) {
      value -= Math.max(0, edge.weight);
      if (value <= 0) return edge;
    }
    return edges.at(-1);
  }

  function generateTrace() {
    const drill = activeDrill();
    if (!drill) return;
    const limit = Math.round(clamp(els.previewLimitInput.value, 1, 1000, 80));
    const context = { events: [], transitions: 0 };
    const result = simulateDrill(drill.id, context, [], limit);
    els.previewList.replaceChildren();
    for (const event of context.events) {
      const li = document.createElement("li");
      li.textContent = event.title;
      const detail = document.createElement("span");
      detail.textContent = event.detail;
      li.appendChild(detail);
      els.previewList.appendChild(li);
    }
    els.previewStats.replaceChildren();
    for (const value of [
      `${context.events.filter(e => e.kind === "shot").length} shots`,
      `${context.events.filter(e => e.kind === "random").length} random choices`,
      `${context.events.filter(e => e.kind === "subdrill").length} sub-drill calls`,
    ]) {
      const chip = document.createElement("span");
      chip.className = "preview-stat";
      chip.textContent = value;
      els.previewStats.appendChild(chip);
    }
    els.previewStopReason.textContent = result.reason;
  }

  function simulateDrill(drillId, context, stack, limit) {
    if (stack.includes(drillId)) return { ok: false, reason: "Stopped: recursive sub-drill call." };
    const drill = getDrill(drillId);
    if (!drill) return { ok: false, reason: "Stopped: missing drill." };
    let node = getNode(drill, drill.startNodeId);
    const nextStack = [...stack, drillId];
    const repeaters = new Map(
      drill.nodes.filter(candidate => candidate.type === "counter").map(repeater => [repeater.id, repeater.startCount])
    );

    while (node && context.events.length < limit) {
      resetRepeatersTriggeredBySimulation(drill, node, context, repeaters);
      let edge = null;
      if (node.type === "shot") {
        const adjusted = adjustedShotForRuntime(node.params, drillId);
        const p = adjusted.params;
        const suffix = adjusted.changed ? ` · live tuning · elev ${signed(p.elevationDeg,1)}°` : "";
        context.events.push({ kind: "shot", title: node.label, detail: `${fmt(p.speedMps,1)} m/s · ${spinWords(p.spinRps)}${suffix}` });
        edge = outgoing(drill, node.id)[0] ?? null;
      } else if (node.type === "random") {
        edge = weightedChoice(outgoing(drill, node.id));
        context.events.push({ kind: "random", title: node.label, detail: edge ? `Selected ${getNode(drill, edge.target)?.label}` : "No branch; set ends" });
      } else if (node.type === "drill") {
        context.events.push({ kind: "subdrill", title: node.label, detail: `Run ${getDrill(node.referencedDrillId)?.name || "missing drill"}` });
        const nested = simulateDrill(node.referencedDrillId, context, nextStack, limit);
        if (!nested.ok) return nested;
        edge = outgoing(drill, node.id)[0] ?? null;
      } else {
        const remaining = repeaters.get(node.id) ?? node.startCount;
        if (remaining > 0) {
          repeaters.set(node.id, remaining - 1);
          edge = edgeForSlot(drill, node.id, "A");
          context.events.push({ kind: "counter", title: node.label, detail: `Repeat; ${remaining - 1} remaining` });
        } else {
          repeaters.set(node.id, node.startCount);
          edge = edgeForSlot(drill, node.id, "B");
          context.events.push({ kind: "counter", title: node.label, detail: `Finish; reset to ${node.startCount}` });
        }
      }
      if (!edge) return { ok: true, reason: `Set ended after “${node.label}”.` };
      const effectiveDelay = tunedDelaySeconds(edge.delaySeconds);
      if (effectiveDelay > 0) {
        const tunedNote = Math.abs(effectiveDelay - edge.delaySeconds) > 1e-6 ? ` · stored ${fmt(edge.delaySeconds,2)} s` : "";
        context.events.push({ kind: "delay", title: `Wait ${fmt(effectiveDelay,2)} seconds`, detail: `Before ${getNode(drill, edge.target)?.label || "next node"}${tunedNote}` });
      }
      node = getNode(drill, edge.target);
    }
    return context.events.length >= limit ? { ok: false, reason: `Stopped at the ${limit}-event preview limit.` } : { ok: true, reason: "Set ended." };
  }

  function resetRepeatersTriggeredBySimulation(drill, triggered, context, repeaters) {
    for (const repeater of drill.nodes.filter(node => node.type === "counter" && node.clearOnNodeIds.includes(triggered.id))) {
      repeaters.set(repeater.id, repeater.startCount);
      context.events.push({ kind: "reset", title: `${repeater.label} reset`, detail: `Triggered by ${triggered.label}` });
    }
  }

  function fitGraph() {
    const drill = activeDrill();
    const endpoints = syntheticEndpointPositions(drill || { nodes: [] });
    if (!drill?.nodes.length) {
      applyGraphZoom(1);
      els.graphViewport.scrollTo({ left: 0, top: 0, behavior: "auto" });
      return;
    }

    // On phones the graph is deliberately a readable vertical document rather than a
    // miniature overview. Keep cards near native size and let the canvas scroll/pan.
    // The Fit button still gives users an explicit overview when they want one.
    if (mobileGraphLayoutEnabled()) {
      applyGraphZoom(.86);
      const startX = Math.max(0, endpoints.start.x * graphZoom - els.graphViewport.clientWidth / 2 + 55 * graphZoom);
      const startY = Math.max(0, (endpoints.start.y - 24) * graphZoom);
      els.graphViewport.scrollTo({ left: startX, top: startY, behavior: "smooth" });
      return;
    }

    const positions = drill.nodes.map(n => ({ node: n, ...visualNodePosition(drill, n) }));
    const minX = Math.min(endpoints.start.x - 60, ...positions.map(p => p.x));
    const maxX = Math.max(endpoints.end.x + 60, ...positions.map(p => p.x + NODE_WIDTH));
    const minY = Math.min(endpoints.start.y - 30, ...positions.map(p => p.y));
    const maxY = Math.max(endpoints.end.y + 30, ...positions.map(p => p.y + nodeHeight(drill, p.node)));

    const padding = mobileGraphLayoutEnabled() ? 48 : 100;
    const contentWidth = Math.max(1, maxX - minX + padding * 2);
    const contentHeight = Math.max(1, maxY - minY + padding * 2);
    const fitZoom = Math.min(
      1,
      els.graphViewport.clientWidth / contentWidth,
      els.graphViewport.clientHeight / contentHeight
    );
    const targetZoom = clamp(fitZoom, MIN_GRAPH_ZOOM, 1, 1);
    applyGraphZoom(targetZoom);

    const centerX = (minX + maxX) / 2 * graphZoom;
    const centerY = (minY + maxY) / 2 * graphZoom;
    els.graphViewport.scrollTo({
      left: Math.max(0, centerX - els.graphViewport.clientWidth / 2),
      top: Math.max(0, centerY - els.graphViewport.clientHeight / 2),
      behavior: "smooth",
    });
  }

  function cloneDrillForUser(source, { folderId = null, nameBase = null } = {}) {
    const clone = structuredClone(source);
    const idMap = new Map();
    clone.id = makeId("drill");
    clone.name = uniqueDrillName(nameBase || `${builtInDisplayName(source.name)} copy`);
    clone.folderId = library.folders.some(folder => folder.id === folderId) ? folderId : null;
    delete clone.builtIn;
    delete clone.libraryFolderId;
    clone.nodes.forEach(node => {
      const old = node.id;
      node.id = makeId(node.type);
      idMap.set(old, node.id);
    });
    clone.edges.forEach(edge => {
      edge.id = makeId("edge");
      edge.source = idMap.get(edge.source);
      edge.target = idMap.get(edge.target);
    });
    clone.nodes.filter(node => node.type === "counter").forEach(node => {
      node.clearOnNodeIds = node.clearOnNodeIds.map(id => idMap.get(id)).filter(Boolean);
    });
    clone.startNodeId = idMap.get(source.startNodeId) ?? clone.nodes[0]?.id ?? null;
    return clone;
  }

  function variationShiftedToEffectiveShot(variation, baseParams, adjustment) {
    if (!variation?.enabled) return null;
    const copy = structuredClone(variation);
    const speedDelta = adjustment.params.speedMps - baseParams.speedMps;
    const spinDelta = adjustment.params.spinRps - baseParams.spinRps;
    const clearanceDeltaCm = ((adjustment.prediction?.net?.clearanceM ?? 0) - (adjustment.basePrediction?.net?.clearanceM ?? 0)) * 100;
    copy.speed.minMps += speedDelta; copy.speed.maxMps += speedDelta;
    copy.spin.minRps += spinDelta; copy.spin.maxRps += spinDelta;
    copy.clearance.minCm += clearanceDeltaCm; copy.clearance.maxCm += clearanceDeltaCm;
    return ShotVariation.normalizeVariation(copy, adjustment.params, adjustment.prediction?.net?.clearanceM);
  }

  function saveEffectiveDrillAsNew() {
    if (playbackRunning || calibrationTestRunning || robotIsActive()) { toast("Stop the robot before saving the current effective drill."); return; }
    const source = activeDrill();
    if (!source) return;
    let compiled;
    try { compiled = compileRobotSet(source.id); }
    catch (error) { toast(error instanceof Error ? error.message : String(error)); return; }
    if (!compiled.shots.length) { toast("This drill has no playable sequence to save."); return; }
    const effective = [];
    for (const shot of compiled.shots) {
      const adjustment = adjustedShotForRuntime(shot.params, shot.drillId);
      if (!adjustment.feasible) {
        toast(`Cannot save: “${shot.label}” is not feasible from the current position and adjustments.`);
        return;
      }
      effective.push({ shot, adjustment });
    }
    const saved = defaultDrill(uniqueDrillName(`${isActiveBuiltIn() ? builtInDisplayName(source.name) : source.name} — current setup`));
    saved.description = `Saved runtime result of “${isActiveBuiltIn() ? builtInDisplayName(source.name) : source.name}”. Robot position and live adjustments were baked into this sampled sequence; the source drill was not changed.`;
    saved.tags = [...new Set([...(source.tags || []), "saved setup"])];
    saved.robotPose = { ...currentRobotPose() };
    saved.settings = {
      repetitions: source.settings.repetitions,
      delayBetweenSets: tunedDelaySeconds(source.settings.delayBetweenSets),
    };
    saved.nodes = effective.map(({ shot, adjustment }, index) => ({
      id: makeId("shot"), type: "shot", label: shot.label,
      x: 150 + (index % 4) * 320, y: 220 + Math.floor(index / 4) * 230,
      params: { ...adjustment.params },
      variation: variationShiftedToEffectiveShot(shot.variation, shot.params, adjustment),
    }));
    saved.startNodeId = saved.nodes[0]?.id || null;
    saved.nodes.slice(0, -1).forEach((node, index) => saved.edges.push({
      id: makeId("edge"), source: node.id, sourceSlot: "next", target: saved.nodes[index + 1].id,
      weight: 1, delaySeconds: tunedDelaySeconds(effective[index + 1].shot.delayBefore),
    }));
    library.drills.push(saved);
    library.activeDrillSource = "user";
    library.activeDrillId = saved.id;
    liveTuning = { ...DrillAdjustments.DEFAULT_TUNING };
    liveTuningCache.clear();
    saveLiveTuningPreference();
    saveLibrary(); renderAll(); renderLiveTuning();
    toast(`Saved and selected “${saved.name}”. Live tuning was reset because its result is now stored in the new drill.`);
  }

  function createDrill() {
    if (libraryView.root !== "user") selectLibraryRoot("user");
    const drill = defaultDrill(uniqueDrillName("New drill"));
    drill.folderId = libraryView.folderId || null;
    library.drills.push(drill);
    library.activeDrillSource = "user";
    library.activeDrillId = drill.id;
    selection = null;
    commit({ message: "New drill created" });
    navigateApp("editor", { push: true });
    setTimeout(fitGraph, 30);
  }

  function copyActiveBuiltInToMyDrills() {
    const source = activeDrill();
    if (!source || !isActiveBuiltIn()) return;
    const clone = cloneDrillForUser(source, { folderId: null, nameBase: `${builtInDisplayName(source.name)} copy` });
    library.drills.push(clone);
    library.activeDrillSource = "user";
    library.activeDrillId = clone.id;
    libraryView = { root: "user", folderId: clone.folderId, query: "" };
    els.librarySearchInput.value = "";
    selection = null;
    commit({ message: "Copied to My drills" });
    setTimeout(fitGraph, 30);
  }

  function duplicateActiveDrill() {
    const source = activeDrill();
    if (!source) return;
    if (isActiveBuiltIn()) { copyActiveBuiltInToMyDrills(); return; }
    const clone = cloneDrillForUser(source, { folderId: source.folderId || null, nameBase: `${source.name} copy` });
    library.drills.push(clone);
    library.activeDrillSource = "user";
    library.activeDrillId = clone.id;
    libraryView = { root: "user", folderId: clone.folderId || null, query: "" };
    selection = null;
    commit({ message: "Drill duplicated" });
  }

  function deleteActiveDrill() {
    const drill = activeDrill();
    if (!drill) return;
    if (isActiveBuiltIn()) { toast("Built-in presets cannot be deleted."); return; }
    askConfirm("Delete drill?", `Delete “${drill.name}”? Sub-drill nodes that reference it will become invalid.`, () => {
      library.drills = library.drills.filter(d => d.id !== drill.id);
      const next = library.drills.find(d => (d.folderId || null) === (drill.folderId || null)) || library.drills[0];
      if (next) {
        library.activeDrillSource = "user";
        library.activeDrillId = next.id;
      } else {
        library.activeDrillSource = "builtin";
        library.activeDrillId = builtInCatalog.defaultDrillId;
      }
      selection = null;
      commit({ message: "Drill deleted" });
    });
  }

  function uniqueFolderName(base, parentId, excludeId = null) {
    const clean = String(base || "New folder").trim().slice(0, 90) || "New folder";
    const used = new Set(library.folders
      .filter(folder => folder.id !== excludeId && (folder.parentId || null) === (parentId || null))
      .map(folder => folder.name.toLowerCase()));
    if (!used.has(clean.toLowerCase())) return clean;
    let index = 2;
    while (used.has(`${clean} ${index}`.toLowerCase())) index += 1;
    return `${clean} ${index}`;
  }

  function openFolderDialog(mode) {
    if (libraryView.root !== "user") return;
    const folder = folderById("user", libraryView.folderId);
    folderDialogMode = mode;
    els.folderDialogTitle.textContent = mode === "rename" ? "Rename folder" : "New folder";
    els.folderNameInput.value = mode === "rename" && folder ? folder.name : "";
    els.folderDialog.showModal();
    setTimeout(() => els.folderNameInput.focus(), 20);
  }

  function saveFolderDialog() {
    const parentFolder = folderById("user", libraryView.folderId);
    if (folderDialogMode === "rename" && parentFolder) {
      parentFolder.name = uniqueFolderName(els.folderNameInput.value, parentFolder.parentId, parentFolder.id);
      els.folderDialog.close();
      commit({ message: "Folder renamed" });
      return;
    }
    const parentId = parentFolder?.id || null;
    const folder = {
      id: makeId("folder"),
      name: uniqueFolderName(els.folderNameInput.value, parentId),
      parentId,
    };
    library.folders.push(folder);
    els.folderDialog.close();
    libraryView.folderId = folder.id;
    commit({ message: "Folder created" });
  }

  function deleteCurrentFolder() {
    const folder = folderById("user", libraryView.folderId);
    if (!folder) return;
    askConfirm(
      "Delete folder?",
      `Delete “${folder.name}”? Drills and subfolders inside it will be moved up one level; no drills will be deleted.`,
      () => {
        const parentId = folder.parentId || null;
        library.drills.forEach(drill => { if (drill.folderId === folder.id) drill.folderId = parentId; });
        library.folders.forEach(child => { if (child.parentId === folder.id) child.parentId = parentId; });
        library.folders = library.folders.filter(item => item.id !== folder.id);
        libraryView.folderId = parentId;
        commit({ message: "Folder removed; contents kept" });
      }
    );
  }

  function folderDepth(folder) {
    let depth = 0;
    let cursor = folder;
    const seen = new Set();
    while (cursor?.parentId && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      depth += 1;
      cursor = folderById("user", cursor.parentId);
    }
    return depth;
  }

  function openMoveDrillDialog() {
    const drill = activeDrill();
    if (!drill || isActiveBuiltIn()) return;
    els.moveDrillFolderSelect.replaceChildren();
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = "My drills /";
    els.moveDrillFolderSelect.appendChild(rootOption);
    for (const folder of [...library.folders].sort((a, b) => {
      const ap = folderPath("user", a.id).map(item => item.name).join("/");
      const bp = folderPath("user", b.id).map(item => item.name).join("/");
      return ap.localeCompare(bp);
    })) {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = `${"  ".repeat(folderDepth(folder) + 1)}${folder.name}`;
      if ((drill.folderId || "") === folder.id) option.selected = true;
      els.moveDrillFolderSelect.appendChild(option);
    }
    els.moveDrillDialog.showModal();
  }

  function moveActiveDrill() {
    const drill = activeDrill();
    if (!drill || isActiveBuiltIn()) return;
    const target = els.moveDrillFolderSelect.value || null;
    drill.folderId = library.folders.some(folder => folder.id === target) ? target : null;
    libraryView = { root: "user", folderId: drill.folderId || null, query: "" };
    els.moveDrillDialog.close();
    commit({ message: "Drill moved" });
  }

  function exportLibrary() {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table-tennis-robot-studio-my-drills.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("My drills and calibration exported");
  }

  function importLibrary(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        library = sanitizeLibrary(JSON.parse(String(reader.result)));
        libraryView = { root: library.activeDrillSource === "user" ? "user" : "builtin", folderId: library.activeDrillSource === "user" ? (activeDrill()?.folderId || null) : (activeDrill()?.libraryFolderId || "builtin-root"), query: "" };
        selection = null;
        stopPlayback();
        commit({ message: "My drills and calibration imported" });
        setTimeout(fitGraph, 40);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Import failed.");
      }
    });
    reader.readAsText(file);
  }

  function askConfirm(title, text, callback, options = {}) {
    confirmCallback = callback;
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmActionBtn.textContent = options.actionLabel || "Confirm";
    els.confirmActionBtn.className = `button ${options.actionClass || "danger"}`;
    els.confirmDialog.showModal();
  }
  function toast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 2700);
  }

  function fmt(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits).replace(/\.?0+$/, "");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function attr(value) { return escapeHtml(value); }

  function robotPhaseLabel(snapshot = robot?.snapshot()) {
    if (!snapshot) return "Controller unavailable";
    if (!snapshot.browserSupported && !snapshot.connected) return "Web Bluetooth unavailable";
    if (!snapshot.connected) {
      const pending = {
        "choosing-device": "Choose Nova…",
        "connecting": "Connecting…",
        "authenticating": "Authenticating…",
      }[snapshot.phase];
      return pending || "Disconnected";
    }
    if (snapshot.wireState != null) return snapshot.stateName;
    return {
      "authenticating": "Authenticating…",
      "initializing": "Initializing…",
      "connected-busy": "Connected",
    }[snapshot.phase] || "Connected";
  }

  function browserBluetoothInstructions() {
    if (!globalThis.isSecureContext) {
      return "Open Table Tennis Robot Studio over HTTPS (GitHub Pages is fine) or localhost. Web Bluetooth is blocked on ordinary http:// pages.";
    }
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const firefox = /Firefox|FxiOS/i.test(ua);
    const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Brave/i.test(ua);
    const brave = /Brave/i.test(ua) || Boolean(navigator.brave);
    if (ios) return "iPhone/iPad Safari and Chrome do not normally expose Web Bluetooth. The lowest-friction option is a Web-Bluetooth-capable iOS browser if one is available on your device, otherwise use Android Chrome/Brave or desktop Chrome/Edge.";
    if (firefox) return "Firefox does not expose Web Bluetooth. Open this site in Chrome, Chromium, Edge, or another Chromium browser, then press Connect Nova.";
    if (safari) return "Safari does not expose Web Bluetooth. Open this site in Chrome, Chromium, or Edge, then press Connect Nova.";
    if (brave) return "Brave needs Bluetooth permission for this site. Check Brave Settings → Site settings → Bluetooth devices (wording may vary), allow this site, reload, then press Connect Nova. If the Bluetooth permission is not available, try Chrome.";
    return "This Chromium browser is not exposing Web Bluetooth. Make sure Bluetooth is enabled, this site is allowed to use Bluetooth devices, and the page is HTTPS. Reload after changing the permission. Chrome or Edge usually works without an experimental flag.";
  }

  function requestRobotConnection(reason, continuation = null) {
    if (robot?.connected && robot.authenticated) {
      if (typeof continuation === "function") void continuation();
      return true;
    }
    pendingRobotReason = String(reason || "This action");
    pendingRobotAction = typeof continuation === "function" ? continuation : null;
    if (els.robotDialogContext) {
      els.robotDialogContext.hidden = false;
      els.robotDialogContext.textContent = `${pendingRobotReason} needs a Nova connection. Connect once and the app will continue automatically.`;
    }
    updateRobotUI();
    if (!els.robotDialog.open) els.robotDialog.showModal();
    return false;
  }

  function clearPendingRobotAction() {
    pendingRobotAction = null;
    pendingRobotReason = "";
    if (els.robotDialogContext) {
      els.robotDialogContext.hidden = true;
      els.robotDialogContext.textContent = "";
    }
  }
  function updateRobotUI() {
    const snapshot = robot?.snapshot() || {
      connected: false,
      ready: false,
      authenticated: false,
      browserSupported: false,
      phase: "unavailable",
      serial: "",
      deviceName: "",
      deviceId: "",
      wireState: null,
      stateDetail: 0,
      stateName: "Unknown",
    };
    const label = robotPhaseLabel(snapshot);
    const connecting = ["choosing-device", "connecting", "authenticating"].includes(snapshot.phase);

    els.robotConnectBtn.textContent = snapshot.connected ? "Disconnect Nova" : connecting ? "Connecting…" : "Connect Nova";
    els.robotConnectBtn.disabled = connecting;
    els.robotStatusText.textContent = "Nova";
    els.robotStatusBtn.title = label;
    els.robotStatusBtn.className = "global-robot-status";
    const statusClass = !snapshot.connected ? (snapshot.browserSupported ? "disconnected" : "unsupported")
      : snapshot.ready ? "ready"
      : [4, 6].includes(snapshot.wireState) ? "running"
      : [2, 5, 7].includes(snapshot.wireState) ? "busy"
      : snapshot.wireState === 202 ? "error" : "connected";
    els.robotStatusBtn.classList.add(statusClass);
    [els.runConnectionDot, els.robotPageDot].filter(Boolean).forEach(dot => { dot.className = `status-dot ${snapshot.connected ? "connected" : "disconnected"}`; });
    if (els.runConnectionText) els.runConnectionText.textContent = snapshot.connected ? `Nova ${label}` : "Nova disconnected";
    if (els.robotPageConnection) els.robotPageConnection.textContent = snapshot.connected ? `Nova ${label}` : "Nova disconnected";
    if (els.robotPageDevice) els.robotPageDevice.textContent = snapshot.connected ? (snapshot.deviceName || snapshot.serial || "Connected") : (snapshot.browserSupported ? "Web Bluetooth available" : "Web Bluetooth unavailable");

    els.robotDialogConnection.textContent = snapshot.connected
      ? `${snapshot.authenticated ? "Authenticated" : "Connected"} · ${label}`
      : label;
    els.robotDialogDevice.textContent = snapshot.deviceName || snapshot.deviceId || "—";
    els.robotDialogSerial.textContent = snapshot.serial || "—";
    els.robotDialogState.textContent = snapshot.wireState == null
      ? "—"
      : `${snapshot.wireState} · ${snapshot.stateName}${snapshot.stateDetail ? ` · detail ${snapshot.stateDetail}` : ""}`;
    els.robotRefreshStatusBtn.disabled = !snapshot.connected || !snapshot.authenticated;
    els.robotDisconnectBtn.disabled = !snapshot.connected;

    if (!globalThis.isSecureContext || !navigator.bluetooth) {
      els.robotBrowserNotice.className = "robot-browser-notice error";
      els.robotBrowserNotice.textContent = browserBluetoothInstructions();
    } else {
      els.robotBrowserNotice.className = "robot-browser-notice ok";
      els.robotBrowserNotice.textContent = snapshot.connected
        ? "Direct BLE session active. Heartbeat runs every 10 seconds while connected."
        : "Web Bluetooth is ready. Press Connect Nova and choose your robot in the browser device picker.";
    }
    if (els.robotDialogConnectBtn) {
      els.robotDialogConnectBtn.hidden = snapshot.connected;
      els.robotDialogConnectBtn.disabled = connecting || (!snapshot.browserSupported && !snapshot.connected);
      els.robotDialogConnectBtn.textContent = connecting ? "Connecting…" : "Connect Nova";
    }
    updatePlayButton();
    renderCalibrationTestShotPanel();
    renderGuidedCalibration();
    renderProtocolDebugState();
  }

  const PROTOCOL_DEBUG_STORAGE_KEY = "ttstudio.protocolDebugScript.v1";
  const PROTOCOL_DEBUG_EXAMPLE = `# Safe example: status + heartbeat only.
# Uploading or editing a script never sends anything until Run script is pressed.
MARK Read state before heartbeat
STATUS
WAIT 500ms
MARK Send heartbeat and wait for its response
HEARTBEAT
WAIT 500ms
STATUS
`;

  function protocolDebugDownload(filename, text, type = "text/plain") {
    const blob = new Blob([String(text || "")], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function appendProtocolDebugLog(message, kind = "info") {
    const stamp = new Date().toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 });
    const marker = kind === "error" ? "!!" : kind === "tx" ? "TX" : kind === "rx" ? "RX" : kind === "wait" ? "… " : kind === "mark" ? "──" : "· ";
    protocolDebugLogLines.push(`${stamp} ${marker} ${message}`);
    if (protocolDebugLogLines.length > 400) protocolDebugLogLines = protocolDebugLogLines.slice(-400);
    if (els.protocolDebugExecutionLog) {
      els.protocolDebugExecutionLog.textContent = protocolDebugLogLines.join("\n");
      els.protocolDebugExecutionLog.scrollTop = els.protocolDebugExecutionLog.scrollHeight;
    }
  }

  function renderProtocolDebugState() {
    if (!els.protocolDebugDialog) return;
    const snapshot = robot?.snapshot?.() || { connected: false, authenticated: false };
    const ready = Boolean(snapshot.connected && snapshot.authenticated);
    els.protocolDebugConnectionBadge.textContent = ready ? "Connected" : snapshot.connected ? "Connecting" : "Disconnected";
    els.protocolDebugConnectionBadge.className = `status-badge ${ready ? "valid" : "neutral"}`;
    els.protocolDebugRunBtn.disabled = protocolDebugRunning || !ready;
    els.protocolDebugRunSelectionBtn.disabled = protocolDebugRunning || !ready;
    els.protocolDebugStopScriptBtn.disabled = !protocolDebugRunning;
    els.protocolDebugStopNovaBtn.disabled = !ready;
    if (!protocolDebugRunning) els.protocolDebugRunState.textContent = ready ? "Ready" : "Connect Nova first";
  }

  function validateProtocolDebugScript({ notify = false } = {}) {
    if (!ProtocolDebug) {
      els.protocolDebugParseStatus.textContent = "Protocol debug parser did not load.";
      els.protocolDebugParseStatus.className = "protocol-debug-parse-status error";
      return null;
    }
    const parsed = ProtocolDebug.parseScript(els.protocolDebugEditor.value);
    if (parsed.errors.length) {
      const first = parsed.errors[0];
      els.protocolDebugParseStatus.textContent = `${parsed.errors.length} error${parsed.errors.length === 1 ? "" : "s"}. Line ${first.lineNumber}: ${first.message}`;
      els.protocolDebugParseStatus.className = "protocol-debug-parse-status error";
      els.protocolDebugTimeline.textContent = "Fix the script errors before running.";
      if (notify) toast(`Debug script: line ${first.lineNumber} · ${first.message}`);
      return parsed;
    }
    const summary = ProtocolDebug.summarize(parsed.actions);
    const waitSeconds = summary.waitMs / 1000;
    els.protocolDebugParseStatus.textContent = `${summary.total} action${summary.total === 1 ? "" : "s"} · ${summary.send} raw TX · ${summary.request} request${summary.request === 1 ? "" : "s"} · ${summary.wait} wait${summary.wait === 1 ? "" : "s"}`;
    els.protocolDebugParseStatus.className = "protocol-debug-parse-status ok";
    els.protocolDebugTimeline.textContent = `Explicit waits: ${waitSeconds.toFixed(waitSeconds < 10 ? 2 : 1)} s · response waits add only as needed.`;
    if (notify) toast("Debug script is valid");
    return parsed;
  }

  function openProtocolDebugger() {
    if (!els.protocolDebugEditor.value) {
      try { els.protocolDebugEditor.value = localStorage.getItem(PROTOCOL_DEBUG_STORAGE_KEY) || PROTOCOL_DEBUG_EXAMPLE; }
      catch (_) { els.protocolDebugEditor.value = PROTOCOL_DEBUG_EXAMPLE; }
    }
    validateProtocolDebugScript();
    renderProtocolDebugState();
    els.protocolDebugDialog.showModal();
  }

  function protocolDebugWait(ms, token) {
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const tick = () => {
        if (token !== protocolDebugRunToken) { reject(new Error("Script stopped")); return; }
        const remaining = ms - (performance.now() - started);
        if (remaining <= 0) { resolve(); return; }
        setTimeout(tick, Math.min(remaining, 50));
      };
      tick();
    });
  }

  async function runProtocolDebugParsed(parsed, runLabel = "script") {
    if (!parsed || parsed.errors.length || !parsed.actions.length) return;
    if (!robot?.connected || !robot.authenticated) { requestRobotConnection("Protocol debugger", () => runProtocolDebugParsed(parsed, runLabel)); return; }

    protocolDebugRunToken += 1;
    const token = protocolDebugRunToken;
    protocolDebugRunning = true;
    protocolDebugLogLines = [];
    els.protocolDebugExecutionLog.textContent = "";
    els.protocolDebugRunState.textContent = "Running…";
    renderProtocolDebugState();
    const pauseHeartbeat = Boolean(els.protocolDebugPauseHeartbeat.checked);
    if (pauseHeartbeat) {
      robot.stopHeartbeat();
      appendProtocolDebugLog("Automatic 10 s app heartbeat paused for this run", "mark");
    }
    appendProtocolDebugLog(`Started ${runLabel}: ${parsed.actions.length} action${parsed.actions.length === 1 ? "" : "s"}`, "mark");

    try {
      for (let index = 0; index < parsed.actions.length; index += 1) {
        if (token !== protocolDebugRunToken) throw new Error("Script stopped");
        const action = parsed.actions[index];
        els.protocolDebugRunState.textContent = `Running ${index + 1}/${parsed.actions.length} · line ${action.lineNumber}`;
        if (action.type === "mark") {
          appendProtocolDebugLog(action.text, "mark");
        } else if (action.type === "wait") {
          appendProtocolDebugLog(`WAIT ${action.durationMs} ms`, "wait");
          await protocolDebugWait(action.durationMs, token);
        } else if (action.type === "send") {
          appendProtocolDebugLog(`line ${action.lineNumber} · TX ${action.hex}`, "tx");
          await robot.sendRaw(Protocol.bytesFromHex(action.hex), { label: `debug line ${action.lineNumber}` });
        } else if (action.type === "request") {
          appendProtocolDebugLog(`line ${action.lineNumber} · REQ 0x${action.expectedOpcode.toString(16).padStart(2, "0")} · ${action.hex}`, "tx");
          const frame = await robot.requestRaw(Protocol.bytesFromHex(action.hex), action.expectedOpcode, action.timeoutMs, action.label || `debug line ${action.lineNumber}`);
          appendProtocolDebugLog(`line ${action.lineNumber} · response ${frame.hex}`, "rx");
        }
      }
      if (token === protocolDebugRunToken) {
        els.protocolDebugRunState.textContent = "Completed";
        appendProtocolDebugLog(`${runLabel} completed`, "mark");
        toast(`${runLabel === "script" ? "Debug script" : "Debug selection"} completed`);
      }
    } catch (error) {
      if (token === protocolDebugRunToken) {
        els.protocolDebugRunState.textContent = error.message === "Script stopped" ? "Stopped" : "Failed";
        appendProtocolDebugLog(error.message, error.message === "Script stopped" ? "mark" : "error");
        if (error.message !== "Script stopped") toast(error.message);
      }
    } finally {
      if (pauseHeartbeat && robot?.connected && robot.authenticated) {
        robot.startHeartbeat();
        appendProtocolDebugLog("Automatic app heartbeat restored", "mark");
      }
      if (token === protocolDebugRunToken) protocolDebugRunning = false;
      renderProtocolDebugState();
    }
  }

  async function runProtocolDebugScript() {
    const parsed = validateProtocolDebugScript({ notify: true });
    await runProtocolDebugParsed(parsed, "script");
  }

  function protocolDebugSelectionSource() {
    const editor = els.protocolDebugEditor;
    const start = editor.selectionStart ?? 0;
    const end = editor.selectionEnd ?? start;
    if (end > start) return editor.value.slice(start, end);
    const lineStart = editor.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = editor.value.indexOf("\n", start);
    const lineEnd = nextBreak < 0 ? editor.value.length : nextBreak;
    return editor.value.slice(lineStart, lineEnd);
  }

  async function runProtocolDebugSelection() {
    const source = protocolDebugSelectionSource();
    const parsed = ProtocolDebug?.parseScript(source);
    if (!parsed) return;
    if (parsed.errors.length) {
      const first = parsed.errors[0];
      toast(`Selection: ${first.message}`);
      return;
    }
    if (!parsed.actions.length) { toast("Select a command or place the cursor on a command line."); return; }
    await runProtocolDebugParsed(parsed, "line / selection");
  }

  function stopProtocolDebugScript() {
    if (!protocolDebugRunning) return;
    protocolDebugRunToken += 1;
    protocolDebugRunning = false;
    els.protocolDebugRunState.textContent = "Stopped";
    appendProtocolDebugLog("Script stopped by user", "mark");
    renderProtocolDebugState();
  }

  async function stopNovaFromProtocolDebugger() {
    if (!robot?.connected || !robot.authenticated) return;
    stopProtocolDebugScript();
    try {
      els.protocolDebugRunState.textContent = "Stopping Nova…";
      await robot.stopAndWaitFree();
      els.protocolDebugRunState.textContent = "Nova Ready";
      appendProtocolDebugLog("Nova STOP sent; robot returned Ready", "mark");
    } catch (error) {
      els.protocolDebugRunState.textContent = "Stop failed";
      appendProtocolDebugLog(`STOP failed: ${error.message}`, "error");
      toast(error.message);
    }
    renderProtocolDebugState();
  }

  function loadProtocolDebugFile(file) {
    if (!file) return;
    if (file.size > 200000) { toast("Debug script is too large (200 kB maximum)."); return; }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      els.protocolDebugEditor.value = String(reader.result || "");
      try { localStorage.setItem(PROTOCOL_DEBUG_STORAGE_KEY, els.protocolDebugEditor.value); } catch (_) {}
      validateProtocolDebugScript();
      toast(`Loaded ${file.name}`);
    });
    reader.addEventListener("error", () => toast("Could not read debug script."));
    reader.readAsText(file);
  }

  function downloadProtocolDebugLog() {
    const combined = [
      "# Table Tennis Robot Studio protocol debug log",
      `# ${new Date().toISOString()}`,
      "",
      "## Script execution",
      protocolDebugLogLines.join("\n") || "(empty)",
      "",
      "## BLE protocol log",
      robotLogLines.join("\n") || "(empty)",
      "",
    ].join("\n");
    protocolDebugDownload(`nova-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`, combined);
  }

  function appendRobotLog(detail) {
    const time = detail.time instanceof Date ? detail.time : new Date(detail.time || Date.now());
    const stamp = time.toLocaleTimeString([], { hour12: false });
    const marker = detail.direction === "tx" ? "TX" : detail.direction === "rx" ? "RX" : detail.direction === "error" ? "!!" : detail.direction === "warn" ? "! " : "· ";
    const line = `${stamp} ${marker} ${detail.message}${detail.hex ? `\n    ${detail.hex}` : ""}`;
    robotLogLines.push(line);
    if (robotLogLines.length > 120) robotLogLines = robotLogLines.slice(-120);
    els.robotLog.textContent = robotLogLines.join("\n");
    els.robotLog.scrollTop = els.robotLog.scrollHeight;
  }

  async function connectOrDisconnectRobot() {
    if (!robot) { toast("Robot controller module is unavailable."); return; }
    try {
      if (robot.connected) {
        clearPendingRobotAction();
        if (calibrationFeedRunning) await stopGuidedFeed();
        if (playbackRunning || calibrationTestRunning || robotIsActive()) await stopPlayback();
        await robot.disconnect({ stopFirst: false });
        toast("Nova disconnected");
      } else {
        await robot.connect();
        const snapshot = robot.snapshot();
        toast(snapshot.ready ? `Connected to ${snapshot.deviceName || "Nova"} · Ready` : `Connected · ${snapshot.stateName}`);
        const continuation = pendingRobotAction;
        clearPendingRobotAction();
        if (els.robotDialog.open) els.robotDialog.close();
        if (continuation) await continuation();
      }
    } catch (error) {
      if (error?.name === "NotFoundError") toast("No Nova selected. You can press Connect Nova when you're ready.");
      else toast(error instanceof Error ? error.message : String(error));
      updateRobotUI();
    }
  }
  async function refreshRobotStatus() {
    if (!robot?.connected || !robot.authenticated) return;
    try {
      const status = await robot.queryStatus();
      toast(`Nova: ${status.name}`);
    } catch (error) {
      toast(error.message);
    }
  }

  async function disconnectRobotFromDialog() {
    if (!robot?.connected) return;
    try {
      if (playbackRunning || robotIsActive()) await stopPlayback();
      await robot.disconnect({ stopFirst: false });
      toast("Nova disconnected");
    } catch (error) {
      toast(error.message);
    }
  }

  async function copyRobotLog() {
    const text = robotLogLines.join("\n");
    if (!text) {
      toast("Protocol log is empty.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Protocol log copied");
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand?.("copy");
      area.remove();
      toast("Protocol log copied");
    }
  }

  function handleUnexpectedRobotDisconnect(event) {
    if (event.detail?.expected) return;
    if (playbackRunning || calibrationTestRunning) {
      const wasCalibrationTest = calibrationTestRunning;
      playbackRunning = false;
      calibrationTestRunning = false;
      playbackToken += 1;
      activeNodeRef = null;
      activeEdgeRef = null;
      if (wasCalibrationTest) {
        calibrationTestMessage = "Bluetooth lost during the test shot; the robot may finish the autonomous one-ball packet.";
      } else {
        els.runStatus.textContent = "Bluetooth lost while serving — the current robot batch may continue";
      }
      toast("Bluetooth disconnected while serving. Use the robot's physical stop/power control if it does not stop safely.");
      updatePlayButton();
      renderCalibrationTestShotPanel();
      renderGraph();
    }
  }

  function showFatalError(error) {
    console.error(error);
    const banner = document.createElement("div");
    banner.className = "fatal-banner";
    const message = error?.message || String(error);
    banner.textContent = `Table Tennis Robot Studio could not start: ${message}. If this is the GitHub Pages site, deploy the complete release together rather than individual files, then reload.`;
    document.body.appendChild(banner);
  }

  function openCalibrationWorkspace(tab = "guided") {
    setCalibrationTab(tab);
    renderCalibration();
    els.calibrationDialog.showModal();
  }

  function bindEvents() {
    els.robotConnectBtn.addEventListener("click", () => { void connectOrDisconnectRobot(); });
    els.robotDialogConnectBtn?.addEventListener("click", () => { void connectOrDisconnectRobot(); });
    els.robotStatusBtn.addEventListener("click", () => navigateApp("robot", { push: true }));
    els.robotDiagnosticsBtn?.addEventListener("click", () => { updateRobotUI(); els.robotDialog.showModal(); });
    els.protocolDebugBtn?.addEventListener("click", openProtocolDebugger);
    els.closeProtocolDebugBtn?.addEventListener("click", () => { stopProtocolDebugScript(); els.protocolDebugDialog.close(); });
    els.protocolDebugExampleBtn?.addEventListener("click", () => { els.protocolDebugEditor.value = PROTOCOL_DEBUG_EXAMPLE; try { localStorage.setItem(PROTOCOL_DEBUG_STORAGE_KEY, els.protocolDebugEditor.value); } catch (_) {} validateProtocolDebugScript(); });
    els.protocolDebugClearBtn?.addEventListener("click", () => { els.protocolDebugEditor.value = ""; try { localStorage.removeItem(PROTOCOL_DEBUG_STORAGE_KEY); } catch (_) {} validateProtocolDebugScript(); });
    els.protocolDebugDownloadBtn?.addEventListener("click", () => protocolDebugDownload("nova-debug-script.nova", els.protocolDebugEditor.value));
    els.protocolDebugDownloadLogBtn?.addEventListener("click", downloadProtocolDebugLog);
    els.protocolDebugValidateBtn?.addEventListener("click", () => validateProtocolDebugScript({ notify: true }));
    els.protocolDebugRunSelectionBtn?.addEventListener("click", () => { void runProtocolDebugSelection(); });
    els.protocolDebugRunBtn?.addEventListener("click", () => { void runProtocolDebugScript(); });
    els.protocolDebugStopScriptBtn?.addEventListener("click", stopProtocolDebugScript);
    els.protocolDebugStopNovaBtn?.addEventListener("click", () => { void stopNovaFromProtocolDebugger(); });
    els.protocolDebugFileInput?.addEventListener("change", event => { loadProtocolDebugFile(event.target.files?.[0]); event.target.value = ""; });
    els.protocolDebugEditor?.addEventListener("input", () => { try { localStorage.setItem(PROTOCOL_DEBUG_STORAGE_KEY, els.protocolDebugEditor.value); } catch (_) {} validateProtocolDebugScript(); });
    els.protocolDebugEditor?.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void runProtocolDebugSelection(); }
    });
    els.closeRobotDialogBtn.addEventListener("click", () => { clearPendingRobotAction(); els.robotDialog.close(); });
    els.robotRefreshStatusBtn.addEventListener("click", () => { void refreshRobotStatus(); });
    els.robotDisconnectBtn.addEventListener("click", () => { void disconnectRobotFromDialog(); });
    els.robotCopyLogBtn.addEventListener("click", () => { void copyRobotLog(); });
    if (robot) {
      robot.addEventListener("statechange", updateRobotUI);
      robot.addEventListener("log", event => appendRobotLog(event.detail));
      robot.addEventListener("disconnect", handleUnexpectedRobotDisconnect);
    }

    const primaryNavButtons = [els.desktopLibraryNavBtn, els.desktopRunNavBtn, els.desktopEditNavBtn, els.desktopRobotNavBtn, els.mobileLibraryNavBtn, els.mobileRunNavBtn, els.mobileEditNavBtn, els.mobileRobotNavBtn].filter(Boolean);
    primaryNavButtons.forEach(button => button.addEventListener("click", () => navigateApp(button.dataset.appNav, { push: true })));
    [els.topBackBtn, els.runBackBtn, els.editorBackBtn, els.robotBackBtn].filter(Boolean).forEach(button => button.addEventListener("click", goBackApp));
    els.runRobotBtn?.addEventListener("click", () => navigateApp("robot", { push: true }));
    els.runEditDrillBtn?.addEventListener("click", () => navigateApp("editor", { push: true }));
    els.editorRunBtn?.addEventListener("click", () => navigateApp("run", { push: true }));
    els.runDrillMenuBtn?.addEventListener("click", openDrillDetails);
    els.drillDetailsBtn?.addEventListener("click", openDrillDetails);
    els.inspectorBackBtn?.addEventListener("click", closeInspectorScreen);
    els.inspectorCloseBtn?.addEventListener("click", closeInspectorScreen);

    els.addNodeMenuBtn?.addEventListener("click", openAddNodeMenu);
    els.closeAddNodeDialogBtn?.addEventListener("click", () => els.addNodeDialog.close());
    els.addShotBtn.addEventListener("click", () => openAddNodeConfig("shot"));
    els.addRandomBtn.addEventListener("click", () => openAddNodeConfig("random"));
    els.addDrillNodeBtn.addEventListener("click", () => openAddNodeConfig("drill"));
    els.addCounterBtn.addEventListener("click", () => openAddNodeConfig("counter"));
    els.deleteSelectionBtn.addEventListener("click", deleteSelection);
    els.fitBtn.addEventListener("click", fitGraph);

    els.builtInLibraryTab.addEventListener("click", () => selectLibraryRoot("builtin"));
    els.myDrillsLibraryTab.addEventListener("click", () => selectLibraryRoot("user"));
    els.librarySearchInput.addEventListener("input", () => { libraryView.query = els.librarySearchInput.value; renderDrillList(); });
    els.newDrillBtn.addEventListener("click", createDrill);
    els.libraryMoreBtn?.addEventListener("click", () => { els.libraryAdvancedActions.open = !els.libraryAdvancedActions.open; });
    els.newFolderBtn.addEventListener("click", () => openFolderDialog("new"));
    els.renameFolderBtn.addEventListener("click", () => openFolderDialog("rename"));
    els.deleteFolderBtn.addEventListener("click", deleteCurrentFolder);
    els.folderSaveBtn.addEventListener("click", saveFolderDialog);
    els.folderNameInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); saveFolderDialog(); } });
    els.copyBuiltInBtn.addEventListener("click", () => { copyActiveBuiltInToMyDrills(); els.drillDetailsDialog.close(); navigateApp("editor", { push: true }); });
    els.moveDrillBtn.addEventListener("click", openMoveDrillDialog);
    els.moveDrillSaveBtn.addEventListener("click", moveActiveDrill);
    els.closeDrillDetailsBtn?.addEventListener("click", () => els.drillDetailsDialog.close());

    const saveDrillDetails = () => {
      if (!activeDrillEditable()) return;
      const drill = activeDrill(); if (!drill) return;
      drill.name = uniqueDrillName(els.drillNameInput.value, drill.id);
      drill.description = String(els.drillDescriptionInput.value || "").trim().slice(0, 600);
      drill.tags = [...new Set(String(els.drillTagsInput.value || "").split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 20);
      drill.robotPose = {
        x: clamp(els.drillRobotXInput.value, -1.5, 4.2, 0),
        y: clamp(els.drillRobotYInput.value, -2, 2, 0),
        yawDeg: clamp(els.drillRobotYawInput.value, -180, 180, 0),
      };
      commit();
      renderRunPage();
    };
    [els.drillNameInput, els.drillDescriptionInput, els.drillTagsInput, els.drillRobotXInput, els.drillRobotYInput, els.drillRobotYawInput].filter(Boolean).forEach(input => input.addEventListener("change", saveDrillDetails));
    els.duplicateDrillBtn.addEventListener("click", () => { duplicateActiveDrill(); els.drillDetailsDialog.close(); navigateApp("editor", { push: true }); });
    els.deleteDrillBtn.addEventListener("click", deleteActiveDrill);

    els.liveTuningBtn.addEventListener("click", () => {
      renderLiveTuning();
      els.liveTuningDialog.showModal();
    });
    els.closeLiveTuningBtn.addEventListener("click", () => els.liveTuningDialog.close());
    els.doneLiveTuningBtn.addEventListener("click", () => els.liveTuningDialog.close());
    els.resetLiveTuningBtn.addEventListener("click", resetLiveTuning);
    els.saveLiveTunedDrillBtn.addEventListener("click", () => { els.liveTuningDialog.close(); saveEffectiveDrillAsNew(); });
    els.saveEffectiveDrillBtn.addEventListener("click", saveEffectiveDrillAsNew);
    els.updateRobotPoseBtn.addEventListener("click", openPoseCalibration);
    els.closePoseCalibrationBtn.addEventListener("click", () => {
      if (calibrationTestRunning) void stopPlayback().then(closePoseCalibration); else closePoseCalibration();
    });
    els.cancelPoseCalibrationBtn.addEventListener("click", () => {
      if (calibrationTestRunning) void stopPlayback().then(closePoseCalibration); else closePoseCalibration();
    });
    els.savePoseCalibrationBtn.addEventListener("click", savePoseCalibration);
    els.poseCalibrationTableSvg.addEventListener("pointerdown", beginPoseCalibrationDrag);
    els.poseCalibrationTableSvg.addEventListener("pointermove", updatePoseCalibrationDrag);
    els.poseCalibrationTableSvg.addEventListener("pointerup", endPoseCalibrationDrag);
    els.poseCalibrationTableSvg.addEventListener("pointercancel", endPoseCalibrationDrag);
    els.poseCalibrationGuide.addEventListener("click", event => {
      const action = event.target.closest("[data-pose-action]")?.dataset.poseAction;
      if (action === "start") startPoseVerification();
      if (action === "fire") void fireCurrentPoseVerification();
    });
    els.poseCalibrationGuide.addEventListener("pointerdown", event => {
      const map = event.target.closest(".pose-observation-map");
      if (!map) return;
      beginPoseMeasurementGesture(event, map);
    });
    els.poseCalibrationGuide.addEventListener("pointermove", updatePoseMeasurementGesture);
    els.poseCalibrationGuide.addEventListener("pointerup", endPoseMeasurementGesture);
    els.poseCalibrationGuide.addEventListener("pointercancel", endPoseMeasurementGesture);
    els.poseCalibrationGuide.addEventListener("wheel", event => {
      const map = event.target.closest(".pose-observation-map");
      if (map) zoomPoseMeasurementWithWheel(event, map);
    }, { passive:false });
    document.querySelectorAll("[data-tuning-key][data-tuning-delta]").forEach(button => {
      button.addEventListener("click", () => stepLiveTuning(button.dataset.tuningKey, finite(button.dataset.tuningDelta, 0)));
    });

    els.graphViewport.addEventListener("pointerdown", onCanvasPointerDown);
    els.graphViewport.addEventListener("wheel", onGraphWheel, { passive: false });
    els.graphSurface.addEventListener("click", () => {
      if (performance.now() < suppressClickUntil || connectionDrag) return;
      selection = null;
      inspectorOpen = false;
      document.body.classList.remove("details-open");
      renderAll();
    });
    els.graphViewport.addEventListener("keydown", event => {
      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        deleteSelection();
      }
      if (event.key === "Escape") {
        selection = null;
        renderAll();
      }
    });

    const commitRepetitionsText = () => {
      const rawText = String(els.repetitionsInput.value).trim();
      if (rawText === "∞" || rawText === "") setRepetitions(0);
      else setRepetitions(finite(rawText, 0));
    };
    els.repetitionsInput.addEventListener("change", commitRepetitionsText);
    els.repetitionsInput.addEventListener("blur", commitRepetitionsText);
    els.repetitionsInput.addEventListener("keydown", event => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const current = activeDrill()?.settings.repetitions ?? 0;
        setRepetitions(current <= 0 ? 1 : current + 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const current = activeDrill()?.settings.repetitions ?? 0;
        if (current > 0) setRepetitions(current - 1);
      }
    });
    els.repetitionsDownBtn.addEventListener("click", () => {
      const current = activeDrill()?.settings.repetitions ?? 0;
      if (current > 0) setRepetitions(current - 1);
    });
    els.repetitionsUpBtn.addEventListener("click", () => {
      const current = activeDrill()?.settings.repetitions ?? 0;
      setRepetitions(current <= 0 ? 1 : current + 1);
    });
    els.setDelayInput.addEventListener("change", () => {
      const drill = activeDrill();
      if (!drill) return;
      drill.settings.delayBetweenSets = clamp(els.setDelayInput.value, 0, 3600, 0);
      els.setDelayInput.value = drill.settings.delayBetweenSets;
      if (activeDrillEditable()) saveLibrary();
    });
    els.playBtn.addEventListener("click", () => {
      if (calibrationFeedRunning) void stopGuidedFeed();
      else if (playbackRunning || calibrationTestRunning || robotIsActive()) void stopPlayback();
      else void startPlayback();
    });

    els.calibrationBtn.addEventListener("click", () => openCalibrationWorkspace("guided"));
    els.robotSettingsShortcutBtn?.addEventListener("click", () => openCalibrationWorkspace("pose"));
    els.closeCalibrationBtn.addEventListener("click", () => {
      if (calibrationFeedRunning) void stopGuidedFeed();
      els.calibrationDialog.close();
    });
    bindCalibrationInputs();

    els.previewBtn.addEventListener("click", () => {
      const validation = validateDrill(activeDrill());
      if (!validation.valid) { toast("Fix drill errors before previewing."); return; }
      generateTrace();
      els.previewDialog.showModal();
    });
    els.closePreviewBtn.addEventListener("click", () => els.previewDialog.close());
    els.rerunPreviewBtn.addEventListener("click", generateTrace);

    els.importBtn.addEventListener("click", () => els.importInput.click());
    els.importInput.addEventListener("change", () => {
      const file = els.importInput.files?.[0];
      if (file) importLibrary(file);
      els.importInput.value = "";
    });
    els.exportBtn.addEventListener("click", exportLibrary);

    document.querySelectorAll("[data-dialog-cancel]").forEach(button => button.addEventListener("click", () => button.closest("dialog")?.close()));

    els.confirmActionBtn.addEventListener("click", () => {
      const callback = confirmCallback;
      confirmCallback = null;
      if (callback) callback();
    });

    window.addEventListener("resize", () => renderGraph());
    const emergencyPageExit = () => {
      playbackRunning = false;
      calibrationTestRunning = false;
      calibrationFeedRunning = false;
      playbackToken += 1;
      calibrationFeedToken += 1;
      try { robot?.emergencyShutdown?.(); } catch (_) {}
    };
    window.addEventListener("pagehide", emergencyPageExit, { capture: true });
    window.addEventListener("beforeunload", emergencyPageExit, { capture: true });
  }

  globalThis.TableTennisRobotStudio = {
    getLibrary: () => library,
    getActiveDrill: () => activeDrill(),
    isActiveBuiltIn: () => isActiveBuiltIn(),
    validateDrill,
    saveLibrary,
    renderAll,
    navigateApp,
    toast,
    askConfirm,
    copyActiveBuiltInToMyDrills,
    cloneDrillForUser,
    uniqueDrillName,
    makeId,
    robot,
    protocol: Protocol,
    requestRobotConnection,
    stopPlayback,
    startPlayback,
    compileRobotSet,
    buildRobotExecutionPlan,
    predictTrajectory,
    estimatedNovaSettings,
    profileShotVariation,
    benchmarkShotVariation(count = 24) {
      const drill = activeDrill();
      const node = drill?.nodes.find(candidate => candidate.type === "shot");
      if (!node) return { ok: false, reason: "The active drill has no shot." };
      const prediction = predictTrajectory(node.params);
      const clearanceCm = Number.isFinite(prediction.net?.clearanceM) ? prediction.net.clearanceM * 100 : 8;
      const benchmarkNode = {
        ...node,
        variation: ShotVariation.normalizeVariation({
          enabled: true,
          placement: { depthCm: 12, lateralCm: 15 },
          clearance: { minCm: Math.max(.2, clearanceCm - 2), maxCm: clearanceCm + 2 },
          speed: { minMps: node.params.speedMps - .7, maxMps: node.params.speedMps + .7 },
          spin: { minRps: node.params.spinRps - 6, maxRps: node.params.spinRps + 6 },
        }, node.params, prediction.net?.clearanceM),
      };
      return profileShotVariation(benchmarkNode, count);
    },
    benchmarkRuntimeSolver(count = 24) {
      const drill = activeDrill();
      const node = drill?.nodes.find(candidate => candidate.type === "shot");
      if (!drill || !node) return { ok: false, reason: "The active drill has no direct shot." };
      const referencePose = drillPose(drill);
      const simulatedPose = { x: referencePose.x + .03, y: referencePose.y - .02, yawDeg: referencePose.yawDeg + 1 };
      const basePrediction = predictTrajectory(node.params, calibrationAtPose(referencePose));
      const iterations = Math.max(1, Math.min(200, Math.round(count)));
      let evaluations = 0;
      let feasible = 0;
      const started = performance.now();
      for (let index = 0; index < iterations; index += 1) {
        const result = DrillAdjustments.applyShotTuning(node.params, { speedPct: 6, spinPct: 5, clearancePct: 5 },
          candidate => predictTrajectory(candidate, calibrationAtPose(simulatedPose)),
          { ...liveTuningOptions(), basePrediction, forceSolve: true, preserveClearance: true });
        evaluations += result.evaluations || 0;
        if (result.feasible) feasible += 1;
      }
      const elapsedMs = performance.now() - started;
      return { ok: feasible === iterations, iterations, feasible, evaluations, elapsedMs, millisecondsPerShot: elapsedMs / iterations };
    },
    exportGuidedMeasurements,
    addUserDrill(drill) {
      const allIds = new Set([...(builtInCatalog?.drills || []).map(item => item.id), ...library.drills.map(item => item.id), String(drill?.id || "")]);
      const clean = sanitizeDrill(drill, allIds);
      clean.id = makeId("drill");
      clean.folderId = null;
      library.drills.push(clean);
      library.activeDrillSource = "user";
      library.activeDrillId = clean.id;
      saveLibrary();
      renderAll();
      return clean;
    },
    replaceActiveUserDrill(drill) {
      if (isActiveBuiltIn()) throw new Error("Built-in drills are read-only");
      const current = activeDrill();
      const allIds = new Set([...(builtInCatalog?.drills || []).map(item => item.id), ...library.drills.map(item => item.id)]);
      const clean = sanitizeDrill({ ...drill, id: current.id, folderId: current.folderId }, allIds);
      const index = library.drills.findIndex(item => item.id === current.id);
      if (index < 0) throw new Error("Active user drill is missing");
      library.drills[index] = clean;
      saveLibrary(); renderAll(); return clean;
    },
  };

  try {
    assertRequiredElements();
    const missingRuntimeModules = [
      ["protocol", Protocol],
      ["BLE controller", RobotController],
      ["robot controller instance", robot],
      ["robot geometry", RobotGeometry],
      ["guided calibration", GuidedCalibration],
      ["launch model", LaunchModel],
      ["drill adjustments", DrillAdjustments],
      ["pose calibration", PoseCalibration],
      ["shot variation", ShotVariation],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missingRuntimeModules.length) {
      throw new Error(`runtime deployment is incomplete; missing ${missingRuntimeModules.join(", ")}`);
    }
    Protocol.selfTest();
    builtInCatalog = makeBuiltInCatalog();
    library = initializeLibrary();
    repairLibraryIfNeeded();
    liveTuning = loadLiveTuningPreference();
    // Always start the browser at its root. The active drill can live in any
    // folder, but entering the app should show the library structure rather
    // than silently dropping the user inside that drill's folder.
    libraryView = { root: "builtin", folderId: "builtin-root", query: "" };
    bindEvents();
    els.graphWorld.style.transform = `scale(${graphZoom})`;
    els.graphSurface.style.width = `${SURFACE_WIDTH * graphZoom}px`;
    els.graphSurface.style.height = `${SURFACE_HEIGHT * graphZoom}px`;
    els.zoomIndicator.textContent = `${Math.round(graphZoom * 100)}%`;
    renderAll();
    navigateApp("library", { push: false });
    updateRobotUI();
    updatePlayButton();
    appendRobotLog({ time: new Date(), direction: "info", message: "Protocol self-test passed; controller ready" });
    saveLibrary();
    if (startupNotice) setTimeout(() => toast(startupNotice), 100);
    if (new URLSearchParams(location.search).get("calibration") === "1") {
      setCalibrationTab("guided");
      renderCalibration();
      setTimeout(() => els.calibrationDialog.showModal(), 20);
    }
    const runtimeProfileCount = Number(new URLSearchParams(location.search).get("profileRuntime"));
    if (Number.isFinite(runtimeProfileCount) && runtimeProfileCount > 0) {
      document.body.dataset.runtimeSolverProfile = JSON.stringify(globalThis.TableTennisRobotStudio.benchmarkRuntimeSolver(runtimeProfileCount));
    }
    globalThis.__TTRS_BOOT_OK = true;
  } catch (error) {
    globalThis.__TTRS_BOOT_ERROR = error?.message || String(error);
    showFatalError(error);
  }
})();
