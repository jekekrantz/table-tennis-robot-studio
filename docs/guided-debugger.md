# Guided Nova protocol debugger

The Guided Debugger is the low-friction hardware investigation layer for Table Tennis Robot Studio. It is intentionally separate from normal drill playback: normal users get a one-test-at-a-time workflow, while protocol details remain under **Advanced / Protocol Console**.

## Architecture

- `studio-features.js` owns the user-facing guided-debug session and executes bounded actions through the existing `NovaBleController`.
- `studio-features-core.js` validates imported test packs, branch targets, raw-byte bounds, advisor responses, telemetry compaction, and ChatGPT handoff data.
- `pongbot-ble.js` emits structured `telemetry` events for TX/RX/log/connection activity. The debugger records these with wall-clock and high-resolution timestamps where available.
- `debug-advisor.js` defines two planner adapters:
  - `LocalGuidedAdvisor`: deterministic branching through a local test pack.
  - `OpenAIAdvisor`: optional backend-only advisor. It sends a compact session handoff to a configured endpoint; no OpenAI key is ever accepted by this frontend adapter.

The browser remains the hardware executor. An advisor can only propose a bounded structured test; the user must press **Run test** before motion-producing actions execute.

## Test-pack format

A pack is JSON with an objective and one or more tests:

```json
{
  "format": "table-tennis-robot-studio/debug-pack",
  "version": 1,
  "objective": "Determine whether long Nova sequences can play continuously.",
  "tests": [
    {
      "id": "long-9",
      "title": "Nine balls in one START",
      "purpose": "Check the conservative normal runtime window.",
      "summary": "9 alternating balls at 1 Hz",
      "heartbeat": "normal",
      "expectedDurationMs": 10000,
      "actions": [
        {
          "type": "start_sequence",
          "count": 9,
          "delayMs": 1000,
          "wheelA": 2400,
          "wheelB": 2400,
          "pitchDeg": 15,
          "yawPattern": [-5, 5]
        }
      ],
      "question": "Did the robot physically pause inside the sequence?",
      "answers": ["yes", "no", "other"],
      "next": {"yes": "conclude", "no": "conclude", "other": "conclude"}
    }
  ]
}
```

Supported action types are `status`, `heartbeat`, `wait`, `raw`, `start_sequence`, `active_append`, and `stop`. Validation imposes limits on test count, action count, raw-byte length, generated sequence count, and estimated duration. Arbitrary JavaScript is never a valid action.

## Branching

After a test, the debugger asks a human question only for an observation software cannot infer. The answer is normalized to `yes`, `no`, or `other` and `test.next` chooses the next test ID. `conclude` ends the deterministic branch. Undo restores the previous test so an accidental answer can be corrected.

## Session transcript

The local session keeps:

- objective and current test;
- tests run and elapsed time;
- human observations;
- TX/RX/heartbeat/connection/error telemetry;
- conclusions.

**Export session JSON** retains the detailed local transcript. **Copy ChatGPT handoff** uses `debugHandoff()` to keep the test history, observations, anomalies, and a compact telemetry window without resending repetitive traffic.

## Optional OpenAI advisor

`OpenAIAdvisor` talks only to a configurable backend endpoint. The companion server in `tools/openai-companion.mjs` reads `OPENAI_API_KEY` and `OPENAI_MODEL` from its environment. The browser never receives the key. The backend uses a structured JSON response contract and validates the returned action before forwarding it.

Run locally:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=... node tools/openai-companion.mjs
```

Then configure the frontend adapter/hosting layer to use `http://127.0.0.1:8787/debug-advisor` during development. The static GitHub Pages app does not require this server; the built-in deterministic debugger works without it.

## Adding a diagnostic test

Prefer the smallest experiment that separates two hypotheses. Reuse normal typed actions when possible. For raw protocol work, keep command bytes and duration bounded, explain the rationale and expected observation, and never make a test fire indefinitely. Add or import the test, run it with a reachable physical STOP/power switch, then export the session rather than manually transcribing protocol traffic.
