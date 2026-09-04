# Product design backlog

Captured 2026-09-04. These are product observations and future work, not completed features or authorization to implement them yet.

## Product principles

- Keep routine use low-friction.
- Give users full control, including advanced and complicated features. The app is intended to replace the official Pongbot app where its limitations get in the way.
- Make the interface as simple and intuitive as possible without achieving simplicity by restricting the user.
- Treat phone screen space as valuable. Avoid persistent explanations that are irrelevant during routine use and avoid unused dead space.
- Prefer progressive disclosure: show the control and the few words needed to use it, then make deeper explanations available on demand.

## Completed

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

### Reduce text in core workflows

There is far too much persistent text around frequently used features. Audit the Run, drill editing, shot editing, live-tuning, library, and calibration workflows.

- Keep routine labels and explanations to a few words where possible.
- Move longer explanations behind a small outlined circular information button placed at the top-right of the control or group it explains.
- The information affordance must work with hover, keyboard focus, and tap; it must not depend on hover alone.
- Longer persistent text remains appropriate in settings, uncommon setup flows, safety-critical notices, and places users do not operate on every session.
- The top of the current live-tuning interface is one concrete example, but not the only place that needs this treatment.

### Add an idle/resting robot-head state

When the app does not expect to shoot soon—normally outside Run drill and calibration—the head should return to a defined resting state.

Goals:

- Give the user an obvious physical signal that the robot is not about to shoot.
- Reduce sustained stress or load on motors and gears.
- Define the safe resting pose, entry delay, cancellation behavior, and protocol command before implementation.
- Enter rest after leaving shooting/calibration modes, while preserving explicit manual or diagnostic control where appropriate.

### Use practical numeric shot controls

Shot inputs expose much more precision than a person or the BLE representation needs.

- Speed should normally fit a value such as `12.34 m/s` rather than exposing long decimals.
- Spin should allow values into the hundreds of rps while remaining compact; roughly six input characters is sufficient.
- Derive allowed ranges and increments from meaningful physical limits and the effective BLE encoding resolution. Do not imply precision the robot cannot use.
- Add prominent `−` and `+` controls that use available space well.
- Keep direct numeric entry for freedom and accessibility.

### Improve back and folder navigation

- Make Back controls larger and easier to hit, especially on phones.
- In folder views, provide an explicit parent-folder item that moves up one level.
- Do not rely on clicking a breadcrumb/path segment as the only way to navigate upward.

### Convert live tuning to sliders with fine controls

- Use sliders for coarse adjustment.
- Overlay the current numeric value legibly on the slider.
- Retain `−` and `+` buttons for fine adjustment, using smaller steps than today.
- Give the buttons sufficiently large hit areas and separate them from the slider so a near-miss cannot jump the slider toward an extreme.
- Support touch, pointer, and keyboard operation.
- Keep the existing non-destructive tuning semantics and rolling live-update behavior.

### Make trajectory checks informative, not restrictive

The app currently refused to play a deliberately authored shot that the model predicted would hit the net.

- Clearly indicate predicted outcomes such as net contact, failure to cross the net, landing long, landing off the side, or no modeled landing.
- Distinguish a model warning from a transport/hardware-invalid command.
- Allow the user to play physically encodable shots despite trajectory warnings after an appropriately lightweight acknowledgement.
- Continue blocking only commands that cannot be represented safely or validly for the hardware.

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

1. Perform the core-workflow text and dead-space audit.
2. Improve numeric controls, Back targets, and parent-folder navigation.
3. Redesign live tuning as coarse sliders plus fine buttons.
4. Separate trajectory warnings from genuinely invalid hardware commands.
5. Add second-bounce goals/variation and the Serve node.
6. Add manual/Auto transition timing using the initial return-cycle model.
7. Specify and test the resting-head state with the physical robot available.
8. Promote AI assist globally and add screen-aware help context.
