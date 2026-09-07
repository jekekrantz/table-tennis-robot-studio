# User-experience responsiveness contract

Responsiveness and recoverable interaction state are product requirements. A
calculation can be mathematically correct and still fail preflight if it makes a
normal gesture stutter, encourages repeated activation, or lets an old async
operation override the user's latest command.

## Interaction tiers and budgets

The limits below are tail limits measured after one warm-up. Tests report the
95th percentile and maximum; an average alone is not sufficient.

| Tier | Examples | Why | Main-thread target |
| --- | --- | --- | --- |
| Immediate and safety-sensitive | Play, Stop, Stopping, fine-step buttons | Used while looking at moving physical hardware. Feedback and the accepted state transition must be immediate. | p95 <= 50 ms, max <= 100 ms. Async robot time is excluded, but the UI must change state within this budget. |
| Continuous gesture | Player-tuning sliders, shot/serve range dragging, landing-range dragging | A normal swipe can deliver an input every frame. One slow event causes overshoot and queued-looking motion. | p95 <= 8 ms, max <= 16 ms per input event. No solver, storage serialization, network/BLE wait, or hidden-view rebuild in the movement path. |
| Commit after a gesture | Releasing a shot/serve slider or landing range, typed-value change | Happens once per adjustment. A short pause is tolerable because movement has ended. | p95 <= 50 ms, max <= 100 ms. If work can exceed 100 ms on supported phones, show immediate pending feedback and split, defer, cache, or progressively render it. |
| Session setup | Opening a drill, first cold trajectory preparation, session-level pose setup | Used a few times per session. | p95 <= 150 ms, max <= 300 ms. Longer work requires visible progress and cancellation. |
| Rare calibration | Model fitting and device calibration performed occasionally | Users expect deliberate computation, but the app must never look frozen. | Up to 1 s with immediate busy feedback; above 1 s requires progress, incremental results, or a spinner and cancellation where safe. |

Wall-clock robot communication is governed by protocol timeouts rather than the
main-thread limits. Waiting for Nova must never block rendering. The UI must say
Starting, Stopping, or the specific operation in progress immediately, remain
responsive, and end in a clear success/error state.

## Required mitigation

When a limit is exceeded, choose a mitigation appropriate to the work:

- remove unnecessary work from the event path;
- cache or precompute stable results;
- coalesce high-frequency changes and keep only the newest requested value;
- render essential feedback first and progressively add sampled trajectories;
- move expensive work to an idle task or worker;
- show immediate busy/progress feedback for intentionally long operations;
- make asynchronous transitions cancellable and prevent stale completion from
  overriding a newer Play or Stop request.

Raising a threshold requires documenting why the interaction is less frequent
or less time-sensitive, plus evidence from representative phone-width testing.

## Automated coverage

`ux-responsiveness-selftest.js` is run by `scripts/preflight.sh`. It checks:

- worst-case and p95 costs for GUI-valid player-tuning solver inputs;
- hard trajectory-evaluation budgets, which are more portable than timing alone;
- slider movement remains presentation-only and commits expensive work once;
- Run tuning cannot rebuild a hidden Shot/Serve inspector;
- delayed readiness and delayed Start acknowledgement both honor cancellation;
- a mouse double-click cannot turn Play immediately back into Stop;
- the generated deployment bundle contains the same protections as source.

The timing tests use deliberately generous CI ceilings in addition to operation
budgets. Device/browser profiling at phone widths remains necessary for changes
to rendering, SVG trajectory density, storage, or event binding.
