# `.ttdrill` portable drill format

Portable drills use human-readable JSON and are shared by file import/export, URL-fragment links, QR codes, native sharing, and external-AI handoff.

## Version 1 wrapper

```json
{
  "format": "table-tennis-robot-studio/drill",
  "formatVersion": 1,
  "name": "Two-point warm-up",
  "description": "Comfortable forehand/backhand alternating feed.",
  "createdWith": "Table Tennis Robot Studio",
  "createdAt": "2026-08-30T12:00:00Z",
  "trainingGoal": "Consistency and recovery",
  "level": "beginner",
  "instructions": "Recover toward neutral after each ball.",
  "drill": {
    "name": "Two-point warm-up",
    "description": "Comfortable forehand/backhand alternating feed.",
    "tags": ["warm-up"],
    "robotPoseReference": "base_back",
    "robotPose": {"x": 0, "y": 0, "yawDeg": 0},
    "startNodeId": "shot-1",
    "settings": {"repetitions": 0, "delayBetweenSets": 1},
    "nodes": [
      {"id": "shot-1", "type": "shot", "label": "Backhand", "x": 300, "y": 260,
       "params": {"speedMps": 5.8, "spinRps": 8, "elevationDeg": 10.5, "aimDeg": -8},
       "variation": {
         "enabled": true,
         "placement": {"depthCm": 15, "lateralCm": 20},
         "clearance": {"minCm": 8, "maxCm": 12},
         "speed": {"minMps": 5.2, "maxMps": 6.4},
         "spin": {"minRps": 3, "maxRps": 13}
       }}
    ],
    "edges": []
  }
}
```

The wrapper requires `format`, `formatVersion`, and a complete `drill`. Import treats the data as untrusted and validates node types, sizes and ball parameter ranges before showing a preview. Imported drills receive a fresh local identity and never silently overwrite existing data.

Current Shot and Serve ranges exposed to portable/AI data are:

- `speedMps`: 1..20
- `spinRps`: -120..120
- `elevationDeg`: -20..45
- `aimDeg`: -60..60

Version 1 allows the same current graph node types as the app (`shot`, `serve`, `random`, `drill`, `counter`) and caps payload/node/edge sizes to avoid pathological imports. A `serve` uses the same semantic launch parameters as a `shot`, while the app validates and previews its required robot-side bounce, net crossing, and player-side bounce. Unknown optional wrapper metadata can be ignored, but unsupported `formatVersion` values fail with a controlled error.

Shot `variation` is optional. Placement values are half-widths around the nominal modeled landing point. Clearance is measured from the top of the physical net to the bottom of the ball. Speed and spin ranges are physical launch values. Imported variation ranges are validated before the drill preview is shown.

## Links and QR

Share links encode the complete wrapper as URL-safe data in `#drill=...`. The fragment is preferred because it is not normally sent to the static web server. Opening a link decodes and validates it, shows the same import preview as file import, then removes the large fragment after a successful import. A size guard falls back to `.ttdrill` files for oversized drills.

QR codes contain the same share URL and are generated locally by the vendored QR implementation; no QR web service receives the drill.
