# Physically constrained shot variation

Shot nodes may define outcome variation for landing position, net clearance, launch speed and spin. The stored nominal shot remains the center/reference shot.

## Sampling model

The executable controls are speed, spin, elevation and aim. A sampled landing x/y and net clearance impose three equality constraints, leaving a one-dimensional family of feasible controls. The sampler does not designate one control as permanently inferred.

For each shot configuration it:

1. evaluates the nominal trajectory;
2. estimates the local three-by-four outcome Jacobian with four additional trajectory evaluations;
3. finds its normalized null-space direction;
4. samples landing position uniformly by area inside the requested ellipse, samples clearance inside its requested interval, and samples a phase along the feasible direction;
5. applies a bounded quasi-Newton correction to satisfy landing and clearance together;
6. rejects targets that cannot be solved inside the requested speed/spin and global elevation/aim limits.

Invalid samples are never clamped or projected to a command boundary. Runtime stops with a useful error if five bounded attempts cannot find a feasible shot.

## Performance limits

The local Jacobian is cached by drill, node, tuned nominal shot, variation settings, calibration and robot pose. Preparation costs exactly five trajectory evaluations. A successful sample normally takes two or three more evaluations. Solver iterations are capped at seven, target attempts at five, and each requested shot has a hard budget of 36 trajectory evaluations across all attempts.

The shot editor's **Test 12 varied shots** button runs the real trajectory model on the current device and reports feasibility, elapsed time and trajectory evaluations per accepted shot.

Development profiling for build `2026-09-01.1` produced:

- normal headless Chromium: 24/24 accepted in 11.2 ms, including cold preparation;
- Chromium with 6× CPU throttling: 100/100 accepted in 158.2 ms, or 1.58 ms per shot;
- the 6× run averaged 3.05 post-preparation trajectory evaluations per shot.

These numbers are regression references, not guarantees for every phone or requested variation region. Wide or nearly infeasible regions require more rejected attempts, but the hard evaluation cap bounds CPU use directly.
