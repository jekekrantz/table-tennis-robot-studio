(function (root, factory) {
  let geometry = root.RobotGeometry;
  let launchModel = root.NovaLaunchModel;
  if (typeof module === "object" && module.exports) {
    if (!geometry) { try { geometry = require("./robot-geometry.js"); } catch (_) {} }
    if (!launchModel) { try { launchModel = require("./launch-model.js"); } catch (_) {} }
  }
  const api = factory(geometry, launchModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GuidedCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (RobotGeometry, LaunchModel) {
  "use strict";

  if (!RobotGeometry) throw new Error("robot-geometry.js must load before guided-calibration.js");
  if (!LaunchModel) throw new Error("launch-model.js must load before guided-calibration.js");

  const BALL_DIAMETER_M = 0.04;
  const BALL_RADIUS_M = BALL_DIAMETER_M / 2;
  const BALL_MASS_KG = 0.0027;
  const GRAVITY = 9.80665;
  const AIR_TEMPERATURE_C = 20;
  const AIR_PRESSURE_KPA = 101.325;
  const DRY_AIR_GAS_CONSTANT = 287.05;
  const TABLE_LENGTH_M = 2.74;
  const NET_X_M = TABLE_LENGTH_M / 2;
  const NET_HEIGHT_M = 0.1525;
  const DRAG_SPEEDS = [2.5, 7.5, 12.5, 17.5];
  const DRAG_CD = [0.55, 0.49, 0.47, 0.47];
  const AIR_DENSITY = (AIR_PRESSURE_KPA * 1000) / (DRY_AIR_GAS_CONSTANT * (AIR_TEMPERATURE_C + 273.15));
  const BALL_AREA = Math.PI * Math.pow(BALL_DIAMETER_M / 2, 2);
  const DEFAULT_DISTANCE_NOISE_PER_M = 0.015;
  const DEFAULT_MAD_THRESHOLD = 3.5;
  const DEFAULT_MAX_MAD_ITERATIONS = 8;
  const MIN_SIN_INCIDENCE = 0.15;

  const USER_SEED_SPEED_MODEL = LaunchModel.constants.DEFAULT_LINEAR_EXIT_MODEL;

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(value, lo, hi, fallback = lo) {
    const n = finite(value, fallback);
    return Math.max(lo, Math.min(hi, n));
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function radians(deg) { return finite(deg, 0) * Math.PI / 180; }

  function normalizeSpeedModel(model = USER_SEED_SPEED_MODEL) {
    return LaunchModel.sanitizeLinearModel(model || USER_SEED_SPEED_MODEL);
  }

  function speedMpsFromRaw(raw, model = USER_SEED_SPEED_MODEL) {
    return LaunchModel.exitSpeedFromRaw(raw, model);
  }

  function rawFromSpeedMps(speedMps, model = USER_SEED_SPEED_MODEL) {
    return LaunchModel.rawFromExitSpeed(speedMps, model);
  }

  function interpolate(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i += 1) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return lerp(ys[i - 1], ys[i], t);
      }
    }
    return ys[ys.length - 1];
  }

  function dragCoefficient(speed) {
    return interpolate(DRAG_SPEEDS, DRAG_CD, Math.max(0, speed));
  }

  function acceleration(vx, vz) {
    const speed = Math.hypot(vx, vz);
    if (speed < 1e-12) return { ax: 0, az: -GRAVITY };
    const cd = dragCoefficient(speed);
    const dragFactor = -0.5 * cd * AIR_DENSITY * BALL_AREA * speed / BALL_MASS_KG;
    return { ax: dragFactor * vx, az: dragFactor * vz - GRAVITY };
  }

  function rk4Step(state, dt) {
    const a1 = acceleration(state.vx, state.vz);
    const vx2 = state.vx + a1.ax * dt / 2;
    const vz2 = state.vz + a1.az * dt / 2;
    const a2 = acceleration(vx2, vz2);
    const vx3 = state.vx + a2.ax * dt / 2;
    const vz3 = state.vz + a2.az * dt / 2;
    const a3 = acceleration(vx3, vz3);
    const vx4 = state.vx + a3.ax * dt;
    const vz4 = state.vz + a3.az * dt;
    const a4 = acceleration(vx4, vz4);
    return {
      x: state.x + dt * (state.vx + 2 * vx2 + 2 * vx3 + vx4) / 6,
      z: state.z + dt * (state.vz + 2 * vz2 + 2 * vz3 + vz4) / 6,
      vx: state.vx + dt * (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax) / 6,
      vz: state.vz + dt * (a1.az + 2 * a2.az + 2 * a3.az + a4.az) / 6,
    };
  }

  function crossingFraction(a, b, plane) {
    if ((a <= plane && b >= plane) || (a >= plane && b <= plane)) {
      const den = b - a;
      return Math.abs(den) < 1e-12 ? 0 : (plane - a) / den;
    }
    return null;
  }

  function setupDefaults(options = {}) {
    const placement = options.placement === "table" ? "table" : "ground";
    return {
      placement,
      baseBackXFromNearEdgeM: placement === "ground" ? 0 : finite(options.baseBackXFromNearEdgeM, 0),
      baseBackYFromCentreM: finite(options.baseBackYFromCentreM, 0),
      baseYawDeg: finite(options.baseYawDeg, 0),
      aimDeg: finite(options.aimDeg, 0),
      tableLengthM: finite(options.tableLengthM, TABLE_LENGTH_M),
      netXFromNearEdgeM: finite(options.netXFromNearEdgeM, NET_X_M),
      netHeightM: finite(options.netHeightM, NET_HEIGHT_M),
      distanceReference: placement === "ground" ? "base_back" : (options.distanceReference || "net"),
      measurementOffsetM: finite(options.measurementOffsetM, 0),
      distanceNoisePerM: clamp(options.distanceNoisePerM, 1e-5, 0.25, DEFAULT_DISTANCE_NOISE_PER_M),
      netClearanceSigmaM: clamp(options.netClearanceSigmaM, 0.001, 0.2, 0.01),
      madThreshold: clamp(options.madThreshold, 2, 10, DEFAULT_MAD_THRESHOLD),
      maxMadIterations: Math.round(clamp(options.maxMadIterations, 1, 20, DEFAULT_MAX_MAD_ITERATIONS)),
      dt: clamp(options.dt, 0.001, 0.02, 0.004),
    };
  }

  function releasePointForShot(elevationDeg, setup) {
    return RobotGeometry.releasePoint({
      baseX: setup.baseBackXFromNearEdgeM,
      baseY: setup.baseBackYFromCentreM,
      baseYawDeg: setup.baseYawDeg,
      aimDeg: setup.aimDeg,
      elevationDeg,
      supportZ: 0,
    });
  }

  function simulateShot(options = {}) {
    const speedMps = finite(options.speedMps, NaN);
    const elevationDeg = finite(options.elevationDeg, NaN);
    if (!Number.isFinite(speedMps) || !Number.isFinite(elevationDeg) || speedMps <= 0) {
      return { landing: null, net: null, releasePoint: null, incidenceDeg: null };
    }
    const setup = setupDefaults(options);
    const release = releasePointForShot(elevationDeg, setup);
    const elevation = radians(elevationDeg);
    let state = {
      x: release.x,
      z: release.z,
      vx: speedMps * Math.cos(elevation),
      vz: speedMps * Math.sin(elevation),
    };
    const supportPlane = BALL_RADIUS_M;
    let landing = null;
    let net = setup.placement === "table" ? { crossed: false, z: null, clearanceM: null } : null;
    let incidenceDeg = null;
    const maxTime = 5;

    for (let t = 0; t < maxTime && !landing; t += setup.dt) {
      const prev = state;
      const next = rk4Step(state, setup.dt);

      if (setup.placement === "table" && !net.crossed) {
        const fNet = crossingFraction(prev.x, next.x, setup.netXFromNearEdgeM);
        if (fNet != null && fNet >= 0 && fNet <= 1 && next.x >= prev.x) {
          const z = lerp(prev.z, next.z, fNet);
          net = { crossed: true, z, clearanceM: z - BALL_RADIUS_M - setup.netHeightM };
        }
      }

      const fSupport = crossingFraction(prev.z, next.z, supportPlane);
      if (fSupport != null && fSupport >= 0 && fSupport <= 1 && next.z <= prev.z) {
        const x = lerp(prev.x, next.x, fSupport);
        const vx = lerp(prev.vx, next.vx, fSupport);
        const vz = lerp(prev.vz, next.vz, fSupport);
        incidenceDeg = Math.atan2(Math.abs(vz), Math.max(1e-12, Math.abs(vx))) * 180 / Math.PI;
        if (setup.placement === "ground" || (x >= 0 && x <= setup.tableLengthM)) {
          landing = { x, z: supportPlane, vx, vz, t: t + setup.dt * fSupport };
        } else {
          break;
        }
      }
      state = next;
    }

    return { landing, net, releasePoint: release, incidenceDeg };
  }

  function landingDistanceFromReference(simulation, options = {}) {
    if (!simulation?.landing) return null;
    const setup = setupDefaults(options);
    const x = simulation.landing.x;
    switch (setup.distanceReference) {
      case "base_back": return x - setup.baseBackXFromNearEdgeM;
      case "near_edge": return x;
      case "wheels":
      case "nozzle": return simulation.releasePoint ? x - simulation.releasePoint.x : null;
      case "net":
      default: return x - setup.netXFromNearEdgeM;
    }
  }

  function measurementSigmaM(predictedDistanceM, incidenceDeg, options = {}) {
    const setup = setupDefaults(options);
    const incidenceRad = Math.abs(finite(incidenceDeg, 0)) * Math.PI / 180;
    const sinIncidence = Math.max(MIN_SIN_INCIDENCE, Math.sin(incidenceRad));
    const distance = Math.max(0.25, Math.abs(finite(predictedDistanceM, 0.25)));
    return setup.distanceNoisePerM * distance / sinIncidence;
  }

  function linspace(a, b, count) {
    if (count <= 1) return [a];
    return Array.from({ length: count }, (_, i) => a + (b - a) * i / (count - 1));
  }

  function buildPlan(options = {}) {
    const setup = setupDefaults(options);
    const elevationMinDeg = finite(options.elevationMinDeg, setup.placement === "ground" ? 5 : 10);
    const elevationMaxDeg = finite(options.elevationMaxDeg, setup.placement === "ground" ? 45 : 30);
    const elevationCount = Math.round(clamp(options.elevationCount, 2, 12, 5));
    const speedMinRaw = Math.round(clamp(options.speedMinRaw, 100, 7500, setup.placement === "ground" ? 2000 : 2000));
    const speedMaxRaw = Math.round(clamp(options.speedMaxRaw, 100, 7500, setup.placement === "ground" ? 3000 : 3000));
    const speedCount = Math.round(clamp(options.speedCount, 2, 8, setup.placement === "ground" ? 6 : 3));
    const speedModel = normalizeSpeedModel(options.speedModel || USER_SEED_SPEED_MODEL);
    const elevations = linspace(elevationMinDeg, elevationMaxDeg, elevationCount);
    const raws = linspace(speedMinRaw, speedMaxRaw, speedCount).map(Math.round);
    const shots = [];

    for (const rawSpeed of raws) {
      for (const elevationDeg of elevations) {
        const speedMps = speedMpsFromRaw(rawSpeed, speedModel);
        const simulation = simulateShot({ ...setup, speedMps, elevationDeg });
        const predictedDistanceM = landingDistanceFromReference(simulation, setup);
        shots.push({
          id: `cal-${shots.length + 1}`,
          index: shots.length,
          rawSpeed,
          elevationDeg,
          predictedDistanceM,
          distanceCm: null,
          netClearanceCm: null,
          saved: false,
        });
      }
    }

    shots.sort((a, b) => {
      const ad = Number.isFinite(a.predictedDistanceM) ? a.predictedDistanceM : Infinity;
      const bd = Number.isFinite(b.predictedDistanceM) ? b.predictedDistanceM : Infinity;
      return ad - bd || a.rawSpeed - b.rawSpeed || a.elevationDeg - b.elevationDeg;
    });
    shots.forEach((shot, index) => { shot.id = `cal-${index + 1}`; shot.index = index; });
    return { shots, elevations, raws };
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function goldenSectionMin(fn, lo, hi, iterations = 34) {
    const phi = (Math.sqrt(5) - 1) / 2;
    let a = lo, b = hi;
    let c = b - phi * (b - a);
    let d = a + phi * (b - a);
    let fc = fn(c), fd = fn(d);
    for (let i = 0; i < iterations; i += 1) {
      if (fc <= fd) {
        b = d; d = c; fd = fc; c = b - phi * (b - a); fc = fn(c);
      } else {
        a = c; c = d; fc = fd; d = a + phi * (b - a); fd = fn(d);
      }
    }
    return (a + b) / 2;
  }

  function preparedRows(shots, setup) {
    return (shots || []).map((shot, index) => {
      const enteredDistanceM = shot?.distanceCm == null || shot?.distanceCm === "" ? null : finite(shot.distanceCm, NaN) / 100;
      const netClearanceM = shot?.netClearanceCm == null || shot?.netClearanceCm === "" ? null : finite(shot.netClearanceCm, NaN) / 100;
      return {
        index,
        rawSpeed: finite(shot?.rawSpeed, NaN),
        elevationDeg: finite(shot?.elevationDeg, NaN),
        enteredDistanceM: Number.isFinite(enteredDistanceM) ? enteredDistanceM : null,
        distanceM: Number.isFinite(enteredDistanceM) ? enteredDistanceM + setup.measurementOffsetM : null,
        netClearanceM: Number.isFinite(netClearanceM) ? netClearanceM : null,
      };
    }).filter(row => Number.isFinite(row.rawSpeed) && Number.isFinite(row.elevationDeg));
  }

  function evaluateRow(row, speedMps, setup) {
    const simulation = simulateShot({ ...setup, speedMps, elevationDeg: row.elevationDeg });
    const predictedDistanceM = landingDistanceFromReference(simulation, setup);
    const predictedClearanceM = simulation?.net?.crossed ? simulation.net.clearanceM : null;
    const sigma = Number.isFinite(predictedDistanceM) && Number.isFinite(simulation?.incidenceDeg)
      ? measurementSigmaM(predictedDistanceM, simulation.incidenceDeg, setup)
      : null;
    return {
      predictedDistanceM,
      predictedClearanceM,
      measurementSigmaM: sigma,
      incidenceDeg: simulation?.incidenceDeg ?? null,
      distanceErrorM: row.distanceM != null && Number.isFinite(predictedDistanceM) ? predictedDistanceM - row.distanceM : null,
      clearanceErrorM: row.netClearanceM != null && Number.isFinite(predictedClearanceM) ? predictedClearanceM - row.netClearanceM : null,
    };
  }

  function lineObjective(rows, activeSet, centerRaw, centerSpeed, slope, setup) {
    let loss = 0;
    let terms = 0;
    for (const row of rows) {
      if (!activeSet.has(row.index)) continue;
      const speed = centerSpeed + slope * (row.rawSpeed - centerRaw);
      if (!(speed > 0.5 && speed < 25)) return 1e15;
      const e = evaluateRow(row, speed, setup);
      if (row.distanceM != null && e.distanceErrorM != null) {
        const sigma = Math.max(0.005, e.measurementSigmaM || 0.02);
        loss += Math.pow(e.distanceErrorM / sigma, 2);
        terms += 1;
      }
      if (row.netClearanceM != null && e.clearanceErrorM != null) {
        loss += Math.pow(e.clearanceErrorM / setup.netClearanceSigmaM, 2);
        terms += 1;
      }
    }
    return terms ? loss / terms : 1e15;
  }

  // Direct two-parameter fit. No independent speed is estimated at each raw value.
  function fitSpeedLine(rows, activeSet, setup, seedModel = USER_SEED_SPEED_MODEL) {
    const activeRows = rows.filter(row => activeSet.has(row.index) && row.distanceM != null);
    if (activeRows.length < 4 || new Set(activeRows.map(row => row.rawSpeed)).size < 2) {
      throw new Error("Need at least four landing distances across at least two wheel-input levels.");
    }
    const centerRaw = activeRows.reduce((sum, row) => sum + row.rawSpeed, 0) / activeRows.length;
    const seed = normalizeSpeedModel(seedModel);
    let slope = clamp(seed.slopeMpsPerRaw, 0.00001, 0.012, USER_SEED_SPEED_MODEL.slopeMpsPerRaw);
    let centerSpeed = speedMpsFromRaw(centerRaw, seed);

    for (let pass = 0; pass < 11; pass += 1) {
      const centerSpan = pass < 2 ? 1.5 : Math.max(0.01, 0.8 / Math.pow(1.8, pass - 1));
      centerSpeed = goldenSectionMin(
        value => lineObjective(rows, activeSet, centerRaw, value, slope, setup),
        Math.max(0.5, centerSpeed - centerSpan),
        Math.min(25, centerSpeed + centerSpan),
        36
      );
      const slopeSpan = pass < 2 ? 0.0018 : Math.max(0.000002, 0.0008 / Math.pow(1.8, pass - 1));
      slope = goldenSectionMin(
        value => lineObjective(rows, activeSet, centerRaw, centerSpeed, value, setup),
        Math.max(0.00001, slope - slopeSpan),
        Math.min(0.012, slope + slopeSpan),
        36
      );
    }

    return {
      interceptMps: centerSpeed - slope * centerRaw,
      slopeMpsPerRaw: slope,
      calibratedRawMin: Math.min(...activeRows.map(row => row.rawSpeed)),
      calibratedRawMax: Math.max(...activeRows.map(row => row.rawSpeed)),
    };
  }

  function summarizeDistanceResiduals(rows) {
    const valid = (rows || []).filter(row => Number.isFinite(row?.distanceErrorM));
    if (!valid.length) return null;
    const meanErrorM = valid.reduce((sum, row) => sum + row.distanceErrorM, 0) / valid.length;
    function trend(key) {
      const points = valid.filter(row => Number.isFinite(Number(row[key])));
      if (points.length < 2) return null;
      const mx = points.reduce((sum, row) => sum + Number(row[key]), 0) / points.length;
      const my = points.reduce((sum, row) => sum + row.distanceErrorM, 0) / points.length;
      const den = points.reduce((sum, row) => sum + Math.pow(Number(row[key]) - mx, 2), 0);
      if (den < 1e-12) return null;
      return points.reduce((sum, row) => sum + (Number(row[key]) - mx) * (row.distanceErrorM - my), 0) / den;
    }
    return { meanErrorM, elevationTrendMPerDeg: trend("elevationDeg"), speedTrendMPerRaw: trend("rawSpeed") };
  }

  function calibrate(shots, options = {}) {
    const setup = setupDefaults(options);
    const rows = preparedRows(shots, setup);
    const distanceRows = rows.filter(row => row.distanceM != null);
    if (distanceRows.length < 4 || new Set(distanceRows.map(row => row.rawSpeed)).size < 2) {
      throw new Error("Need at least four landing distances across at least two wheel-input levels.");
    }

    let activeSet = new Set(distanceRows.map(row => row.index));
    const rejectionIteration = new Map();
    let speedModel = normalizeSpeedModel(options.speedModel || USER_SEED_SPEED_MODEL);
    let robustCenter = null;
    let robustScale = null;
    let madIterations = 0;

    for (let iteration = 0; iteration < setup.maxMadIterations; iteration += 1) {
      speedModel = fitSpeedLine(rows, activeSet, setup, speedModel);
      const standardized = [];
      for (const row of distanceRows) {
        if (!activeSet.has(row.index)) continue;
        const evaluation = evaluateRow(row, speedMpsFromRaw(row.rawSpeed, speedModel), setup);
        if (evaluation.distanceErrorM != null && evaluation.measurementSigmaM != null) {
          standardized.push({ row, z: evaluation.distanceErrorM / evaluation.measurementSigmaM });
        }
      }
      robustCenter = median(standardized.map(item => item.z));
      const mad = median(standardized.map(item => Math.abs(item.z - robustCenter)));
      robustScale = Math.max(1e-9, 1.4826 * finite(mad, 0));
      const threshold = setup.madThreshold * robustScale;
      const candidates = standardized
        .filter(item => Math.abs(item.z - robustCenter) > threshold)
        .sort((a, b) => Math.abs(b.z - robustCenter) - Math.abs(a.z - robustCenter));

      madIterations = iteration + 1;
      if (!candidates.length) break;
      let removed = 0;
      for (const item of candidates) {
        const next = new Set(activeSet);
        next.delete(item.row.index);
        const remaining = distanceRows.filter(row => next.has(row.index));
        if (remaining.length < 4 || new Set(remaining.map(row => row.rawSpeed)).size < 2) continue;
        activeSet = next;
        rejectionIteration.set(item.row.index, iteration + 1);
        removed += 1;
      }
      if (!removed) break;
    }

    speedModel = fitSpeedLine(rows, activeSet, setup, speedModel);
    const residualRows = rows.map(row => {
      const speedMps = speedMpsFromRaw(row.rawSpeed, speedModel);
      const e = evaluateRow(row, speedMps, setup);
      return {
        rawSpeed: row.rawSpeed,
        elevationDeg: row.elevationDeg,
        enteredDistanceM: row.enteredDistanceM,
        distanceM: row.distanceM,
        predictedDistanceM: e.predictedDistanceM,
        distanceErrorM: e.distanceErrorM,
        measurementSigmaM: e.measurementSigmaM,
        incidenceDeg: e.incidenceDeg,
        standardizedResidual: e.distanceErrorM != null && e.measurementSigmaM != null ? e.distanceErrorM / e.measurementSigmaM : null,
        included: row.distanceM == null ? null : activeSet.has(row.index),
        rejectionIteration: rejectionIteration.get(row.index) || null,
        netClearanceM: row.netClearanceM,
        predictedClearanceM: e.predictedClearanceM,
        clearanceErrorM: e.clearanceErrorM,
      };
    });

    const included = residualRows.filter(row => row.included && Number.isFinite(row.distanceErrorM));
    const all = residualRows.filter(row => Number.isFinite(row.distanceErrorM));
    const clearance = residualRows.filter(row => Number.isFinite(row.clearanceErrorM));
    const rmse = list => list.length ? Math.sqrt(list.reduce((sum, row) => sum + row.distanceErrorM * row.distanceErrorM, 0) / list.length) : null;

    return {
      modelKind: "affine-raw-speed-v1",
      placement: setup.placement,
      geometryReference: RobotGeometry.GEOMETRY_REFERENCE,
      geometry: RobotGeometry.constants,
      baseBackXFromNearEdgeM: setup.baseBackXFromNearEdgeM,
      measurementOffsetM: setup.measurementOffsetM,
      distanceNoisePerM: setup.distanceNoisePerM,
      madThreshold: setup.madThreshold,
      madIterations,
      robustCenter,
      robustScale,
      speedModel: { ...speedModel },
      distanceRmseM: rmse(included),
      distanceAllRmseM: rmse(all),
      distanceMaxAbsM: included.length ? Math.max(...included.map(row => Math.abs(row.distanceErrorM))) : null,
      distanceCount: included.length,
      distanceAllCount: all.length,
      distanceRejectedCount: all.length - included.length,
      clearanceRmseM: clearance.length ? Math.sqrt(clearance.reduce((sum, row) => sum + row.clearanceErrorM * row.clearanceErrorM, 0) / clearance.length) : null,
      clearanceMaxAbsM: clearance.length ? Math.max(...clearance.map(row => Math.abs(row.clearanceErrorM))) : null,
      clearanceCount: clearance.length,
      distanceDiagnostics: summarizeDistanceResiduals(included),
      residualRows,
    };
  }

  return Object.freeze({
    constants: Object.freeze({
      BALL_DIAMETER_M,
      BALL_RADIUS_M,
      BALL_MASS_KG,
      GRAVITY,
      TABLE_LENGTH_M,
      NET_X_M,
      NET_HEIGHT_M,
      DEFAULT_DISTANCE_NOISE_PER_M,
      DEFAULT_MAD_THRESHOLD,
      MIN_SIN_INCIDENCE,
      USER_SEED_SPEED_MODEL,
    }),
    normalizeSpeedModel,
    speedMpsFromRaw,
    rawFromSpeedMps,
    simulateShot,
    landingDistanceFromReference,
    measurementSigmaM,
    buildPlan,
    calibrate,
    summarizeDistanceResiduals,
  });
});
