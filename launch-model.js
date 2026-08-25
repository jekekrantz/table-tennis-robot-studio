(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NovaLaunchModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RAW_BASE = 969.9321047526674;
  const RAW_PER_SPEED_LEVEL = 630.455868089234;
  const RAW_DELTA_PER_SPIN_LEVEL = 342.036255843120;

  const LOCAL_EXIT_SPEED_MAP = [
    { raw: 2025, speedMps: 5.04 },
    { raw: 2167, speedMps: 5.39 },
    { raw: 2388, speedMps: 5.79 },
  ];

  const SPINSIGHT_MEASURED_CURVE = [
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

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function interpolateCurve(x, points, xField, yField) {
    const sorted = points.slice().sort((a, b) => a[xField] - b[xField]);
    if (!sorted.length) return null;
    if (x <= sorted[0][xField]) return sorted[0][yField];
    for (let i = 1; i < sorted.length; i += 1) {
      const right = sorted[i];
      const left = sorted[i - 1];
      if (x <= right[xField]) {
        const span = right[xField] - left[xField];
        const t = span ? (x - left[xField]) / span : 0;
        return lerp(left[yField], right[yField], t);
      }
    }
    return sorted[sorted.length - 1][yField];
  }

  function rawFromLevel(level) { return RAW_BASE + RAW_PER_SPEED_LEVEL * finite(level, 0); }
  function levelFromRaw(raw) { return (finite(raw, RAW_BASE) - RAW_BASE) / RAW_PER_SPEED_LEVEL; }
  function spinsightSpeedMpsAtLevel(level) {
    return interpolateCurve(level, SPINSIGHT_MEASURED_CURVE, "level", "speedKmh") / 3.6;
  }

  // Spinsight reports in-flight speed, whereas the local trajectory calibration
  // estimates nozzle-exit speed. Fit one affine overlap correction before using
  // the Spinsight table as an external source for the command/speed relation.
  function fitInFlightToExitCorrection(localMap = LOCAL_EXIT_SPEED_MAP) {
    const pairs = localMap.map(point => ({
      x: spinsightSpeedMpsAtLevel(levelFromRaw(point.raw)),
      y: point.speedMps,
    })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (pairs.length < 2) return { slope: 1, interceptMps: 0 };
    const meanX = pairs.reduce((s, p) => s + p.x, 0) / pairs.length;
    const meanY = pairs.reduce((s, p) => s + p.y, 0) / pairs.length;
    const denom = pairs.reduce((s, p) => s + Math.pow(p.x - meanX, 2), 0);
    const slope = denom > 1e-12
      ? pairs.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / denom
      : 1;
    return { slope, interceptMps: meanY - slope * meanX };
  }

  const EXIT_CORRECTION = fitInFlightToExitCorrection();
  function correctionFor(localMap) { return localMap ? fitInFlightToExitCorrection(localMap) : EXIT_CORRECTION; }
  function estimatedExitSpeedAtLevel(level, localMap = null) {
    const corr = correctionFor(localMap);
    return corr.interceptMps + corr.slope * spinsightSpeedMpsAtLevel(level);
  }

  // Keep the source points available for diagnostics and re-fitting, but do not
  // interpolate through them for normal operation. The measured SpinSight curve
  // is quantized/noisy enough that point-to-point interpolation creates artificial
  // flats and slope changes in a motor system that is expected to be close to linear.
  function combinedExitSpeedCurve(localMap = LOCAL_EXIT_SPEED_MAP) {
    const external = SPINSIGHT_MEASURED_CURVE.map(point => ({
      raw: rawFromLevel(point.level),
      speedMps: estimatedExitSpeedAtLevel(point.level, localMap),
      source: "spinsight-corrected",
      level: point.level,
    }));
    const local = localMap.map(point => ({ ...point, source: "local-trajectory" }));
    return external.concat(local).sort((a, b) => a.raw - b.raw);
  }

  function fitLinearExitModel(localMap = LOCAL_EXIT_SPEED_MAP) {
    const points = combinedExitSpeedCurve(localMap)
      .filter(point => Number.isFinite(point.raw) && Number.isFinite(point.speedMps));
    if (points.length < 2) {
      return {
        slopeMpsPerRaw: 0.0013339412562561616,
        interceptMps: 2.4319583819816337,
        rmseMps: 0,
        pointCount: points.length,
        minRaw: 1915.6159068865184,
        maxRaw: 7274.490785645007,
      };
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
    return {
      slopeMpsPerRaw,
      interceptMps,
      rmseMps,
      pointCount: points.length,
      minRaw: Math.min(...points.map(point => point.raw)),
      maxRaw: Math.max(...points.map(point => point.raw)),
    };
  }

  const DEFAULT_LINEAR_EXIT_MODEL = fitLinearExitModel();
  function linearModelFor(localMap) { return localMap ? fitLinearExitModel(localMap) : DEFAULT_LINEAR_EXIT_MODEL; }

  function exitSpeedFromRaw(raw, localMap = null) {
    const model = linearModelFor(localMap);
    const boundedRaw = clamp(finite(raw, model.minRaw), model.minRaw, model.maxRaw);
    return model.interceptMps + model.slopeMpsPerRaw * boundedRaw;
  }

  function rawFromExitSpeed(speedMps, localMap = null) {
    const model = linearModelFor(localMap);
    const minMps = model.interceptMps + model.slopeMpsPerRaw * model.minRaw;
    const maxMps = model.interceptMps + model.slopeMpsPerRaw * model.maxRaw;
    const target = clamp(finite(speedMps, minMps), Math.min(minMps, maxMps), Math.max(minMps, maxMps));
    if (Math.abs(model.slopeMpsPerRaw) < 1e-12) return model.minRaw;
    return clamp((target - model.interceptMps) / model.slopeMpsPerRaw, model.minRaw, model.maxRaw);
  }

  function exitSpeedRange(localMap = null) {
    const model = linearModelFor(localMap);
    const a = model.interceptMps + model.slopeMpsPerRaw * model.minRaw;
    const b = model.interceptMps + model.slopeMpsPerRaw * model.maxRaw;
    return {
      minMps: Math.min(a, b),
      maxMps: Math.max(a, b),
      minRaw: model.minRaw,
      maxRaw: model.maxRaw,
    };
  }

  function spinCapacityAtLevel(level) {
    return {
      maxSpinSetting: Math.max(0, interpolateCurve(level, SPINSIGHT_MEASURED_CURVE, "level", "maxSpinSetting")),
      maxSpinRps: Math.max(0, interpolateCurve(level, SPINSIGHT_MEASURED_CURVE, "level", "maxSpinRps")),
    };
  }
  function spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity = false } = {}) {
    const cap = spinCapacityAtLevel(level);
    if (cap.maxSpinSetting <= 1e-9 || cap.maxSpinRps <= 1e-9) return 0;
    const sign = Math.sign(finite(spinSetting, 0));
    let magnitude = Math.abs(finite(spinSetting, 0));
    if (clampToMeasuredCapacity) magnitude = Math.min(magnitude, cap.maxSpinSetting);
    return sign * magnitude / cap.maxSpinSetting * cap.maxSpinRps;
  }
  function spinSettingFromRps(level, spinRps, { clampToMeasuredCapacity = true } = {}) {
    const cap = spinCapacityAtLevel(level);
    if (cap.maxSpinSetting <= 1e-9 || cap.maxSpinRps <= 1e-9) return 0;
    const sign = Math.sign(finite(spinRps, 0));
    let magnitude = Math.abs(finite(spinRps, 0)) / cap.maxSpinRps * cap.maxSpinSetting;
    if (clampToMeasuredCapacity) magnitude = Math.min(magnitude, cap.maxSpinSetting);
    return sign * magnitude;
  }
  function spinRpsFromRawWheels(wheelA, wheelB) {
    const a = finite(wheelA, RAW_BASE);
    const b = finite(wheelB, RAW_BASE);
    const level = levelFromRaw((a + b) / 2);
    const spinSetting = (a - b) / (2 * RAW_DELTA_PER_SPIN_LEVEL);
    return spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity: false });
  }

  return {
    constants: {
      RAW_BASE,
      RAW_PER_SPEED_LEVEL,
      RAW_DELTA_PER_SPIN_LEVEL,
      LOCAL_EXIT_SPEED_MAP,
      SPINSIGHT_MEASURED_CURVE,
      EXIT_CORRECTION,
      DEFAULT_LINEAR_EXIT_MODEL,
    },
    rawFromLevel,
    levelFromRaw,
    spinsightSpeedMpsAtLevel,
    fitInFlightToExitCorrection,
    estimatedExitSpeedAtLevel,
    combinedExitSpeedCurve,
    fitLinearExitModel,
    exitSpeedFromRaw,
    rawFromExitSpeed,
    exitSpeedRange,
    spinCapacityAtLevel,
    spinRpsFromSpinSetting,
    spinSettingFromRps,
    spinRpsFromRawWheels,
  };
});
