(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DeveloperShotAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DB_NAME = "table-tennis-robot-studio-developer-media";
  const DB_VERSION = 1;
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    retainLogs: false,
    retainVideo: false,
    retainImages: false,
    captureAudio: true,
    cameraSide: "left",
    cameraDistanceCm: 50,
    cameraHeightAboveNetCm: 30,
    cameraPitchDeg: 2,
    datasetRepetitions: 10,
    datasetIntervalSeconds: 1.25,
    calibration: null,
  });

  const LANDMARK_KEYS = Object.freeze([
    "nearLeft",
    "nearRight",
    "farRight",
    "farLeft",
    "netTopLeft",
    "netTopRight",
  ]);

  const LANDMARK_LABELS = Object.freeze([
    "robot-end corner nearer the camera",
    "robot-end corner farther from the camera",
    "player-end corner farther from the camera",
    "player-end corner nearer the camera",
    "top of the net post nearer the camera",
    "top of the net post farther from the camera",
  ]);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function normalizePoint(point) {
    return {
      x: clamp(finite(point?.x, 0), 0, 1),
      y: clamp(finite(point?.y, 0), 0, 1),
    };
  }

  function normalizeCalibration(raw) {
    if (!raw || !Array.isArray(raw.landmarks) || raw.landmarks.length < 4) return null;
    const landmarks = raw.landmarks.slice(0, LANDMARK_KEYS.length).map(normalizePoint);
    const homography = Array.isArray(raw.homography) && raw.homography.length === 9
      ? raw.homography.map(value => finite(value, 0))
      : null;
    return {
      landmarks,
      homography,
      camera: raw.camera && typeof raw.camera === "object" ? { ...raw.camera } : {},
      cameraSide: raw.cameraSide === "right" ? "right" : "left",
      updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    };
  }

  function sanitizeSettings(raw = {}) {
    return {
      enabled: Boolean(raw.enabled),
      retainLogs: Boolean(raw.retainLogs),
      retainVideo: Boolean(raw.retainVideo),
      retainImages: Boolean(raw.retainImages),
      captureAudio: raw.captureAudio !== false,
      cameraSide: raw.cameraSide === "right" ? "right" : "left",
      cameraDistanceCm: Math.round(clamp(finite(raw.cameraDistanceCm, 50), 30, 150) / 10) * 10,
      cameraHeightAboveNetCm: Math.round(clamp(finite(raw.cameraHeightAboveNetCm, 30), 0, 100) / 5) * 5,
      cameraPitchDeg: Math.round(clamp(finite(raw.cameraPitchDeg, 2), -15, 20)),
      datasetRepetitions: Math.round(clamp(finite(raw.datasetRepetitions, 10), 1, 20)),
      datasetIntervalSeconds: Math.round(clamp(finite(raw.datasetIntervalSeconds, 1.25), .7, 2) * 100) / 100,
      calibration: normalizeCalibration(raw.calibration),
    };
  }

  // Rotate each block so every condition occupies every ordinal position before
  // the pattern repeats. The interval remains fixed while time drift is spread
  // across conditions instead of being correlated with one shot type.
  function balancedDatasetSchedule(conditionIds, repetitions = 10) {
    const ids = Array.isArray(conditionIds) ? conditionIds.map(String).filter(Boolean) : [];
    if (!ids.length) return [];
    const count = Math.round(clamp(finite(repetitions, 10), 1, 20));
    const schedule = [];
    for (let repetition = 0; repetition < count; repetition += 1) {
      const offset = repetition % ids.length;
      for (let position = 0; position < ids.length; position += 1) {
        schedule.push({
          sampleIndex: schedule.length + 1,
          repetition: repetition + 1,
          position: position + 1,
          conditionId: ids[(position + offset) % ids.length],
        });
      }
    }
    return schedule;
  }

  function solveLinearSystem(matrix, values) {
    const size = values.length;
    const augmented = matrix.map((row, index) => row.slice().concat(values[index]));
    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < size; row += 1) {
        if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
      }
      if (Math.abs(augmented[pivot][column]) < 1e-10) throw new Error("Table landmarks do not define a stable camera mapping.");
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
      const scale = augmented[column][column];
      for (let index = column; index <= size; index += 1) augmented[column][index] /= scale;
      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = augmented[row][column];
        for (let index = column; index <= size; index += 1) augmented[row][index] -= factor * augmented[column][index];
      }
    }
    return augmented.map(row => row[size]);
  }

  // Maps normalized image coordinates to table-plane metres. Table x runs
  // from the robot-side edge to the player-side edge and y is positive left.
  function tableHomography(landmarks, table = { length: 2.74, width: 1.525 }, cameraSide = "left") {
    if (!Array.isArray(landmarks) || landmarks.length < 4) throw new Error("Mark all four table corners first.");
    const image = landmarks.slice(0, 4).map(normalizePoint);
    const nearY = cameraSide === "right" ? -table.width / 2 : table.width / 2;
    const farY = -nearY;
    const world = [
      { x: 0, y: nearY },
      { x: 0, y: farY },
      { x: table.length, y: farY },
      { x: table.length, y: nearY },
    ];
    const rows = [];
    const values = [];
    image.forEach((point, index) => {
      const target = world[index];
      rows.push([point.x, point.y, 1, 0, 0, 0, -target.x * point.x, -target.x * point.y]);
      values.push(target.x);
      rows.push([0, 0, 0, point.x, point.y, 1, -target.y * point.x, -target.y * point.y]);
      values.push(target.y);
    });
    return solveLinearSystem(rows, values).concat(1);
  }

  function projectToTable(homography, point) {
    if (!Array.isArray(homography) || homography.length !== 9) return null;
    const p = normalizePoint(point);
    const denominator = homography[6] * p.x + homography[7] * p.y + homography[8];
    if (Math.abs(denominator) < 1e-10) return null;
    return {
      x: (homography[0] * p.x + homography[1] * p.y + homography[2]) / denominator,
      y: (homography[3] * p.x + homography[4] * p.y + homography[5]) / denominator,
    };
  }

  function preferredRecorderMimeType(MediaRecorderClass) {
    if (!MediaRecorderClass) return "";
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    return candidates.find(type => !MediaRecorderClass.isTypeSupported || MediaRecorderClass.isTypeSupported(type)) || "";
  }

  function cameraHorizontalFovDeg(camera, fallback = 78) {
    const sensorWidthMm = finite(camera?.physicalSizeMm?.width, 0);
    const activeFocalLengthMm = finite(camera?.activeFocalLengthMm, 0);
    const focalLengthMm = activeFocalLengthMm > 0 ? activeFocalLengthMm : Array.isArray(camera?.focalLengthsMm)
      ? camera.focalLengthsMm.map(value => finite(value, 0)).find(value => value > 0)
      : 0;
    if (!(sensorWidthMm > 0) || !(focalLengthMm > 0)) return clamp(finite(fallback, 78), 20, 160);
    return clamp(2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * 180 / Math.PI, 20, 160);
  }

  function calibrationMatchesCamera(calibration, cameraId) {
    if (!calibration) return false;
    const calibratedId = calibration.camera?.cameraId;
    if (calibratedId == null || calibratedId === "" || cameraId == null || cameraId === "") return true;
    return String(calibratedId) === String(cameraId);
  }

  function openArtifactDatabase(indexedDb = typeof indexedDB === "undefined" ? null : indexedDB) {
    if (!indexedDb) return Promise.reject(new Error("IndexedDB is unavailable."));
    return new Promise((resolve, reject) => {
      const request = indexedDb.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error("Could not open developer artifact storage."));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
        if (!db.objectStoreNames.contains("artifacts")) {
          const store = db.createObjectStore("artifacts", { keyPath: "id" });
          store.createIndex("sessionId", "sessionId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Developer artifact storage failed."));
    });
  }

  async function putSession(session, indexedDb) {
    const db = await openArtifactDatabase(indexedDb);
    try {
      const transaction = db.transaction("sessions", "readwrite");
      await requestResult(transaction.objectStore("sessions").put(session));
    } finally {
      db.close();
    }
    return session;
  }

  async function putArtifact(artifact, indexedDb) {
    const db = await openArtifactDatabase(indexedDb);
    try {
      const transaction = db.transaction("artifacts", "readwrite");
      await requestResult(transaction.objectStore("artifacts").put(artifact));
    } finally {
      db.close();
    }
    return artifact;
  }

  async function listSessions(indexedDb) {
    const db = await openArtifactDatabase(indexedDb);
    try {
      const transaction = db.transaction("sessions", "readonly");
      const sessions = await requestResult(transaction.objectStore("sessions").getAll());
      return sessions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } finally {
      db.close();
    }
  }

  async function clearArtifacts(indexedDb) {
    const db = await openArtifactDatabase(indexedDb);
    try {
      const transaction = db.transaction(["sessions", "artifacts"], "readwrite");
      await Promise.all([
        requestResult(transaction.objectStore("sessions").clear()),
        requestResult(transaction.objectStore("artifacts").clear()),
      ]);
    } finally {
      db.close();
    }
  }

  return Object.freeze({
    DB_NAME,
    DEFAULT_SETTINGS,
    LANDMARK_KEYS,
    LANDMARK_LABELS,
    sanitizeSettings,
    normalizeCalibration,
    tableHomography,
    projectToTable,
    balancedDatasetSchedule,
    preferredRecorderMimeType,
    cameraHorizontalFovDeg,
    calibrationMatchesCamera,
    putSession,
    putArtifact,
    listSessions,
    clearArtifacts,
  });
});
