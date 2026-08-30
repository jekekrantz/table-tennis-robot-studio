(function (root, factory) {
  let geometry = root.RobotGeometry;
  if (!geometry && typeof module === "object" && module.exports) {
    try { geometry = require("./robot-geometry.js"); } catch (_) {}
  }
  const api = factory(geometry);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GuidedCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (RobotGeometry) {
  "use strict";

  if (!RobotGeometry) throw new Error("robot-geometry.js must load before guided-calibration.js");

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
  const DEFAULT_DISTANCE_NOISE_PER_M = 0.015; // metres of SD per metre of predicted distance
  const DEFAULT_MAD_THRESHOLD = 3.5;
  const DEFAULT_MAX_MAD_ITERATIONS = 8;
  const MIN_SIN_INCIDENCE = 0.15;

  // Robust refit from the visible 2026-08-28 flat-ground calibration points.
  const USER_SEED_SPEED_MAP = [
    { raw: 2000, speedMps: 4.5114314001 },
    { raw: 2200, speedMps: 4.9901634909 },
    { raw: 2400, speedMps: 5.4688955818 },
    { raw: 2600, speedMps: 5.9476276726 },
    { raw: 2800, speedMps: 6.4263597635 },
    { raw: 3000, speedMps: 6.9050918544 },
  ];

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(value, lo, hi, fallback = lo) {
    const n = finite(value, fallback);
    return Math.max(lo, Math.min(hi, n));
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

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
    const placement = options.placement === "ground" ? "ground" : "table";
    const baseBackXFromNearEdgeM = finite(
      options.baseBackXFromNearEdgeM,
      Number.isFinite(Number(options.nozzleXFromNearEdgeM))
        ? finite(options.nozzleXFromNearEdgeM) - 0.392
        : 0
    );
    return {
      placement,
      baseBackXFromNearEdgeM: placement === "ground" ? 0 : baseBackXFromNearEdgeM,
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
    const elevation = elevationDeg * Math.PI / 180;
    let state = {
      x: release.x,
      z: release.z,
      vx: speedMps * Math.cos(elevation),
      vz: speedMps * Math.sin(elevation),
    };
    const groundPlane = BALL_RADIUS_M;
    let landing = null;
    let net = setup.placement === "table"
      ? { crossed: false, z: null, clearanceM: null }
      : null;
    let incidenceDeg = null;
    const maxTime = 5;
    for (let t = 0; t < maxTime && !landing; t += setup.dt) {
      const prev = state;
      const next = rk4Step(state, setup.dt);

      if (setup.placement === "table" && !net.crossed) {
        const fNet = crossingFraction(prev.x, next.x, setup.netXFromNearEdgeM);
        if (fNet != null && fNet >= 0 && fNet <= 1 && next.x >= prev.x) {
          const z = lerp(prev.z, next.z, fNet);
          net = {
            crossed: true,
            z,
            clearanceM: z - BALL_RADIUS_M - setup.netHeightM,
          };
        }
      }

      const fGround = crossingFraction(prev.z, next.z, groundPlane);
      if (fGround != null && fGround >= 0 && fGround <= 1 && next.z <= prev.z) {
        const x = lerp(prev.x, next.x, fGround);
        const vx = lerp(prev.vx, next.vx, fGround);
        const vz = lerp(prev.vz, next.vz, fGround);
        const incidence = Math.atan2(Math.abs(vz), Math.max(1e-12, Math.abs(vx)));
        incidenceDeg = incidence * 180 / Math.PI;

        if (setup.placement === "ground") {
          landing = { x, z: groundPlane, vx, vz, t: t + setup.dt * fGround };
        } else {
          // On-table calibration is only valid when the first tabletop bounce is
          // inside the table. A trajectory that falls before/after is unavailable.
          if (x >= 0 && x <= setup.tableLengthM) {
            landing = { x, z: groundPlane, vx, vz, t: t + setup.dt * fGround };
          } else {
            break;
          }
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
      case "nozzle":
      case "wheels": return simulation.releasePoint ? x - simulation.releasePoint.x : null;
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

  function speedFromMap(raw, map = USER_SEED_SPEED_MAP) {
    const sorted = (map || []).slice().sort((a, b) => a.raw - b.raw);
    if (!sorted.length) return seedSpeedMps(raw);
    if (sorted.length === 1) return finite(sorted[0].speedMps, 5);
    const x = finite(raw, sorted[0].raw);
    if (x <= sorted[0].raw) {
      const a = sorted[0], b = sorted[1];
      return a.speedMps + (x - a.raw) * (b.speedMps - a.speedMps) / (b.raw - a.raw);
    }
    for (let i = 1; i < sorted.length; i += 1) {
      if (x <= sorted[i].raw) {
        const a = sorted[i - 1], b = sorted[i];
        return a.speedMps + (x - a.raw) * (b.speedMps - a.speedMps) / (b.raw - a.raw);
      }
    }
    const a = sorted[sorted.length - 2], b = sorted[sorted.length - 1];
    return b.speedMps + (x - b.raw) * (b.speedMps - a.speedMps) / (b.raw - a.raw);
  }

  function seedSpeedMps(raw) {
    return speedFromMap(raw, USER_SEED_SPEED_MAP);
  }

  function rawFromSpeed(speedMps, map = USER_SEED_SPEED_MAP) {
    const sorted = (map || []).slice().sort((a, b) => a.speedMps - b.speedMps);
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0].raw;
    const y = finite(speedMps, sorted[0].speedMps);
    const pair = y <= sorted[0].speedMps
      ? [sorted[0], sorted[1]]
      : y >= sorted[sorted.length - 1].speedMps
        ? [sorted[sorted.length - 2], sorted[sorted.length - 1]]
        : (() => {
            for (let i = 1; i < sorted.length; i += 1) if (y <= sorted[i].speedMps) return [sorted[i - 1], sorted[i]];
            return [sorted[sorted.length - 2], sorted[sorted.length - 1]];
          })();
    const [a, b] = pair;
    return a.raw + (y - a.speedMps) * (b.raw - a.raw) / (b.speedMps - a.speedMps);
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
    const speedMinRaw = Math.round(clamp(options.speedMinRaw, 400, 7500, setup.placement === "ground" ? 2000 : 2025));
    const speedMaxRaw = Math.round(clamp(options.speedMaxRaw, 400, 7500, setup.placement === "ground" ? 3000 : 2388));
    const speedCount = Math.round(clamp(options.speedCount, 2, 8, setup.placement === "ground" ? 6 : 3));
    const speedMap = Array.isArray(options.speedMap) && options.speedMap.length ? options.speedMap : USER_SEED_SPEED_MAP;
    const elevations = linspace(elevationMinDeg, elevationMaxDeg, elevationCount);
    const raws = linspace(speedMinRaw, speedMaxRaw, speedCount).map(Math.round);
    const shots = [];

    for (const rawSpeed of raws) {
      for (const elevationDeg of elevations) {
        const speedMps = speedFromMap(rawSpeed, speedMap);
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

    // Walking is the dominant workflow cost: visit approximately nearest-to-farthest.
    // Unavailable predictions go at the end and then sort stably by raw/elevation.
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

  function fitLinearSpeedModel(points) {
    const valid = (points || []).filter(p => Number.isFinite(p?.raw) && Number.isFinite(p?.speedMps));
    if (valid.length < 2) throw new Error("Need at least two wheel-input levels to fit launch speed.");
    const meanX = valid.reduce((s, p) => s + p.raw, 0) / valid.length;
    const meanY = valid.reduce((s, p) => s + p.speedMps, 0) / valid.length;
    const denom = valid.reduce((s, p) => s + Math.pow(p.raw - meanX, 2), 0);
    const slope = denom > 1e-12
      ? valid.reduce((s, p) => s + (p.raw - meanX) * (p.speedMps - meanY), 0) / denom
      : 0;
    const intercept = meanY - slope * meanX;
    const rmse = Math.sqrt(valid.reduce((s, p) => {
      const e = intercept + slope * p.raw - p.speedMps;
      return s + e * e;
    }, 0) / valid.length);
    return { interceptMps: intercept, slopeMpsPerRaw: slope, rmseMps: rmse };
  }

  function goldenSectionMin(fn, lo, hi, iterations = 36) {
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
    const measurementSigma = Number.isFinite(predictedDistanceM) && Number.isFinite(simulation?.incidenceDeg)
      ? measurementSigmaM(predictedDistanceM, simulation.incidenceDeg, setup)
      : null;
    return {
      simulation,
      predictedDistanceM,
      predictedClearanceM,
      measurementSigmaM: measurementSigma,
      incidenceDeg: simulation?.incidenceDeg ?? null,
      distanceErrorM: row.distanceM != null && Number.isFinite(predictedDistanceM) ? predictedDistanceM - row.distanceM : null,
      clearanceErrorM: row.netClearanceM != null && Number.isFinite(predictedClearanceM) ? predictedClearanceM - row.netClearanceM : null,
    };
  }

  function profileSpeedForRaw(rows, raw, setup) {
    const group = rows.filter(r => r.rawSpeed === raw && (r.distanceM != null || r.netClearanceM != null));
    if (!group.length) return null;
    const objective = speed => {
      let loss = 0, count = 0;
      for (const row of group) {
        const e = evaluateRow(row, speed, setup);
        if (row.distanceM != null && e.distanceErrorM != null) {
          loss += Math.pow(e.distanceErrorM / Math.max(0.005, e.measurementSigmaM || 0.02), 2);
          count += 1;
        }
        if (row.netClearanceM != null && e.clearanceErrorM != null) {
          loss += Math.pow(e.clearanceErrorM / setup.netClearanceSigmaM, 2);
          count += 1;
        }
      }
      return count ? loss / count : 1e12;
    };
    return goldenSectionMin(objective, 2, 15, 42);
  }

  function objectiveForLine(rows, activeSet, centerRaw, centerSpeed, slope, setup) {
    let loss = 0, count = 0;
    for (const row of rows) {
      if (!activeSet.has(row.index)) continue;
      const speed = centerSpeed + slope * (row.rawSpeed - centerRaw);
      if (speed < 1 || speed > 20) return 1e12;
      const e = evaluateRow(row, speed, setup);
      if (row.distanceM != null && e.distanceErrorM != null) {
        const sigma = Math.max(0.005, e.measurementSigmaM || 0.02);
        loss += Math.pow(e.distanceErrorM / sigma, 2);
        count += 1;
      }
      if (row.netClearanceM != null && e.clearanceErrorM != null) {
        loss += Math.pow(e.clearanceErrorM / setup.netClearanceSigmaM, 2);
        count += 1;
      }
    }
    return count ? loss / count : 1e12;
  }

  function fitSpeedLine(rows, activeSet, setup, previous = null) {
    const activeRows = rows.filter(r => activeSet.has(r.index) && r.distanceM != null);
    const uniqueRaws = [...new Set(activeRows.map(r => r.rawSpeed))].sort((a, b) => a - b);
    if (activeRows.length < 4 || uniqueRaws.length < 2) {
      throw new Error("Need at least four landing distances across at least two wheel-input levels.");
    }
    const centerRaw = activeRows.reduce((s, r) => s + r.rawSpeed, 0) / activeRows.length;
    let centerSpeed, slope;

    if (previous) {
      slope = previous.slope;
      centerSpeed = previous.centerSpeed + previous.slope * (centerRaw - previous.centerRaw);
    } else {
      const profiled = uniqueRaws.map(raw => ({ raw, speedMps: profileSpeedForRaw(rows.filter(r => activeSet.has(r.index)), raw, setup) }))
        .filter(p => Number.isFinite(p.speedMps));
      const linear = fitLinearSpeedModel(profiled);
      slope = linear.slopeMpsPerRaw;
      centerSpeed = linear.interceptMps + linear.slopeMpsPerRaw * centerRaw;
    }

    slope = clamp(slope, 0.00005, 0.01, 0.0024);
    centerSpeed = clamp(centerSpeed, 2, 15, 5.7);

    for (let pass = 0; pass < 10; pass += 1) {
      const cSpan = pass < 2 ? 1.0 : Math.max(0.02, 0.5 / Math.pow(1.8, pass - 1));
      centerSpeed = goldenSectionMin(
        c => objectiveForLine(rows, activeSet, centerRaw, c, slope, setup),
        Math.max(1.5, centerSpeed - cSpan),
        Math.min(18, centerSpeed + cSpan),
        34
      );
      const sSpan = pass < 2 ? 0.0015 : Math.max(0.00001, 0.0007 / Math.pow(1.8, pass - 1));
      slope = goldenSectionMin(
        s => objectiveForLine(rows, activeSet, centerRaw, centerSpeed, s, setup),
        Math.max(0.00001, slope - sSpan),
        Math.min(0.012, slope + sSpan),
        34
      );
    }

    return {
      centerRaw,
      centerSpeed,
      slope,
      interceptMps: centerSpeed - slope * centerRaw,
      slopeMpsPerRaw: slope,
    };
  }

  function summarizeDistanceResiduals(rows) {
    const valid = (rows || []).filter(r => Number.isFinite(r?.distanceErrorM));
    if (!valid.length) return null;
    const meanErrorM = valid.reduce((s, r) => s + r.distanceErrorM, 0) / valid.length;
    function trend(key) {
      const pts = valid.filter(r => Number.isFinite(Number(r[key])));
      if (pts.length < 2) return null;
      const mx = pts.reduce((s, r) => s + Number(r[key]), 0) / pts.length;
      const my = pts.reduce((s, r) => s + r.distanceErrorM, 0) / pts.length;
      const den = pts.reduce((s, r) => s + Math.pow(Number(r[key]) - mx, 2), 0);
      if (den < 1e-12) return null;
      return pts.reduce((s, r) => s + (Number(r[key]) - mx) * (r.distanceErrorM - my), 0) / den;
    }
    return {
      meanErrorM,
      elevationTrendMPerDeg: trend("elevationDeg"),
      speedTrendMPerRaw: trend("rawSpeed"),
    };
  }

  function calibrate(shots, options = {}) {
    const setup = setupDefaults(options);
    const rows = preparedRows(shots, setup);
    const distanceRows = rows.filter(r => r.distanceM != null);
    if (distanceRows.length < 4 || new Set(distanceRows.map(r => r.rawSpeed)).size < 2) {
      throw new Error("Need at least four landing distances across at least two wheel-input levels.");
    }

    let activeSet = new Set(distanceRows.map(r => r.index));
    const rejectionIteration = new Map();
    let line = null;
    let madIterations = 0;
    let robustCenter = null;
    let robustScale = null;

    for (let iteration = 0; iteration < setup.maxMadIterations; iteration += 1) {
      line = fitSpeedLine(rows, activeSet, setup, line);
      const standardized = [];
      for (const row of distanceRows) {
        if (!activeSet.has(row.index)) continue;
        const speed = line.interceptMps + line.slopeMpsPerRaw * row.rawSpeed;
        const e = evaluateRow(row, speed, setup);
        if (e.distanceErrorM != null && e.measurementSigmaM != null) {
          standardized.push({ row, z: e.distanceErrorM / e.measurementSigmaM });
        }
      }
      const center = median(standardized.map(item => item.z));
      const mad = median(standardized.map(item => Math.abs(item.z - center)));
      const scale = Math.max(1e-9, 1.4826 * finite(mad, 0));
      robustCenter = center;
      robustScale = scale;
      const threshold = setup.madThreshold * scale;
      const candidates = standardized
        .filter(item => Math.abs(item.z - center) > threshold)
        .sort((a, b) => Math.abs(b.z - center) - Math.abs(a.z - center));

      if (!candidates.length) {
        madIterations = iteration + 1;
        break;
      }

      let removed = 0;
      for (const item of candidates) {
        const next = new Set(activeSet);
        next.delete(item.row.index);
        const remaining = distanceRows.filter(r => next.has(r.index));
        if (remaining.length < 4 || new Set(remaining.map(r => r.rawSpeed)).size < 2) continue;
        activeSet = next;
        rejectionIteration.set(item.row.index, iteration + 1);
        removed += 1;
      }
      madIterations = iteration + 1;
      if (!removed) break;
    }

    line = fitSpeedLine(rows, activeSet, setup, line);

    const residualRows = rows.map(row => {
      const speedMps = line.interceptMps + line.slopeMpsPerRaw * row.rawSpeed;
      const e = evaluateRow(row, speedMps, setup);
      const z = e.distanceErrorM != null && e.measurementSigmaM != null
        ? e.distanceErrorM / e.measurementSigmaM
        : null;
      return {
        rawSpeed: row.rawSpeed,
        elevationDeg: row.elevationDeg,
        enteredDistanceM: row.enteredDistanceM,
        distanceM: row.distanceM,
        predictedDistanceM: e.predictedDistanceM,
        distanceErrorM: e.distanceErrorM,
        measurementSigmaM: e.measurementSigmaM,
        incidenceDeg: e.incidenceDeg,
        standardizedResidual: z,
        included: row.distanceM == null ? null : activeSet.has(row.index),
        rejectionIteration: rejectionIteration.get(row.index) || null,
        netClearanceM: row.netClearanceM,
        predictedClearanceM: e.predictedClearanceM,
        clearanceErrorM: e.clearanceErrorM,
      };
    });

    const includedResiduals = residualRows.filter(r => r.included && Number.isFinite(r.distanceErrorM));
    const allResiduals = residualRows.filter(r => Number.isFinite(r.distanceErrorM));
    const clearanceResiduals = residualRows.filter(r => Number.isFinite(r.clearanceErrorM));
    const rmse = list => list.length ? Math.sqrt(list.reduce((s, r) => s + r.distanceErrorM * r.distanceErrorM, 0) / list.length) : null;
    const distanceRmseM = rmse(includedResiduals);
    const distanceAllRmseM = rmse(allResiduals);
    const distanceMaxAbsM = includedResiduals.length ? Math.max(...includedResiduals.map(r => Math.abs(r.distanceErrorM))) : null;
    const clearanceRmseM = clearanceResiduals.length
      ? Math.sqrt(clearanceResiduals.reduce((s, r) => s + r.clearanceErrorM * r.clearanceErrorM, 0) / clearanceResiduals.length)
      : null;
    const clearanceMaxAbsM = clearanceResiduals.length ? Math.max(...clearanceResiduals.map(r => Math.abs(r.clearanceErrorM))) : null;

    const uniqueRaws = [...new Set(distanceRows.map(r => r.rawSpeed))].sort((a, b) => a - b);
    const speedMap = uniqueRaws.map(raw => ({
      raw,
      speedMps: line.interceptMps + line.slopeMpsPerRaw * raw,
    }));
    const profiledSpeedMap = uniqueRaws.map(raw => ({
      raw,
      speedMps: profileSpeedForRaw(rows.filter(r => activeSet.has(r.index)), raw, setup),
    })).filter(p => Number.isFinite(p.speedMps));
    const profileErrors = profiledSpeedMap.map(p => (line.interceptMps + line.slopeMpsPerRaw * p.raw) - p.speedMps);
    const speedModelRmseMps = profileErrors.length
      ? Math.sqrt(profileErrors.reduce((s, e) => s + e * e, 0) / profileErrors.length)
      : null;

    // Legacy aliases are kept so an older app shell can still display a result.
    const referenceRelease = releasePointForShot(0, setup);
    return {
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
      speedMap,
      speedModel: {
        interceptMps: line.interceptMps,
        slopeMpsPerRaw: line.slopeMpsPerRaw,
      },
      profiledSpeedMap,
      speedModelRmseMps,
      distanceRmseM,
      distanceAllRmseM,
      distanceMaxAbsM,
      distanceCount: includedResiduals.length,
      distanceAllCount: allResiduals.length,
      distanceRejectedCount: allResiduals.length - includedResiduals.length,
      clearanceRmseM,
      clearanceMaxAbsM,
      clearanceCount: clearanceResiduals.length,
      distanceDiagnostics: summarizeDistanceResiduals(includedResiduals),
      residualRows,

      nozzleHeightM: referenceRelease.z,
      nozzleHeightReference: setup.placement === "ground" ? "ground" : "table",
      nozzleXReference: "base_back",
      nozzleXFromNearEdgeM: referenceRelease.x - setup.baseBackXFromNearEdgeM,
    };
  }

  return Object.freeze({
    fitLinearSpeedModel,
    simulateShot,
    landingDistanceFromReference,
    measurementSigmaM,
    buildPlan,
    calibrate,
    seedSpeedMps,
    speedFromMap,
    rawFromSpeed,
    summarizeDistanceResiduals,
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
      USER_SEED_SPEED_MAP,
    }),
  });
});
