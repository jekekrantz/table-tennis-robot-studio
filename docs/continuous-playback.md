# Continuous playback and transport windows

The runtime treats a user drill as one logical session rather than independently starting/stopping every set.

## Normal playback

- Logical set boundaries are crossed while filling a Nova START packet.
- Normal packets are currently capped at **9 ball records** because earlier community work reported 10+ record packets unreliable on some firmware.
- No explicit STOP is inserted merely because one logical set ended.
- Delays are represented in each ball record's frequency field whenever the requested interval is within the known representable range (about 0.667..2.0 seconds).
- Only a delay that cannot be represented by the ball parameters creates a host-side wait/buffer boundary.
- The Play button represents the whole logical session and does not toggle between buffers.
- The first shot pack uses `START`; while it is running, the next pack is sent with the experimental `0x84` live-update command roughly two balls before the current pack is expected to end.
- Playback continues rolling this way for finite and infinite drills, compiling only one bounded look-ahead pack at a time. A deliberately long delay that cannot fit in a ball record still creates a Ready/START boundary.
- Live tuning also uses `0x84`: it updates the already-queued pack when one exists, otherwise the active pack. Automatic refill and tuning writes share one serialized queue so they cannot race. Rapid tuning taps are combined before transmission.
- If the robot rejects a rolling refill, the app lets the active pack finish and falls back to a normal `START` for the queued pack. A rejected tuning update simply remains pending for the next pack.

The `0x84` streaming behavior is an explicit hardware-testing assumption. The fallback can still have a firmware/Ready transition pause.

## Guided investigation

Robot -> **Guided debug** contains deliberately experimental tests that go beyond the conservative runtime:

- 16 records in one START;
- 20 records with heartbeat traffic;
- a second bounded START sent while the first sequence is active;
- status/heartbeat traffic during playback.

These experiments record exact TX/RX timing and then ask only whether a physical pause was observed. If a particular Nova firmware proves a larger safe buffer or append behavior, the normal runtime limit can be raised in a later change with evidence rather than guesswork.
