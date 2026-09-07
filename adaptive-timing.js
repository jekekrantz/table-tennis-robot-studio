(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdaptiveTiming = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_PLAYER_MODEL = Object.freeze({
    id: "player-balanced",
    name: "Balanced player",
    timingSpeedPct: 100,
    baseStrokeRecoverySeconds: .30,
    minimumContactGapSeconds: .50,
    lateralAccelerationMps2: 7,
    lateralMaxSpeedMps: 2.8,
    depthAccelerationMps2: 5,
    depthMaxSpeedMps: 2,
    returnTurnaroundSeconds: .08,
    returnSpeedRatio: .75,
    minimumReturnSpeedMps: 4,
    maximumReturnSpeedMps: 10,
    servePreparationSeconds: .65,
  });

  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));

  function normalizePlayerModel(raw = {}, fallbackId = DEFAULT_PLAYER_MODEL.id) {
    const d = DEFAULT_PLAYER_MODEL;
    const value = { ...d, ...(raw || {}) };
    const minimumReturnSpeedMps = clamp(value.minimumReturnSpeedMps, 1, 15);
    const maximumReturnSpeedMps = Math.max(minimumReturnSpeedMps, clamp(value.maximumReturnSpeedMps, 2, 25));
    return {
      id: String(raw?.id || fallbackId),
      name: String(value.name || "Player").trim().slice(0, 60) || "Player",
      timingSpeedPct: clamp(value.timingSpeedPct, 50, 200),
      baseStrokeRecoverySeconds: clamp(value.baseStrokeRecoverySeconds, .1, 1.5),
      minimumContactGapSeconds: clamp(value.minimumContactGapSeconds, .2, 3),
      lateralAccelerationMps2: clamp(value.lateralAccelerationMps2, 1, 20),
      lateralMaxSpeedMps: clamp(value.lateralMaxSpeedMps, .5, 6),
      depthAccelerationMps2: clamp(value.depthAccelerationMps2, 1, 20),
      depthMaxSpeedMps: clamp(value.depthMaxSpeedMps, .5, 6),
      returnTurnaroundSeconds: clamp(value.returnTurnaroundSeconds, 0, 1),
      returnSpeedRatio: clamp(value.returnSpeedRatio, .2, 1.5),
      minimumReturnSpeedMps,
      maximumReturnSpeedMps,
      servePreparationSeconds: clamp(value.servePreparationSeconds, 0, 5),
    };
  }

  function axisMovementTime(distance, acceleration, maxSpeed) {
    const d = Math.abs(finite(distance, 0));
    const a = Math.max(.001, finite(acceleration, 1));
    const v = Math.max(.001, finite(maxSpeed, 1));
    const threshold = v * v / a;
    if (d <= threshold) return 2 * Math.sqrt(d / a);
    return 2 * v / a + (d - threshold) / v;
  }

  function movementTime(a, b, model) {
    return Math.max(
      axisMovementTime(b.x - a.x, model.depthAccelerationMps2, model.depthMaxSpeedMps),
      axisMovementTime(b.y - a.y, model.lateralAccelerationMps2, model.lateralMaxSpeedMps)
    );
  }

  function reversalTime(previous, a, b) {
    if (!previous) return 0;
    const first = { x: a.x - previous.x, y: a.y - previous.y };
    const second = { x: b.x - a.x, y: b.y - a.y };
    const firstLength = Math.hypot(first.x, first.y);
    const secondLength = Math.hypot(second.x, second.y);
    if (firstLength < .05 || secondLength < .05) return 0;
    const cosine = (first.x * second.x + first.y * second.y) / (firstLength * secondLength);
    return .10 * Math.max(0, -cosine);
  }

  function difficultyTime(contact) {
    const speedScore = clamp((finite(contact.speedMps, 4) - 4) / 6, 0, 1);
    const spinScore = clamp(Math.abs(finite(contact.spinRps, 0)) / 80, 0, 1);
    const lowScore = clamp((.30 - finite(contact.z, .30)) / .18, 0, 1);
    return .06 * speedScore + .05 * spinScore + .05 * lowScore;
  }

  function virtualReturnTime(contact, table, model) {
    const target = { x: Math.max(0, finite(table?.length, 2.74) * .25), y: 0 };
    const distance = Math.hypot(contact.x - target.x, contact.y - target.y);
    const returnSpeed = clamp(
      finite(contact.speedMps, model.minimumReturnSpeedMps) * model.returnSpeedRatio,
      model.minimumReturnSpeedMps,
      Math.max(model.minimumReturnSpeedMps, model.maximumReturnSpeedMps)
    );
    return model.returnTurnaroundSeconds + distance / returnSpeed;
  }

  function delaySeconds({ previousContact = null, contactA, contactB, targetType = "shot", table, playerModel, edgeSpeedPct = 100 }) {
    const model = normalizePlayerModel(playerModel);
    if (!contactA || !contactB) return 1;
    const move = movementTime(contactA, contactB, model);
    const playerGap = model.baseStrokeRecoverySeconds + move + difficultyTime(contactA)
      + reversalTime(previousContact, contactA, contactB);
    const rallyGap = virtualReturnTime(contactA, table, model) + contactB.t;
    const desiredGap = Math.max(model.minimumContactGapSeconds, playerGap, rallyGap);
    const servePreparation = targetType === "serve" ? model.servePreparationSeconds : 0;
    const speedMultiplier = Math.max(.1, model.timingSpeedPct / 100) * Math.max(.1, finite(edgeSpeedPct, 100) / 100);
    return Math.max(0, (desiredGap + contactA.t - contactB.t + servePreparation) / speedMultiplier);
  }

  return {
    DEFAULT_PLAYER_MODEL,
    normalizePlayerModel,
    axisMovementTime,
    movementTime,
    reversalTime,
    difficultyTime,
    virtualReturnTime,
    delaySeconds,
  };
});
