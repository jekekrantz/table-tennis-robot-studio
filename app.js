(() => {
  "use strict";

  const STORAGE_KEY = "table-tennis-robot-studio";
  const LIVE_TUNING_STORAGE_KEY = "table-tennis-robot-studio-live-tuning";
  const SCHEMA_VERSION = 1;
  const LIBRARY_STRUCTURE_VERSION = 2;
  // Working geometric estimate: center of the Nova S Pro ball exit above the table
  // with the head nominally level. This is not a manufacturer-specified dimension;
  // calibrate against the physical robot for precision trajectory work.
  const DEFAULT_NOVA_NOZZLE_HEIGHT_M = 0.225;
  const SURFACE_WIDTH = 2600;
  const SURFACE_HEIGHT = 1800;
  const MIN_GRAPH_ZOOM = 0.45;
  const MAX_GRAPH_ZOOM = 2.2;
  const NODE_WIDTH = 226;
  const MIN_NODE_Y = 24;
  const MAX_TRANSITIONS = 1200;
  const MOBILE_LAYOUT_CENTER_X = SURFACE_WIDTH / 2;
  const nodeHeightCache = new Map();

  const $ = (id) => document.getElementById(id);
  const GuidedCalibration = globalThis.GuidedCalibration;
  const LaunchModel = globalThis.NovaLaunchModel;
  const DrillAdjustments = globalThis.DrillAdjustments;
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
    guidedComputeBtn: $("guidedComputeBtn"),
    guidedComputeHelp: $("guidedComputeHelp"),
    guidedComputeStatus: $("guidedComputeStatus"),
    guidedFitBadge: $("guidedFitBadge"),
    guidedResults: $("guidedResults"),
    poseSvg: $("poseSvg"),
    poseLandingSummary: $("poseLandingSummary"),
    poseXInput: $("poseXInput"),
    poseYInput: $("poseYInput"),
    poseYawInput: $("poseYawInput"),
    rotationTypeInput: $("rotationTypeInput"),
    nozzleHeightInput: $("nozzleHeightInput"),
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
    wheelBaseRpmInput: $("wheelBaseRpmInput"),
    wheelRpmPerSpeedInput: $("wheelRpmPerSpeedInput"),
    wheelRpmPerSpinInput: $("wheelRpmPerSpinInput"),
    upDownAtZeroInput: $("upDownAtZeroInput"),
    upDownPerDegreeInput: $("upDownPerDegreeInput"),
    yawPerPlacementInput: $("yawPerPlacementInput"),
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
  let stopPromise = null;
  let liveTuning = DrillAdjustments ? { ...DrillAdjustments.DEFAULT_TUNING } : { pacePct: 0, clearancePct: 0, spinPct: 0, speedPct: 0 };
  const liveTuningCache = new Map();
  let liveTuningRevision = 0;
  let playbackRetuneRequested = false;
  let playbackResponsiveTuning = false;
  let liveRetuneStopPromise = null;

  const Protocol = globalThis.PongbotProtocol;
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
      libraryStructureVersion: LIBRARY_STRUCTURE_VERSION,
      builtInLibraryVersion: DEFAULT_LIBRARY_VERSION,
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
    library.libraryStructureVersion = LIBRARY_STRUCTURE_VERSION;
    library.builtInLibraryVersion = DEFAULT_LIBRARY_VERSION;
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
      { level: 0.0, speedKmh: 6.5, maxSpinSetting: 2, maxSpinRps: 13.2, estimated: true },
      { level: 0.5, speedKmh: 8.5, maxSpinSetting: 3, maxSpinRps: 19.8, estimated: true },
      { level: 1.0, speedKmh: 10.5, maxSpinSetting: 4, maxSpinRps: 26.4, estimated: true },
      { level: 1.5, speedKmh: 13, maxSpinSetting: 5, maxSpinRps: 28 },
      { level: 2.0, speedKmh: 17, maxSpinSetting: 6, maxSpinRps: 36 },
      { level: 2.5, speedKmh: 19, maxSpinSetting: 7, maxSpinRps: 43 },
      { level: 3.0, speedKmh: 20, maxSpinSetting: 8, maxSpinRps: 52 },
      { level: 3.5, speedKmh: 23, maxSpinSetting: 9, maxSpinRps: 56 },
      { level: 4.0, speedKmh: 24, maxSpinSetting: 10, maxSpinRps: 61 },
      { level: 4.5, speedKmh: 25, maxSpinSetting: 10, maxSpinRps: 66 },
      { level: 5.0, speedKmh: 29, maxSpinSetting: 9, maxSpinRps: 59 },
      { level: 5.5, speedKmh: 29, maxSpinSetting: 8, maxSpinRps: 53 },
      { level: 6.0, speedKmh: 33, maxSpinSetting: 8, maxSpinRps: 53 },
      { level: 6.5, speedKmh: 34, maxSpinSetting: 7, maxSpinRps: 46 },
      { level: 7.0, speedKmh: 36, maxSpinSetting: 6, maxSpinRps: 42 },
      { level: 7.5, speedKmh: 39, maxSpinSetting: 5, maxSpinRps: 33 },
      { level: 8.0, speedKmh: 40, maxSpinSetting: 4, maxSpinRps: 28 },
      { level: 8.5, speedKmh: 42, maxSpinSetting: 3, maxSpinRps: 21 },
      { level: 9.0, speedKmh: 46, maxSpinSetting: 2, maxSpinRps: 16 },
      { level: 9.5, speedKmh: 47, maxSpinSetting: 1, maxSpinRps: 13 },
      { level: 10.0, speedKmh: 48, maxSpinSetting: 0, maxSpinRps: 0 },
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
    return {
      wheelBaseRpm: 969.9321047526674,
      wheelRpmPerSpeed: 630.455868089234,
      wheelRpmPerSpin: 342.036255843120,
      upDownAtZeroDeg: 10,
      upDownPerDegree: 3,
      yawDegreesPerPlacement: 2.2,
      spinsightCurve: spinsightReferenceCurve(),
      rawSpeedMap: LaunchModel
        ? LaunchModel.constants.LOCAL_EXIT_SPEED_MAP.map(point => ({ raw: point.raw, speedMps: point.speedMps }))
        : [
            { raw: 2025, speedMps: 5.04 },
            { raw: 2167, speedMps: 5.39 },
            { raw: 2388, speedMps: 5.79 },
          ],
    };
  }

  function defaultGuidedCalibration() {
    const plan = GuidedCalibration ? GuidedCalibration.buildPlan({
      placement: "table",
      elevationMinDeg: 10,
      elevationMaxDeg: 30,
      elevationCount: 5,
      speedMinRaw: 2025,
      speedMaxRaw: 2388,
      speedCount: 3,
    }) : { shots: [] };
    return {
      placement: "table",
      distanceReference: "net",
      nozzleXcm: 26.5,
      tableHeightCm: 76,
      repeatCount: 3,
      elevationMinDeg: 10,
      elevationMaxDeg: 30,
      elevationCount: 5,
      speedMinRaw: 2025,
      speedMaxRaw: 2388,
      speedCount: 3,
      currentIndex: 0,
      shots: plan.shots || [],
      lastResult: null,
    };
  }

  function defaultCalibration() {
    return {
      pose: { x: 0.265, y: 0, yawDeg: 0 },
      placementMode: "table",
      tableHeight: 0.76,
      table: regulationTable(),
      rotationType: 0,
      nozzleHeight: DEFAULT_NOVA_NOZZLE_HEIGHT_M,
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
      // Expected physical placement for this drill. x/y refer to the nozzle position
      // in table coordinates; the default corresponds to the back of the robot base
      // aligned with the near table edge and the 26.5 cm base-to-nozzle estimate.
      robotPose: { x: 0.265, y: 0, yawDeg: 0 },
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
      params: { speedMps: 5.97, spinRps: 0, elevationDeg: 12.5, aimDeg: 0 },
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

  const DEFAULT_LIBRARY_VERSION = 4;
  const LEGACY_BUILT_IN_DRILL_NAMES = [
    "Match-play mix",
    "Serve + third ball",
    "Two forehands then backhand",
  ];

  // These feeds were solved against the current default trajectory model with the
  // robot centered at the near edge (nozzle x=0.265 m, y=0) and a 22.5 cm nozzle
  // height. Targets deliberately stay well inside the table and use 8–12 cm of
  // modeled net clearance so a few centimetres of real-world placement variation
  // should not turn normal feeds into edge/net balls.
  const DEFAULT_SHOT_PRESETS = Object.freeze({
    noSpinCenter: {
      label: "No-spin center",
      params: { speedMps: 5.97, spinRps: 0, elevationDeg: 12.5, aimDeg: 0 },
      target: { xM: 2.154, yM: 0, netClearanceCm: 10.1 },
    },
    shortNoSpin: {
      label: "Short no-spin",
      params: { speedMps: 5.01, spinRps: 0, elevationDeg: 17.1, aimDeg: 0 },
      target: { xM: 1.950, yM: 0, netClearanceCm: 10.0 },
    },
    shortBackspinForehand: {
      label: "Short underspin to forehand",
      params: { speedMps: 5.00, spinRps: -18, elevationDeg: 13.9, aimDeg: 14.0 },
      target: { xM: 1.951, yM: 0.420, netClearanceCm: 8.0 },
    },
    shortBackspinBackhand: {
      label: "Short underspin to backhand",
      params: { speedMps: 5.00, spinRps: -18, elevationDeg: 13.9, aimDeg: -14.0 },
      target: { xM: 1.951, yM: -0.420, netClearanceCm: 8.0 },
    },
    topspinForehand: {
      label: "Topspin to forehand",
      params: { speedMps: 7.63, spinRps: 22, elevationDeg: 11.0, aimDeg: 13.6 },
      target: { xM: 2.253, yM: 0.481, netClearanceCm: 10.1 },
    },
    topspinBackhand: {
      label: "Topspin to backhand",
      params: { speedMps: 7.63, spinRps: 22, elevationDeg: 11.0, aimDeg: -13.6 },
      target: { xM: 2.253, yM: -0.481, netClearanceCm: 10.1 },
    },
    deepTopspinForehand: {
      label: "Long wide topspin to forehand",
      params: { speedMps: 9.02, spinRps: 22, elevationDeg: 8.9, aimDeg: 12.9 },
      target: { xM: 2.449, yM: 0.500, netClearanceCm: 10.0 },
    },
    deepTopspinBackhand: {
      label: "Long wide topspin to backhand",
      params: { speedMps: 9.02, spinRps: 22, elevationDeg: 8.9, aimDeg: -12.9 },
      target: { xM: 2.449, yM: -0.500, netClearanceCm: 10.0 },
    },
    topspinElbow: {
      label: "Topspin to elbow",
      params: { speedMps: 7.35, spinRps: 22, elevationDeg: 11.3, aimDeg: 0 },
      target: { xM: 2.252, yM: 0, netClearanceCm: 10.0 },
    },
    heavyTopspin: {
      label: "Heavy topspin center",
      params: { speedMps: 7.06, spinRps: 35, elevationDeg: 13.3, aimDeg: 0 },
      target: { xM: 2.249, yM: 0, netClearanceCm: 12.0 },
    },
    backspinForehand: {
      label: "Backspin to forehand",
      params: { speedMps: 5.12, spinRps: -18, elevationDeg: 15.3, aimDeg: 13.0 },
      target: { xM: 2.082, yM: 0.419, netClearanceCm: 12.1 },
    },
    backspinBackhand: {
      label: "Backspin to backhand",
      params: { speedMps: 5.12, spinRps: -18, elevationDeg: 15.3, aimDeg: -13.0 },
      target: { xM: 2.082, yM: -0.419, netClearanceCm: 12.1 },
    },
    backspinCenter: {
      label: "Backspin center",
      params: { speedMps: 5.00, spinRps: -18, elevationDeg: 15.7, aimDeg: 0 },
      target: { xM: 2.081, yM: 0, netClearanceCm: 12.0 },
    },
    fastDeepForehand: {
      label: "Fast deep to forehand",
      params: { speedMps: 8.64, spinRps: 15, elevationDeg: 8.9, aimDeg: 12.4 },
      target: { xM: 2.450, yM: 0.480, netClearanceCm: 10.0 },
    },
    fastDeepBackhand: {
      label: "Fast deep to backhand",
      params: { speedMps: 8.64, spinRps: 15, elevationDeg: 8.9, aimDeg: -12.4 },
      target: { xM: 2.450, yM: -0.480, netClearanceCm: 10.0 },
    },
    fastDeepCenter: {
      label: "Fast deep center",
      params: { speedMps: 8.38, spinRps: 15, elevationDeg: 9.1, aimDeg: 0 },
      target: { xM: 2.450, yM: 0, netClearanceCm: 10.0 },
    },
    middleForehandTopspin: {
      label: "Topspin to forehand-middle",
      params: { speedMps: 7.40, spinRps: 22, elevationDeg: 11.2, aimDeg: 5.75 },
      target: { xM: 2.249, yM: 0.200, netClearanceCm: 10.0 },
    },
    middleBackhandTopspin: {
      label: "Topspin to backhand-middle",
      params: { speedMps: 7.40, spinRps: 22, elevationDeg: 11.2, aimDeg: -5.75 },
      target: { xM: 2.249, yM: -0.200, netClearanceCm: 10.0 },
    },
  });

  function presetShot(drill, key, label = null) {
    const preset = DEFAULT_SHOT_PRESETS[key];
    if (!preset) throw new Error(`Unknown built-in shot preset ${key}`);
    const shot = makeShot(drill, label || preset.label);
    shot.params = { ...preset.params };
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
  } = {}) {
    const drill = defaultDrill(name);
    drill.settings = { repetitions, delayBetweenSets: intervalSeconds };
    const nodes = steps.map((key, index) => presetShot(drill, key, labels[index] || null));
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
      const shot = presetShot(drill, choice.key, choice.label || null);
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
    const middle = presetShot(drill, "middleForehandTopspin", "Forehand from middle");
    middle.x = 820; middle.y = 180;
    const wide = presetShot(drill, "topspinForehand", "Wide forehand");
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
      presetShot(drill, "topspinBackhand", "Random · backhand"),
      presetShot(drill, "topspinElbow", "Random · elbow"),
      presetShot(drill, "topspinForehand", "Random · forehand"),
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
    const opening = presetShot(drill, openingPresetKey, "Short underspin");
    opening.x = 150; opening.y = 330;
    const random = makeRandom(randomLabel);
    random.x = 500; random.y = 330;
    drill.nodes.push(opening, random);
    drill.startNodeId = opening.id;
    drill.edges.push({ id: makeId("edge"), source: opening.id, sourceSlot: "next", target: random.id, weight: 1, delaySeconds: intervalSeconds });
    choices.forEach((choice, index) => {
      const shot = presetShot(drill, choice.key, choice.label || null);
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
    const shortBh = presetShot(drill, "shortBackspinBackhand", "Short underspin · backhand");
    const shortFh = presetShot(drill, "shortBackspinForehand", "Short underspin · forehand");
    shortBh.x = 430; shortBh.y = 190;
    shortFh.x = 430; shortFh.y = 470;
    const longRandom = makeRandom("Next attack");
    longRandom.x = 760; longRandom.y = 330;
    const longBh = presetShot(drill, "deepTopspinBackhand", "Long topspin · backhand");
    const longElbow = presetShot(drill, "topspinElbow", "Long topspin · elbow");
    const longFh = presetShot(drill, "deepTopspinForehand", "Long topspin · forehand");
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
    const stay = presetShot(drill, "topspinBackhand", "Stay backhand");
    const elbow = presetShot(drill, "topspinElbow", "Switch to elbow");
    const wideFh = presetShot(drill, "deepTopspinForehand", "Switch wide forehand");
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
    const bh = presetShot(drill, "topspinBackhand", "Backhand pressure");
    const elbow = presetShot(drill, "topspinElbow", "Elbow pressure");
    const fh = presetShot(drill, "topspinForehand", "Forehand pressure");
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
      { repetitions: 16, intervalSeconds: .9, labels: ["Heavy topspin", "Backspin"] }
    );
    const backspinCorners = sequenceDrill(
      "Drill: Backspin corners",
      ["backspinBackhand", "backspinForehand"],
      { repetitions: 18, intervalSeconds: .92, labels: ["Backspin · backhand", "Backspin · forehand"] }
    );
    const fastDeepRandom = randomDrill("Drill: Fast deep random", [
      { key: "fastDeepBackhand", label: "Deep backhand" },
      { key: "fastDeepCenter", label: "Deep elbow" },
      { key: "fastDeepForehand", label: "Deep forehand" },
    ], { repetitions: 30, intervalSeconds: .72, randomLabel: "Fast deep · three spots" });

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
      { repetitions: 12, intervalSeconds: .86, labels: ["Short backhand underspin", "Wide forehand recovery 1", "Wide forehand recovery 2"] }
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
      schemaVersion: SCHEMA_VERSION,
      builtInLibraryVersion: DEFAULT_LIBRARY_VERSION,
      activeDrillId: alternating.id,
      calibration: defaultCalibration(),
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
      drill.tags = [...new Set([folderName.toLowerCase(), drill.name.startsWith("Match:") ? "match-like" : "training"].filter(Boolean))];
      drill.description = drill.description || (drill.name.startsWith("Match:")
        ? "Match-like robot pattern with realistic placement and timing variation."
        : folderName === "Shots"
          ? "Repeatable single-shot feed for technique and calibration-aware practice."
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

  function builtInDrillByName(name) {
    return builtInCatalog?.drills.find(drill => drill.name === name) ?? null;
  }

  function normalizedDrillSignature(drill) {
    const nodeIndex = new Map((drill.nodes || []).map((node, index) => [node.id, index]));
    const nodes = (drill.nodes || []).map(node => ({
      type: node.type,
      label: node.label,
      params: node.params ? {
        speedMps: finite(node.params.speedMps, 0),
        spinRps: finite(node.params.spinRps, 0),
        elevationDeg: finite(node.params.elevationDeg, 0),
        aimDeg: finite(node.params.aimDeg, 0),
      } : null,
      referencedDrillId: node.type === "drill" ? String(node.referencedDrillId || "") : undefined,
      startCount: node.type === "counter" ? finite(node.startCount, 0) : undefined,
      clearOnNodeIndexes: node.type === "counter"
        ? (node.clearOnNodeIds || []).map(id => nodeIndex.get(id)).filter(Number.isInteger)
        : undefined,
    }));
    const edges = (drill.edges || []).map(edge => ({
      source: nodeIndex.get(edge.source),
      sourceSlot: edge.sourceSlot,
      target: nodeIndex.get(edge.target),
      weight: finite(edge.weight, 1),
      delaySeconds: finite(edge.delaySeconds, 0),
    }));
    return JSON.stringify({
      name: drill.name,
      settings: drill.settings,
      startNodeIndex: nodeIndex.get(drill.startNodeId),
      nodes,
      edges,
    });
  }

  function isLegacyBuiltInLibrary(raw) {
    if (!raw || !Array.isArray(raw.drills) || raw.drills.length !== LEGACY_BUILT_IN_DRILL_NAMES.length) return false;
    const names = raw.drills.map(drill => String(drill?.name || "")).sort();
    return LEGACY_BUILT_IN_DRILL_NAMES.slice().sort().every((name, index) => names[index] === name);
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
        speedKmh: clamp(point.speedKmh, 0.1, 100, defaultPoint.speedKmh),
        maxSpinSetting: clamp(point.maxSpinSetting, 0, 10, defaultPoint.maxSpinSetting),
        maxSpinRps: clamp(point.maxSpinRps, 0, 200, defaultPoint.maxSpinRps),
        estimated: Boolean(defaultPoint.estimated),
      };
    });
    const rawSpeedMapSource = Array.isArray(novaRaw.rawSpeedMap) ? novaRaw.rawSpeedMap : novaBase.rawSpeedMap;
    const oldSeedMap = [
      { raw: 2025, speedMps: 4.925 },
      { raw: 2167, speedMps: 5.277 },
      { raw: 2388, speedMps: 5.687 },
    ];
    const isOldUntouchedSpeedMap = rawSpeedMapSource.length === oldSeedMap.length
      && rawSpeedMapSource.every((point, index) => Math.abs(finite(point?.raw, 0) - oldSeedMap[index].raw) < 1e-9
        && Math.abs(finite(point?.speedMps, 0) - oldSeedMap[index].speedMps) < 1e-9);
    const rawSpeedMap = (isOldUntouchedSpeedMap ? novaBase.rawSpeedMap : rawSpeedMapSource)
      .map(point => ({ raw: clamp(point?.raw, 400, 7500, 2025), speedMps: clamp(point?.speedMps, 1, 20, 5) }))
      .sort((a,b) => a.raw - b.raw);
    const oldDefaultGeometry = Math.abs(finite(raw.nozzleHeight, base.nozzleHeight) - 0.205) < 1e-9
      && Math.abs(finite(pose.x, base.pose.x) - 0.34) < 1e-9;
    const oldGuidedNozzleDefault = Math.abs(finite(guidedRaw.nozzleXcm, guidedBase.nozzleXcm) - 34) < 1e-9;
    const guidedShots = Array.isArray(guidedRaw.shots) ? guidedRaw.shots.map((shot, index) => ({
      id: String(shot?.id || `cal-${index + 1}`),
      index,
      rawSpeed: clamp(shot?.rawSpeed, 400, 7500, 2025),
      elevationDeg: clamp(shot?.elevationDeg, -20, 60, 10),
      distanceCm: shot?.distanceCm === null || shot?.distanceCm === "" || shot?.distanceCm === undefined ? null : finite(shot.distanceCm, null),
      netClearanceCm: shot?.netClearanceCm === null || shot?.netClearanceCm === "" || shot?.netClearanceCm === undefined ? null : finite(shot.netClearanceCm, null),
      saved: Boolean(shot?.saved),
    })) : guidedBase.shots;
    return {
      pose: {
        x: oldDefaultGeometry ? base.pose.x : clamp(pose.x, -3, 10, base.pose.x),
        y: clamp(pose.y, -5, 5, base.pose.y),
        yawDeg: clamp(pose.yawDeg, -180, 180, base.pose.yawDeg),
      },
      placementMode: raw.placementMode === "ground" ? "ground" : "table",
      tableHeight: clamp(raw.tableHeight, .4, 1.2, base.tableHeight),
      table: {
        length: clamp(table.length, .5, 10, base.table.length),
        width: clamp(table.width, .3, 5, base.table.width),
        netHeight: clamp(table.netHeight, .01, 1, base.table.netHeight),
      },
      rotationType: Math.round(clamp(raw.rotationType, 0, 7, base.rotationType)),
      nozzleHeight: oldDefaultGeometry ? base.nozzleHeight : clamp(raw.nozzleHeight, .05, 1.5, base.nozzleHeight),
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
        wheelBaseRpm: clamp(novaRaw.wheelBaseRpm, 0, 20000, novaBase.wheelBaseRpm),
        wheelRpmPerSpeed: clamp(novaRaw.wheelRpmPerSpeed, 0, 5000, novaBase.wheelRpmPerSpeed),
        wheelRpmPerSpin: clamp(novaRaw.wheelRpmPerSpin, 0, 5000, novaBase.wheelRpmPerSpin),
        upDownAtZeroDeg: clamp(novaRaw.upDownAtZeroDeg, -100, 200, novaBase.upDownAtZeroDeg),
        upDownPerDegree: clamp(novaRaw.upDownPerDegree, .01, 30, novaBase.upDownPerDegree),
        yawDegreesPerPlacement: clamp(novaRaw.yawDegreesPerPlacement, .01, 30, novaBase.yawDegreesPerPlacement),
        spinsightCurve: sanitizedCurve,
        rawSpeedMap,
      },
      guided: {
        placement: guidedRaw.placement === "ground" ? "ground" : "table",
        distanceReference: guidedRaw.placement === "ground"
          ? "base_back"
          : (["net","near_edge","nozzle"].includes(guidedRaw.distanceReference) ? guidedRaw.distanceReference : guidedBase.distanceReference),
        // Migrate the short-lived old ground mode where negative values meant
        // "behind the table". Ground calibration now uses the robot-base back
        // as x=0, with a positive base-back → nozzle offset.
        nozzleXcm: guidedRaw.placement === "ground" && finite(guidedRaw.nozzleXcm, 26.5) < 0
          ? 26.5
          : oldGuidedNozzleDefault
            ? guidedBase.nozzleXcm
            : clamp(guidedRaw.nozzleXcm, guidedRaw.placement === "ground" ? 0 : -300, 300, guidedBase.nozzleXcm),
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
        lastResult: guidedRaw.lastResult && typeof guidedRaw.lastResult === "object" ? guidedRaw.lastResult : null,
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
    drill.robotPose = {
      x: clamp(rawPose.x, -1.5, 4.2, 0.265),
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

  function sanitizeNewLibrary(raw) {
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
      libraryStructureVersion: LIBRARY_STRUCTURE_VERSION,
      builtInLibraryVersion: DEFAULT_LIBRARY_VERSION,
      activeDrillSource: source,
      activeDrillId: activeId,
      calibration: sanitizeCalibration(raw.calibration),
      folders,
      drills,
    };
  }

  function migrateLegacyLibrary(raw) {
    if (raw?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.drills)) {
      throw new Error(`Unsupported drill file. Expected schemaVersion ${SCHEMA_VERSION}.`);
    }
    if (isLegacyBuiltInLibrary(raw)) {
      startupNotice = "The old built-in examples were replaced by the read-only Built-in library; calibration settings were preserved.";
      return makeUserLibrary(sanitizeCalibration(raw.calibration));
    }

    const preliminaryIds = new Set(raw.drills.map(d => String(d.id || makeId("drill"))));
    const legacyDrills = raw.drills.map(d => sanitizeDrill(d, preliminaryIds));
    const matchedBuiltInIds = new Map();
    const userDrills = [];
    for (const drill of legacyDrills) {
      const candidate = builtInDrillByName(drill.name);
      if (candidate && normalizedDrillSignature(drill) === normalizedDrillSignature(candidate)) {
        matchedBuiltInIds.set(drill.id, candidate.id);
      } else {
        drill.folderId = null;
        userDrills.push(drill);
      }
    }
    for (const drill of userDrills) {
      for (const node of drill.nodes) {
        if (node.type === "drill" && matchedBuiltInIds.has(node.referencedDrillId)) {
          node.referencedDrillId = matchedBuiltInIds.get(node.referencedDrillId);
        }
      }
    }

    const oldActive = String(raw.activeDrillId || "");
    const mappedActive = matchedBuiltInIds.get(oldActive);
    const activeUser = userDrills.find(drill => drill.id === oldActive);
    const result = {
      schemaVersion: SCHEMA_VERSION,
      libraryStructureVersion: LIBRARY_STRUCTURE_VERSION,
      builtInLibraryVersion: DEFAULT_LIBRARY_VERSION,
      activeDrillSource: mappedActive ? "builtin" : activeUser ? "user" : "builtin",
      activeDrillId: mappedActive || activeUser?.id || builtInCatalog.defaultDrillId,
      calibration: sanitizeCalibration(raw.calibration),
      folders: [],
      drills: userDrills,
    };
    const removed = matchedBuiltInIds.size;
    startupNotice = removed
      ? `${removed} old built-in preset${removed === 1 ? " was" : "s were"} moved to the automatically updated Built-in library. Custom drills were kept under My drills.`
      : "Existing drills were moved under My drills; the new Built-in library is maintained separately.";
    return result;
  }

  function sanitizeLibrary(raw) {
    return Number(raw?.libraryStructureVersion) >= LIBRARY_STRUCTURE_VERSION
      ? sanitizeNewLibrary(raw)
      : migrateLegacyLibrary(raw);
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
    if (!DrillAdjustments) return;
    try {
      localStorage.setItem(LIVE_TUNING_STORAGE_KEY, JSON.stringify(DrillAdjustments.normalizeTuning(liveTuning)));
    } catch (error) {
      console.warn("Could not save Live tuning preference", error);
    }
  }

  function loadLiveTuningPreference() {
    if (!DrillAdjustments) return { pacePct: 0, clearancePct: 0, spinPct: 0, speedPct: 0 };
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

  function navigateApp(view, { push = true } = {}) {
    const normalized = ["library", "run", "editor", "robot"].includes(view) ? view : "library";
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
    const p = drill?.robotPose || library?.calibration?.pose || { x: 0.265, y: 0, yawDeg: 0 };
    return { x: finite(p.x, 0.265), y: finite(p.y, 0), yawDeg: finite(p.yawDeg, 0) };
  }

  function poseWords(pose) {
    const y = Math.abs(pose.y) < .025 ? "Centered" : `${Math.abs(pose.y * 100).toFixed(0)} cm ${pose.y > 0 ? "left" : "right"} of centre`;
    const edge = Math.abs(pose.x - 0.265) < .035 ? "near edge" : `nozzle x ${pose.x.toFixed(2)} m`;
    const yaw = Math.abs(pose.yawDeg) < 1 ? "straight ahead" : `${pose.yawDeg > 0 ? "left" : "right"} ${Math.abs(pose.yawDeg).toFixed(0)}°`;
    return `${y} · ${edge} · ${yaw}`;
  }

  function robotSetupMiniSvg(pose) {
    const table = library?.calibration?.table || regulationTable();
    const w = 250, h = 118, pad = 12;
    const sx = (w - pad * 2) / table.length;
    const sy = (h - pad * 2) / table.width;
    const x = pad + pose.x * sx;
    const y = h / 2 - pose.y * sy;
    const ray = 28;
    const a = radians(pose.yawDeg);
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Robot setup top view"><rect x="${pad}" y="${pad}" width="${w-pad*2}" height="${h-pad*2}" rx="4" fill="#123047" stroke="#6f8196"/><line x1="${w/2}" x2="${w/2}" y1="${pad}" y2="${h-pad}" stroke="#d7e0e9"/><circle cx="${x}" cy="${y}" r="7" fill="#55c98c"/><line x1="${x}" y1="${y}" x2="${x+Math.cos(a)*ray}" y2="${y-Math.sin(a)*ray}" stroke="#8ce0b2" stroke-width="3" marker-end="url(#none)"/></svg>`;
  }

  function renderRobotSetupSummary() {
    if (!els.runRobotSetup) return;
    const drill = activeDrill();
    if (!drill) { els.runRobotSetup.innerHTML = `<p class="helper">Choose a drill first.</p>`; return; }
    const pose = drillPose(drill);
    els.runRobotSetup.innerHTML = `<div class="robot-setup-mini">${robotSetupMiniSvg(pose)}</div><div><strong>${escapeHtml(poseWords(pose))}</strong><small>Expected physical position for this drill</small></div>`;
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

  function orderedGraphNodes(drill) {
    if (!drill?.nodes?.length) return [];
    const result = [];
    const seen = new Set();
    const queue = [];
    const start = getNode(drill, drill.startNodeId);
    if (start) queue.push(start);
    while (queue.length) {
      const node = queue.shift();
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id); result.push(node);
      outgoing(drill, node.id).forEach(edge => { const target = getNode(drill, edge.target); if (target && !seen.has(target.id)) queue.push(target); });
    }
    drill.nodes.forEach(node => { if (!seen.has(node.id)) result.push(node); });
    return result;
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

  function resetGraphZoom() {
    applyGraphZoom(1);
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
      const p = { speedMps: 5.97, spinRps: 0, elevationDeg: 12.5, aimDeg: 0 };
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

  function interpolateNovaCurve(level, field, calibration = library.calibration) {
    const curve = calibration.nova.spinsightCurve;
    if (level <= curve[0].level) return curve[0][field];
    if (level >= curve.at(-1).level) return curve.at(-1)[field];
    for (let index = 1; index < curve.length; index += 1) {
      const right = curve[index];
      const left = curve[index - 1];
      if (level <= right.level) {
        const ratio = (level - left.level) / (right.level - left.level || 1);
        return left[field] + ratio * (right[field] - left[field]);
      }
    }
    return curve.at(-1)[field];
  }

  function novaSpeedLevelFromMps(speedMps, calibration = library.calibration) {
    const targetKmh = speedMps * 3.6;
    const curve = calibration.nova.spinsightCurve;
    if (targetKmh <= curve[0].speedKmh) return curve[0].level;
    if (targetKmh >= curve.at(-1).speedKmh) return curve.at(-1).level;
    for (let index = 1; index < curve.length; index += 1) {
      const right = curve[index];
      const left = curve[index - 1];
      if (targetKmh <= right.speedKmh) {
        const span = right.speedKmh - left.speedKmh;
        const ratio = span > .0001 ? (targetKmh - left.speedKmh) / span : 1;
        return left.level + ratio * (right.level - left.level);
      }
    }
    return curve.at(-1).level;
  }

  function estimatedNovaSettings(params, calibration = library.calibration) {
    const nova = calibration.nova;
    const localSpeedMap = Array.isArray(nova.rawSpeedMap) && nova.rawSpeedMap.length >= 2 ? nova.rawSpeedMap : null;
    const exitRange = LaunchModel ? LaunchModel.exitSpeedRange(localSpeedMap || undefined) : null;
    const calibratedRaw = LaunchModel
      ? LaunchModel.rawFromExitSpeed(params.speedMps, localSpeedMap || undefined)
      : (GuidedCalibration && localSpeedMap ? GuidedCalibration.rawFromSpeed(params.speedMps, localSpeedMap) : null);
    const base = Number.isFinite(calibratedRaw)
      ? calibratedRaw
      : nova.wheelBaseRpm + nova.wheelRpmPerSpeed * novaSpeedLevelFromMps(params.speedMps, calibration);
    const speedLevel = LaunchModel
      ? LaunchModel.levelFromRaw(base)
      : clamp(novaSpeedLevelFromMps(params.speedMps, calibration), 0, 10, 0);

    const cap = LaunchModel
      ? LaunchModel.spinCapacityAtLevel(speedLevel)
      : {
          maxSpinSetting: Math.max(0, interpolateNovaCurve(speedLevel, "maxSpinSetting", calibration)),
          maxSpinRps: Math.max(0, interpolateNovaCurve(speedLevel, "maxSpinRps", calibration)),
        };
    const maxSpinSetting = cap.maxSpinSetting;
    const maxSpinRps = cap.maxSpinRps;
    const requestedSpinRps = Math.abs(params.spinRps);
    const spinLevel = LaunchModel
      ? LaunchModel.spinSettingFromRps(speedLevel, params.spinRps, { clampToMeasuredCapacity: true })
      : Math.sign(params.spinRps) * clamp(maxSpinRps > .001 ? requestedSpinRps / maxSpinRps * maxSpinSetting : 0, 0, maxSpinSetting, 0);
    const limited = requestedSpinRps > maxSpinRps + .05;
    const speedLimited = exitRange
      ? params.speedMps < exitRange.minMps - .01 || params.speedMps > exitRange.maxMps + .01
      : false;

    const delta = nova.wheelRpmPerSpin * spinLevel;
    const swapped = calibration.rotationType >= 4;
    const wheelA = Math.floor(swapped ? base - delta : base + delta);
    const wheelB = Math.floor(swapped ? base + delta : base - delta);
    const modeledExitSpeedMps = LaunchModel ? LaunchModel.exitSpeedFromRaw(base, localSpeedMap || undefined) : params.speedMps;
    const modeledSpinRps = LaunchModel
      ? LaunchModel.spinRpsFromRawWheels(swapped ? wheelB : wheelA, swapped ? wheelA : wheelB)
      : params.spinRps;
    const upDown = Math.round(clamp(
      nova.upDownAtZeroDeg + nova.upDownPerDegree * params.elevationDeg,
      -50,
      100,
      0
    ));
    const placement = clamp(params.aimDeg / nova.yawDegreesPerPlacement, -10, 10, 0);

    return { wheelA, wheelB, upDown, placement, speedLevel, spinLevel, maxSpinSetting, maxSpinRps,
      limited, speedLimited, modeledExitSpeedMps, modeledSpinRps, exitRange };
  }

  function novaEstimateHtml(params) {
    const estimate = estimatedNovaSettings(params);
    const warnings = [];
    if (estimate.speedLimited && estimate.exitRange) warnings.push(`Requested speed is outside the supported linear exit-speed range (${fmt(estimate.exitRange.minMps,1)}–${fmt(estimate.exitRange.maxMps,1)} m/s); the motor estimate is clamped.`);
    if (estimate.limited) warnings.push(`Requested spin exceeds the Spinsight-derived capability at this speed (${fmt(estimate.maxSpinRps,1)} rps maximum); the motor estimate is clamped.`);
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
      <p>${warnings.length ? warnings.join(" ") : `Exit speed uses one linear raw-wheel-input model fit to the local no-spin calibration plus the Spinsight-derived speed data; rotation uses the Spinsight speed-dependent spin table.`}</p>
    </div>`;
  }

  function aimWords(angle) {
    if (Math.abs(angle) < .05) return "straight";
    return `${fmt(Math.abs(angle),1)}° ${angle < 0 ? "right" : "left"}`;
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
    const yaw = radians(c.pose.yawDeg + params.aimDeg);
    const elevation = radians(params.elevationDeg);
    const groundPlacement = c.placementMode === "ground";
    const launchHeightAboveTable = groundPlacement ? c.nozzleHeight - c.tableHeight : c.nozzleHeight;
    let position = { x: c.pose.x, y: c.pose.y, z: launchHeightAboveTable };
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
      c.nozzleHeight + .05,
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
    const maxZ = Math.max(c.nozzleHeight, ...prediction.points.map(p => p.z), table.netHeight) + .12;
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

  function mapX(value, min, max, outMin, outMax) {
    return outMin + (value - min) / (max - min) * (outMax - outMin);
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

  function renderCalibration() {
    const c = library.calibration;
    els.poseXInput.value = c.pose.x;
    els.poseYInput.value = c.pose.y;
    els.poseYawInput.value = c.pose.yawDeg;
    els.rotationTypeInput.value = String(c.rotationType);
    els.nozzleHeightInput.value = c.nozzleHeight;
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
    els.wheelBaseRpmInput.value = c.nova.wheelBaseRpm;
    els.wheelRpmPerSpeedInput.value = c.nova.wheelRpmPerSpeed;
    els.wheelRpmPerSpinInput.value = c.nova.wheelRpmPerSpin;
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
    els.novaScaleTableBody.replaceChildren();
    library.calibration.nova.spinsightCurve.forEach((point, index) => {
      const row = document.createElement("tr");
      if (point.estimated) row.classList.add("estimated-row");
      row.innerHTML = `
        <th>${fmt(point.level,1)}${point.estimated ? `<small>estimated</small>` : ""}</th>
        <td><span class="table-input-unit"><input data-nova-index="${index}" data-nova-field="speedKmh" type="number" min=".1" max="100" step=".1" value="${point.speedKmh}"><small>km/h</small></span></td>
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

  function guidedNozzleXMetres(g = guidedState()) {
    return finite(g.nozzleXcm, 26.5) / 100;
  }

  function guidedSpeedEstimate(raw) {
    const map = library.calibration.nova.rawSpeedMap;
    if (GuidedCalibration && Array.isArray(map) && map.length) return GuidedCalibration.speedFromMap(raw, map);
    return GuidedCalibration ? GuidedCalibration.seedSpeedMps(raw) : 5;
  }

  function syncGuidedConfigFromInputs() {
    const g = guidedState();
    g.placement = els.guidedPlacementGround.checked ? "ground" : "table";
    g.distanceReference = g.placement === "ground" ? "base_back" : els.guidedDistanceReference.value;
    const shownX = finite(els.guidedNozzleXInput.value, 26.5);
    g.nozzleXcm = Math.abs(shownX);
    g.tableHeightCm = clamp(els.guidedTableHeightInput.value, 40, 120, 76);
    g.repeatCount = Math.round(clamp(els.guidedRepeatCountInput.value, 1, 12, 3));
    g.elevationMinDeg = clamp(els.guidedElevationMinInput.value, -20, 60, 10);
    g.elevationMaxDeg = clamp(els.guidedElevationMaxInput.value, -20, 60, 30);
    g.elevationCount = Math.round(clamp(els.guidedElevationCountInput.value, 2, 12, 5));
    g.speedMinRaw = Math.round(clamp(els.guidedSpeedMinInput.value, 400, 7500, 2025));
    g.speedMaxRaw = Math.round(clamp(els.guidedSpeedMaxInput.value, 400, 7500, 2388));
    g.speedCount = Math.round(clamp(els.guidedSpeedCountInput.value, 2, 8, 3));
    return g;
  }

  function rebuildGuidedPlan(preserve = true) {
    if (!GuidedCalibration) return;
    const g = library.calibration.guided || defaultGuidedCalibration();
    const previous = preserve && Array.isArray(g.shots) ? g.shots : [];
    const byKey = new Map(previous.map(shot => [`${shot.rawSpeed}|${shot.elevationDeg}`, shot]));
    const plan = GuidedCalibration.buildPlan({
      placement: g.placement,
      elevationMinDeg: g.elevationMinDeg,
      elevationMaxDeg: g.elevationMaxDeg,
      elevationCount: g.elevationCount,
      speedMinRaw: g.speedMinRaw,
      speedMaxRaw: g.speedMaxRaw,
      speedCount: g.speedCount,
    });
    g.shots = plan.shots.map((shot, index) => {
      const old = byKey.get(`${shot.rawSpeed}|${shot.elevationDeg}`);
      return old ? { ...shot, distanceCm: old.distanceCm, netClearanceCm: old.netClearanceCm, saved: old.saved } : shot;
    });
    g.currentIndex = Math.min(g.currentIndex || 0, Math.max(0, g.shots.length - 1));
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
      g.nozzleXcm = 34;
      g.elevationMinDeg = 5;
      g.elevationMaxDeg = 45;
      g.elevationCount = 5;
      for (const shot of g.shots || []) shot.netClearanceCm = null;
    } else {
      g.distanceReference = "net";
      g.nozzleXcm = 34;
      g.elevationMinDeg = 10;
      g.elevationMaxDeg = 30;
      g.elevationCount = 5;
    }
    g.currentIndex = 0;
    rebuildGuidedPlan(false);
    renderGuidedCalibration();
  }

  function renderGuidedCalibration() {
    if (!GuidedCalibration || !els.guidedPlacementTable) return;
    const g = guidedState();
    const ground = g.placement === "ground";
    els.guidedPlacementTable.checked = !ground;
    els.guidedPlacementGround.checked = ground;
    if (ground) g.distanceReference = "base_back";
    els.guidedDistanceReference.value = g.distanceReference;
    els.guidedDistanceReference.disabled = ground;
    els.guidedNozzleXInput.value = Math.abs(g.nozzleXcm);
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
    els.guidedNozzleXLabel.textContent = ground ? "Nozzle from back of base" : "Nozzle from near edge";
    els.guidedNozzleXHint.textContent = ground ? "Horizontal distance from the back of the robot base to the launch point. Default 26.5 cm." : "Positive means the nozzle is over the tabletop. Default 26.5 cm.";
    els.guidedPlacementHelp.innerHTML = ground
      ? `<strong>Ground setup:</strong> place the robot on a flat floor with the back of the base as your zero point. Measure from the <strong>back of the base to the first landing point on the ground</strong>. No table or net is used in this calibration model, so longer shots are fine.`
      : `<strong>Table setup:</strong> place the robot on the table, centred and pointing straight forward. Default assumes the nozzle is 26.5 cm from the near table edge. The fitted nozzle height is measured above the tabletop.`;
    const refText = g.distanceReference === "base_back"
      ? "0 cm at the back of the robot base; positive is forward along the shot."
      : g.distanceReference === "net"
        ? "0 cm at the net; positive is toward the opponent."
        : g.distanceReference === "near_edge"
          ? "0 cm at the near table edge; positive is toward the net."
          : "0 cm directly below the nozzle; positive is forward.";
    els.guidedReferenceHint.textContent = refText;
    els.guidedDistanceLabel.textContent = ground ? "Distance from back of base" : "Landing distance";
    els.guidedNetHeightInput.disabled = ground;
    if (ground) els.guidedNetHeightInput.value = "";
    els.guidedComputeHelp.textContent = ground
      ? "Flat-ground fit: landing distances estimate nozzle height above the floor and a monotonic raw-input → m/s map. The nozzle offset from the back of the base stays fixed to your setup value."
      : "Table fit: landing distances estimate nozzle height and a monotonic raw-input → m/s map. Optional net-clearance values add vertical constraints.";
    els.guidedSpeedMinHint.textContent = `≈ ${fmt(guidedSpeedEstimate(g.speedMinRaw),2)} m/s from current calibration`;
    els.guidedSpeedMaxHint.textContent = `≈ ${fmt(guidedSpeedEstimate(g.speedMaxRaw),2)} m/s from current calibration`;
    els.guidedShotCountBadge.textContent = `${g.shots.length} shots`;

    const shot = guidedCurrentShot();
    if (shot) {
      els.guidedProgressText.textContent = `${g.currentIndex + 1} / ${g.shots.length}`;
      els.guidedCurrentElevation.textContent = `${fmt(shot.elevationDeg,1)}°`;
      els.guidedCurrentSpeed.textContent = `${Math.round(shot.rawSpeed)}`;
      els.guidedCurrentSpeedMps.textContent = `≈ ${fmt(guidedSpeedEstimate(shot.rawSpeed),2)} m/s`;
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
      if (!robot.connected) await robot.connect();
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
      nozzleXFromNearEdgeM: guidedNozzleXMetres(g),
      tableHeightM: g.tableHeightCm / 100,
      tableLengthM: library.calibration.table.length,
      netXFromNearEdgeM: library.calibration.table.length / 2,
      netHeightM: library.calibration.table.netHeight,
      distanceSigmaM: 0.015,
      netClearanceSigmaM: 0.01,
      dt: 0.004,
    };
  }

  function computeGuidedCalibration() {
    if (!GuidedCalibration) {
      toast("Guided calibration solver did not load.");
      return;
    }
    syncGuidedConfigFromInputs();
    saveGuidedCurrentInputs();
    els.guidedComputeBtn.disabled = true;
    els.guidedComputeStatus.textContent = "Computing trajectory fit…";
    els.guidedFitBadge.textContent = "Computing";
    try {
      const g = guidedState();
      const result = GuidedCalibration.calibrate(g.shots, guidedFitSetup());
      g.lastResult = {
        placement: result.placement,
        nozzleHeightM: result.nozzleHeightM,
        nozzleHeightReference: result.nozzleHeightReference,
        nozzleXReference: result.nozzleXReference,
        nozzleXFromNearEdgeM: result.nozzleXFromNearEdgeM,
        speedMap: result.speedMap,
        speedModel: result.speedModel,
        speedModelRmseMps: result.speedModelRmseMps,
        distanceRmseM: result.distanceRmseM,
        distanceMaxAbsM: result.distanceMaxAbsM,
        clearanceRmseM: result.clearanceRmseM,
        clearanceMaxAbsM: result.clearanceMaxAbsM,
        distanceCount: result.distanceCount,
        clearanceCount: result.clearanceCount,
      };
      saveLibrary();
      els.guidedComputeStatus.textContent = "Calibration computed. Review the fit before applying it.";
      renderGuidedResult();
    } catch (error) {
      g.lastResult = null;
      els.guidedFitBadge.textContent = "Needs data";
      els.guidedFitBadge.className = "status-badge invalid";
      els.guidedComputeStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      els.guidedComputeBtn.disabled = false;
    }
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
    const good = result.distanceRmseM != null && result.distanceRmseM <= 0.025;
    els.guidedFitBadge.textContent = good ? "Good fit" : "Review fit";
    els.guidedFitBadge.className = `status-badge ${good ? "valid" : "neutral"}`;
    const support = result.nozzleHeightReference === "ground" ? "above ground" : "above table";
    const clearanceLine = result.placement === "ground"
      ? "Not used in flat-ground mode"
      : (result.clearanceRmseM == null ? "No net-height measurements used" : `Net-height RMSE ${fmt(result.clearanceRmseM * 100,2)} cm (${result.clearanceCount} values)`);
    els.guidedResults.innerHTML = `
      <div class="fit-summary-grid">
        <div><span>Nozzle height</span><strong>${fmt(result.nozzleHeightM * 100,1)} cm</strong><small>${support}</small></div>
        <div><span>Horizontal reference</span><strong>${fmt(Math.abs(result.nozzleXFromNearEdgeM) * 100,1)} cm</strong><small>${result.nozzleXReference === "base_back" ? "from back of base" : "from near edge"}</small></div>
        <div><span>Landing RMSE</span><strong>${result.distanceRmseM == null ? "—" : `${fmt(result.distanceRmseM * 100,2)} cm`}</strong><small>${result.distanceCount} distances</small></div>
        <div><span>Vertical check</span><strong>${result.clearanceRmseM == null ? "—" : `${fmt(result.clearanceRmseM * 100,2)} cm`}</strong><small>${clearanceLine}</small></div>
      </div>
      <div class="speed-map-result">
        <h4>Linear raw wheel input → launch speed</h4>
        ${result.speedModel ? `<p class="fit-equation">v = ${fmt(result.speedModel.interceptMps,4)} + ${fmt(result.speedModel.slopeMpsPerRaw,7)} × raw <span>m/s · profile RMSE ${fmt((result.speedModelRmseMps || 0) * 1000,1)} mm/s</span></p>` : ""}
        ${result.speedMap.map(p => `<div><span>${Math.round(p.raw)}</span><strong>${fmt(p.speedMps,3)} m/s</strong><small>${fmt(p.speedMps * 3.6,2)} km/h</small></div>`).join("")}
      </div>
      <button id="guidedApplyResultBtn" class="button primary wide" type="button">Apply calibration to Robot Studio</button>`;
    els.guidedResults.hidden = false;
    $("guidedApplyResultBtn")?.addEventListener("click", applyGuidedCalibrationResult);
  }

  function applyGuidedCalibrationResult() {
    const g = guidedState();
    const result = g.lastResult;
    if (!result) return;
    const c = library.calibration;
    // Guided placement describes the calibration experiment only. Applying
    // the result must not move the robot in the drill model or switch its
    // operational placement. Only intrinsic launch calibration is updated.
    c.nozzleHeight = result.nozzleHeightM;
    c.nova.rawSpeedMap = result.speedMap.map(point => ({ raw: point.raw, speedMps: point.speedMps }));
    saveLibrary();
    renderAll();
    renderCalibration();
    toast("Nozzle height and linear Nova speed calibration applied; robot pose was left unchanged");
  }

  function bindGuidedCalibrationInputs() {
    els.calibrationGuidedTab.addEventListener("click", () => setCalibrationTab("guided"));
    els.guidedPlacementTable.addEventListener("change", () => { if (els.guidedPlacementTable.checked) setGuidedPlacement("table"); });
    els.guidedPlacementGround.addEventListener("change", () => { if (els.guidedPlacementGround.checked) setGuidedPlacement("ground"); });
    els.guidedDistanceReference.addEventListener("change", () => { if (guidedState().placement !== "ground") guidedState().distanceReference = els.guidedDistanceReference.value; saveLibrary(); renderGuidedCalibration(); });
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
      [els.poseXInput, value => library.calibration.pose.x = clamp(value, -1.5, 4.2, -.18)],
      [els.poseYInput, value => library.calibration.pose.y = clamp(value, -2, 2, 0)],
      [els.poseYawInput, value => library.calibration.pose.yawDeg = clamp(value, -180, 180, 0)],
      [els.rotationTypeInput, value => library.calibration.rotationType = Math.round(clamp(value, 0, 7, 0))],
      [els.nozzleHeightInput, value => library.calibration.nozzleHeight = clamp(value, .05, 1.5, DEFAULT_NOVA_NOZZLE_HEIGHT_M)],
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
      [els.wheelBaseRpmInput, value => library.calibration.nova.wheelBaseRpm = clamp(value, 0, 20000, 969.9321047526674)],
      [els.wheelRpmPerSpeedInput, value => library.calibration.nova.wheelRpmPerSpeed = clamp(value, 0, 5000, 630.455868089234)],
      [els.wheelRpmPerSpinInput, value => library.calibration.nova.wheelRpmPerSpin = clamp(value, 0, 5000, 342.036255843120)],
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
      if (field === "speedKmh") point.speedKmh = clamp(input.value, .1, 100, point.speedKmh);
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
      library.calibration.nova = defaultNovaCalibration();
      saveLibrary();
      renderCalibration();
      renderGraph();
      renderInspector();
      toast("Spinsight and native motor defaults restored");
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
    return Boolean(robot?.connected && [4, 5, 6, 7].includes(robot.wireState));
  }

  function liveTuningIsActive() {
    return Boolean(DrillAdjustments?.hasActiveTuning(liveTuning));
  }

  function liveTrajectoryTuningIsActive() {
    return Boolean(DrillAdjustments?.hasActiveTuning({ ...liveTuning, pacePct: 0 }));
  }

  function formatTuningPercent(value) {
    const n = Math.round(finite(value, 0));
    return `${n > 0 ? "+" : ""}${n}%`;
  }

  function tunedDelaySeconds(seconds) {
    return DrillAdjustments ? DrillAdjustments.delayWithPace(seconds, liveTuning) : Math.max(0, finite(seconds, 0));
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
    const range = LaunchModel?.exitSpeedRange(library.calibration.nova.rawSpeedMap);
    return {
      ...tuningElevationBounds(),
      minSpeedMps: range?.minMps ?? 1,
      maxSpeedMps: range?.maxMps ?? 20,
      landingToleranceM: .04,
      clearanceToleranceM: .01,
      minNetClearanceM: .002,
    };
  }

  function adjustedShotForLiveTuning(baseParams) {
    const params = {
      speedMps: finite(baseParams?.speedMps, 8),
      spinRps: finite(baseParams?.spinRps, 0),
      elevationDeg: finite(baseParams?.elevationDeg, 4),
      aimDeg: finite(baseParams?.aimDeg, 0),
    };
    if (!DrillAdjustments || !liveTrajectoryTuningIsActive()) {
      const prediction = predictTrajectory(params);
      return { params, basePrediction: prediction, prediction, landingErrorM: 0, clearanceErrorM: 0, targetClearanceM: prediction?.net?.clearanceM ?? null, warnings: [], changed: false };
    }
    const cacheKey = JSON.stringify([params, liveTuning, library.calibration]);
    const cached = liveTuningCache.get(cacheKey);
    if (cached) return cached;
    const result = DrillAdjustments.applyShotTuning(
      params,
      liveTuning,
      candidate => predictTrajectory(candidate),
      liveTuningOptions()
    );
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
    if (!DrillAdjustments) return;
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

    const shot = liveTuningShotForPreview();
    if (!shot) {
      els.liveTuningImpactLabel.textContent = "No shot available";
      els.liveTuningImpact.innerHTML = `<p class="helper">The selected drill has no direct shot node to preview.</p>`;
      return;
    }
    els.liveTuningImpactLabel.textContent = `All balls · example: ${shot.label}`;
    const result = adjustedShotForLiveTuning(shot.params);
    const base = result.basePrediction || predictTrajectory(shot.params);
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

    // A Nova Start packet is buffered by the robot, so it cannot be edited in
    // place. Interrupt the currently buffered batch, then resume the same
    // already-sampled traversal with freshly tuned commands. From this point
    // on, use one-ball packets for the rest of this playback session so later
    // clicks affect the next ball rather than waiting behind a multi-ball batch.
    playbackResponsiveTuning = true;
    playbackRetuneRequested = true;
    els.runStatus.textContent = "Applying Live tuning to every ball…";

    if (robot?.connected && (robotIsActive() || robot.phase === "running") && !liveRetuneStopPromise) {
      liveRetuneStopPromise = robot.stopAndWaitFree()
        .catch(error => {
          robot.log(`Live tuning Stop was not confirmed: ${error.message}`, "warn");
          return null;
        })
        .finally(() => { liveRetuneStopPromise = null; });
    }
  }

  function stepLiveTuning(key, delta) {
    if (!DrillAdjustments || !(key in liveTuning)) return;
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
    const result = adjustedShotForLiveTuning(baseParams);
    const shift = Number.isFinite(result.landingErrorM) ? `${fmt(result.landingErrorM * 100,1)} cm` : "unknown";
    return `<div class="live-tuning-inline"><strong>Live tuning is active.</strong> Effective shot: ${fmt(result.params.speedMps,2)} m/s · ${signed(result.params.spinRps,1)} rps · ${signed(result.params.elevationDeg,1)}°. Modeled landing shift: ${shift}. Stored values below are unchanged.</div>`;
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
    const exitRange = estimate.exitRange || (LaunchModel ? LaunchModel.exitSpeedRange(c.nova.rawSpeedMap) : null);
    const minMps = exitRange ? exitRange.minMps : 1;
    const maxMps = exitRange ? exitRange.maxMps : 20;

    if (upDown < -50 - 1e-6 || upDown > 100 + 1e-6) {
      errors.push(`“${shot.label}”: elevation ${fmt(shot.params.elevationDeg,1)}° maps to Nova Up/down ${fmt(upDown,1)}, outside -50…100.`);
    }
    if (Math.abs(placement) > 10 + 1e-6) {
      errors.push(`“${shot.label}”: aim ${fmt(shot.params.aimDeg,1)}° maps to placement ${fmt(placement,1)}, outside -10…10.`);
    }
    if (shot.params.speedMps < minMps - .01 || shot.params.speedMps > maxMps + .01) {
      warnings.push(`“${shot.label}”: ${fmt(shot.params.speedMps,1)} m/s is outside the supported linear exit-speed range (${fmt(minMps,1)}…${fmt(maxMps,1)} m/s); the nearest supported wheel input is used.`);
    }
    if (estimate.limited) {
      warnings.push(`“${shot.label}”: requested ${fmt(Math.abs(shot.params.spinRps),1)} rps exceeds the calibrated ${fmt(estimate.maxSpinRps,1)} rps capacity at this speed; spin is clamped.`);
    }
    if (estimate.wheelA < 400 || estimate.wheelA > 7500 || estimate.wheelB < 400 || estimate.wheelB > 7500) {
      warnings.push(`“${shot.label}”: a computed wheel speed is outside 400…7500 rpm and will be clamped.`);
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

  function buildRobotExecutionPlan(compiled, { maxBatchSize = 6 } = {}) {
    if (!Protocol) throw new Error("Protocol module is unavailable");
    if (!compiled.shots.length) throw new Error("This traversal contains no shots to send to the robot.");

    const warnings = [...compiled.warnings];
    const errors = [];
    const prepared = [];
    const batchLimit = Math.max(1, Math.min(6, Math.trunc(finite(maxBatchSize, 6)) || 6));

    // IMPORTANT: tune the entire compiled traversal, not the selected/inspected
    // shot. The same runtime modifiers are applied independently to every ball.
    const tunedShots = DrillAdjustments.applyTuningToShotList(
      compiled.shots,
      liveTuning,
      candidate => predictTrajectory(candidate),
      liveTuningOptions()
    );

    for (let index = 0; index < compiled.shots.length; index += 1) {
      const baseShot = compiled.shots[index];
      const adjusted = tunedShots[index].adjustment;
      const shot = {
        ...baseShot,
        params: { ...adjusted.params },
        baseParams: { ...baseShot.params },
        tuningApplied: adjusted.changed,
      };
      if (adjusted.warnings?.length) warnings.push(...adjusted.warnings.map(message => `“${shot.label}”: ${message}`));
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
        encodedSeconds,
        hostDelayBefore: pendingHostDelay,
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
        : "This set is split into batches of at most 6 balls for BLE/robot stability. A small Ready→Start transition overhead can be added at those chunk boundaries.");
    }

    return {
      trailingDelay: tunedDelaySeconds(compiled.trailingDelay),
      batches,
      warnings: [...new Set(warnings)],
      shotCount: prepared.length,
    };
  }

  function buildCalibrationTestExecutionPlan() {
    const c = library.calibration;
    return buildRobotExecutionPlan({
      shots: [{
        drillId: "__calibration__",
        nodeId: "__test_shot__",
        label: "Calibration test shot",
        params: { ...c.testShot },
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
        <span><strong>Wheel A</strong> ${shot.wheelA} rpm</span>
        <span><strong>Wheel B</strong> ${shot.wheelB} rpm</span>
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
      els.simulateTestShotBtn.disabled = true;
      els.simulateTestShotBtn.textContent = "Web Bluetooth unavailable";
      els.testShotConnectionState.textContent = "Open the app from localhost/HTTPS in a Chromium browser with Web Bluetooth.";
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

  async function runCalibrationTestShot() {
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
      plan = buildCalibrationTestExecutionPlan();
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
      if (!robot.connected) {
        await robot.connect();
        if (!calibrationTestRunning || token !== playbackToken) return;
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
      calibrationTestMessage = `Serving one ball · A ${shot.wheelA} rpm · B ${shot.wheelB} rpm`;
      renderCalibrationTestShotPanel();

      const timeoutMs = Math.max(20000, Math.ceil((batch.encodedSeconds + 12) * 1000));
      await robot.startBatch(batch.packet, {
        timeoutMs,
        expectedDurationMs: batch.encodedSeconds * 1000,
        description: `calibration test shot (${fmt(shot.params.speedMps,1)} m/s, ${signed(shot.params.spinRps,1)} rps)`,
      });

      if (!calibrationTestRunning || token !== playbackToken) return;
      calibrationTestMessage = "Test shot complete · Nova Ready";
      toast("Calibration test shot complete · Nova Ready");
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

  async function startPlayback() {
    if (calibrationTestRunning) {
      toast("Stop the calibration test shot first.");
      return;
    }
    const drill = activeDrill();
    if (!drill) return;
    const validation = validateDrill(drill);
    if (!validation.valid) {
      toast("Fix drill errors before playing.");
      return;
    }
    if (!robot) {
      toast("Robot controller module did not load.");
      return;
    }
    if (!robot.connected) {
      toast("Connect the Nova before pressing Play. Preview trace remains simulation-only.");
      return;
    }

    playbackToken += 1;
    const token = playbackToken;
    playbackRunning = true;
    playbackRetuneRequested = false;
    playbackResponsiveTuning = liveTuningIsActive();
    activeNodeRef = null;
    activeEdgeRef = null;
    runtimeCounterDisplay = new Map();
    updatePlayButton();

    const configured = drill.settings.repetitions;
    const infinite = configured <= 0;
    let completed = 0;
    let warningsShown = false;

    try {
      await robot.ensureReadyForStart();
      while (playbackRunning && token === playbackToken && (infinite || completed < configured)) {
        const currentNumber = completed + 1;
        updateProgress(completed, configured, infinite, `Preparing set ${currentNumber}${infinite ? " · ∞" : ` of ${configured}`}`);
        runtimeCounterDisplay = new Map();

        // Sample the drill graph exactly once for this set. Live tuning is not
        // baked into this traversal; the execution plan can therefore be rebuilt
        // instantly without changing random choices or Repeater state.
        const compiled = compileRobotSet(drill.id);
        let nextShotIndex = 0;

        while (playbackRunning && token === playbackToken && nextShotIndex < compiled.shots.length) {
          if (liveRetuneStopPromise) await liveRetuneStopPromise.catch(() => null);
          playbackRetuneRequested = false;

          const remainingCompiled = {
            ...compiled,
            shots: compiled.shots.slice(nextShotIndex).map((shot, offset) => ({
              ...shot,
              sourceIndex: nextShotIndex + offset,
            })),
          };
          const plan = buildRobotExecutionPlan(remainingCompiled, {
            maxBatchSize: playbackResponsiveTuning ? 1 : 6,
          });
          if (!warningsShown && plan.warnings.length) {
            warningsShown = true;
            plan.warnings.forEach(message => robot.log(`Plan warning: ${message}`, "warn"));
            toast(plan.warnings[0]);
          }

          let rebuildForRetune = false;
          for (let batchIndex = 0; batchIndex < plan.batches.length; batchIndex += 1) {
            if (!playbackRunning || token !== playbackToken) break;
            const batch = plan.batches[batchIndex];
            const batchStartIndex = batch.shots[0]?.sourceIndex ?? nextShotIndex;

            if (playbackRetuneRequested) {
              if (liveRetuneStopPromise) await liveRetuneStopPromise.catch(() => null);
              nextShotIndex = batchStartIndex;
              playbackRetuneRequested = false;
              rebuildForRetune = true;
              break;
            }

            if (batch.hostDelayBefore > 0) {
              await waitWithStatus(batch.hostDelayBefore, token, batchIndex === 0 ? "First shot in" : "Long edge delay");
              if (!playbackRunning || token !== playbackToken) break;
              if (playbackRetuneRequested) {
                nextShotIndex = batchStartIndex;
                playbackRetuneRequested = false;
                rebuildForRetune = true;
                break;
              }
            }

            const firstShot = batch.shots[0];
            activeNodeRef = { drillId: firstShot.drillId, nodeId: firstShot.nodeId };
            activeEdgeRef = null;
            if (firstShot.drillId === activeDrill()?.id) renderGraph();
            els.runStatus.textContent = `Set ${currentNumber} · ${playbackResponsiveTuning ? "live ball" : `batch ${batchIndex + 1}/${plan.batches.length}`} · ${batch.shots.map(item => item.label).join(" → ")}`;
            const timeoutMs = Math.max(20000, Math.ceil((batch.encodedSeconds + 12) * 1000));
            const revisionAtStart = liveTuningRevision;
            await robot.startBatch(batch.packet, {
              timeoutMs,
              expectedDurationMs: batch.encodedSeconds * 1000,
              description: `set ${currentNumber}, ${playbackResponsiveTuning ? "live ball" : `batch ${batchIndex + 1}/${plan.batches.length}`} (${batch.shots.length} ball${batch.shots.length === 1 ? "" : "s"})`,
            });
            activeNodeRef = null;
            if (activeDrill()) renderGraph();

            if (playbackRetuneRequested || liveTuningRevision !== revisionAtStart) {
              if (liveRetuneStopPromise) await liveRetuneStopPromise.catch(() => null);
              // We cannot ask the Nova which record inside an interrupted packet
              // was the last one actually fired. Resume conservatively from the
              // first record of that packet. Once a live edit has happened, the
              // rest of playback uses one-ball packets, so subsequent edits have
              // at most the currently firing ball in flight.
              nextShotIndex = batchStartIndex;
              playbackRetuneRequested = false;
              rebuildForRetune = true;
              break;
            }

            nextShotIndex = (batch.shots[batch.shots.length - 1]?.sourceIndex ?? batchStartIndex) + 1;
          }

          if (!playbackRunning || token !== playbackToken) break;
          if (rebuildForRetune) continue;
          if (nextShotIndex >= compiled.shots.length) break;
        }

        if (!playbackRunning || token !== playbackToken) break;
        if (compiled.trailingDelay > 0) await waitWithLivePace(compiled.trailingDelay, token, "Finishing set in");
        if (!playbackRunning || token !== playbackToken) break;

        completed += 1;
        updateProgress(completed, configured, infinite, infinite ? `∞ · ${completed} sets completed` : `${completed} of ${configured} sets completed`);
        if (!playbackRunning || token !== playbackToken || (!infinite && completed >= configured)) break;
        await waitWithLivePace(drill.settings.delayBetweenSets, token, "Next set in");
      }

      if (playbackRunning && token === playbackToken) {
        els.runStatus.textContent = infinite ? `Stopped after ${completed} sets` : `Finished ${completed} sets · Nova Ready`;
        els.runProgressBar.style.width = infinite ? els.runProgressBar.style.width : "100%";
      }
    } catch (error) {
      if (token === playbackToken && playbackRunning) {
        els.runStatus.textContent = `Stopped: ${error.message}`;
        toast(error.message);
        if (robot.connected && robotIsActive()) {
          await robot.stopAndWaitFree().catch(stopError => robot.log(`Emergency cleanup Stop was not confirmed: ${stopError.message}`, "error"));
        }
      }
    } finally {
      if (token === playbackToken) {
        playbackRunning = false;
        playbackRetuneRequested = false;
        playbackResponsiveTuning = false;
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

  async function waitWithLivePace(baseSeconds, token, prefix) {
    const base = Math.max(0, finite(baseSeconds, 0));
    if (base <= 0) return;
    const start = performance.now();
    while (playbackRunning && token === playbackToken) {
      // Re-evaluate the pace multiplier every ~100 ms so pace buttons are
      // genuinely live even during a between-set wait.
      const duration = tunedDelaySeconds(base);
      const elapsed = (performance.now() - start) / 1000;
      const remaining = duration - elapsed;
      if (remaining <= 0) return;
      els.runStatus.textContent = `${prefix} ${fmt(remaining,1)}s`;
      await sleep(Math.min(100, remaining * 1000), token);
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
    playbackRetuneRequested = false;
    playbackResponsiveTuning = false;
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
        const adjusted = adjustedShotForLiveTuning(node.params);
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

  function askConfirm(title, text, callback) {
    confirmCallback = callback;
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
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

    if (!globalThis.isSecureContext) {
      els.robotBrowserNotice.className = "robot-browser-notice error";
      els.robotBrowserNotice.textContent = "Web Bluetooth requires HTTPS or localhost. On Android connected by ADB, use: adb reverse tcp:8080 tcp:8080, then open http://localhost:8080 in Chrome.";
    } else if (!navigator.bluetooth) {
      els.robotBrowserNotice.className = "robot-browser-notice error";
      els.robotBrowserNotice.textContent = "This browser does not expose Web Bluetooth. Use a Chromium browser with Web Bluetooth available.";
    } else {
      els.robotBrowserNotice.className = "robot-browser-notice ok";
      els.robotBrowserNotice.textContent = snapshot.connected
        ? "Direct BLE session active. Heartbeat runs every 10 seconds while connected."
        : "Web Bluetooth is available. Connect opens the browser's device chooser; only the selected Nova is accessible.";
    }
    updatePlayButton();
    renderCalibrationTestShotPanel();
    renderGuidedCalibration();
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
    if (!robot) {
      toast("Robot controller module is unavailable.");
      return;
    }
    try {
      if (robot.connected) {
        if (calibrationFeedRunning) await stopGuidedFeed();
        if (playbackRunning || calibrationTestRunning || robotIsActive()) await stopPlayback();
        await robot.disconnect({ stopFirst: false });
        toast("Nova disconnected");
      } else {
        await robot.connect();
        const snapshot = robot.snapshot();
        toast(snapshot.ready ? `Connected to ${snapshot.deviceName || "Nova"} · Ready` : `Connected · ${snapshot.stateName}`);
      }
    } catch (error) {
      if (error?.name === "NotFoundError") {
        toast("No Nova selected.");
      } else {
        toast(error instanceof Error ? error.message : String(error));
      }
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
    banner.textContent = `Table Tennis Robot Studio could not start: ${error?.message || error}. Reload the page; if it persists, use a fresh profile or clear localhost site data.`;
    document.body.appendChild(banner);
  }

  function setMobileWorkspace(mode) {
    const normalized = mode === "drills" ? "drills" : mode === "calibrate" ? "calibrate" : "graph";
    document.body.classList.toggle("mobile-drills-open", normalized === "drills");
    const tabs = [
      [els.mobileGraphNavBtn, normalized === "graph"],
      [els.mobileDrillsNavBtn, normalized === "drills"],
      [els.mobileCalibrationNavBtn, normalized === "calibrate"],
    ];
    for (const [button, active] of tabs) {
      if (!button) continue;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function openCalibrationWorkspace(tab = "guided") {
    setCalibrationTab(tab);
    renderCalibration();
    els.calibrationDialog.showModal();
  }

  function bindEvents() {
    els.robotConnectBtn.addEventListener("click", () => { void connectOrDisconnectRobot(); });
    els.robotStatusBtn.addEventListener("click", () => navigateApp("robot", { push: true }));
    els.robotDiagnosticsBtn?.addEventListener("click", () => { updateRobotUI(); els.robotDialog.showModal(); });
    els.closeRobotDialogBtn.addEventListener("click", () => els.robotDialog.close());
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
        x: clamp(els.drillRobotXInput.value, -1.5, 4.2, 0.265),
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
    window.addEventListener("beforeunload", event => {
      if (!playbackRunning && !calibrationTestRunning && !calibrationFeedRunning && !robotIsActive()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  try {
    assertRequiredElements();
    if (!Protocol || !RobotController || !robot || !GuidedCalibration || !DrillAdjustments) throw new Error("Pongbot protocol/BLE/guided calibration/drill adjustment modules did not load");
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
  } catch (error) {
    showFatalError(error);
  }
})();
