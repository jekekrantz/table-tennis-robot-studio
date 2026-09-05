# Product design backlog

Captured 2026-09-04. These are product observations and future work, not completed features or authorization to implement them yet.

## Product principles

- Keep routine use low-friction.
- Give users full control, including advanced and complicated features. The app is intended to replace the official Pongbot app where its limitations get in the way.
- Make the interface as simple and intuitive as possible without achieving simplicity by restricting the user.
- Treat phone screen space as valuable. Avoid persistent explanations that are irrelevant during routine use and avoid unused dead space.
- Prefer progressive disclosure: show the control and the few words needed to use it, then make deeper explanations available on demand.

## Completed

### Improve back and folder navigation — completed 2026-09-04

- Increased Back controls to a minimum 48 × 48 px target, including on phones.
- Added an explicit parent-folder row at the top of every nested built-in or My
  drills folder while retaining breadcrumbs for direct ancestor navigation.

### Make trajectory checks informative, not restrictive — completed 2026-09-04

- Distinguishes modeled net contact, failure to cross the net, long placement,
  side misses, edge contact, and missing landings.
- Treats trajectory outcomes as warnings rather than hardware-invalid errors.
- Requires a lightweight `Play anyway` acknowledgement once per distinct set of
  trajectory warnings during the current app session.
- Continues to block commands whose Nova elevation, placement, orientation, or
  other hardware representation is invalid.

### Reduce text in core workflows — completed 2026-09-04

- Audited the Run, drill editing, shot editing, live-tuning, library, and
  calibration workflows to reduce persistent routine text and dead space.
- Kept routine labels concise and moved deeper explanations behind information
  affordances that work with hover, keyboard focus, and tap.
- Retained persistent text where it remains appropriate for setup, settings,
  safety, and uncommon workflows.

### Use practical numeric shot controls — completed 2026-09-04

- Limited displayed precision and control sizing to values meaningful to people
  and the BLE representation.
- Added prominent `−` and `+` controls while retaining accessible direct numeric
  entry.
- Based ranges and increments on practical physical and encoding limits.

### Convert live tuning to sliders with fine controls — completed 2026-09-04

- Added sliders for coarse adjustment with legible current values.
- Retained separate, generously sized `−` and `+` buttons for fine adjustment.
- Supports touch, pointer, and keyboard use while preserving non-destructive
  tuning and rolling live-update behavior.

### Serve shot type — completed 2026-09-04

- Added a first-class **Serve** node with serve-oriented defaults and the same full manual speed, spin, elevation, aim, variation, timing, and connection controls as a Shot.
- Serve previews simulate three flight segments: release to the robot-side
  bounce, across the net to the receiver's first bounce, then onward to the
  receiver's second bounce or the 0.5 m outside-table display limit.
- Serve validation distinguishes an invalid first-bounce side, post-bounce net failure, and invalid second-bounce placement without turning a trajectory-model warning into a hardware encoding error.
- Serve nodes participate in traversal, Nova playback, live tuning, import/export, duplication, sharing, and AI-assist data handling.
- Added a dedicated built-in **Serve / receive** collection with short backspin,
  short no-spin, fast-long topspin, third-ball follow-ups, spin/length
  recognition, weighted randomness, controlled physical variation, and a
  reusable combination mix.

### Simulate and display post-bounce trajectories — completed 2026-09-04

- Added the Conti et al. ball-table contact model, including incoming velocity,
  spin, sliding/rolling friction, velocity-dependent restitution, and the
  published fitted residual corrections.
- Extended shot-creation and drill/drill-editor previews through the second
  bounce, capped at 0.5 m outside the table. Serve previews add a third flight
  segment through the receiver's second bounce. Calibration views intentionally
  remain first-flight-only.
- Rendered the first arc and landing in the existing outcome color and the
  second arc and landing in high-contrast magenta, and the Serve-only third arc
  in gold, with white-ringed bounce circles in both top and side views. Full
  creation/editor previews include a numbered color key so every segment is
  immediately identifiable.
- Long trajectories that exceed the display limit stop at the boundary without
  inventing a second-bounce marker.
- Marked post-bounce placement as an equipment-specific approximation.
- Removed the routine `15.25 cm net` annotation; net height is labeled only
  when it differs from the regulation default.

## Backlog

### Add an idle/resting robot-head state

When the app does not expect to shoot soon—normally outside Run drill and calibration—the head should return to a defined resting state.

Goals:

- Give the user an obvious physical signal that the robot is not about to shoot.
- Reduce sustained stress or load on motors and gears.
- Define the safe resting pose, entry delay, cancellation behavior, and protocol command before implementation.
- Enter rest after leaving shooting/calibration modes, while preserving explicit manual or diagnostic control where appropriate.

### Support second-bounce goals and variation

- Let the user specify a desired second-bounce outcome, including half-long placement.
- Provide a more general way to define allowed second-bounce position variation, not only fixed categorical labels.
- Incorporate second-bounce constraints into shot/serve solving and sampling without biasing samples toward feasibility boundaries.
- Clearly report when the requested first-bounce, second-bounce, clearance, speed, and spin combination is infeasible, while retaining the non-restrictive warning policy for physically encodable commands.

### Add automatic timing between shots

Each transition between shots should allow either a manually specified delay or **Auto** timing.

For the initial Auto model, assume:

- The user contacts each incoming ball at its post-bounce peak height.
- The user returns ball A with the same speed and spin with which the robot fired it.
- The next robot ball is B.

Use this first timing estimate:

```text
delay(A → B) = 2 × (A flight time + A bounce-to-peak time)
               + B flight time + B bounce-to-peak time
```

- Compute flight and bounce-to-peak times from the trajectory and bounce models rather than fixed constants.
- Show the resulting Auto delay in a compact form and allow the user to override it manually.
- Recompute Auto timing when relevant shot, serve, spin, bounce, robot-pose, or calibration parameters change.
- Keep future timing models open to return types such as flick, push, kick, opening loop, and other user-selectable responses.

### Make AI assist global and context-aware

- Add an AI assist button in the top app bar beside the Nova control so it is reachable from every screen.
- Include the current screen/menu, active drill or editor selection, and relevant visible state as context.
- Preserve all existing drill-assistant capabilities while extending the assistant to general app help.
- Support questions such as:
  - “How do I make a new drill?”
  - “Where do I add a shot in the shot editor?”
  - “How do I calibrate the robot?”
- Make it clear what context will be used, and do not silently include secrets, Bluetooth logs, or unrelated stored data in external AI requests.

## Suggested order when revisiting

1. Add second-bounce goals and variation.
2. Add manual/Auto transition timing using the initial return-cycle model.
3. Specify and test the resting-head state with the physical robot available.
4. Promote AI assist globally and add screen-aware help context.
