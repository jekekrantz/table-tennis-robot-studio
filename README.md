# Table Tennis Robot Studio

Table Tennis Robot Studio is a static web app for designing table-tennis drills, previewing
ball trajectories, and controlling a Pongbot Nova S Pro over Web Bluetooth.

This repository is intended to be usable directly from GitHub Pages and for local
development without a build step or package manager.

## Current capabilities

- Visual drill graph with shots, weighted-random branches, sub-drills and repeaters.
- Per-drill set count and delay between sets.
- Local browser persistence plus JSON import/export.
- Web Bluetooth connection, authentication and state-aware Nova control.
- Real Start/Stop execution with Ready-state gating and heartbeat handling.
- Small Start batches for BLE/robot stability.
- Physical shot inputs in m/s, rps and degrees, converted to Nova parameters.
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

For the intended repository, configure GitHub Pages to deploy the `main` branch from
`/ (root)`. No ChatGPT/GitHub connection is required; files can be uploaded manually
or pushed with normal Git tooling.

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

## Robot geometry and calibration

The current default nozzle height is:

```text
0.205 m
```

This is a working estimate for the center of the Nova S Pro ball exit above the table
with the head nominally level. It is not presented as a manufacturer-specified
measurement. Keep it configurable and calibrate against the physical robot when
trajectory accuracy matters.

The editor uses physical inputs:

- speed: m/s
- spin: rps, negative underspin and positive topspin
- elevation: degrees
- aim: degrees

Real Play currently permits physical head orientation types `0` and `4`. Side/mixed
orientations remain blocked until their physical spin axes are verified.

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
  "activeDrillId": "...",
  "calibration": {},
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

The GitHub Actions workflow runs the same syntax and mock checks on pushes and pull
requests.

## Repository layout

```text
index.html                 App shell
styles.css                 App styles
app.js                     Drill editor, calibration, trajectory and orchestration
pongbot-protocol.js        Protocol encoding/decoding and parameter conversion
pongbot-ble.js             Web Bluetooth transport and Nova state machine
selftest.js                Offline protocol/BLE integration test
PROTOCOL.md                Packet-level protocol notes and provenance
MODEL_SOURCES.md           Trajectory-model sources and assumptions
SECURITY.md                Safety/privacy guidance for contributors
THIRD_PARTY_NOTICES.md     External references and provenance notes
scripts/                   Local development and preflight helpers
.github/workflows/         CI checks
```

## Licensing and provenance

The repository is licensed under GPL-3.0. No third-party source tree or runtime
dependency is vendored. Protocol interoperability facts were informed by direct
hardware work and public community references; see `THIRD_PARTY_NOTICES.md` and
`PROTOCOL.md`.

Pongbot/PONGBOT and other product names may be trademarks of their respective owners.
This is an independent community project and is not affiliated with or endorsed by
Pongbot.
