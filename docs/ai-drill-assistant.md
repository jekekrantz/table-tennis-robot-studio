# AI-assisted drill creation and editing

AI assistance is optional and never controls the robot directly. The authoritative path is always:

```text
natural-language intent -> structured portable drill -> local validation
-> normal app drill model -> trajectory/compiler checks -> user Apply -> normal playback path
```

## User paths

1. **Built-in assistant** — the static app includes a zero-setup local semantic helper for common table-tennis requests and iterative edits. It works offline and is intentionally conservative.
2. **BYOK** — advanced users choose a provider, enter a provider model ID and API key, and generate a structured drill. Key and model are kept in page memory only; the key is not written to storage, URLs, exports or logs. **Forget key** clears it immediately.
3. **Use another AI manually** — copy/download one self-contained request, open ChatGPT/Claude/Gemini/Copilot or another assistant, then paste/import the resulting portable drill. The request embeds the current drill when editing, format/range guidance, terminology, and machine-readable delimiters.

A future hosted built-in AI can reuse the same portable-drill contract without changing the editor/compiler layers. Static GitHub Pages does not depend on a backend.

## Speech input

The microphone is progressive enhancement. Browser-native `SpeechRecognition`/`webkitSpeechRecognition` is feature-detected and permission is requested only after the user taps **Speak**. Recognized text remains in the prompt box for review/editing; it never auto-generates a drill. Unsupported browsers simply keep typing available.

## Built-in/library drills

Built-in drills are read-only. Manual Edit and AI Apply both prompt/create a personal copy rather than silently failing or mutating the shipped library.

## External AI request behavior

The generated request tells the external assistant to use ordinary table-tennis semantics, make sensible assumptions, avoid raw motor/protocol values, preserve unspecified behavior during edits, and return one complete `table-tennis-robot-studio/drill` wrapper. The importer tolerates harmless prose or fenced JSON around the final object, but the object must still pass local validation.
