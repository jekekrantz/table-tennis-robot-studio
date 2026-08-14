(() => {
  "use strict";

  const STORAGE_KEY = "table-tennis-robot-studio";
  const SCHEMA_VERSION = 1;
  // Working geometric estimate: center of the Nova S Pro ball exit above the table
  // with the head nominally level. This is not a manufacturer-specified dimension;
  // calibrate against the physical robot for precision trajectory work.
  const DEFAULT_NOVA_NOZZLE_HEIGHT_M = 0.205;
  const SURFACE_WIDTH = 2600;
  const SURFACE_HEIGHT = 1800;
  const MIN_GRAPH_ZOOM = 0.45;
  const MAX_GRAPH_ZOOM = 2.2;
  const NODE_WIDTH = 226;
  const MIN_NODE_Y = 24;
  const MAX_TRANSITIONS = 1200;

  const $ = (id) => document.getElementById(id);
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
    resetExamplesBtn: $("resetExamplesBtn"),
    libraryStatus: $("libraryStatus"),
    drillList: $("drillList"),
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
  };

  let startupNotice = "";
  let library = initializeLibrary();
  let selection = null;
  let nodeDrag = null;
  let connectionDrag = null;
  let canvasPan = null;
  let graphZoom = 1;
  let poseDrag = null;
  let suppressClickUntil = 0;
  let toastTimer = null;
  let confirmCallback = null;
  let playbackToken = 0;
  let playbackRunning = false;
  let calibrationTestRunning = false;
  let calibrationTestMessage = "";
  let activeNodeRef = null;
  let activeEdgeRef = null;
  let runtimeCounterDisplay = new Map();
  let calibrationViewTransform = null;
  let robotLogLines = [];
  let stopPromise = null;

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
    if (loaded && Array.isArray(loaded.drills) && loaded.drills.length > 0) return loaded;
    startupNotice = "No usable saved drill library was found, so the example drills were restored.";
    return makeSampleLibrary();
  }

  function repairLibraryIfNeeded() {
    if (!library || typeof library !== "object") library = makeSampleLibrary();
    if (!Array.isArray(library.drills)) library.drills = [];
    if (library.drills.length === 0) {
      const replacement = defaultDrill("Custom drill");
      library.drills.push(replacement);
      library.activeDrillId = replacement.id;
      startupNotice = "The saved library contained no drills. A new blank drill was created.";
    }
    const activeExists = library.drills.some(drill => drill.id === library.activeDrillId);
    if (!activeExists) library.activeDrillId = library.drills[0].id;
    if (!library.calibration) library.calibration = defaultCalibration();
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
    };
  }

  function defaultCalibration() {
    return {
      pose: { x: -0.18, y: 0, yawDeg: 0 },
      table: regulationTable(),
      rotationType: 0,
      nozzleHeight: DEFAULT_NOVA_NOZZLE_HEIGHT_M,
      gravity: 9.80665,
      timeStep: 0.004,
      maxFlightTime: 4.0,
      physics: defaultPhysicsCalibration(),
      nova: defaultNovaCalibration(),
      testShot: { speedMps: 8.0, spinRps: 22, elevationDeg: 4, aimDeg: 0 },
    };
  }

  function defaultDrill(name = "Custom drill") {
    return {
      id: makeId("drill"),
      name,
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
      params: { speedMps: 8.0, spinRps: 20, elevationDeg: 4, aimDeg: 0 },
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

  function makeSampleLibrary() {
    const serve = defaultDrill("Serve + third ball");
    const serve1 = makeShot(serve, "Short underspin serve");
    serve1.x = 210; serve1.y = 260;
    serve1.params = { speedMps: 5.5, spinRps: -30, elevationDeg: 5, aimDeg: -3 };
    const serve2 = makeShot(serve, "Third-ball forehand");
    serve2.x = 560; serve2.y = 260;
    serve2.params = { speedMps: 9.2, spinRps: 30, elevationDeg: 3.5, aimDeg: 8 };
    serve.nodes.push(serve1, serve2);
    serve.startNodeId = serve1.id;
    serve.edges.push({
      id: makeId("edge"), source: serve1.id, sourceSlot: "next", target: serve2.id,
      weight: 1, delaySeconds: 1.1
    });

    const pattern = defaultDrill("Two forehands then backhand");
    const fh = makeShot(pattern, "Forehand drive");
    fh.x = 190; fh.y = 250;
    fh.params = { speedMps: 8.7, spinRps: 25, elevationDeg: 4, aimDeg: 9 };
    const counter = makeCounter("Repeat forehand once");
    counter.x = 500; counter.y = 250; counter.startCount = 1;
    const bh = makeShot(pattern, "Backhand push");
    bh.x = 830; bh.y = 390;
    bh.params = { speedMps: 6.2, spinRps: -22, elevationDeg: 6, aimDeg: -8 };
    pattern.nodes.push(fh, counter, bh);
    pattern.startNodeId = fh.id;
    pattern.edges.push(
      { id: makeId("edge"), source: fh.id, sourceSlot: "next", target: counter.id, weight: 1, delaySeconds: .85 },
      { id: makeId("edge"), source: counter.id, sourceSlot: "A", target: fh.id, weight: 1, delaySeconds: .8 },
      { id: makeId("edge"), source: counter.id, sourceSlot: "B", target: bh.id, weight: 1, delaySeconds: .9 }
    );

    const main = defaultDrill("Match-play mix");
    main.settings = { repetitions: 5, delayBetweenSets: 1.5 };
    const random = makeRandom("Choose a rally pattern");
    random.x = 220; random.y = 300;
    const serveNode = makeDrillNode("Serve pattern", serve.id);
    serveNode.x = 570; serveNode.y = 190;
    const rallyNode = makeDrillNode("Rally pattern", pattern.id);
    rallyNode.x = 570; rallyNode.y = 430;
    main.nodes.push(random, serveNode, rallyNode);
    main.startNodeId = random.id;
    main.edges.push(
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: serveNode.id, weight: 60, delaySeconds: 0 },
      { id: makeId("edge"), source: random.id, sourceSlot: "branch", target: rallyNode.id, weight: 40, delaySeconds: 0 }
    );

    return {
      schemaVersion: SCHEMA_VERSION,
      activeDrillId: main.id,
      calibration: defaultCalibration(),
      drills: [main, serve, pattern],
    };
  }

  function activeDrill() {
    repairLibraryIfNeeded();
    return library.drills.find(d => d.id === library.activeDrillId) ?? library.drills[0] ?? null;
  }

  function getDrill(id) { return library.drills.find(d => d.id === id) ?? null; }
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
    return {
      pose: {
        x: clamp(pose.x, -1.5, 10, base.pose.x),
        y: clamp(pose.y, -5, 5, base.pose.y),
        yawDeg: clamp(pose.yawDeg, -180, 180, base.pose.yawDeg),
      },
      table: {
        length: clamp(table.length, .5, 10, base.table.length),
        width: clamp(table.width, .3, 5, base.table.width),
        netHeight: clamp(table.netHeight, .01, 1, base.table.netHeight),
      },
      rotationType: Math.round(clamp(raw.rotationType, 0, 7, base.rotationType)),
      nozzleHeight: clamp(raw.nozzleHeight, .05, 1.5, base.nozzleHeight),
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

    const settings = raw?.settings || {};
    const repetitions = Math.round(finite(settings.repetitions, 1));
    drill.settings = {
      repetitions: repetitions <= 0 ? 0 : Math.min(999999, repetitions),
      delayBetweenSets: clamp(settings.delayBetweenSets, 0, 3600, 0),
    };
    drill.startNodeId = nodeIds.has(String(raw?.startNodeId)) ? String(raw.startNodeId) : (drill.nodes[0]?.id ?? null);
    return drill;
  }

  function sanitizeLibrary(raw) {
    if (raw?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.drills)) {
      throw new Error(`Unsupported drill file. Expected schemaVersion ${SCHEMA_VERSION}.`);
    }

    const preliminaryIds = new Set(raw.drills.map(d => String(d.id || makeId("drill"))));
    let drills = raw.drills.map(d => sanitizeDrill(d, preliminaryIds));
    if (drills.length === 0) {
      const fallback = defaultDrill("Custom drill");
      drills = [fallback];
    }
    const ids = new Set(drills.map(d => d.id));
    return {
      schemaVersion: SCHEMA_VERSION,
      activeDrillId: ids.has(String(raw.activeDrillId)) ? String(raw.activeDrillId) : drills[0].id,
      calibration: sanitizeCalibration(raw.calibration),
      drills,
    };
  }

  function saveLibrary() {
    try {
      repairLibraryIfNeeded();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      if (els.libraryStatus) els.libraryStatus.textContent = `${library.drills.length} drill${library.drills.length === 1 ? "" : "s"} saved locally`;
    } catch (error) {
      console.warn("Could not save drill library", error);
      if (els.libraryStatus) els.libraryStatus.textContent = "Browser storage is unavailable; changes will last only until this page closes.";
    }
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.drills) && parsed.drills.length === 0) {
        startupNotice = "An empty saved library was ignored and the examples were restored.";
        return null;
      }
      return sanitizeLibrary(parsed);
    } catch (error) {
      console.warn(`Could not load ${STORAGE_KEY}`, error);
      return null;
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
    saveLibrary();
  }

  function currentSettingsToHeader() {
    const drill = activeDrill();
    if (!drill) return;
    els.repetitionsInput.value = repetitionsDisplay(drill.settings.repetitions);
    els.setDelayInput.value = drill.settings.delayBetweenSets;
  }

  function renderAll() {
    repairLibraryIfNeeded();
    renderDrillList();
    renderGraph();
    renderInspector();
    renderValidation();
    currentSettingsToHeader();
    const drill = activeDrill();
    els.activeDrillTitle.textContent = drill?.name ?? "No drill";
    els.drillNameInput.value = drill?.name ?? "";
    els.emptyHint.hidden = Boolean(drill?.nodes.length);
    if (els.libraryStatus && !els.libraryStatus.textContent) {
      els.libraryStatus.textContent = `${library.drills.length} drill${library.drills.length === 1 ? "" : "s"} available`;
    }
  }

  function renderDrillList() {
    els.drillList.replaceChildren();
    for (const drill of library.drills) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `drill-list-item${drill.id === library.activeDrillId ? " active" : ""}`;
      const strong = document.createElement("strong");
      strong.textContent = drill.name;
      const small = document.createElement("small");
      small.textContent = `${drill.nodes.length} nodes`;
      button.append(strong, small);
      button.addEventListener("click", () => {
        stopPlayback();
        library.activeDrillId = drill.id;
        selection = null;
        commit();
        setTimeout(fitGraph, 30);
      });
      els.drillList.appendChild(button);
    }
  }

  function nodeHeight(drill, node) {
    if (node.type === "shot") return 270;
    if (node.type === "random") return Math.max(112, 74 + (outgoing(drill, node.id).length + 1) * 27);
    if (node.type === "counter") return 116;
    return 112;
  }

  function outputPosition(drill, node, edge = null, slot = null, add = false) {
    const h = nodeHeight(drill, node);
    if (node.type === "shot" || node.type === "drill") return { x: node.x + NODE_WIDTH, y: node.y + h / 2 };
    if (node.type === "counter") {
      const actualSlot = slot || edge?.sourceSlot || "A";
      return { x: node.x + NODE_WIDTH, y: node.y + (actualSlot === "A" ? 51 : 86) };
    }
    const edges = outgoing(drill, node.id);
    const index = add ? edges.length : Math.max(0, edges.findIndex(e => e.id === edge?.id));
    return { x: node.x + NODE_WIDTH, y: node.y + 61 + index * 27 };
  }

  function renderGraph() {
    const drill = activeDrill();
    els.nodeLayer.replaceChildren();
    els.edgeLayer.replaceChildren();
    if (!drill) return;

    renderEdges(drill);

    for (const node of drill.nodes) {
      const article = document.createElement("article");
      article.className = `flow-node ${node.type}`;
      article.dataset.nodeId = node.id;
      article.style.left = `${node.x}px`;
      article.style.top = `${node.y}px`;
      article.style.height = `${nodeHeight(drill, node)}px`;
      if (selection?.kind === "node" && selection.id === node.id) article.classList.add("selected");
      if (activeNodeRef?.drillId === drill.id && activeNodeRef?.nodeId === node.id) article.classList.add("playing");

      if (drill.startNodeId === node.id) {
        const start = document.createElement("span");
        start.className = "start-badge";
        start.textContent = "Start";
        article.appendChild(start);
      }

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
            <span class="shot-metric speed-metric"><span class="shot-metric-value">${fmt(p.speedMps,1)}</span><span class="shot-metric-unit">m/s</span></span>
            <span class="shot-metric spin-metric"><span class="shot-metric-value">${fmt(Math.abs(p.spinRps),1)}</span><span class="shot-metric-unit">rps</span><span class="shot-metric-note">${p.spinRps < 0 ? "underspin" : p.spinRps > 0 ? "topspin" : "no spin"}</span></span>
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
    port.style.top = `${pos.y - node.y}px`;
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
      const to = { x: target.x, y: target.y + nodeHeight(drill, target) / 2 };
      const route = routeEdge(drill, edge, from, to, previousRoutes, index);
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
  }

  function onPortPointerDown(event) {
    if (event.button !== 0) return;
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

  function addNode(type) {
    let drill = activeDrill();
    if (!drill) {
      const created = defaultDrill("Custom drill");
      library.drills = [created];
      library.activeDrillId = created.id;
      drill = created;
    }
    let node;
    if (type === "shot") node = makeShot(drill, "Shot");
    else if (type === "random") node = makeRandom();
    else if (type === "drill") node = makeDrillNode("Sub-drill", library.drills.find(d => d.id !== drill.id)?.id ?? null);
    else node = makeCounter();

    const placement = findFreeNodePosition(drill, node);
    node.x = placement.x;
    node.y = placement.y;
    drill.nodes.push(node);
    if (!drill.startNodeId) drill.startNodeId = node.id;
    selection = { kind: "node", id: node.id };
    commit({ message: `${node.label} added` });
  }

  function deleteSelection() {
    const drill = activeDrill();
    if (!drill || !selection) return;
    if (selection.kind === "edge") {
      drill.edges = drill.edges.filter(e => e.id !== selection.id);
      selection = null;
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
    for (const drill of library.drills) {
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
        <button id="setStartInspectorBtn" class="button compact ghost" type="button"${drill.startNodeId === node.id ? " disabled" : ""}>${drill.startNodeId === node.id ? "Start node" : "Set as start"}</button>
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
      <div class="field-grid two">
        <label class="field"><span>Ball speed</span><span class="input-with-unit"><input id="shotSpeedField" type="number" min="1" max="20" step="0.1" value="${p.speedMps}"><small>m/s</small></span></label>
        <label class="field"><span>Spin</span><span class="input-with-unit"><input id="shotSpinField" type="number" min="-120" max="120" step="1" value="${p.spinRps}"><small>rps</small></span></label>
        <label class="field"><span>Elevation</span><span class="input-with-unit"><input id="shotElevationField" type="number" min="-20" max="45" step="0.5" value="${p.elevationDeg}"><small>°</small></span></label>
        <label class="field"><span>Aim left/right</span><span class="input-with-unit"><input id="shotAimField" type="number" min="-60" max="60" step="0.5" value="${p.aimDeg}"><small>°</small></span></label>
      </div>
      <div class="shot-view-stack">
        <div><p class="helper">Predicted top view</p>${topTrajectorySvg(prediction, 600, 310)}</div>
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
    const speedLevel = clamp(novaSpeedLevelFromMps(params.speedMps, calibration), 0, 10, 0);
    const maxSpinSetting = Math.max(0, interpolateNovaCurve(speedLevel, "maxSpinSetting", calibration));
    const maxSpinRps = Math.max(0, interpolateNovaCurve(speedLevel, "maxSpinRps", calibration));
    const requestedSpinRps = Math.abs(params.spinRps);
    const rawSpinSetting = maxSpinRps > .001
      ? requestedSpinRps / maxSpinRps * maxSpinSetting
      : 0;
    const limited = requestedSpinRps > maxSpinRps + .05;
    const spinMagnitude = clamp(rawSpinSetting, 0, maxSpinSetting, 0);
    const spinLevel = Math.sign(params.spinRps) * spinMagnitude;

    const base = nova.wheelBaseRpm + nova.wheelRpmPerSpeed * speedLevel;
    const delta = nova.wheelRpmPerSpin * spinLevel;
    const swapped = calibration.rotationType >= 4;
    const wheelA = Math.floor(swapped ? base - delta : base + delta);
    const wheelB = Math.floor(swapped ? base + delta : base - delta);
    const upDown = Math.round(clamp(
      nova.upDownAtZeroDeg + nova.upDownPerDegree * params.elevationDeg,
      -50,
      100,
      0
    ));
    const placement = clamp(params.aimDeg / nova.yawDegreesPerPlacement, -10, 10, 0);

    return {
      wheelA,
      wheelB,
      upDown,
      placement,
      speedLevel,
      spinLevel,
      maxSpinSetting,
      maxSpinRps,
      limited,
    };
  }

  function novaEstimateHtml(params) {
    const estimate = estimatedNovaSettings(params);
    return `<div class="nova-estimate">
      <span>Estimated Nova settings</span>
      <dl>
        <div><dt>Wheel A</dt><dd>${estimate.wheelA} rpm</dd></div>
        <div><dt>Wheel B</dt><dd>${estimate.wheelB} rpm</dd></div>
        <div><dt>Speed setting</dt><dd>${fmt(estimate.speedLevel,2)}</dd></div>
        <div><dt>Spin setting</dt><dd>${signed(estimate.spinLevel,2)}</dd></div>
        <div><dt>Up/down</dt><dd>${signed(estimate.upDown,0)}</dd></div>
        <div><dt>Placement</dt><dd>${signed(estimate.placement,2)}</dd></div>
      </dl>
      <p>${estimate.limited
        ? `Requested spin exceeds the calibrated capability at this speed (${fmt(estimate.maxSpinRps,1)} rps maximum); the motor estimate is clamped.`
        : `Converted through the editable Spinsight curve. Estimated spin capacity here is ${fmt(estimate.maxSpinRps,1)} rps.`}</p>
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

  function predictTrajectory(params, calibration = library.calibration) {
    const c = calibration;
    const table = c.table;
    const netX = table.length / 2;
    const ballRadius = c.physics.ballDiameterM / 2;
    const yaw = radians(c.pose.yawDeg + params.aimDeg);
    const elevation = radians(params.elevationDeg);
    let position = { x: c.pose.x, y: c.pose.y, z: c.nozzleHeight };
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

      if (previous.z > ballRadius && position.z <= ballRadius) {
        const ratio = (previous.z - ballRadius) / (previous.z - position.z || 1);
        landing = {
          x: previous.x + ratio * (position.x - previous.x),
          y: previous.y + ratio * (position.y - previous.y),
          z: ballRadius,
          t: t - c.timeStep + ratio * c.timeStep,
        };
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
    if (net.hit) status = "net";
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
    const yaw = radians(c.pose.yawDeg);
    const arrow = Math.max(18, tr.scale * .25);
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scale accurate top trajectory">
      <rect x="${tr.sx(0)}" y="${tr.sy(table.width/2)}" width="${tr.sx(table.length)-tr.sx(0)}" height="${tr.sy(-table.width/2)-tr.sy(table.width/2)}" rx="4" fill="#183e58" stroke="#7fa2bb" stroke-width="2"/>
      <line x1="${tr.sx(table.length/2)}" y1="${tr.sy(table.width/2)}" x2="${tr.sx(table.length/2)}" y2="${tr.sy(-table.width/2)}" stroke="#d4dbe5" stroke-width="3"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4"/>
      <circle cx="${rx}" cy="${ry}" r="7" fill="#32bda2" stroke="#d5fff6" stroke-width="2"/>
      <line x1="${rx}" y1="${ry}" x2="${rx + Math.cos(yaw)*arrow}" y2="${ry - Math.sin(yaw)*arrow}" stroke="#e4a84c" stroke-width="3"/>
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
    const pose = tab !== "table";
    els.calibrationPosePanel.hidden = !pose;
    els.calibrationTablePanel.hidden = pose;
    els.calibrationPoseTab.classList.toggle("active", pose);
    els.calibrationTableTab.classList.toggle("active", !pose);
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
        context.shots.push({
          drillId,
          nodeId: node.id,
          label: node.label,
          params: { ...node.params },
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
    const curve = c.nova.spinsightCurve;
    const minMps = curve[0].speedKmh / 3.6;
    const maxMps = curve.at(-1).speedKmh / 3.6;

    if (upDown < -50 - 1e-6 || upDown > 100 + 1e-6) {
      errors.push(`“${shot.label}”: elevation ${fmt(shot.params.elevationDeg,1)}° maps to Nova Up/down ${fmt(upDown,1)}, outside -50…100.`);
    }
    if (Math.abs(placement) > 10 + 1e-6) {
      errors.push(`“${shot.label}”: aim ${fmt(shot.params.aimDeg,1)}° maps to placement ${fmt(placement,1)}, outside -10…10.`);
    }
    if (shot.params.speedMps < minMps - .01 || shot.params.speedMps > maxMps + .01) {
      warnings.push(`“${shot.label}”: ${fmt(shot.params.speedMps,1)} m/s is outside the Spinsight speed curve (${fmt(minMps,1)}…${fmt(maxMps,1)} m/s); the nearest calibrated speed setting is used.`);
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

  function buildRobotExecutionPlan(compiled) {
    if (!Protocol) throw new Error("Protocol module is unavailable");
    if (!compiled.shots.length) throw new Error("This traversal contains no shots to send to the robot.");

    const warnings = [...compiled.warnings];
    const errors = [];
    const prepared = [];

    for (let index = 0; index < compiled.shots.length; index += 1) {
      const shot = compiled.shots[index];
      const preflight = robotShotPreflight(shot);
      errors.push(...preflight.errors);
      warnings.push(...preflight.warnings);

      // The fifth 32-bit field is frequency in Hz. Community stopwatch data
      // shows the pre-pause before this ball is 1/f: 0.5..1.5 Hz corresponds
      // to 2.00..0.667 s. Edge delays are therefore attached to the TARGET
      // shot, not the source shot.
      const timing = novaFrequencyForDelay(shot.delayBefore);
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
      if (current.length >= 6) {
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

    if (prepared.length > 6) {
      warnings.push("This set is split into batches of at most 6 balls for BLE/robot stability. A small Ready→Start transition overhead can be added at those chunk boundaries.");
    }

    return {
      trailingDelay: Math.max(0, finite(compiled.trailingDelay, 0)),
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

        // Compile every set independently so weighted choices are re-sampled and
        // every drill/sub-drill invocation gets fresh Repeater state.
        const compiled = compileRobotSet(drill.id);
        const plan = buildRobotExecutionPlan(compiled);
        if (!warningsShown && plan.warnings.length) {
          warningsShown = true;
          plan.warnings.forEach(message => robot.log(`Plan warning: ${message}`, "warn"));
          toast(plan.warnings[0]);
        }

        for (let batchIndex = 0; batchIndex < plan.batches.length; batchIndex += 1) {
          if (!playbackRunning || token !== playbackToken) break;
          const batch = plan.batches[batchIndex];
          if (batch.hostDelayBefore > 0) {
            await waitWithStatus(batch.hostDelayBefore, token, batchIndex === 0 ? "First shot in" : "Long edge delay");
            if (!playbackRunning || token !== playbackToken) break;
          }
          const firstShot = batch.shots[0];
          activeNodeRef = { drillId: firstShot.drillId, nodeId: firstShot.nodeId };
          activeEdgeRef = null;
          if (firstShot.drillId === activeDrill()?.id) renderGraph();
          els.runStatus.textContent = `Set ${currentNumber} · batch ${batchIndex + 1}/${plan.batches.length} · ${batch.shots.map(item => item.label).join(" → ")}`;
          const timeoutMs = Math.max(20000, Math.ceil((batch.encodedSeconds + 12) * 1000));
          await robot.startBatch(batch.packet, {
            timeoutMs,
            expectedDurationMs: batch.encodedSeconds * 1000,
            description: `set ${currentNumber}, batch ${batchIndex + 1}/${plan.batches.length} (${batch.shots.length} ball${batch.shots.length === 1 ? "" : "s"})`,
          });
          activeNodeRef = null;
          if (activeDrill()) renderGraph();
        }

        if (!playbackRunning || token !== playbackToken) break;
        if (plan.trailingDelay > 0) await waitWithStatus(plan.trailingDelay, token, "Finishing set in");
        if (!playbackRunning || token !== playbackToken) break;

        completed += 1;
        updateProgress(completed, configured, infinite, infinite ? `∞ · ${completed} sets completed` : `${completed} of ${configured} sets completed`);
        if (!playbackRunning || token !== playbackToken || (!infinite && completed >= configured)) break;
        await waitWithStatus(drill.settings.delayBetweenSets, token, "Next set in");
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

  function sleep(ms, token) {
    return new Promise(resolve => setTimeout(() => resolve(token === playbackToken), ms));
  }

  async function stopPlayback() {
    if (stopPromise) return stopPromise;
    const hadCalibrationTest = calibrationTestRunning;
    const needsRobotStop = Boolean(robot?.connected && robot.authenticated && robot.wireState !== 3 && robot.wireState !== 0 && robot.wireState != null);
    if (!playbackRunning && !calibrationTestRunning && !needsRobotStop) return;

    playbackRunning = false;
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
    const active = playbackRunning || calibrationTestRunning || robotIsActive();
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
        const p = node.params;
        context.events.push({ kind: "shot", title: node.label, detail: `${fmt(p.speedMps,1)} m/s · ${spinWords(p.spinRps)}` });
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
      if (edge.delaySeconds > 0) context.events.push({ kind: "delay", title: `Wait ${fmt(edge.delaySeconds,2)} seconds`, detail: `Before ${getNode(drill, edge.target)?.label || "next node"}` });
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
    if (!drill?.nodes.length) return;
    const minX = Math.min(...drill.nodes.map(n => n.x));
    const maxX = Math.max(...drill.nodes.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...drill.nodes.map(n => n.y));
    const maxY = Math.max(...drill.nodes.map(n => n.y + nodeHeight(drill, n)));

    const padding = 100;
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

  function createDrill() {
    const drill = defaultDrill(uniqueDrillName("Custom drill"));
    library.drills.push(drill);
    library.activeDrillId = drill.id;
    selection = null;
    commit({ message: "New drill created" });
  }

  function duplicateActiveDrill() {
    const source = activeDrill();
    if (!source) return;
    const clone = structuredClone(source);
    const idMap = new Map();
    clone.id = makeId("drill");
    clone.name = uniqueDrillName(`${source.name} copy`);
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
    clone.nodes.filter(n => n.type === "counter").forEach(n => n.clearOnNodeIds = n.clearOnNodeIds.map(id => idMap.get(id)).filter(Boolean));
    clone.startNodeId = idMap.get(source.startNodeId) ?? clone.nodes[0]?.id ?? null;
    library.drills.push(clone);
    library.activeDrillId = clone.id;
    selection = null;
    commit({ message: "Drill duplicated" });
  }

  function deleteActiveDrill() {
    const drill = activeDrill();
    if (!drill) return;
    if (library.drills.length <= 1) {
      toast("Keep at least one drill.");
      return;
    }
    askConfirm("Delete drill?", `Delete “${drill.name}”? Sub-drill nodes that reference it will become invalid.`, () => {
      library.drills = library.drills.filter(d => d.id !== drill.id);
      library.activeDrillId = library.drills[0]?.id ?? null;
      selection = null;
      commit({ message: "Drill deleted" });
    });
  }

  function restoreExampleLibrary() {
    askConfirm(
      "Load example drills?",
      "This replaces the locally saved drill library with the built-in examples. Export first if you need the current data.",
      () => {
        stopPlayback();
        library = makeSampleLibrary();
        selection = null;
        startupNotice = "Example drills restored.";
        commit({ message: "Example drills restored" });
        setTimeout(fitGraph, 40);
      }
    );
  }

  function exportLibrary() {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table-tennis-robot-studio-library.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Drill library exported");
  }

  function importLibrary(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        library = sanitizeLibrary(JSON.parse(String(reader.result)));
        selection = null;
        stopPlayback();
        commit({ message: "Drill library imported" });
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

    els.robotConnectBtn.textContent = snapshot.connected ? "Disconnect" : connecting ? "Connecting…" : "Connect Nova";
    els.robotConnectBtn.disabled = connecting;
    els.robotStatusText.textContent = label;
    els.robotStatusBtn.className = "robot-status-button";
    if (!snapshot.connected) els.robotStatusBtn.classList.add(snapshot.browserSupported ? "disconnected" : "unsupported");
    else if (snapshot.ready) els.robotStatusBtn.classList.add("ready");
    else if ([4, 6].includes(snapshot.wireState)) els.robotStatusBtn.classList.add("running");
    else if ([2, 5, 7].includes(snapshot.wireState)) els.robotStatusBtn.classList.add("busy");
    else if (snapshot.wireState === 202) els.robotStatusBtn.classList.add("error");
    else els.robotStatusBtn.classList.add("connected");

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
        if (playbackRunning || robotIsActive()) await stopPlayback();
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

  function bindEvents() {
    els.robotConnectBtn.addEventListener("click", () => { void connectOrDisconnectRobot(); });
    els.robotStatusBtn.addEventListener("click", () => { updateRobotUI(); els.robotDialog.showModal(); });
    els.closeRobotDialogBtn.addEventListener("click", () => els.robotDialog.close());
    els.robotRefreshStatusBtn.addEventListener("click", () => { void refreshRobotStatus(); });
    els.robotDisconnectBtn.addEventListener("click", () => { void disconnectRobotFromDialog(); });
    els.robotCopyLogBtn.addEventListener("click", () => { void copyRobotLog(); });
    if (robot) {
      robot.addEventListener("statechange", updateRobotUI);
      robot.addEventListener("log", event => appendRobotLog(event.detail));
      robot.addEventListener("disconnect", handleUnexpectedRobotDisconnect);
    }

    els.addShotBtn.addEventListener("click", () => addNode("shot"));
    els.addRandomBtn.addEventListener("click", () => addNode("random"));
    els.addDrillNodeBtn.addEventListener("click", () => addNode("drill"));
    els.addCounterBtn.addEventListener("click", () => addNode("counter"));
    els.deleteSelectionBtn.addEventListener("click", deleteSelection);
    els.fitBtn.addEventListener("click", fitGraph);
    els.newDrillBtn.addEventListener("click", createDrill);
    els.drillNameInput.addEventListener("change", () => {
      const drill = activeDrill();
      if (!drill) return;
      drill.name = uniqueDrillName(els.drillNameInput.value, drill.id);
      commit({ message: `Drill renamed to “${drill.name}”` });
    });
    els.duplicateDrillBtn.addEventListener("click", duplicateActiveDrill);
    els.deleteDrillBtn.addEventListener("click", deleteActiveDrill);
    els.resetExamplesBtn.addEventListener("click", restoreExampleLibrary);

    els.graphViewport.addEventListener("pointerdown", onCanvasPointerDown);
    els.graphViewport.addEventListener("wheel", onGraphWheel, { passive: false });
    els.graphSurface.addEventListener("click", () => {
      if (performance.now() < suppressClickUntil || connectionDrag) return;
      selection = null;
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
      saveLibrary();
    });
    els.playBtn.addEventListener("click", () => {
      if (playbackRunning || calibrationTestRunning || robotIsActive()) void stopPlayback();
      else void startPlayback();
    });

    els.calibrationBtn.addEventListener("click", () => {
      setCalibrationTab("pose");
      renderCalibration();
      els.calibrationDialog.showModal();
    });
    els.closeCalibrationBtn.addEventListener("click", () => els.calibrationDialog.close());
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

    els.confirmActionBtn.addEventListener("click", () => {
      const callback = confirmCallback;
      confirmCallback = null;
      if (callback) callback();
    });

    window.addEventListener("resize", () => renderGraph());
    window.addEventListener("beforeunload", event => {
      if (!playbackRunning && !calibrationTestRunning && !robotIsActive()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  try {
    assertRequiredElements();
    if (!Protocol || !RobotController || !robot) throw new Error("Pongbot protocol/BLE modules did not load");
    Protocol.selfTest();
    repairLibraryIfNeeded();
    bindEvents();
    els.graphWorld.style.transform = `scale(${graphZoom})`;
    els.graphSurface.style.width = `${SURFACE_WIDTH * graphZoom}px`;
    els.graphSurface.style.height = `${SURFACE_HEIGHT * graphZoom}px`;
    els.zoomIndicator.textContent = `${Math.round(graphZoom * 100)}%`;
    renderAll();
    updateRobotUI();
    updatePlayButton();
    appendRobotLog({ time: new Date(), direction: "info", message: "Protocol self-test passed; controller ready" });
    saveLibrary();
    if (startupNotice) setTimeout(() => toast(startupNotice), 100);
    setTimeout(fitGraph, 80);
  } catch (error) {
    showFatalError(error);
  }
})();
