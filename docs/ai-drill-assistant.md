# Global AI assistance and drill editing

AI assistance is optional and never controls the robot directly. The authoritative path is always:

```text
natural-language intent -> allow-listed UI action -> optional intuitive outcome graph
-> trajectory/Nova feasibility -> optional AI revision -> user Apply/open -> normal app path
```

The AI button is available in the top app bar on every screen. It can answer common app-navigation and setup questions locally, or create and revise drills through the existing validated proposal flow.

## Assistant action contract

Before generating anything, the app classifies the request as one of five actions: `create_drill`, `edit_drill`, `open_builtin_drill`, `open_screen`, or `answer`. External assistants receive the same list plus the available screen names and a compact catalog containing each built-in drill's exact ID, display name, and folder. They return one `table-tennis-robot-studio/assistant-action` object. Create/edit actions carry an intuitive drill plan; opening a built-in carries an exact catalog ID; navigation carries an allow-listed screen; answers carry concise text.

The browser validates the action and executes it locally. Unknown actions, invented built-in IDs, and unknown screens are rejected. Common misspellings in an explicit request to open a built-in are matched locally against the shipped catalog, so a request such as “open the builtin faulkenerg drill” opens **Falkenberg** on its Run screen instead of generating a similarly named copy. A fresh-drill request always creates a drill; even when typed into the skill assistant it is handed to the drill flow rather than being misread as a skill progression.

Fresh drills return to Run when requested from Run, and otherwise open in the Editor. Edits return to the originating Run or Editor view. Opening an existing built-in always goes to Run. Robot, Calibration, Robot placement, and Add node expose an assistant button inside their modal surface so the control remains reachable while the modal is open.

## Screen context

The context disclosure in the assistant lists the allow-listed state used for a request: current screen, active drill name/source, visible editor selection, general Nova state, and current activity. Drill creation/editing requests also include the active drill definition when appropriate. Bluetooth logs, device identifiers, API keys, calibration values, unrelated stored drills, and other local data are excluded.

## User paths

1. **Built-in assistant** — the static app includes zero-setup local help for common app tasks plus a semantic helper for common table-tennis requests and iterative edits. It works offline and is intentionally conservative.
2. **BYOK** — advanced users choose a provider, enter a provider model ID and API key, and generate a structured drill. Key and model are kept in page memory only; the key is not written to storage, URLs, exports or logs. **Forget key** clears it immediately.
3. **Use another AI manually** — copy/download one self-contained request, open ChatGPT/Claude/Gemini/Copilot or another assistant, then paste/import the resulting intuitive drill. The request embeds the current drill when editing, outcome ranges, graph guidance, terminology, and coordinate definitions. If the local model rejects one or more balls, the app copies a second request containing the per-ball feasibility report for another AI pass.

A future hosted built-in AI can reuse the same intuitive-drill contract without changing the editor/compiler layers. Static GitHub Pages does not depend on a backend.

## Speech input

The microphone is progressive enhancement. Browser-native `SpeechRecognition`/`webkitSpeechRecognition` is feature-detected and permission is requested only after the user taps **Speak**. Recognized text remains in the prompt box for review/editing; it never auto-generates a drill. Unsupported browsers simply keep typing available.

## Built-in/library drills

Built-in drills are read-only. Manual Edit and AI Apply both prompt/create a personal copy rather than silently failing or mutating the shipped library.

## Intuitive drill contract and coordinates

The AI authors outcomes, not robot commands. Every Shot or Serve supplies inclusive ranges for receiver-side depth and lateral placement, launch speed, spin, and net clearance. Depth is measured from the net across the receiver half (`0…137 cm`). Lateral placement is measured from the centre line (`-76…76 cm`), positive toward the robot's left. Positive spin is topspin and negative spin is backspin. Shot placement means the receiver-side first bounce; Serve placement means the receiver-side second physical bounce. The app applies the saved calibrated robot pose while solving those outcomes.

The same object carries the drill graph. It supports Shot, Serve, weighted Random, Repeat/Finish counters, connection timing, and repetitions. Existing sub-drill references are preserved on edits, but the AI is not allowed to invent references to drills it cannot see.

For create/edit actions, the generated request tells the external assistant to use ordinary table-tennis semantics, make sensible assumptions, preserve unspecified behavior during edits, and embed one complete `table-tennis-robot-studio/intuitive-drill` object in the assistant action. It explicitly forbids wheel values, elevation, aim, PWM, calibration coefficients, and protocol commands. Older plain intuitive-drill responses remain accepted for compatibility, but they are interpreted only as the already-routed create/edit action and must still pass local schema and graph validation.

## Feasibility and revision loop

The app resolves each requested ball through its calibrated trajectory and Nova hardware model. Its report identifies each ball, the requested five ranges, whether one modeled shot satisfied them all, and the nearest modeled outcome when none did. BYOK mode can send that report back for up to two complete revisions. Manual mode copies the same revision request for the user to paste into an external assistant. A proposal is not shown as validated or made applicable until every ball is feasible and the graph passes normal drill validation.

Edits include the current intuitive drill plus up to 12 previous user requests, AI outputs, and feasibility reports. This preserves the full creation/edit conversation without asking the AI to reverse-engineer prior launch parameters. History stays in the local saved drill and is removed from exported or shared portable drills.

Serve requests use the dedicated `serve` node type rather than approximating a serve as a normal shot. Both the local helper and generated external request use the validated serve-oriented default and preserve Serve nodes during edits.

## Repeatable intuitiveness evaluation

The versioned evaluation procedure under `evaluation/ai-intuitiveness/` replays fixed user wording and visible contexts through intent routing, generated API instructions, isolated API responses, app validation, feasibility revision, and resulting UI state. Its response-generation stage must receive only one saved request at a time; expectations, source code, conversation history, and other cases are deliberately excluded. See `evaluation/ai-intuitiveness/README.md` for the reusable procedure. Generated suites are intentionally disposable and are not retained after their evaluation cycle ends.
