# Continuous playback and transport windows

The runtime treats a user drill as one logical session rather than independently starting/stopping every set.

## Normal playback

- Logical set boundaries are crossed while filling a Nova START packet.
- Normal packets are currently capped at **9 ball records** because earlier community work reported 10+ record packets unreliable on some firmware.
- No explicit STOP is inserted merely because one logical set ended.
- Delays are represented in each ball record's frequency field whenever the requested interval is within the known representable range (about 0.667..2.0 seconds).
- Only a delay that cannot be represented by the ball parameters creates a host-side wait/buffer boundary.
- The Play button represents the whole logical session and does not toggle between buffers.
- Live tuning is queued for the next sequence buffer instead of STOP/restarting an active buffer.

There can still be a firmware/buffer transition pause between separate START packets. The app does not pretend this is solved without hardware evidence.

## Guided investigation

Robot -> **Guided debug** contains deliberately experimental tests that go beyond the conservative runtime:

- 16 records in one START;
- 20 records with heartbeat traffic;
- a second bounded START sent while the first sequence is active;
- status/heartbeat traffic during playback.

These experiments record exact TX/RX timing and then ask only whether a physical pause was observed. If a particular Nova firmware proves a larger safe buffer or append behavior, the normal runtime limit can be raised in a later change with evidence rather than guesswork.
