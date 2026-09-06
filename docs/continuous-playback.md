# Continuous playback and transport windows

The runtime treats a user drill as one logical session rather than independently starting/stopping every set.

## Normal playback

- Playback uses one running 24-byte record slot. The first shot is sent with `START`; each `0x05` ball event triggers a same-size `0x84` replacement for the next shot.
- Exact duplicate `0x05` notifications are ignored so a repeated BLE notification cannot advance the controller-side pattern twice.
- Finite sessions use combo mode with the exact shot count, so the Nova returns to Ready after the final ball. Infinite sessions use endless mode and end only on Stop.
- The one-slot shape never changes while running. Direct hardware tests showed that same-size updates are accepted, while attempts to change the active record count are rejected with status 1.
- Logical set boundaries do not create STOP/START cycles. Random choices, shot variation, and live tuning can therefore change the next slot while the robot remains Running.
- Update writes and immediate live-tuning writes share one serialized queue. A typical direct update acknowledgement took about 87 ms in the verified 1 Hz test.
- Delays are represented in each record's frequency field when they fit the Nova range (about 0.667..2.0 seconds). A deliberately longer delay still needs a controlled stream boundary and host-side wait.
- The verified combo-count field is bounded to 255 per continuous finite segment. Only longer sessions or unrepresentable delays require another START.

Direct Nova tests verified six per-ball replacements, a same-size four-record endless replacement, and a same-size four-record/two-combo replacement without leaving Running.
