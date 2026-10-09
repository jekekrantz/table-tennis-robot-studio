# Developer shot-analysis capture

The experimental shot-analysis capture is intentionally hidden until **Robot →
Developer features → Developer mode** is enabled. Developer mode adds an
**Analyze shot** button to Run. It does not alter drill compilation, Nova commands,
calibration, or the outcome-to-hardware solver.

## Current vertical slice

The Run capture window provides:

- the same safe Start/Stop drill path used by the ordinary Run button;
- rear-camera capture with a 1080p/60 fps preference and an automatic video-only
  fallback when microphone permission is unavailable;
- `MediaRecorder` video/audio capture with a manual download;
- monotonic timestamps for Nova state, log, active-shot and `0x05` served-ball
  events;
- per-presented-frame video metadata while recording, capped at 30,000 entries;
- manual still and empty-background reference capture;
- six guided table landmarks: four corners followed by both net-post tops;
- an image-to-table homography from the first four landmarks;
- a versioned JSON session log containing the active drill identity, selected
  model context, camera settings, calibration, events and frame timestamps; and
- independent opt-in retention for logs, video/audio and images in browser
  IndexedDB.

All persistent developer retention is off by default. Developer settings and
camera landmarks use their own local-storage key and are not part of portable
drill exports. **Clear stored artifacts** deletes retained IndexedDB captures but
does not delete drills or the saved table landmarks.

## Balanced dataset recorder

The capture window can build and run a versioned, deterministic dataset
protocol. Its default run contains 100 balls: ten conditions repeated ten times
at a fixed 1.25-second interval. The conditions cover short and medium no-spin,
short and deep underspin, ordinary and heavy topspin, fast/deep balls, and both
left/right placements.

Condition order uses a cyclic balanced rotation. Across ten repetitions, every
condition occupies every ordinal position once. This keeps the physical interval
constant while avoiding a permanent correlation between one condition and
warm-up, battery state or elapsed time.

**Record balanced dataset** performs one finite run:

1. It checks that the camera is active, microphone audio is present when
   requested, and all six table/net landmarks are saved.
2. It creates or refreshes an inspectable `Developer dataset · balanced
   trajectories` drill in My drills.
3. It records a 1.5-second pre-roll and still image, freezes variation and live
   tuning, and runs the exact protocol.
4. It joins every Nova served-ball event to the expected condition, repetition
   and compiled physical command.
5. It records one second of post-roll and a final still, then stops recording
   automatically and marks the run complete or stopped early.

The repetition count is adjustable from 1–20 and the fixed interval from
0.70–2.00 seconds. Stop remains available during the run, and closing the
analysis window stops an active dataset run before closing the camera.

The JSON log is the replay manifest. It contains the full generated drill,
ordered schedule, authored parameters and modeled targets, current robot
pose/model, latest robot state, browser/hardware information, camera track
settings/constraints/capabilities, frame timestamps, raw robot events, and exact
compiled wheel/pitch/yaw/frequency records. Media and images share the JSON
session ID. **Download dataset files** downloads the manifest, recording and
captured pre/post stills.

## Capture workflow

1. Mount the phone in landscape on a fixed tripod beside the net, on either long
   side of the table. Move it far enough sideways to keep both end lines, both
   net posts, the table surface and useful space above the table visible. Aim
   approximately perpendicular to the long axis and avoid an extreme wide-angle
   lens when the phone offers a normal rear camera.
2. Enable Developer mode and select which artifacts, if any, should persist.
3. Open the drill in Run and choose **Analyze shot**.
4. Select whether the tripod is on the left or right long side, viewed from the
   robot toward the player. Changing sides resets the viewpoint calibration.
5. Enable the camera, then use **Mark table**. Tap the robot-end corners nearer
   and farther from the camera, then the player-end corners farther and nearer
   the camera. Finish with the nearer and farther net-post tops.
6. With nobody in view, choose **Set empty background**.
7. For an ad-hoc capture, start recording and start/stop the current drill. For
   a comparable corpus, use **Record balanced dataset** and let it finish.
8. Download the dataset files, or use the retained
   browser artifacts during local development.

## Deliberate limitations

This release collects synchronized, inspectable evidence but does not yet:

- detect or track the ball;
- classify audio impacts;
- solve camera intrinsics or airborne 3D position;
- estimate speed, net clearance, landing position or spin; or
- use captured data to create or command a Nova shot.

The next implementation stage should consume the recorded 2D observations and
event-time likelihoods through the existing drag/Magnus motion model. Until that
fit is validated against physical ground truth, the capture window must remain
developer-only and diagnostic.
