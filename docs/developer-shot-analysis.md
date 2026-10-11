# Developer shot-analysis capture

The experimental tools live under the persistent **DEV** button in the top bar.
Turn on **Development mode** there to enable camera alignment and standalone
dataset capture. Enabling it also turns on log, video/audio and image retention;
each artifact type can then be disabled individually. Development mode does not
alter normal drills, calibration, or the outcome-to-hardware solver.

## Current vertical slice

The shot-analysis window provides:

- the same safe Start/Stop drill path used by the ordinary Run button;
- immediate rear-camera capture with a 1080p/60 fps preference and an automatic video-only
  fallback when microphone permission is unavailable;
- switching among the cameras/lenses reported by Android;
- lens-specific projected-table geometry derived from Camera2 sensor size and
  the focal length reported by the first completed frame, with a 78° fallback
  only when the device omits optical metadata;
- approximate camera-distance, height-above-net and downward-pitch guides,
  initially set to 50 cm, 30 cm and 2°;
- `MediaRecorder` video/audio capture with a manual download;
- monotonic timestamps for Nova state, log, active-shot and `0x05` served-ball
  events;
- per-presented-frame video metadata while recording, capped at 30,000 entries;
- Android Camera2 characteristics for every lens, including intrinsic parameters
  when reported, distortion, sensor geometry, exposure/ISO ranges, focal lengths,
  apertures, stabilization modes and supported recording sizes;
- synchronized native Android accelerometer, gyroscope, gravity,
  linear-acceleration, magnetic-field and rotation-vector samples;
- manual still and empty-background reference capture;
- six guided table landmarks: four corners followed by both net-post tops;
- an image-to-table homography from the first four landmarks;
- a versioned JSON session log containing the active drill identity, selected
  model context, camera settings, calibration, events and frame timestamps; and
- independent opt-in retention for logs, video/audio and images in browser
  IndexedDB.

Developer settings and camera landmarks use their own local-storage key and are
not part of portable drill exports. **Clear stored artifacts** deletes retained
IndexedDB captures but does not delete drills or the saved table landmarks.

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

1. It checks that the camera is active and microphone audio is present when
   requested. Table/net landmarks improve interpretation but are optional.
2. It creates a temporary `Developer dataset · balanced trajectories` execution
   plan that is removed when capture ends; it never appears in My drills.
3. Recording and native motion capture start when the dataset button is pressed,
   covering robot connection and safety latency. It also captures a pre-sequence
   still, freezes variation and live tuning, and runs the exact protocol.
4. It joins every Nova served-ball event to the expected condition, repetition
   and compiled physical command.
5. It records one second of post-roll and a final still, then stops recording
   automatically and marks the run complete or stopped early.

Canceling the Nova connection prompt, closing the analysis window, locking the
phone, or pressing the dataset button again now finalizes the partial recording
and resolves the dataset run instead of leaving it waiting indefinitely.

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

Android sensor samples use the hardware `SensorEvent.timestamp` nanosecond clock
and include simultaneous `elapsedRealtime` and epoch anchors, so they can be
aligned with video-frame, robot-event and audio time. Rotation-vector sensors
provide phone-orientation observations that can be combined with the marked
table geometry to estimate camera extrinsic rotation.

The Android app owns the preview, MP4/H.264/AAC recorder and still capture with
Camera2. Its clipped native `SurfaceView` sits beneath a transparent WebView so
Samsung devices can display the camera while retaining the projected-table
canvas and web controls. While the analysis panel scrolls, an animation-frame
sync keeps the native surface clipped to the camera stage and skips unchanged
Android layout updates. Camera startup is acknowledged only after Camera2
returns its first completed frame. Every completed recording frame has a Camera2 result row containing its
sensor timestamp, exposure time, ISO, frame duration, rolling-shutter skew,
focus distance, focal length, aperture, AE/AWB/AF state, crop region and colour
gains. These rows are drained into the JSON manifest once per second alongside
the motion sensors. The browser-hosted web app keeps its existing browser APIs;
camera dataset capture remains routed to the Android app.

Camera permission remains mandatory. If microphone permission is declined,
alignment and silent ad-hoc video remain available and the UI reports that
audio is off; a balanced dataset still refuses to start while its **Capture
microphone audio** option is enabled. Activity pause/lock closes Camera2 and
finalizes an active MP4, and the visible-page recovery path reopens the selected
lens rather than trusting stale JavaScript state.

## Capture workflow

1. Mount the phone in landscape on a fixed tripod beside the net, on either long
   side of the table. Move it far enough sideways to keep both end lines, both
   net posts, the table surface and useful space above the table visible. Aim
   approximately perpendicular to the long axis and avoid an extreme wide-angle
   lens when the phone offers a normal rear camera.
2. Open **DEV**, enable Development mode, and adjust retention if needed.
3. Choose **Open camera alignment** for an individual sequence, or **Set up
   dataset recording** for the standalone balanced protocol. The camera starts
   immediately.
4. Select whether the tripod is on the left or right long side, viewed from the
   robot toward the player. Changing sides resets the viewpoint calibration.
5. Select the closest camera lens, adjust the distance/height/pitch sliders until
   the projected table is approximately aligned, then use **Mark table**. Tap the robot-end corners nearer
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
- solve camera intrinsics or airborne 3D position (reported factory intrinsics
  and the manual table homography are recorded as inputs);
- estimate speed, net clearance, landing position or spin; or
- use captured data to create or command a Nova shot.

The next implementation stage should consume the recorded 2D observations and
event-time likelihoods through the existing drag/Magnus motion model. Until that
fit is validated against physical ground truth, the capture window must remain
developer-only and diagnostic.
