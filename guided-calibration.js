(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GuidedCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BALL_DIAMETER_M = 0.04;
  const BALL_RADIUS_M = BALL_DIAMETER_M / 2;
  const BALL_MASS_KG = 0.0027;
  const GRAVITY = 9.80665;
  const AIR_TEMPERATURE_C = 20;
  const AIR_PRESSURE_KPA = 101.325;
  const DRY_AIR_GAS_CONSTANT = 287.05;
  const TABLE_LENGTH_M = 2.74;
  const TABLE_HEIGHT_M = 0.76;
  const NET_X_M = TABLE_LENGTH_M / 2;
  const NET_HEIGHT_M = 0.1525;
  const DRAG_SPEEDS = [2.5, 7.5, 12.5, 17.5];
  const DRAG_CD = [0.55, 0.49, 0.47, 0.47];
  const AIR_DENSITY = (AIR_PRESSURE_KPA * 1000) / (DRY_AIR_GAS_CONSTANT * (AIR_TEMPERATURE_C + 273.15));
  const BALL_AREA = Math.PI * Math.pow(BALL_DIAMETER_M / 2, 2);

  const USER_SEED_SPEED_MAP = [
    { raw: 2025, speedMps: 5.04 },
    { raw: 2167, speedMps: 5.39 },
    { raw: 2388, speedMps: 5.79 },
  ];

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, lo, hi, fallback = lo) {
    const n = finite(value, fallback);
    return Math.max(lo, Math.min(hi, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function simulateShot(options) {
    const speedMps = finite(options.speedMps, NaN);
    const elevationDeg = finite(options.elevationDeg, NaN);
    const placement = options.placement === "ground" ? "ground" : "table";
    // Coordinate origin depends on the calibration setup:
    //   table:  x=0 is the near table edge, z=0 is the tabletop.
    //   ground: x=0 is the back of the robot base, z=0 is the floor.
    // For ground calibration there is deliberately no table or net in the
    // forward model; the ball simply lands on the same flat ground plane.
    const nozzleX = finite(options.nozzleXFromNearEdgeM, 0.265);
    const nozzleHeight = finite(options.nozzleHeightM, 0.225);
    const tableLength = finite(options.tableLengthM, TABLE_LENGTH_M);
    const netX = finite(options.netXFromNearEdgeM, tableLength / 2);
    const netHeight = finite(options.netHeightM, NET_HEIGHT_M);
    const ballRadius = finite(options.ballRadiusM, BALL_RADIUS_M);
    const dt = clamp(options.dt, 0.001, 0.02, 0.004);
    const maxTime = clamp(options.maxTimeS, 0.5, 10, placement === "ground" ? 6 : 4);

    if (!(speedMps > 0) || !Number.isFinite(elevationDeg)) return { ok: false, reason: "invalid-input" };
    if (!(nozzleHeight > ballRadius)) return { ok: false, reason: "invalid-nozzle-height" };
    if (placement === "ground" && nozzleX < 0) return { ok: false, reason: "ground-nozzle-before-base-back" };

    const theta = elevationDeg * Math.PI / 180;
    let state = {
      x: nozzleX,
      z: nozzleHeight,
      vx: speedMps * Math.cos(theta),
      vz: speedMps * Math.sin(theta),
    };
    let t = 0;
    let netCenterZ = null;
    let roseAboveSupport = state.z > ballRadius;

    while (t < maxTime) {
      const previous = state;
      state = rk4Step(state, dt);
      t += dt;
      if (state.z > ballRadius) roseAboveSupport = true;

      if (placement === "table" && netCenterZ == null && previous.x <= netX && state.x >= netX) {
        const r = crossingFraction(previous.x, state.x, netX);
        netCenterZ = lerp(previous.z, state.z, r == null ? 0 : r);
      }

      // In both calibration setups the support/landing plane is z=0. The
      // difference is only the horizontal reference and whether a net exists.
      if (roseAboveSupport && previous.z > ballRadius && state.z <= ballRadius && state.vz < 0) {
        const r = crossingFraction(previous.z, state.z, ballRadius);
        const landingX = lerp(previous.x, state.x, r == null ? 0 : r);
        const landingT = t - dt + (r == null ? 0 : r) * dt;
        const netClearanceM = placement === "table" && netCenterZ != null ? netCenterZ - ballRadius - netHeight : null;
        return {
          ok: true,
          landingX,
          landingT,
          netCenterZ,
          netClearanceM,
          onTable: placement === "table" && landingX >= 0 && landingX <= tableLength,
          onGround: placement === "ground",
        };
      }

      const maxX = placement === "ground" ? nozzleX + 20 : tableLength + 6;
      if (state.x > maxX || state.x < nozzleX - 1 || state.z < -1.5 || state.z > 5) break;
    }
    return { ok: false, reason: "no-landing" };
  }

  function landingDistanceFromReference(simulation, reference, setup) {
    if (!simulation || !simulation.ok) return null;
    const key = String(reference || "net").toLowerCase();
    const netX = finite(setup.netXFromNearEdgeM, TABLE_LENGTH_M / 2);
    const nozzleX = finite(setup.nozzleXFromNearEdgeM, 0.265);
    if (key === "net") return simulation.landingX - netX;
    if (key === "near_edge" || key === "table_edge" || key === "edge" || key === "base_back") return simulation.landingX;
    if (key === "nozzle") return simulation.landingX - nozzleX;
    throw new Error(`Unknown distance reference: ${reference}`);
  }

  function fitLinearSpeedModel(speedMap = USER_SEED_SPEED_MAP) {
    const points = (speedMap || [])
      .map(point => ({ raw: finite(point?.raw, NaN), speedMps: finite(point?.speedMps, NaN) }))
      .filter(point => Number.isFinite(point.raw) && Number.isFinite(point.speedMps));
    if (points.length < 2) {
      const fallback = USER_SEED_SPEED_MAP;
      return fitLinearSpeedModel(fallback === speedMap ? [
        { raw: 2025, speedMps: 5.04 },
        { raw: 2388, speedMps: 5.79 },
      ] : fallback);
    }
    const meanRaw = points.reduce((sum, point) => sum + point.raw, 0) / points.length;
    const meanSpeed = points.reduce((sum, point) => sum + point.speedMps, 0) / points.length;
    const denominator = points.reduce((sum, point) => sum + Math.pow(point.raw - meanRaw, 2), 0);
    const slopeMpsPerRaw = denominator > 1e-12
      ? points.reduce((sum, point) => sum + (point.raw - meanRaw) * (point.speedMps - meanSpeed), 0) / denominator
      : 0;
    const interceptMps = meanSpeed - slopeMpsPerRaw * meanRaw;
    const rmseMps = Math.sqrt(points.reduce((sum, point) => {
      const residual = interceptMps + slopeMpsPerRaw * point.raw - point.speedMps;
      return sum + residual * residual;
    }, 0) / points.length);
    return { slopeMpsPerRaw, interceptMps, rmseMps, pointCount: points.length };
  }

  const USER_SEED_LINEAR_MODEL = fitLinearSpeedModel(USER_SEED_SPEED_MAP);

  function speedFromLinearModel(raw, model) {
    return model.interceptMps + model.slopeMpsPerRaw * finite(raw, 0);
  }

  function seedSpeedMps(raw) {
    return speedFromLinearModel(raw, USER_SEED_LINEAR_MODEL);
  }

  function linspace(start, end, count, roundToInteger) {
    const n = Math.max(1, Math.round(finite(count, 1)));
    if (n === 1) return [roundToInteger ? Math.round((start + end) / 2) : (start + end) / 2];
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const v = start + (end - start) * i / (n - 1);
      out.push(roundToInteger ? Math.round(v) : Math.round(v * 100) / 100);
    }
    return out;
  }

  function buildPlan(config) {
    const placement = config.placement === "ground" ? "ground" : "table";
    const elevationMin = finite(config.elevationMinDeg, placement === "ground" ? 5 : 10);
    const elevationMax = finite(config.elevationMaxDeg, placement === "ground" ? 45 : 30);
    const elevationCount = clamp(config.elevationCount, 2, 12, 5);
    const speedMin = finite(config.speedMinRaw, 2025);
    const speedMax = finite(config.speedMaxRaw, 2388);
    const speedCount = clamp(config.speedCount, 2, 8, 3);
    if (elevationMax < elevationMin) throw new Error("Maximum elevation must be at least the minimum elevation.");
    if (speedMax < speedMin) throw new Error("Maximum raw speed must be at least the minimum raw speed.");
    const elevations = linspace(elevationMin, elevationMax, elevationCount, false);
    const speeds = linspace(speedMin, speedMax, speedCount, true);

    // Group by speed so the wheels remain at one speed while several
    // elevations are measured. This is more stable than changing speed every shot.
    const shots = [];
    let index = 0;
    for (const rawSpeed of speeds) {
      for (const elevationDeg of elevations) {
        shots.push({
          id: `cal-${index + 1}`,
          index,
          rawSpeed,
          elevationDeg,
          distanceCm: null,
          netClearanceCm: null,
          saved: false,
        });
        index += 1;
      }
    }
    return { elevations, speeds, shots };
  }

  function normalizeMeasurement(row) {
    const rawSpeed = finite(row.rawSpeed, NaN);
    const elevationDeg = finite(row.elevationDeg, NaN);
    const distanceCm = row.distanceCm === "" || row.distanceCm == null ? null : finite(row.distanceCm, NaN);
    const netClearanceCm = row.netClearanceCm === "" || row.netClearanceCm == null ? null : finite(row.netClearanceCm, NaN);
    return {
      rawSpeed,
      elevationDeg,
      distanceM: Number.isFinite(distanceCm) ? distanceCm / 100 : null,
      netClearanceM: Number.isFinite(netClearanceCm) ? netClearanceCm / 100 : null,
    };
  }

  function goldenMinimize(fn, lo, hi, iterations = 34) {
    const gr = (Math.sqrt(5) - 1) / 2;
    let a = lo;
    let b = hi;
    let c = b - gr * (b - a);
    let d = a + gr * (b - a);
    let fc = fn(c);
    let fd = fn(d);
    for (let i = 0; i < iterations; i += 1) {
      if (fc < fd) {
        b = d; d = c; fd = fc; c = b - gr * (b - a); fc = fn(c);
      } else {
        a = c; c = d; fc = fd; d = a + gr * (b - a); fd = fn(d);
      }
    }
    const x = fc < fd ? c : d;
    return { x, value: Math.min(fc, fd) };
  }

  function shotLoss(measurement, speedMps, nozzleHeightM, setup) {
    const sim = simulateShot({
      speedMps,
      elevationDeg: measurement.elevationDeg,
      placement: setup.placement,
      nozzleXFromNearEdgeM: setup.nozzleXFromNearEdgeM,
      nozzleHeightM,
      tableHeightM: setup.tableHeightM,
      tableLengthM: setup.tableLengthM,
      netXFromNearEdgeM: setup.netXFromNearEdgeM,
      netHeightM: setup.netHeightM,
      dt: setup.dt || 0.004,
      maxTimeS: 5,
    });
    if (!sim.ok) return { loss: 1e6, sim };
    let loss = 0;
    let terms = 0;
    if (measurement.distanceM != null) {
      const predicted = landingDistanceFromReference(sim, setup.distanceReference, setup);
      const sigma = setup.distanceSigmaM || 0.015;
      const r = (predicted - measurement.distanceM) / sigma;
      loss += r * r;
      terms += 1;
    }
    if (measurement.netClearanceM != null) {
      if (sim.netClearanceM == null) return { loss: 1e6, sim };
      const sigma = setup.netClearanceSigmaM || 0.01;
      const r = (sim.netClearanceM - measurement.netClearanceM) / sigma;
      loss += r * r;
      terms += 1;
    }
    return { loss: terms ? loss : 0, sim };
  }

  function calibrate(rows, setupInput) {
    const placement = setupInput.placement === "ground" ? "ground" : "table";
    const setup = {
      placement,
      distanceReference: placement === "ground" ? "base_back" : (setupInput.distanceReference || "net"),
      // In table mode this is measured from the near table edge. In ground
      // mode it is measured from the back of the robot base.
      nozzleXFromNearEdgeM: finite(setupInput.nozzleXFromNearEdgeM, 0.265),
      tableHeightM: finite(setupInput.tableHeightM, TABLE_HEIGHT_M),
      tableLengthM: finite(setupInput.tableLengthM, TABLE_LENGTH_M),
      netXFromNearEdgeM: finite(setupInput.netXFromNearEdgeM, TABLE_LENGTH_M / 2),
      netHeightM: finite(setupInput.netHeightM, NET_HEIGHT_M),
      distanceSigmaM: clamp(setupInput.distanceSigmaM, 0.003, 0.10, 0.015),
      netClearanceSigmaM: clamp(setupInput.netClearanceSigmaM, 0.003, 0.10, 0.01),
      dt: clamp(setupInput.dt, 0.002, 0.01, 0.004),
    };
    const measurements = rows.map(normalizeMeasurement)
      .filter(m => Number.isFinite(m.rawSpeed) && Number.isFinite(m.elevationDeg))
      .map(m => placement === "ground" ? { ...m, netClearanceM: null } : m)
      .filter(m => m.distanceM != null || m.netClearanceM != null);
    if (!measurements.length) throw new Error("Enter at least some landing-distance measurements before computing calibration.");
    const rawSpeeds = [...new Set(measurements.map(m => m.rawSpeed))].sort((a, b) => a - b);
    const byRaw = new Map(rawSpeeds.map(raw => [raw, measurements.filter(m => m.rawSpeed === raw)]));
    for (const raw of rawSpeeds) {
      if (!byRaw.get(raw).some(m => m.distanceM != null)) {
        throw new Error(`Raw speed ${raw} needs at least one landing-distance measurement.`);
      }
    }
    const distinctElevations = [...new Set(measurements.filter(m => m.distanceM != null).map(m => m.elevationDeg))];
    if (distinctElevations.length < 2) throw new Error("Use at least two different elevations so nozzle height can be estimated.");

    const heightBounds = setup.placement === "ground" ? [0.10, 0.45] : [0.10, 0.45];
    const speedBounds = [2.5, 10.0];

    function fitAtHeight(nozzleHeightM) {
      // Profile the preferred speed independently at each measured raw command,
      // then regress those profile points to one straight motor law. The final
      // loss is evaluated with that line, so noisy measurements cannot create
      // artificial point-to-point bends in the speed mapping.
      const profiledSpeedMap = [];
      let dataTerms = 0;
      for (const raw of rawSpeeds) {
        const group = byRaw.get(raw);
        const objective = speed => {
          let sum = 0;
          for (const m of group) sum += shotLoss(m, speed, nozzleHeightM, setup).loss;
          return sum;
        };
        const seed = seedSpeedMps(raw);
        const coarse = goldenMinimize(objective, speedBounds[0], speedBounds[1], 30);
        const localLo = Math.max(speedBounds[0], Math.min(coarse.x, seed) - 0.8);
        const localHi = Math.min(speedBounds[1], Math.max(coarse.x, seed) + 0.8);
        const refined = goldenMinimize(objective, localLo, localHi, 24);
        profiledSpeedMap.push({ raw, speedMps: refined.x });
        for (const m of group) {
          if (m.distanceM != null) dataTerms += 1;
          if (m.netClearanceM != null) dataTerms += 1;
        }
      }

      const speedModel = fitLinearSpeedModel(profiledSpeedMap);
      let total = speedModel.slopeMpsPerRaw > 0 ? 0 : 1e5 + Math.pow(speedModel.slopeMpsPerRaw * 1e5, 2);
      const speedMap = rawSpeeds.map(raw => ({ raw, speedMps: speedFromLinearModel(raw, speedModel) }));
      for (const m of measurements) {
        total += shotLoss(m, speedFromLinearModel(m.rawSpeed, speedModel), nozzleHeightM, setup).loss;
      }
      return { total, speedMap, profiledSpeedMap, speedModel, dataTerms };
    }

    const heightObjective = h => fitAtHeight(h).total;
    // A coarse scan makes the 1-D optimization robust when ground-placement
    // geometry creates invalid regions.
    let bestH = heightBounds[0];
    let bestLoss = Infinity;
    const scanCount = 28;
    for (let i = 0; i < scanCount; i += 1) {
      const h = heightBounds[0] + (heightBounds[1] - heightBounds[0]) * i / (scanCount - 1);
      const loss = heightObjective(h);
      if (loss < bestLoss) { bestLoss = loss; bestH = h; }
    }
    const span = (heightBounds[1] - heightBounds[0]) / (scanCount - 1) * 2.5;
    const hFit = goldenMinimize(heightObjective, Math.max(heightBounds[0], bestH - span), Math.min(heightBounds[1], bestH + span), 30);
    const fitted = fitAtHeight(hFit.x);

    const speedMap = fitted.speedMap.map(p => ({ ...p }));
    const speedModel = { ...fitted.speedModel };
    const speedForRaw = raw => speedFromLinearModel(raw, speedModel);
    const residualRows = [];
    const distanceErrors = [];
    const clearanceErrors = [];
    for (const m of measurements) {
      const sim = simulateShot({
        speedMps: speedForRaw(m.rawSpeed),
        elevationDeg: m.elevationDeg,
        placement: setup.placement,
        nozzleXFromNearEdgeM: setup.nozzleXFromNearEdgeM,
        nozzleHeightM: hFit.x,
        tableHeightM: setup.tableHeightM,
        tableLengthM: setup.tableLengthM,
        netXFromNearEdgeM: setup.netXFromNearEdgeM,
        netHeightM: setup.netHeightM,
        dt: setup.dt,
        maxTimeS: 5,
      });
      const predictedDistanceM = sim.ok ? landingDistanceFromReference(sim, setup.distanceReference, setup) : null;
      const predictedClearanceM = sim.ok ? sim.netClearanceM : null;
      const distanceErrorM = m.distanceM != null && predictedDistanceM != null ? predictedDistanceM - m.distanceM : null;
      const clearanceErrorM = m.netClearanceM != null && predictedClearanceM != null ? predictedClearanceM - m.netClearanceM : null;
      if (distanceErrorM != null) distanceErrors.push(distanceErrorM);
      if (clearanceErrorM != null) clearanceErrors.push(clearanceErrorM);
      residualRows.push({ ...m, predictedDistanceM, predictedClearanceM, distanceErrorM, clearanceErrorM, simulation: sim });
    }
    const rms = arr => arr.length ? Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length) : null;
    const maxAbs = arr => arr.length ? Math.max(...arr.map(Math.abs)) : null;

    return {
      placement: setup.placement,
      nozzleHeightM: hFit.x,
      nozzleHeightReference: setup.placement === "ground" ? "ground" : "table",
      nozzleXReference: setup.placement === "ground" ? "base_back" : "near_edge",
      nozzleXFromNearEdgeM: setup.nozzleXFromNearEdgeM,
      speedMap,
      speedModel,
      profiledSpeedMap: fitted.profiledSpeedMap.map(point => ({ ...point })),
      speedModelRmseMps: speedModel.rmseMps,
      distanceRmseM: rms(distanceErrors),
      distanceMaxAbsM: maxAbs(distanceErrors),
      clearanceRmseM: rms(clearanceErrors),
      clearanceMaxAbsM: maxAbs(clearanceErrors),
      distanceCount: distanceErrors.length,
      clearanceCount: clearanceErrors.length,
      residualRows,
    };
  }

  function speedFromMap(raw, speedMap) {
    const model = fitLinearSpeedModel(speedMap && speedMap.length >= 2 ? speedMap : USER_SEED_SPEED_MAP);
    return speedFromLinearModel(raw, model);
  }

  function rawFromSpeed(speedMps, speedMap) {
    const model = fitLinearSpeedModel(speedMap && speedMap.length >= 2 ? speedMap : USER_SEED_SPEED_MAP);
    if (Math.abs(model.slopeMpsPerRaw) < 1e-12) return null;
    return (finite(speedMps, model.interceptMps) - model.interceptMps) / model.slopeMpsPerRaw;
  }

  return {
    constants: {
      BALL_DIAMETER_M,
      BALL_RADIUS_M,
      TABLE_LENGTH_M,
      TABLE_HEIGHT_M,
      NET_X_M,
      NET_HEIGHT_M,
      USER_SEED_SPEED_MAP,
      USER_SEED_LINEAR_MODEL,
    },
    fitLinearSpeedModel,
    simulateShot,
    landingDistanceFromReference,
    buildPlan,
    calibrate,
    seedSpeedMps,
    speedFromMap,
    rawFromSpeed,
  };
});
