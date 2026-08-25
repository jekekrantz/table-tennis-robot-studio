#!/usr/bin/env node
"use strict";

const assert = require("assert");
const C = require("./guided-calibration.js");

function close(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} (tol ${tolerance})`);
}

function syntheticRows({ placement = "table", nozzleHeightM = 0.225, nozzleXFromNearEdgeM = 0.265, withClearance = true } = {}) {
  const speeds = [2025, 2167, 2388].map(raw => ({ raw, speedMps: C.seedSpeedMps(raw) }));
  const elevations = placement === "ground" ? [5, 15, 25, 35, 45] : [10, 15, 20, 25, 30];
  const rows = [];
  for (const point of speeds) {
    for (const elevationDeg of elevations) {
      const sim = C.simulateShot({
        speedMps: point.speedMps,
        elevationDeg,
        placement,
        nozzleXFromNearEdgeM,
        nozzleHeightM,
        maxTimeS: 6,
      });
      if (!sim.ok) continue;
      if (placement === "table" && !sim.onTable) continue;
      rows.push({
        rawSpeed: point.raw,
        elevationDeg,
        distanceCm: placement === "ground" ? sim.landingX * 100 : (sim.landingX - C.constants.NET_X_M) * 100,
        netClearanceCm: placement === "table" && withClearance && sim.netClearanceM != null && rows.length % 2 === 0 ? sim.netClearanceM * 100 : null,
      });
    }
  }
  return rows;
}

(function run() {
  const plan = C.buildPlan({
    placement: "table",
    elevationMinDeg: 10,
    elevationMaxDeg: 30,
    elevationCount: 5,
    speedMinRaw: 2025,
    speedMaxRaw: 2388,
    speedCount: 3,
  });
  assert.equal(plan.shots.length, 15);
  assert.deepEqual(plan.elevations, [10, 15, 20, 25, 30]);
  assert.equal(plan.speeds[0], 2025);
  assert.equal(plan.speeds.at(-1), 2388);
  // Grouped by speed: first five shots should keep the same wheel setting.
  assert(plan.shots.slice(0, 5).every(s => s.rawSpeed === 2025));

  const rows = syntheticRows();
  assert(rows.length >= 12, `expected useful synthetic table rows, got ${rows.length}`);
  const fit = C.calibrate(rows, {
    placement: "table",
    distanceReference: "net",
    nozzleXFromNearEdgeM: 0.265,
    tableHeightM: 0.76,
    distanceSigmaM: 0.01,
    netClearanceSigmaM: 0.01,
  });
  close(fit.nozzleHeightM, 0.225, 0.012, "table nozzle height");
  close(fit.speedMap[0].speedMps, C.seedSpeedMps(2025), 0.06, "linear speed 2025");
  close(fit.speedMap[1].speedMps, C.seedSpeedMps(2167), 0.06, "linear speed 2167");
  close(fit.speedMap[2].speedMps, C.seedSpeedMps(2388), 0.06, "linear speed 2388");
  assert(fit.speedModel.slopeMpsPerRaw > 0, "calibrated speed slope should be positive");
  for (const point of fit.speedMap) {
    close(point.speedMps, fit.speedModel.interceptMps + fit.speedModel.slopeMpsPerRaw * point.raw, 1e-10, `speed map lies on line at ${point.raw}`);
  }
  assert(fit.distanceRmseM < 0.015, `table RMSE too high: ${fit.distanceRmseM}`);
  assert(fit.clearanceCount > 0);

  const blankRows = rows.concat([{ rawSpeed: 2025, elevationDeg: 12, distanceCm: null, netClearanceCm: null }]);
  const fitWithBlank = C.calibrate(blankRows, {
    placement: "table",
    distanceReference: "net",
    nozzleXFromNearEdgeM: 0.265,
  });
  close(fitWithBlank.nozzleHeightM, fit.nozzleHeightM, 0.005, "blank rows ignored");

  // Ground calibration is a flat-floor experiment. x=0 is the back of the
  // robot base; the table and net must have no influence on the trajectory.
  const ground = C.simulateShot({
    speedMps: 5.39,
    elevationDeg: 35,
    placement: "ground",
    nozzleXFromNearEdgeM: 0.265,
    nozzleHeightM: 0.225,
    tableHeightM: 0.20,
    tableLengthM: 0.5,
    netXFromNearEdgeM: 0.1,
    maxTimeS: 6,
  });
  const groundOtherTable = C.simulateShot({
    speedMps: 5.39,
    elevationDeg: 35,
    placement: "ground",
    nozzleXFromNearEdgeM: 0.265,
    nozzleHeightM: 0.225,
    tableHeightM: 1.20,
    tableLengthM: 8,
    netXFromNearEdgeM: 4,
    maxTimeS: 6,
  });
  assert(ground.ok && ground.onGround);
  assert(groundOtherTable.ok && groundOtherTable.onGround);
  close(ground.landingX, groundOtherTable.landingX, 1e-9, "ground ignores table geometry");
  assert.equal(ground.netClearanceM, null);

  const groundRows = syntheticRows({ placement: "ground", nozzleHeightM: 0.225, nozzleXFromNearEdgeM: 0.265 });
  assert.equal(groundRows.length, 15);
  const groundFit = C.calibrate(groundRows, {
    placement: "ground",
    distanceReference: "net", // solver must force back-of-base reference
    nozzleXFromNearEdgeM: 0.265,
    distanceSigmaM: 0.01,
  });
  close(groundFit.nozzleHeightM, 0.225, 0.012, "ground nozzle height");
  close(groundFit.speedMap[0].speedMps, C.seedSpeedMps(2025), 0.06, "ground linear speed 2025");
  close(groundFit.speedMap[2].speedMps, C.seedSpeedMps(2388), 0.06, "ground linear speed 2388");
  assert(groundFit.speedModel.slopeMpsPerRaw > 0);
  assert(groundFit.distanceRmseM < 0.015, `ground RMSE too high: ${groundFit.distanceRmseM}`);
  assert.equal(groundFit.clearanceCount, 0);
  assert.equal(groundFit.nozzleXReference, "base_back");

  const seedModel = C.constants.USER_SEED_LINEAR_MODEL;
  const seed = C.speedFromMap(2167, C.constants.USER_SEED_SPEED_MAP);
  close(seed, seedModel.interceptMps + seedModel.slopeMpsPerRaw * 2167, 1e-12, "seed map uses one linear fit");
  close(C.rawFromSpeed(seed, C.constants.USER_SEED_SPEED_MAP), 2167, 1e-9, "inverse linear seed model");
  close(C.fitLinearSpeedModel(C.constants.USER_SEED_SPEED_MAP).rmseMps, 0.02647874901767954, 1e-12, "seed line RMSE");

  console.log("guided-calibration self-test: PASS");
})();
