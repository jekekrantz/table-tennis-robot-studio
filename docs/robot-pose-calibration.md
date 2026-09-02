# Robot position calibration

The app separates two positions:

- A drill's `robotPose` is the position where its shots were authored.
- `calibration.pose` is the robot's current physical SE(2) position on the table.

At runtime the app predicts the stored shot at the authored position, then uses one bounded nonlinear solve to preserve that outcome from the current position. Speed, spin and net-clearance live adjustments are goals in the same solve, so their result does not depend on adjustment order. Sub-drill shots use the referenced drill's own authored position. Neither pose compensation nor live tuning edits the source drill.

## Manual position workflow

Open **Run → Calibrate pose**:

1. Drag the robot body on the top-view table until it matches the physical robot. Drag the blue handle to set its direction.
2. Start verification. The app proposes numbered landing targets chosen to make forward/back, lateral and direction errors observable using the table edges, centre line and net as visual references.
3. Fire the proposed ball and watch its first bounce.
4. Tap that first-bounce position directly on the table visualization. The app immediately updates the pose estimate and uncertainty, then proposes the next ball from that refined pose.
5. Save the calibrated pose after the sequence.

The user never enters uncertainty. A manual placement starts with a conservative 5 cm forward/back, 5 cm lateral and 3° direction prior, plus a base landing/feedback noise model. Each reported landing is a new measurement in a small-angle SE(2) update, so the displayed pose uncertainty contracts as useful feedback arrives. A 14-day inactivity reminder is shown before playback; continuing is allowed when the robot has not moved.

## Saving a temporary result

**Save current setup as new drill** compiles one traversal of the active drill, bakes current pose compensation, live speed/spin/clearance tuning, and pace into a new linear drill, and stores the current pose as its authored position. Random choices are therefore a snapshot. Shot-variation ranges are shifted with the new nominal parameters. The source remains unchanged, the new drill is selected, and live tuning is reset so it is not applied twice.

## Runtime budget

The simultaneous solver uses four control variables, at most eight iterations, and at most 24 trajectory evaluations per ball. Infeasible pose/tuning combinations stop preflight with an explicit error instead of silently serving the unchanged or boundary-clamped shot.
