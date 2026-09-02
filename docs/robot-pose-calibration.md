# Robot position calibration

The app separates two positions:

- A drill's `robotPose` is the position where its shots were authored.
- `calibration.pose` is the robot's current physical SE(2) position on the table.

At runtime the app predicts the stored shot at the authored position, then uses one bounded nonlinear solve to preserve that outcome from the current position. Speed, spin and net-clearance live adjustments are goals in the same solve, so their result does not depend on adjustment order. Sub-drill shots use the referenced drill's own authored position. Neither pose compensation nor live tuning edits the source drill.

## Manual position workflow

Open **Run → Calibrate pose**:

1. Drag the robot body on the top-view table until it matches the physical robot. Drag the blue handle to set its direction.
2. Start calibration. The app searches a dense grid of feasible landing placements and predicts a short information-rich sequence. The score rewards reduction of the remaining calibration error and penalizes moving to a different viewing area, so useful nearby shots are grouped when possible.
3. Move to the named viewing area, fire one ball deliberately, and watch its first bounce against the numbered table references.
4. Tap that bounce on a local, uncertainty-sized view. The initial view includes the nearest useful intersection (endline/net × sideline/centre line), and every visible table line is named. All ruler numbers are centimetres and use clean 1/2/5/10/20/50 cm intervals as the zoom changes. Drag to translate; pinch, scroll, or use the buttons to zoom. Official 2 cm edge markings and the 3 mm centre line are drawn at physical scale. The top-view net is a symbolic mesh band at the exact net plane, extends 15.25 cm past each sideline, and has visible posts. The dark ground remains clickable for misses outside the table.
5. The app updates the pose and replans from the measurement actually received. Once pose-induced landing error is no larger than normal modeled ball dispersion, it stops tightening and asks for a spatially distinct check shot which is not used to fit the pose.
6. Save the calibrated pose after that independent check passes, or after the seven-shot safety limit with the remaining uncertainty shown.

The user never enters uncertainty. A manual placement starts with a conservative 5 cm forward/back, 5 cm lateral and 3° direction prior. Landing dispersion has a 5 cm floor and reuses the guided shot-calibration relationship `1.5 cm/m × flight distance / sin(impact incidence)`, so long and shallow shots receive less weight. Tap uncertainty is estimated independently in the forward/back and lateral axes from pointer resolution and proximity to the numbered table references. Clicking outside preserves the certain inside/outside classification but increases positional uncertainty. Grossly inconsistent answers are downweighted rather than dragging the estimate to an extreme. A 14-day inactivity reminder is shown before playback; continuing is allowed when the robot has not moved.

## Saving a temporary result

**Save current setup as new drill** compiles one traversal of the active drill, bakes current pose compensation, live speed/spin/clearance tuning, and pace into a new linear drill, and stores the current pose as its authored position. Random choices are therefore a snapshot. Shot-variation ranges are shifted with the new nominal parameters. The source remains unchanged, the new drill is selected, and live tuning is reset so it is not applied twice.

## Runtime budget

The simultaneous solver uses four control variables, at most eight iterations, and at most 24 trajectory evaluations per ball. Infeasible pose/tuning combinations stop preflight with an explicit error instead of silently serving the unchanged or boundary-clamped shot.
