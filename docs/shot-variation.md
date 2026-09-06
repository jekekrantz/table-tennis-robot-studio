# Physically constrained shot variation

Shot nodes may define outcome variation for landing position, net clearance, launch speed and spin. The stored nominal shot remains the center/reference shot. New intuitive-editor placement is stored as a receiver-side rectangle using depth coordinates measured from the net and signed lateral coordinates measured from the table centerline. Older ellipse-based files remain supported.
Placement always means the receiver-side first bounce: the first physical bounce for a normal shot and the second physical bounce for a serve.

## Sampling model

The executable controls are speed, spin, elevation and aim. A sampled landing x/y and net clearance impose three equality constraints, leaving a one-dimensional family of feasible controls. The sampler does not designate one control as permanently inferred.

For each shot configuration it:

1. evaluates the nominal trajectory;
2. estimates the local three-by-four outcome Jacobian with four additional trajectory evaluations;
3. finds its normalized null-space direction;
4. samples landing position uniformly by area inside the requested rectangle (or a legacy ellipse), samples clearance inside its requested interval, and samples a phase along the feasible direction;
5. applies a bounded quasi-Newton correction to satisfy landing and clearance together;
6. rejects targets that cannot be solved inside the requested speed/spin and global elevation/aim limits.

Invalid samples are never clamped or projected to a command boundary. Runtime stops with a useful error if five bounded attempts cannot find a feasible shot.

## Intuitive-editor feasible envelopes

The intuitive editor starts new shots and serves with the reachable receiver-side rectangle inset 5 cm from each physical table edge, the reachable speed and spin envelope, and a requested 0–30 cm clearance interval. Feasibility may move an edge farther inward when the robot cannot reach the nominal inset. Each slider's visible endpoints are recalculated from deterministic valid trajectory samples while holding the other four selected intervals fixed. Every sample must also be exactly representable by the Nova model: base and individual wheel inputs must remain inside firmware limits, spin must remain below the speed-dependent calibrated capacity, and elevation/aim must fit both firmware and calibrated actuator ranges. The trajectory is evaluated with the speed and spin produced by the encoded wheel pair. An endpoint therefore means that at least one valid robot-representable combination exists there; it does not claim that every Cartesian combination inside the five intervals is valid. Exact selected speed/spin endpoints are added to the envelope search so narrow ranges remain useful.

The Manual tab edits launch speed, spin, elevation and left/right aim as synchronized min/dual-slider/max intervals. It samples commands directly inside those four ranges, skips combinations that are not robot-representable or do not make a valid receiver-side shot, and shows concise feedback when the interval set is wholly or partly impossible. Its receiver-side table shows a representative valid landing point. Outcome intervals remain available in the Intuitive tab; switching back to Intuitive returns variation to outcome-solving mode.

Clearance text input and its slider may extend down to −30 cm to deliberately request net contact and exercise impossible-shot feedback. The upper endpoint follows the highest modeled valid receiver-side shot found under the other selected intervals.

## Performance limits

The local Jacobian is cached by drill, node, tuned nominal shot, variation settings, calibration and robot pose. Preparation costs exactly five trajectory evaluations. A successful sample normally takes two or three more evaluations. Solver iterations are capped at seven, target attempts at five, and each requested shot has a hard budget of 36 trajectory evaluations across all attempts.

The shot editor's **Test 12 varied shots** button runs the real trajectory model on the current device and reports feasibility, elapsed time and trajectory evaluations per accepted shot.

Development profiling for build `2026-09-01.1` produced:

- normal headless Chromium: 24/24 accepted in 11.2 ms, including cold preparation;
- Chromium with 6× CPU throttling: 100/100 accepted in 158.2 ms, or 1.58 ms per shot;
- the 6× run averaged 3.05 post-preparation trajectory evaluations per shot.

These numbers are regression references, not guarantees for every phone or requested variation region. Wide or nearly infeasible regions require more rejected attempts, but the hard evaluation cap bounds CPU use directly.
