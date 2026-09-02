# Table Tennis Robot Studio

Table Tennis Robot Studio is a static web app for designing table-tennis drills, previewing
ball trajectories, and controlling a Pongbot Nova S Pro over Web Bluetooth.

This repository is intended to be usable directly from GitHub Pages and for local
development without a build step or package manager.

## Drill library organization

The drill browser deliberately separates two roots:

- **Built-in** is read-only and ships with the app. It is organized into virtual folders (Shots, Footwork, Placement, Spin, and Random / match-like) and updates automatically with new app releases. Use **Copy to My drills** before changing a built-in graph.
- **My drills** contains only user-created/copied drills. It is saved locally, exported/imported with calibration, and supports nested virtual folders, move, duplicate, rename, and delete operations. Removing a folder moves its contents up one level instead of deleting drills.

Built-in drills are not written to browser storage. This prevents app upgrades from overwriting custom work and prevents stale stored defaults from hiding newer built-in presets. Live tuning is stored separately as a player preference and never edits either source.

## App flow

The user-facing navigation is organized around intent rather than editor internals:

1. **Library** is the start page. Tapping a drill opens **Run**; the pencil action opens **Edit**. **New drill** creates an empty `START → END` drill and opens the editor.
2. **Run** contains Play/Stop, repetitions, delay between repetitions, persistent player tuning, current-vs-authored robot pose, preview, saving the effective setup, and an **Edit drill** action.
3. **Edit** contains the graph. Every drill has a structural START and at least one terminating END path. On phones the graph is laid out vertically with branch siblings separated into collision-free rows; read-only built-ins use a deterministic horizontal layered layout on desktop. Node cards size themselves to their rendered contents, and shot cards keep compact speed/spin metrics on one line. The floating `+` opens a configure-before-create menu for shots, random choices, repeaters and sub-drills.
4. Node/connection **Details** are a separate screen on phones and a side pane on desktop, so editing controls never cover the graph. Drill name, description, tags, folder and expected robot pose live in **Drill details** rather than on the canvas.
5. **Robot** is global. It owns Connect/Disconnect, diagnostics, calibration and model/geometry settings. The compact Nova status in the top bar opens the same Robot page.

Back arrows pop navigation history; close buttons dismiss only the current dialog/details layer.

## Current capabilities

- Visual drill graph with shots, weighted-random branches, sub-drills and repeaters.
- Per-drill repetition count and delay between repetitions.
- Local browser persistence plus JSON import/export.
- Web Bluetooth connection, authentication and state-aware Nova control.
- Real Start/Stop execution with Ready-state gating and heartbeat handling.
- Small Start batches for BLE/robot stability.
- Physical shot inputs in m/s, rps and degrees, converted to Nova parameters.
- Physically constrained per-shot variation in landing position, net clearance, speed and spin, used selectively by random, match-like and variable-practice drills.
- Persisted manual SE(2) robot-position calibration with uncertainty-aware verification targets based on table lines and net geometry.
- One bounded runtime solve combines robot-position compensation with live speed, spin and clearance adjustments; the source drill remains unchanged and the effective result can be saved as a new drill.
- Trajectory preview using a published aerodynamic free-flight model with ITTF ball parameters.
- Editable robot/table calibration, including a one-ball physical calibration test.
- Protocol diagnostics and an offline protocol/BLE mock self-test.

## Safety

This app can command physical hardware. Keep the Nova unobstructed and its physical
stop/power control accessible during development and calibration. Treat changes to
BLE authentication, packet construction, Start/Stop state handling, and
calibration-to-hardware conversion as safety-sensitive.

Predicted trajectories are planning aids, not safety interlocks or guarantees of
where a physical ball will land.

## Run locally

From the repository root:

```bash
python3 scripts/serve.py
```

Then open:

```text
http://localhost:8080
```

The helper server disables caching while developing.

Web Bluetooth requires a secure context. Browsers treat `localhost` as trustworthy;
a normal plain-HTTP LAN address usually is not sufficient.

### Android through ADB

With Android Platform Tools installed and USB debugging enabled:

```bash
./scripts/serve_android_via_adb.sh
```

Then open `http://localhost:8080` in Chrome on the Android device.

## GitHub Pages

The app is static and can be served directly from the repository root. `.nojekyll`
is included so GitHub Pages serves the files as-is.

Production loads a generated **`runtime.bundle.js`**, containing the JavaScript runtime
in one versioned file. The separate source files remain in the repository for development
and tests. This makes deployment much less vulnerable to a new HTML/app shell being mixed
with missing or stale runtime modules.

For the intended repository, configure GitHub Pages to deploy the `main` branch from
`/ (root)`. **Deploy the complete release together; do not upload only a hand-picked set
of files such as `index.html` and `app.js`.**

The safest update from a local checkout is:

```bash
python3 scripts/build_runtime_bundle.py --check
bash scripts/preflight.sh
git add -A
git status
git commit -m "Update Table Tennis Robot Studio"
git push
```

`git add -A` is intentional: it adds newly introduced files and removes obsolete ones in
the same commit. The included GitHub Actions workflow runs the repository preflight on
pushes to `main`. `RELEASE_MANIFEST.sha256` also records the exact release file set and
can be verified locally with `sha256sum -c RELEASE_MANIFEST.sha256`.

If the deployed site reports that its runtime did not load, compare the repository with
the release ZIP. The root must contain `runtime.bundle.js` and `BUILD_ID`, and the bundle
query in `index.html` must use that build ID. Wait for GitHub Pages to finish deploying,
then reload. Clearing browser site data should not be the first troubleshooting step.

## Connect and run a drill

1. Power on the Nova.
2. Open the app in a Web-Bluetooth-capable Chromium browser.
3. Press **Connect Nova** and select the robot in the browser chooser.
4. Wait for **Ready**.
5. Build or select a valid drill.
6. Press **Play** to send real motor/feed commands.
7. Press **Stop** to cancel and return the robot to Ready.

**Preview trace** is simulation-only. **Calibration → Calibration test shot** sends
one real ball using the current calibration and the same state gating as normal Play.

## Guided calibration setups

The guided calibration supports two experiment geometries. **On table** uses the tabletop as the support plane and can use net-referenced landing distance plus optional net clearance. **On ground** is a flat-floor calibration only: place the robot on the floor, use the back of the robot base as x=0, and measure from the back of the base to the first landing point on the ground. The table and net are not part of the ground calibration forward model. Switching calibration setup does not change the operational robot pose used by drills.

## Robot geometry and calibration

The launch point is a fixed measured mechanical chain referenced from the **back of the robot base**:

```text
base back -> yaw pivot:    0.242 m
yaw pivot -> pitch pivot: 0.075 m
pitch pivot -> wheels:    0.075 m
yaw pivot height:         0.240 m above the support surface
```

These dimensions are treated as exact project measurements for now and are not calibration parameters. Aim/yaw rotates the two links after the yaw pivot; elevation rotates the final pitch-to-wheel link, so the physical release point moves with both aim and elevation.

The editor uses physical inputs:

- speed: m/s
- spin: rps, negative underspin and positive topspin
- elevation: degrees
- aim: degrees

Raw wheel input -> launch speed is deliberately **one global affine model** with two fitted parameters only:

```text
v_exit [m/s] = intercept + slope * raw_wheel_input
```

The current fixed-geometry robust fit of the visible 2026-08-28 flat-ground measurements is approximately:

```text
v_exit [m/s] = -0.27588934 + 0.00239366039 * raw_wheel_input
measured raw range = 2000..3000
```

The measured range is used only to mark extrapolation; it does not create extra knots or clamp the line. Guided calibration fits the intercept and slope jointly across all active observations. Distance uncertainty is weighted approximately as predicted distance divided by the sine of predicted ground-incidence angle, and iterative MAD rejection is applied to standardized residuals. Mechanical dimensions stay fixed.

A **measurement offset** can be applied before fitting. The convention is `corrected distance = entered distance + offset`; for example, if a tape's zero is 10 cm behind the back of the base, enter `-10 cm`.

Real Play currently permits physical head orientation types `0` and `4`. Side/mixed orientations remain blocked until their physical spin axes are verified.

## Default training library

A fresh install now starts with a practical shot-and-drill library instead of the old graph-editor demonstration examples. It includes common topspin, backspin, no-spin and fast/deep feeds plus forehand/backhand alternating, 2-2, Falkenberg, three-point and semi-random/random footwork patterns. Built-in shot parameters were solved with the current default trajectory model from the centered robot position and use conservative table-edge and net-clearance margins.

Built-in drills are read-only and update with the app. **My drills** are stored independently, so updating built-ins never overwrites custom work. Older saved default presets are migrated out of browser storage while modified/custom drills are kept under My drills. Calibration is preserved during migration.

See `TRAINING_LIBRARY.md` for the preset list, modeled target assumptions and coaching references.

## Execution model

Each set is compiled immediately before execution, so weighted-random branches are
sampled independently for each set.

Flow semantics:

- **Single shot** → one Nova ball record.
- **Weighted random** → choose one outgoing branch by relative weight.
- **Sub-drill** → execute the referenced drill, then return to the parent.
- **Repeater** → local counter with Repeat/Finish outputs.
- No outgoing path → the set is complete.

Repeater state is local to each drill invocation. Each top-level set is a fresh
invocation.

For stability, Start commands contain at most **6 ball records**. Longer sequences
are split into batches and the controller waits for the Nova to return to Ready
between batches.

## Timing

The fifth float in a Nova ball record is frequency in Hz, not seconds. The conversion
used by the controller is:

```text
frequency_hz = 0.5 + percentage / 100
pre_pause_seconds = 1 / frequency_hz
```

The editor exposes delay-before-target in seconds and converts it to frequency when
building the target record. Directly encodable delays are approximately 0.667–2.000 s;
longer delays are split between browser-side waiting and the robot's encoded pause.

See `PROTOCOL.md` for packet-level details and provenance.

## Trajectory model

The trajectory preview uses the aerodynamic free-flight model from Conti et al.
(2026), with ITTF ball and table values, constant angular velocity during the first
flight segment, drag and Magnus forces, and numerical integration.

Primary research source:

> Christian Conti, Bilan Yang, Alexander Sigrist, Lorenzo Miele, Yamen Saraiji,
> Peter Dürr, and Naoya Takahashi. *Physics Models for Sim-to-Real Transfer in
> Professional-Level Robot Table Tennis*. arXiv:2606.28805, 2026.
> https://arxiv.org/abs/2606.28805

See `MODEL_SOURCES.md` for sources, assumptions and remaining limitations.

## Persistence and JSON schema

Browser data uses one current storage key:

```text
table-tennis-robot-studio
```

The current JSON format uses:

```json
{
  "schemaVersion": 1,
  "activeDrillSource": "builtin",
  "activeDrillId": "...",
  "calibration": {},
  "folders": [],
  "drills": []
}
```

Imports must match the current schema. If the schema changes, bump
`SCHEMA_VERSION` and update the import/export contract deliberately.

## Development checks

Run the full local preflight:

```bash
./scripts/preflight.sh
```

It checks JavaScript syntax, protocol/controller mock behavior, helper-script syntax,
common credential patterns, and likely device-specific serials.

The core offline test can also be run directly:

```bash
node selftest.js
```

For a full local regression pass, run `bash scripts/preflight.sh`.

## Repository layout

```text
index.html                 App shell
styles.css                 App styles
app.js                     Drill editor, runtime, calibration and orchestration
robot-geometry.js          Fixed measured base/yaw/pitch/wheel geometry
launch-model.js            One global affine raw-input → launch-speed model
guided-calibration.js      Weighted robust calibration solver
pongbot-protocol.js        Protocol encoding/decoding and parameter conversion
pongbot-ble.js             Web Bluetooth transport, telemetry and Nova state machine
protocol-debug.js          Raw timed protocol-script parser/executor
studio-features-core.js    Portable drills, AI/debug validation and serialization
studio-features.js         Sharing, AI assistant and Guided Debug UI
debug-advisor.js           Deterministic/optional backend debug-advisor abstraction
debug-packs/               Importable bounded diagnostic experiment packs
docs/                      Feature and interchange-format documentation
vendor/                    Small vendored browser dependencies with licenses
tools/                     Optional local development companions
scripts/                   Local serving, tests and preflight helpers
PROTOCOL.md                Packet-level protocol notes and provenance
MODEL_SOURCES.md           Trajectory-model sources and assumptions
TRAINING_LIBRARY.md         Default shot/drill presets and coaching references
SECURITY.md                Safety/privacy guidance for contributors
THIRD_PARTY_NOTICES.md     External references and vendored-component notices
```

## Licensing and provenance

The repository is licensed under GPL-3.0. A small MIT-licensed QRCode component is vendored under `vendor/` so QR drill sharing works offline; its license is retained there. Protocol interoperability facts were informed by direct hardware work and public community references; see `THIRD_PARTY_NOTICES.md` and `PROTOCOL.md`.

Pongbot/PONGBOT and other product names may be trademarks of their respective owners.
This is an independent community project and is not affiliated with or endorsed by
Pongbot.

## Live tuning

The graph toolbar includes **Live tuning**, a non-destructive player-preference layer for quick drill fine-tuning. The tuning profile is saved separately in browser storage so an advanced player can keep a faster/lower style across sessions while a beginner can keep a gentler profile. It is intentionally **not** written into drills and is not exported with the drill library.

- **Pace** uses 5% steps from -50% to +100%. Pace is treated as a rate: +100% is twice the pace (half the delays), and -50% is half the pace. The between-set delay is scaled too because it is also the inter-ball interval for single-shot drills.
- **Net clearance** uses 5% steps from -100% to +200%. The -100% endpoint targets about 0.2 cm of modeled clearance rather than forcing an exact numerical net contact. The runtime solver adjusts elevation and exit speed together to preserve the stored landing point; spin/exit-speed ratio is kept constant where the modeled/hardware range permits it.
- **Spin** uses 5% steps from -100% to +300%. It scales spin magnitude while keeping exit speed fixed, then solves elevation to minimize landing shift. A no-spin shot remains no-spin.
- **Speed** uses smaller 2% steps from -50% to +50%. It changes exit speed while keeping spin fixed, then solves elevation to minimize landing shift. Hardware/model speed limits still apply.

The stored shot parameters stay unchanged. Preview uses the effective tuned shots, and Play applies the same modifiers independently to every ball in the compiled traversal, including balls reached through sub-drills. Live changes are queued for the **next sequence buffer** instead of STOP/restarting the active buffer, so tuning does not deliberately insert a physical pause.

Normal playback also crosses logical set boundaries when possible. A single Nova START may contain records from more than one set, up to the current conservative nine-record transport window. Ordinary set boundaries do not generate STOP/START. Inter-ball and between-set delays are encoded in the shot frequency field whenever the requested interval is within the known Nova range; a host-side wait/buffer boundary is used only when the requested delay cannot be represented there. The **Guided debug** tool contains bounded experiments for larger buffers, heartbeat behavior and attempting to append a second START while playback is active; normal playback stays conservative until those firmware-dependent behaviors are proven on hardware.

## Drill sharing and AI-assisted editing

Drills can be shared without accounts or a backend. **Share** can create a URL-fragment link, use the native device share sheet when available, render a locally generated QR code, or save a human-readable `.ttdrill` file. Opening a shared link or importing a file always shows a preview before creating an independent copy in **My drills**.

The editor also provides **AI assist**. The default local assistant handles common table-tennis creation/edit requests offline. Advanced options support session-memory-only BYOK provider calls (the user supplies both provider model ID and key) and a first-class external-AI handoff: copy/download one self-contained request, use any preferred assistant, then paste/import the returned versioned drill. Every proposal is validated locally before Apply and never bypasses the normal drill compiler or robot-control path. Browser speech recognition is used for prompt transcription when available and only after the user taps the microphone button.

## Guided protocol debugger

Robot -> **Guided debug** runs one bounded diagnostic experiment at a time and records outgoing/incoming BLE traffic, timings, heartbeat events, connection changes and errors automatically. Human input is limited to physical observations such as whether the robot paused. The built-in adaptive tree starts with continuous-play questions: long START packets, heartbeat traffic, active-buffer append attempts and status traffic during playback. Sessions can be exported as JSON or copied as a compact ChatGPT handoff. Imported test packs are schema-checked and bounded before they can run.

## Protocol debugger

Robot → **Protocol debugger** opens a developer tool for running timed raw BLE scripts without rebuilding the app. A `.nova` or `.txt` file can be uploaded, edited in the browser, validated, saved locally, and rerun as often as needed.

Supported commands:

```text
# or // comment
MARK free-form label
TX <hex bytes>
REQ <expected-opcode-hex> <hex bytes> [TIMEOUT <duration>]
WAIT <duration>
STATUS
HEARTBEAT
PAUSE
CONTINUE
STOP
```

Durations accept `ms` or `s`; bare numbers are milliseconds. Hex may be compact (`830600`) or spaced (`83 06 00`) with optional `0x` prefixes. `TX` is fire-and-forget, while `REQ` waits for a response with the specified opcode. Uploading or editing never transmits anything; **Run script** is explicit. The debugger can optionally pause the app's automatic 10-second heartbeat for deterministic protocol experiments and restores it afterward.

`debug-scripts/status-heartbeat.nova` is a safe starter example. The debugger has a separate stop-script control and a **Stop Nova** control, and can download a combined execution + BLE protocol log for comparison between experiments.

For fast iteration, select one or more lines in the editor and choose **Run line / selection**; with no selection, it runs the line containing the cursor. `Ctrl+Enter` / `Cmd+Enter` does the same thing. This is useful for tweaking one `0x84` candidate frame repeatedly while leaving the longer setup script untouched.

### Calibration fit diagnostics

Guided calibration reports signed landing-distance residuals (`predicted - measured`) against both elevation and raw wheel input. It also exports the original entered distance, measurement offset, corrected distance, predicted distance, predicted incidence angle, per-shot uncertainty, standardized residual and MAD inclusion/rejection status as CSV.

The release point used for every residual already comes from the fixed measured yaw/pitch/wheel pivot chain, so elevation and aim change the launch coordinates before free flight begins.
