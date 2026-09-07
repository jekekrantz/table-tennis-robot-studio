'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const Adjustments=require('./drill-adjustments.js');
const AdaptiveTiming=require('./adaptive-timing.js');
const app=fs.readFileSync('app.js','utf8');
const ble=fs.readFileSync('pongbot-ble.js','utf8');
assert(app.includes('compilePlaybackWindow'));
assert(app.includes('NOVA_SEQUENCE_RECORD_LIMIT = 9'));
assert(app.includes('NOVA_STREAM_COMBO_LIMIT = 255'));
assert(app.includes('Math.min(NOVA_SEQUENCE_RECORD_LIMIT'));
assert(app.includes('Ordinary set boundaries do not cause STOP/START'));
assert(app.includes('Protocol.buildLiveAdjustPacket(records)'));
assert(app.includes('robot.updateActiveSequence('));
assert(app.includes('maxBatchSize: 1'));
assert(app.includes('mode: 3, value: 0'));
assert(app.includes('value: segment.batches.length'));
assert(app.includes('robot.waitForBallEvent('));
assert(app.includes('robot.addEventListener("ball", noteRobotShot)'));
assert(app.includes('stopRobotAfterShotIdle'));
assert(app.includes('next streaming shot'));
assert(app.includes('flushImmediateLiveRetune'));
assert(app.includes('enqueuePlaybackUpdate'));
assert(!app.includes('manualTimingSpec(shot.desiredDelay)'), 'live rebuild must not treat an already pace-adjusted delay as authored timing');
assert(app.includes('timingBefore: shot.timingSpec || shot.timingBefore || manualTimingSpec(shot.delayBefore)'), 'live rebuild must retain the authored manual/adaptive timing model');
assert(app.includes('initialTimingHistory: timingHistorySnapshot(timingHistory)'), 'live rebuild must pass preceding contact context into adaptive timing');
assert(app.includes('rebuildPlaybackBatchForLiveTuning(original, context.timingHistory)'), 'active-slot tuning must use the contacts preceding that slot');
assert(app.includes('completedTimingHistory = timingHistoryAfter(completedTimingHistory, batch.shots)'), 'completed shots must become timing context across set and sub-drill boundaries');
assert(app.includes('if (!planMore(timingHistory)) return null'), 'new planning windows must inherit preceding contacts instead of resetting adaptive timing');
const pacedOnce = Adjustments.delayWithPace(1.2, { pacePct: -50 });
assert.strictEqual(pacedOnce, 2.4, 'the authored delay must receive Pace exactly once');
assert.notStrictEqual(pacedOnce, Adjustments.delayWithPace(pacedOnce, { pacePct: -50 }), 'a second Pace pass would regress live timing');
assert(!app.includes('Tuning queued for the next sequence buffer'));
assert(app.includes('variationApplied'));
assert(app.includes('No valid shot exists inside the requested position, clearance, speed, and spin intervals.'));
assert(app.includes('feasibleSamples: variationFeasibleSamples'));
assert(app.includes('ShotVariation.sample'));
assert(app.includes('the next ball is loaded into one running Nova slot after each ball event'));
assert(app.includes('requestRobotConnection("Play drill"'));
assert(app.includes('exportGuidedMeasurements'));
assert(app.includes('Copy this drill to edit it?'));
assert(ble.includes('emergencyShutdown()'));
assert(ble.includes('best-effort STOP queued'));
assert(ble.includes('waitForBallEvent('));
assert(ble.includes('new CustomEvent("ball"'));
assert(ble.includes('lastBallSignature'));
assert(ble.includes('Ignoring duplicate ball event'));
assert(ble.includes('Idle STOP already satisfied'));

// Execute the real planner/rebuilder functions with small deterministic stubs.
// This catches timing data-flow regressions that source-presence assertions miss.
const timingStart=app.indexOf('  function adaptiveDelayForPreparedShot(');
const timingEnd=app.indexOf('\n\n  function buildCalibrationTestExecutionPlan', timingStart);
assert(timingStart >= 0 && timingEnd > timingStart, 'could not locate playback timing functions');
const timingRuntime={
  AdaptiveTiming,
  Protocol:{
    frequencyHzFromDelaySeconds: delay => 1 / delay,
    packBallRecord: value => value,
    buildStartPacket: records => records,
    buildLiveAdjustPacket: records => records,
  },
  NOVA_LIMITS:{ frequencyHzMax:1.5, frequencyHzMin:.5, wheelRawMin:0, wheelRawMax:100 },
  NOVA_SEQUENCE_RECORD_LIMIT:9,
  library:{ calibration:{ table:{ length:2.74 }, rotationType:0 } },
  liveTuningRevision:0,
  liveTuning:{ pacePct:0 },
  contactOffsetY:0,
  finite:(value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  clamp:(value, min, max, fallback=min) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback)),
  fmt:value => String(value),
  manualTimingSpec:delaySeconds => ({ mode:'manual', delaySeconds }),
  tunedDelaySeconds:delay => Adjustments.delayWithPace(delay, timingRuntime.liveTuning),
  novaFrequencyForDelay:delay => {
    const desiredDelay=Math.max(0, Number(delay) || 0);
    const encodedDelay=Math.min(2, Math.max(1 / 1.5, desiredDelay || 1 / 1.5));
    return { desiredDelay, encodedDelay, frequencyHz:1 / encodedDelay, tooFast:desiredDelay > 0 && desiredDelay < 1 / 1.5, tooSlow:desiredDelay > 2, extraHostDelay:Math.max(0, desiredDelay - 2) };
  },
  activePlayerModel:() => AdaptiveTiming.DEFAULT_PLAYER_MODEL,
  adjustedShotForRuntime:params => ({
    params:{ ...params, contact:{ ...params.contact, y:params.contact.y + timingRuntime.contactOffsetY } },
    prediction:{}, warnings:[], changed:Boolean(timingRuntime.contactOffsetY), feasible:true,
  }),
  variedShotParams:(_shot, params) => ({ params, result:null }),
  variationShiftedToEffectiveShot:value => value,
  predictTrajectory:() => ({}),
  calibrationAtPose:() => ({}),
  currentRobotPose:() => ({}),
  timingContactForShot:shot => ({ ...shot.params.contact }),
  trajectoryPlanWarning:() => null,
  robotShotPreflight:() => ({ estimate:{ wheelA:50, wheelB:50 }, errors:[], warnings:[] }),
};
vm.createContext(timingRuntime);
vm.runInContext(`${app.slice(timingStart, timingEnd)}\nglobalThis.timingApi={buildRobotExecutionPlan,rebuildPlaybackBatchForLiveTuning};`, timingRuntime);
const manualShot={
  label:'Manual', nodeType:'shot', params:{ contact:{ x:2.2, y:0, z:.25, t:.6, speedMps:7, spinRps:20 } },
  delayBefore:1.2, timingBefore:{ mode:'manual', delaySeconds:1.2 },
};
timingRuntime.liveTuning={ pacePct:-50 };
const manualPlan=timingRuntime.timingApi.buildRobotExecutionPlan({ shots:[manualShot], warnings:[], trailingDelay:0 }, { maxBatchSize:1 });
const manualRebuilt=timingRuntime.timingApi.rebuildPlaybackBatchForLiveTuning(manualPlan.batches[0], []);
assert.strictEqual(manualPlan.batches[0].shots[0].desiredDelay, 2.4);
assert.strictEqual(manualRebuilt.shots[0].desiredDelay, 2.4, 'live rebuild must not apply Pace twice');

timingRuntime.liveTuning={ pacePct:0 };
const adaptiveShots=[
  { label:'A', nodeType:'shot', params:{ contact:{ x:2.2, y:-.2, z:.25, t:.6, speedMps:7, spinRps:20 } }, delayBefore:0, timingBefore:{ mode:'adaptive', speedPct:100 } },
  { label:'B', nodeType:'shot', params:{ contact:{ x:2.2, y:.2, z:.25, t:.6, speedMps:7, spinRps:20 } }, delayBefore:0, timingBefore:{ mode:'adaptive', speedPct:100 } },
];
const adaptivePlan=timingRuntime.timingApi.buildRobotExecutionPlan({ shots:adaptiveShots, warnings:[], trailingDelay:0 }, { maxBatchSize:1 });
const firstPrepared=adaptivePlan.batches[0].shots[0];
timingRuntime.contactOffsetY=.5;
timingRuntime.liveTuning={ pacePct:-50 };
const adaptiveRebuilt=timingRuntime.timingApi.rebuildPlaybackBatchForLiveTuning(adaptivePlan.batches[1], [firstPrepared]);
const rebuiltShot=adaptiveRebuilt.shots[0];
const expectedAdaptive=AdaptiveTiming.delaySeconds({
  contactA:firstPrepared.timingContact,
  contactB:rebuiltShot.timingContact,
  targetType:'shot',
  table:timingRuntime.library.calibration.table,
  playerModel:AdaptiveTiming.DEFAULT_PLAYER_MODEL,
  edgeSpeedPct:100,
});
assert.strictEqual(rebuiltShot.timingMode, 'adaptive');
assert(Math.abs(rebuiltShot.desiredDelay - expectedAdaptive * 2) < 1e-9, 'retuned adaptive delay must use the preceding actual contact and apply Pace once');
console.log('PASS continuous playback / connection / shutdown source invariants');
