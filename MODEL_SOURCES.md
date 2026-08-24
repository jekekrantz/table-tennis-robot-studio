# Trajectory model sources

## Ball and net dimensions

International Table Tennis Federation, *ITTF Statutes 2026*, Laws of Table
Tennis:

- 2.2.3: net height 15.25 cm above the playing surface.
- 2.3.1: spherical ball, diameter 40 mm.
- 2.3.2: ball mass 2.7 g.

Source:
https://documents.ittf.sport/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf

## Aerodynamic force and coefficient model

Christian Conti, Bilan Yang, Alexander Sigrist, Lorenzo Miele, Yamen Saraiji,
Peter Dürr, and Naoya Takahashi, *Physics Models for Sim-to-Real Transfer in
Professional-Level Robot Table Tennis*, arXiv:2606.28805, 2026.

Implemented from Section III-B:

- Equation (2): drag, Magnus and gravity force model.
- Reynolds number and spin-ratio definitions.
- Table I: piecewise drag coefficient values.
- Tables II and III: piecewise Magnus coefficient parameters.
- Ball radius 0.02 m.
- Kinematic viscosity reference 1.506e-5 m²/s at 20 °C.

Source:
https://arxiv.org/abs/2606.28805

The paper reports fitting on approximately 58,000 competitive flight
trajectories and a 59% median landing-position error reduction over the standard
baseline.

## Air properties

Dry-air density is computed from the ideal-gas equation:

    rho = p / (R T)

Default specific gas constant:

    R = 287.05 J/(kg K)

Dynamic viscosity uses Sutherland's law:

    mu = mu0 (T/T0)^(3/2) (T0 + S)/(T + S)

Defaults:

- mu0 = 1.716e-5 Pa s
- T0 = 273.15 K
- S = 110.4 K

Reference sources:

- NASA Glenn, Air Properties Definitions:
  https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/air-properties-definitions/
- COMSOL, Sutherland's Law:
  https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html

## Numerical method

The browser implementation uses a fixed-step fourth-order Runge-Kutta
integrator. The default step is 0.004 s and is user-adjustable.

## Nova launch-speed and spin calibration

The default raw-motor conversion combines two empirical sources:

1. Local no-spin trajectory measurements, evaluated with the current geometry
   constraint (nozzle height 0.225 m, base-back to nozzle 0.265 m):
   raw 2025 -> 5.04 m/s, raw 2167 -> 5.39 m/s, raw 2388 -> 5.79 m/s.
2. Spinsight measurements for Nova speed/spin settings. The published table reports
   in-flight km/h and rps, so the speed values are not treated as nozzle-exit speed
   directly. A least-squares overlap correction is first fit against the local
   launch-speed observations.

The corrected Spinsight speed observations and the local launch-speed observations
are then fit with one first-order model rather than interpolated point-to-point:

```text
v_exit [m/s] = 2.431958 + 0.001333941 * raw_wheel_input
RMSE = 0.160589 m/s over the 21 combined source observations
```

First-, second-, and third-order fits were compared; their RMSE values were
approximately 0.1606, 0.1595, and 0.1590 m/s respectively. The negligible reduction
from extra polynomial terms did not justify the added curvature, so the first-order
model is used. Guided calibration likewise regularizes its fitted no-spin speed
points to a straight line.

Spin remains based on the published speed-dependent max-spin-setting / max-rps table.
At any fixed Nova speed, rps is modeled linearly with the upper-minus-lower wheel
command difference.

Protocol setting formulas and Spinsight table:

- https://github.com/olanga/nova/wiki/General-information
- https://github.com/olanga/nova/wiki/Spinsight-measurements-with-Nova-S-Pro
- Independent high-spin cross-check (7500 / 500 wheels ~= 67 rps):
  https://www.tabletennisdaily.com/forum/topics/pongbot-nova-s-pro-owners-review-and-discussion-thread.36322/page-12

This is an empirical command-to-ball model, not a manufacturer calibration. Robot-to-robot
variation, wheel contamination, ball wear and measurement geometry can shift it.

## Remaining limitations

- The launch state still depends on the current Nova speed/spin calibration.
- Physical head orientation is not yet converted to a fully verified 3D spin axis.
- Spin is held constant during free flight.
- No table-bounce model is used for first-landing prediction.
- Robot alignment, ball wear and wheel contamination still require empirical
  calibration and safety margins.


## Model policy

Table Tennis Robot Studio uses the Conti et al. (2026) free-flight model as the
default aerodynamic model rather than exposing aerodynamic tuning as part of normal
calibration.

Angular velocity is held constant during the first flight segment. This follows
the cited model and avoids adding an unsupported aerodynamic torque or spin-decay
law. A future spin-decay model should only be added when an identified
torque model or suitable measurements justify it.
