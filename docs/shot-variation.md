# Physically constrained shot variation

Shot nodes may define outcome variation for landing position, net clearance, launch speed and spin. The stored nominal shot remains the center/reference shot. New intuitive-editor placement is stored as a receiver-side rectangle using depth coordinates measured from the net and signed lateral coordinates measured from the table centerline. Older ellipse-based files remain supported.
Placement always means the receiver-side first bounce: the first physical bounce for a normal shot and the second physical bounce for a serve.

## Sampling model

The executable controls are speed, spin, elevation and aim. A sampled landing x/y and net clearance impose three equality constraints, leaving a one-dimensional family of feasible controls. The sampler does not designate one control as permanently inferred.

For each shot configuration it:

1. evaluates the nominal trajectory;
2. estimates the local three-by-four outcome Jacobian with four additional trajectory evaluations;
3. finds its normalized null-space direction;
4. filters deterministic valid trajectories through the requested intervals, independently projects that support onto each launch and outcome variable, and samples targets from the supported region;
5. applies a bounded quasi-Newton correction to satisfy landing and clearance together;
6. rejects targets that cannot be solved inside the requested speed/spin and global elevation/aim limits.

The user-requested intervals are never narrowed to make sampling easier. Invalid Cartesian combinations are skipped internally; if the local solver misses within its bounded budget, playback uses a known-valid trajectory from the filtered support. Runtime stops only when the requested intervals contain no known valid shot.
An exact interval is valid support in its own right and does not need a nonzero free-manifold span. This applies equally to ordinary shots and serves.

## Intuitive-editor feasible envelopes

The intuitive editor starts new shots and serves as fixed, legal defaults: the two handles initially meet at the modeled landing, speed, spin and net clearance. Widening any interval adds controlled variation and can never remove a previously valid shot. If an older saved nominal is outside the editor's legal trajectory envelope, the controls start from the nearest valid sampled point so they remain operable; changing a control then stores the corrected shot. Slider endpoints show the unconditional robot/table envelope and do not shrink in response to the other selected intervals. Every sample must also be exactly representable by the Nova model: base and individual wheel inputs must remain inside firmware limits, spin must remain below the speed-dependent calibrated capacity, and elevation/aim must fit both firmware and calibrated actuator ranges. The trajectory is evaluated with the speed and spin produced by the encoded wheel pair. An interval describes allowed results; it does not claim that every Cartesian combination across all five intervals is valid. Exact selected speed/spin endpoints and each valid nominal shot are added to the support search so narrow ranges remain useful.

The Manual tab edits launch speed, spin, elevation and left/right aim as synchronized min/dual-slider/max intervals. It internally projects known-valid support independently onto those four ranges, skips combinations that are not robot-representable or do not make a valid receiver-side shot, and reports only when the interval set contains no valid shot. Its receiver-side table shows a representative valid landing point. Outcome intervals remain available in the Intuitive tab; switching back to Intuitive returns variation to outcome-solving mode.

Clearance text input and its slider may extend down to −30 cm to deliberately request net contact and exercise impossible-shot feedback. Its endpoints remain the global editor bounds rather than changing with the other intervals.

## Performance limits

The local Jacobian is cached by drill, node, tuned nominal shot, variation settings, calibration and robot pose. Preparation costs exactly five trajectory evaluations. A successful sample normally takes two or three more evaluations. Solver iterations are capped at seven, target attempts at five, and each requested shot has a hard budget of 36 trajectory evaluations across all attempts.

The shot editor's **Test 12 varied shots** button runs the real trajectory model on the current device and reports feasibility, elapsed time and trajectory evaluations per accepted shot.

Development profiling for build `2026-09-01.1` produced:

- normal headless Chromium: 24/24 accepted in 11.2 ms, including cold preparation;
- Chromium with 6× CPU throttling: 100/100 accepted in 158.2 ms, or 1.58 ms per shot;
- the 6× run averaged 3.05 post-preparation trajectory evaluations per shot.

These numbers are regression references, not guarantees for every phone or requested variation region. The bounded local solve keeps CPU use predictable; retained valid support prevents a broad allowed region from failing merely because it also contains impossible combinations.
