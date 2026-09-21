# Robot position calibration

The app separates two positions:

- A drill's `robotPose` is the installation where its shots were authored.
- `calibration.pose` is the robot's current physical installation relative to the table: base-back `x/y/z`, yaw, pitch, roll, and a Table/Floor/Other placement label.

At runtime the app predicts the stored shot at the authored position, then uses one bounded nonlinear solve to preserve that outcome from the current position. Speed, spin and net-clearance live adjustments are goals in the same solve, so their result does not depend on adjustment order. Sub-drill shots use the referenced drill's own authored position. Neither pose compensation nor live tuning edits the source drill.

## Manual position workflow

Open **Run → Calibrate pose**:

1. Choose **Placement → Table, Floor, or Other**. Table places the base on the tabletop, Floor places it at floor height, and Other starts with a raised support that can be adjusted.
2. In **Top**, drag the robot body to set forward/side position and drag the blue handle to set yaw. In **Side**, drag the representative Nova outline to set forward position and base height; drag its blue handle to set installation pitch. The Nova outline is dimensioned from the published 465 × 176 × 325 mm physical envelope and anchored to the rear edge of the rigid base, rather than to the hopper overhang or an enlarged icon box. The hopper is a separate shell and may extend behind `base_back`. The side view draws floor, tabletop, net, regulation-style undercarriage, robot and support height at a common scale, with 3 m of visible space behind the near edge. Compact sliders retain exact pitch and roll input without duplicating the graphical position controls.
3. Optionally choose **Measure pitch and roll with phone**. Place the phone screen-up against the documented robot reference surface with its top edge pointing forward. The app retains only accelerometer samples collected while gyroscope rotation is low, rejects acceleration outliers with a median/MAD filter, and uses the robust gravity vector as a pitch/roll prior. Manual sliders remain available when sensors or permission are unavailable.
4. Start calibration. The app searches a dense grid of feasible landing placements and predicts a short information-rich sequence. The score rewards reduction of the remaining calibration error and penalizes moving to a different viewing area, so useful nearby shots are grouped when possible.
5. Move to the named viewing area, fire one ball deliberately, and watch its first bounce against the numbered table references.
6. Tap that bounce on the local measurement view. The grid continues across table and off-table ground, and its uncertainty ellipse combines normal shot dispersion with the current installation uncertainty.
7. The app numerically measures how the fired shot's landing responds to `x`, `y`, yaw, pitch, and roll. Each observation updates those five uncertain installation components; phone tilt remains a prior rather than an unquestioned fixed value.
8. Save after the independent check passes, or after the seven-shot limit with remaining uncertainty shown.

The user never enters uncertainty. A manual placement starts with a conservative 5 cm forward/back, 5 cm lateral and 3° direction prior. Landing dispersion has a 5 cm floor and reuses the guided shot-calibration relationship `1.5 cm/m × flight distance / sin(impact incidence)`, so long and shallow shots receive less weight. Tap uncertainty is estimated independently in the forward/back and lateral axes from pointer resolution and proximity to the numbered table references. Clicking outside preserves the certain inside/outside classification but increases positional uncertainty. Grossly inconsistent answers are downweighted rather than dragging the estimate to an extreme. A 14-day inactivity reminder is shown before playback; continuing is allowed when the robot has not moved.

## Saving a temporary result

**Save current setup as new drill** compiles one traversal of the active drill, bakes current pose compensation, live speed/spin/clearance tuning, and pace into a new linear drill, and stores the current pose as its authored position. Random choices are therefore a snapshot. Shot-variation ranges are shifted with the new nominal parameters. The source remains unchanged, the new drill is selected, and live tuning is reset so it is not applied twice.

## Runtime budget

The simultaneous solver uses four control variables, at most eight iterations, and at most 24 trajectory evaluations per ball. Infeasible pose/tuning combinations stop preflight with an explicit error instead of silently serving the unchanged or boundary-clamped shot.
