(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NovaLaunchModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RAW_BASE = 969.9321047526674;
  const RAW_PER_SPEED_LEVEL = 630.455868089234;
  const RAW_DELTA_PER_SPIN_LEVEL = 342.036255843120;
  const HARDWARE_RAW_MIN = 100;
  const HARDWARE_RAW_MAX = 7500;
  const DEFAULT_MOTOR_SCALING = Object.freeze({
    rawAtZeroSpeedLevel: RAW_BASE,
    rawPerSpeedLevel: RAW_PER_SPEED_LEVEL,
    rawDeltaPerSpinLevel: RAW_DELTA_PER_SPIN_LEVEL,
  });

  // One affine motor law, fitted to the robust fixed-geometry ground calibration.
  // There are deliberately no speed knots or interpolation tables in the motor model.
  const DEFAULT_LINEAR_EXIT_MODEL = Object.freeze({
    interceptMps: -0.2758895085,
    slopeMpsPerRaw: 0.0023936604543,
    calibratedRawMin: 2000,
    calibratedRawMax: 3000,
    source: "2026-08-28-ground-calibration-fixed-geometry",
  });

  // Spinsight data are retained only for the speed-dependent spin-capacity estimate.
  // They do not define or bend the raw-wheel-input -> exit-speed relationship.
  const SPINSIGHT_MEASURED_CURVE = [
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

  function normalizeMotorScaling(scaling = DEFAULT_MOTOR_SCALING) {
    const source = scaling && typeof scaling === "object" ? scaling : DEFAULT_MOTOR_SCALING;
    const rawAtZeroSpeedLevel = finite(
      source.rawAtZeroSpeedLevel,
      DEFAULT_MOTOR_SCALING.rawAtZeroSpeedLevel
    );
    let rawPerSpeedLevel = finite(
      source.rawPerSpeedLevel,
      DEFAULT_MOTOR_SCALING.rawPerSpeedLevel
    );
    let rawDeltaPerSpinLevel = finite(
      source.rawDeltaPerSpinLevel,
      DEFAULT_MOTOR_SCALING.rawDeltaPerSpinLevel
    );
    if (!(rawPerSpeedLevel > 1e-9)) rawPerSpeedLevel = DEFAULT_MOTOR_SCALING.rawPerSpeedLevel;
    if (!(rawDeltaPerSpinLevel > 1e-9)) rawDeltaPerSpinLevel = DEFAULT_MOTOR_SCALING.rawDeltaPerSpinLevel;
    return { rawAtZeroSpeedLevel, rawPerSpeedLevel, rawDeltaPerSpinLevel };
  }
  function rawFromLevel(level, scaling = DEFAULT_MOTOR_SCALING) {
    const s = normalizeMotorScaling(scaling);
    return s.rawAtZeroSpeedLevel + s.rawPerSpeedLevel * finite(level, 0);
  }
  function levelFromRaw(raw, scaling = DEFAULT_MOTOR_SCALING) {
    const s = normalizeMotorScaling(scaling);
    return (finite(raw, s.rawAtZeroSpeedLevel) - s.rawAtZeroSpeedLevel) / s.rawPerSpeedLevel;
  }
  function sanitizeLinearModel(model, fallback = DEFAULT_LINEAR_EXIT_MODEL) {
    const source = model && typeof model === "object" ? model : fallback;
    const interceptMps = finite(source.interceptMps, fallback.interceptMps);
    let slopeMpsPerRaw = finite(source.slopeMpsPerRaw, fallback.slopeMpsPerRaw);
    if (!(slopeMpsPerRaw > 1e-9)) slopeMpsPerRaw = fallback.slopeMpsPerRaw;
    let calibratedRawMin = finite(source.calibratedRawMin, fallback.calibratedRawMin);
    let calibratedRawMax = finite(source.calibratedRawMax, fallback.calibratedRawMax);
    if (calibratedRawMax < calibratedRawMin) [calibratedRawMin, calibratedRawMax] = [calibratedRawMax, calibratedRawMin];
    if (calibratedRawMax - calibratedRawMin < 1) {
      calibratedRawMin = fallback.calibratedRawMin;
      calibratedRawMax = fallback.calibratedRawMax;
    }
    return {
      interceptMps,
      slopeMpsPerRaw,
      calibratedRawMin,
      calibratedRawMax,
      source: String(source.source || fallback.source || "linear-calibration"),
    };
  }

  function exitSpeedFromRaw(raw, model = DEFAULT_LINEAR_EXIT_MODEL) {
    const m = sanitizeLinearModel(model);
    // Intentionally no calibration-range clamp: the model is affine everywhere.
    return m.interceptMps + m.slopeMpsPerRaw * finite(raw, m.calibratedRawMin);
  }

  function rawFromExitSpeed(speedMps, model = DEFAULT_LINEAR_EXIT_MODEL) {
    const m = sanitizeLinearModel(model);
    return (finite(speedMps, exitSpeedFromRaw(m.calibratedRawMin, m)) - m.interceptMps) / m.slopeMpsPerRaw;
  }

  function calibratedSpeedRange(model = DEFAULT_LINEAR_EXIT_MODEL) {
    const m = sanitizeLinearModel(model);
    const a = exitSpeedFromRaw(m.calibratedRawMin, m);
    const b = exitSpeedFromRaw(m.calibratedRawMax, m);
    return {
      minMps: Math.min(a, b),
      maxMps: Math.max(a, b),
      minRaw: m.calibratedRawMin,
      maxRaw: m.calibratedRawMax,
    };
  }

  function hardwareSpeedRange(model = DEFAULT_LINEAR_EXIT_MODEL) {
    const m = sanitizeLinearModel(model);
    const a = exitSpeedFromRaw(HARDWARE_RAW_MIN, m);
    const b = exitSpeedFromRaw(HARDWARE_RAW_MAX, m);
    return {
      minMps: Math.min(a, b),
      maxMps: Math.max(a, b),
      minRaw: HARDWARE_RAW_MIN,
      maxRaw: HARDWARE_RAW_MAX,
    };
  }

  function isRawCalibrated(raw, model = DEFAULT_LINEAR_EXIT_MODEL) {
    const m = sanitizeLinearModel(model);
    const r = finite(raw, NaN);
    return Number.isFinite(r) && r >= m.calibratedRawMin && r <= m.calibratedRawMax;
  }

  function clampRawToHardware(raw) {
    return clamp(finite(raw, RAW_BASE), HARDWARE_RAW_MIN, HARDWARE_RAW_MAX);
  }

  function normalizeSpinCurve(curve = SPINSIGHT_MEASURED_CURVE) {
    const source = Array.isArray(curve) && curve.length ? curve : SPINSIGHT_MEASURED_CURVE;
    const points = source.map(point => ({
      level: finite(point?.level, NaN),
      maxSpinSetting: Math.max(0, finite(point?.maxSpinSetting, NaN)),
      maxSpinRps: Math.max(0, finite(point?.maxSpinRps, NaN)),
    })).filter(point => Number.isFinite(point.level) && Number.isFinite(point.maxSpinSetting) && Number.isFinite(point.maxSpinRps));
    return points.length >= 2 ? points : SPINSIGHT_MEASURED_CURVE;
  }
  function spinCapacityAtLevel(level, curve = SPINSIGHT_MEASURED_CURVE) {
    const points = normalizeSpinCurve(curve);
    return {
      maxSpinSetting: Math.max(0, interpolateCurve(level, points, "level", "maxSpinSetting")),
      maxSpinRps: Math.max(0, interpolateCurve(level, points, "level", "maxSpinRps")),
    };
  }
  function spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity = false, curve = SPINSIGHT_MEASURED_CURVE } = {}) {
    const cap = spinCapacityAtLevel(level, curve);
    if (cap.maxSpinSetting <= 1e-9 || cap.maxSpinRps <= 1e-9) return 0;
    const sign = Math.sign(finite(spinSetting, 0));
    let magnitude = Math.abs(finite(spinSetting, 0));
    if (clampToMeasuredCapacity) magnitude = Math.min(magnitude, cap.maxSpinSetting);
    return sign * magnitude / cap.maxSpinSetting * cap.maxSpinRps;
  }
  function spinSettingFromRps(level, spinRps, { clampToMeasuredCapacity = true, curve = SPINSIGHT_MEASURED_CURVE } = {}) {
    const cap = spinCapacityAtLevel(level, curve);
    if (cap.maxSpinSetting <= 1e-9 || cap.maxSpinRps <= 1e-9) return 0;
    const sign = Math.sign(finite(spinRps, 0));
    let magnitude = Math.abs(finite(spinRps, 0)) / cap.maxSpinRps * cap.maxSpinSetting;
    if (clampToMeasuredCapacity) magnitude = Math.min(magnitude, cap.maxSpinSetting);
    return sign * magnitude;
  }
  function spinRpsFromRawWheels(wheelA, wheelB, scaling = DEFAULT_MOTOR_SCALING) {
    const s = normalizeMotorScaling(scaling);
    const curve = Array.isArray(scaling?.spinsightCurve) ? scaling.spinsightCurve : SPINSIGHT_MEASURED_CURVE;
    const a = finite(wheelA, s.rawAtZeroSpeedLevel);
    const b = finite(wheelB, s.rawAtZeroSpeedLevel);
    const level = levelFromRaw((a + b) / 2, s);
    const spinSetting = (a - b) / (2 * s.rawDeltaPerSpinLevel);
    return spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity: false, curve });
  }

  return Object.freeze({
    constants: Object.freeze({
      RAW_BASE,
      RAW_PER_SPEED_LEVEL,
      RAW_DELTA_PER_SPIN_LEVEL,
      HARDWARE_RAW_MIN,
      HARDWARE_RAW_MAX,
      DEFAULT_LINEAR_EXIT_MODEL,
      DEFAULT_MOTOR_SCALING,
      SPINSIGHT_MEASURED_CURVE,
    }),
    normalizeMotorScaling,
    rawFromLevel,
    levelFromRaw,
    sanitizeLinearModel,
    exitSpeedFromRaw,
    rawFromExitSpeed,
    calibratedSpeedRange,
    hardwareSpeedRange,
    isRawCalibrated,
    clampRawToHardware,
    normalizeSpinCurve,
    spinCapacityAtLevel,
    spinRpsFromSpinSetting,
    spinSettingFromRps,
    spinRpsFromRawWheels,
  });
});
