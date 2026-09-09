# Product design backlog

Captured 2026-09-04. These are product observations and future work, not completed features or authorization to implement them yet.

## Product principles

- Keep routine use low-friction.
- Give users full control, including advanced and complicated features. The app is intended to replace the official Pongbot app where its limitations get in the way.
- Make the interface as simple and intuitive as possible without achieving simplicity by restricting the user.
- Treat phone screen space as valuable. Avoid persistent explanations that are irrelevant during routine use and avoid unused dead space.
- Prefer progressive disclosure: show the control and the few words needed to use it, then make deeper explanations available on demand.

## Completed

### Streamline new drill construction — completed 2026-09-09

- Opening a new drill immediately opens the node-type chooser.
- A newly added Serve becomes the first step and connects to the previous start
  when one exists.
- Other new nodes connect from the most recently created node when that output
  is available; selecting an edge still inserts the node into that path.

### Audit built-in club-training drills — completed 2026-09-09

- Confirmed rally, footwork, and attacking feeds use positive topspin; zero-spin
  remains limited to drills explicitly teaching or recognizing no-spin balls.
- Added deep, heavy-underspin feeds and dedicated backhand consistency,
  forehand/backhand alternating, and random-placement push drills.
- Added regression checks tying topspin, backspin, and no-spin preset names to
  the expected spin direction.

### Keep default shot intervals self-consistent — completed 2026-09-09

- Initialize and display intuitive outcome intervals from the same
  Nova-representable, wheel-quantized trajectory used by feasibility checks.
- Prevent a small interval expansion from excluding the otherwise unchanged
  default shot because its ideal and representable outcomes differ slightly.

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

### Global, context-aware AI assist — completed 2026-09-06

- Added AI assist to the top app bar so it is reachable from every screen.
- Added local help for library browsing, running and editing drills, calibration, connection/idle behavior, and import/export/share questions while preserving validated drill creation and editing.
- Context follows the visible surface: Library supplies collection/folder/search state without leaking the last active drill; Run and Editor supply the open drill; Editor adds the visible selection/mode; Robot supplies idle settings; Calibration supplies its open section.
- Every provider request also includes a stable app-capabilities guide. The dialog discloses both this general knowledge and the allow-listed local context before use. Only Run/Editor drill requests may include the open drill definition.
- Excludes Bluetooth logs, device identifiers, API keys, calibration values, unrelated stored drills, and arbitrary application state.

### Add safe idle and connection lifecycle — software completed 2026-09-06

- Leaving active Run or calibration work sends STOP as needed and waits for Nova to report Ready while retaining the BLE connection for a fast restart.
- Added a separate configurable idle STOP, defaulting to two minutes since the connection or last confirmed ball event. Ready and Uninitialized already satisfy the stopped condition; otherwise it sends STOP, confirms Nova reaches Ready or Uninitialized, and retains BLE. The next Start initializes automatically when required.
- Added a Robot-menu setting to disconnect after 5, 10, 15, 30, or 60 minutes without robot use, with 10 minutes as the default and Never as an option.
- The BLE disconnect timeout never interrupts a running drill or calibration. The shorter STOP timer is deliberately based on confirmed ball events and ends activity after the configured no-shot interval. Changing browser visibility alone does not trigger shutdown.
- The inactivity timeout performs an orderly Ready transition before disconnecting. Page close retains the separate best-effort STOP and immediate GATT disconnect because browsers cannot guarantee awaited BLE work during teardown.

## Backlog

### Verify and enable a physical robot-head parking pose

The software idle state now confirms Nova is Ready and retains the connection. A distinct physical parking move remains disabled until it can be verified on the robot without firing or feeding.

Goals:

- Define the safe resting pose, entry delay, cancellation behavior, and protocol command before implementation.
- Confirm that entering and leaving the pose cannot feed or fire a ball and measure the added first-shot positioning delay.
- Once verified, add the pose as an optional step after the existing confirmed-Ready transition.

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

## Suggested order when revisiting

1. Add second-bounce goals and variation.
2. Add manual/Auto transition timing using the initial return-cycle model.
3. Verify and enable the physical resting-head pose with the robot available.
