(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TableBounce = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Conti et al. (2026), Section III-C, equations 11-14. These fitted
  // corrections are equipment-specific (Nittaku balls on a SAN-EI table).
  const DELTA_VV = Object.freeze([
    Object.freeze([0, 0, 0]),
    Object.freeze([0, 0, 3.378e-3]),
    Object.freeze([-0.02344, 0, -0.02717]),
  ]);
  const DELTA_VW = Object.freeze([
    Object.freeze([0, 3.330e-4, 0]),
    Object.freeze([-6.940e-4, -5.428e-5, -2.126e-4]),
    Object.freeze([1.768e-5, -1.148e-5, -8.228e-6]),
  ]);
  const DELTA_WV = Object.freeze([
    Object.freeze([-0.69324, 0, -1.02984]),
    Object.freeze([0.51114, 0, 0]),
    Object.freeze([0.34033, 0, 0]),
  ]);
  const DELTA_WW = Object.freeze([
    Object.freeze([0.06456, 3.501e-4, 0.01193]),
    Object.freeze([0.00756, 0.00211, 0.00389]),
    Object.freeze([0.00314, 0.00291, 0.03411]),
  ]);

  const mul = (matrix, vector) => matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
  const transpose = matrix => matrix[0].map((_, column) => matrix.map(row => row[column]));
  const mulMatrices = (left, right) => left.map(row => right[0].map((_, column) =>
    row[0] * right[0][column] + row[1] * right[1][column] + row[2] * right[2][column]
  ));
  const rotateCorrection = (delta, rotation) => mulMatrices(mulMatrices(transpose(rotation), delta), rotation);
  const add = (a, b) => a.map((value, index) => value + b[index]);
  const subtract = (a, b) => a.map((value, index) => value - b[index]);

  function applyTableBounce(velocity, omega, radiusM) {
    const v = [velocity.x, velocity.y, velocity.z];
    const w = [omega.x, omega.y, omega.z];
    const radius = Math.max(1e-6, Number(radiusM) || .02);
    const restitution = 0.98 + 0.02 * velocity.z;
    const surfaceX = velocity.x - radius * omega.y;
    const surfaceY = velocity.y + radius * omega.x;
    const surfaceSpeed = Math.hypot(surfaceX, surfaceY);
    const alpha = surfaceSpeed > 1e-9
      ? Math.min(2 / 5, 0.25 * (1 + restitution) * Math.abs(velocity.z) / surfaceSpeed)
      : 2 / 5;
    const kappa = 3 / 2;

    const baseVelocity = [
      (1 - alpha) * velocity.x + alpha * radius * omega.y,
      (1 - alpha) * velocity.y - alpha * radius * omega.x,
      -restitution * velocity.z,
    ];
    const baseOmega = [
      (1 - kappa * alpha) * omega.x - kappa * alpha / radius * velocity.y,
      (1 - kappa * alpha) * omega.y + kappa * alpha / radius * velocity.x,
      omega.z,
    ];

    const horizontalSpeed = Math.hypot(velocity.x, velocity.y);
    const cos = horizontalSpeed > 1e-9 ? velocity.x / horizontalSpeed : 1;
    const sin = horizontalSpeed > 1e-9 ? velocity.y / horizontalSpeed : 0;
    const rotation = [[cos, sin, 0], [-sin, cos, 0], [0, 0, 1]];
    const correctedVelocity = subtract(baseVelocity, add(
      mul(rotateCorrection(DELTA_VV, rotation), v),
      mul(rotateCorrection(DELTA_VW, rotation), w)
    ));
    const correctedOmega = subtract(baseOmega, add(
      mul(rotateCorrection(DELTA_WV, rotation), v),
      mul(rotateCorrection(DELTA_WW, rotation), w)
    ));

    return {
      velocity: { x: correctedVelocity[0], y: correctedVelocity[1], z: correctedVelocity[2] },
      omega: { x: correctedOmega[0], y: correctedOmega[1], z: correctedOmega[2] },
      restitution,
      alpha,
      contactMode: alpha >= 2 / 5 - 1e-12 ? "rolling" : "sliding",
    };
  }

  return Object.freeze({ applyTableBounce });
});
