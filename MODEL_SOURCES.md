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

## Ball-table contact model

The shot/serve creation and drill-editor previews continue past a first on-table
landing using Section III-C, equations (6)-(20), of Conti et al. Serve previews
apply the contact model again at the receiver's first bounce and therefore show
three free-flight segments. The first post-contact flight evaluates net crossing
and the legal receiver-side contact:

- instantaneous point contact with sliding/rolling regimes;
- dynamic friction coefficient 0.25 and thin-shell inertia ratio 3/2;
- impact-speed-dependent normal restitution `e_n = 0.98 + 0.02 v_z^-`;
- the four published Lasso-fitted residual correction matrices, rotated from a
  frame aligned with the incoming horizontal velocity into the app's table frame;
- the same aerodynamic model and constant post-contact spin during the second
  free-flight segment.

The fitted contact residuals came from almost 25,000 contacts using Nittaku
Nexcel 40+ 3-star balls and a SAN-EI table. Post-bounce placement is therefore
shown as an equipment-specific estimate rather than an exact prediction. The
preview stops at the projected second table-plane contact, or when the ball has
travelled 0.5 m outside the table footprint, whichever happens first.

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

The launch geometry is not inferred from the external speed data. It uses the measured fixed chain documented in `README.md` and `CALIBRATION_REFIT.md`.

The operational raw-wheel-input -> launch-speed relation is one two-parameter affine model fitted to the local no-spin ground-distance calibration:

```text
v_exit [m/s] = -0.27588934 + 0.00239366039 * raw_wheel_input
calibrated raw range = 2000..3000
```

No piecewise speed map or per-raw latent speed parameters are used. Outside the measured range the same line is extrapolated and the UI warns that it is extrapolation.

The Spinsight-derived table is retained only as an empirical **spin-capacity** reference versus Nova's native speed-setting axis. Its raw-setting conversion does not replace or bend the global launch-speed line.

Guided calibration uses the fixed pivot-chain release point, distance/incidence-dependent relative uncertainty and iterative MAD rejection of standardized landing-distance residuals before the affine coefficients are finalized.

## Remaining limitations

- The launch state still depends on the current Nova speed/spin calibration.
- Physical head orientation is not yet converted to a fully verified 3D spin axis.
- Spin is held constant during free flight.
- The bounce model does not change ordinary-shot first-landing prediction or
  guided calibration. Serve preview, validation, and variation use the
  post-contact net crossing and receiver-side first bounce; display then applies
  the model once more for the receiver-side second-bounce arc.
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
