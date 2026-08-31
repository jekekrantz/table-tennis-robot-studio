# Pongbot Nova S Pro protocol notes

This file distinguishes direct project validation from community-derived
behavior.

## BLE identifiers

Observed and independently confirmed by the Olanga client:

```text
advertised service: 0000feff-0000-1000-8000-00805f9b34fb
vendor service:     02f00000-0000-0000-0000-00000000fe00
write FF01:         02f00000-0000-0000-0000-00000000ff01
notify/read FF02:   02f00000-0000-0000-0000-00000000ff02
```

## Generic response framing

Directly validated:

```text
byte 0      result/status (0 = accepted)
byte 1      opcode
bytes 2..3  payload length, little-endian
bytes 4..   payload
```

## Commands

Directly recovered/validated during this project:

```text
01 00 00       device info
02 00 00       status
07 00 00       access/challenge
08 20 00 ...  authentication response; 32 ASCII MD5 characters
80 01 00 00    init
80 01 00 01    stop
80 01 00 02    pause
80 01 00 03    continue
83 06 00       heartbeat (exact bytes; 06 is not normalized as a payload length)
81 LL HH ...   Start
84 LL HH ...   live-adjust ball parameters
```

## Authentication

Salt:

```text
Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw
```

Access payload:

```text
serial_length
challenge_length
serial bytes
challenge bytes
```

For each raw serial byte `b`:

```text
mapped_byte = salt[b % 36]
```

Then:

```text
MD5(serial_bytes || mapped_bytes || challenge_bytes)
```

is hex-encoded as 32 lowercase ASCII characters and sent as:

```text
08 20 00 <32 ASCII chars>
```

Synthetic test vector:

```text
access response:
000714000c06544553543030303030303031414243313233

serial:    TEST00000001
challenge: ABC123
MD5:       1588a9ee94356d140d04174c3a99d35d

verify frame:
0820003135383861396565393433353664313430643034313734633361393964333564
```

`pongbot-protocol.js` uses this synthetic fixture for its self-test.

## Status states

Directly interpreted from captures/native work:

```text
0    Uninitialized
2    Initializing
3    Ready / Free
4    Running
5    Stopping / sequence completion transition
6    Paused
7    Busy
10   Reading module
60   Joint adjustment
202  Error
```

Successful status frame shape:

```text
00 02 03 00 <state> <detail-lo> <detail-hi>
```

Important state rule learned in direct testing:

- **Do not Init when state is already 3 / Ready.**
- If state is 0, Init then wait until 3.
- If state is 2, wait until 3 without another Init.
- Require a fresh state 3 before Start.
- After Stop, wait/poll until state 3 before disconnecting.

A prior Start rejection was caused by re-initializing an already Ready robot and
then trying to Start while the wire state was 2.

## 24-byte ball record

Directly validated. There is no padding:

```text
offset  size  type       meaning
0       4     int32 LE   wheel A raw command value
4       4     int32 LE   wheel B raw command value
8       4     float32 LE launch pitch, degrees
12      4     float32 LE launch yaw, degrees
16      4     float32 LE frequency, Hz
20      4     int32 LE   repetition count
```

Known accepted record:

```text
wheel A     2861
wheel B     2861
pitch       -3.333333...
yaw         0
frequency   0.6 Hz
count       1

2d0b00002d0b0000555555c0000000009a99193f01000000
```

## Frequency and edge timing

The native/community conversion from the official 0–100 Frequency setting is:

```text
frequency_hz = 0.5 + frequency_percent / 100
```

Community stopwatch measurements show the user-visible pre-pause before that
ball is:

```text
pre_pause_seconds = 1 / frequency_hz
```

Examples reported in the owners thread:

```text
10% -> 0.6 Hz -> 1.67 s
20% -> 0.7 Hz -> 1.43 s
50% -> 1.0 Hz -> 1.00 s
```

This explains the entire 0–100 range: roughly 2.00 s down to 0.667 s.

Table Tennis Robot Studio's edge delay belongs to the target shot, so it encodes:

```text
frequency_hz = 1 / edge_delay_seconds
```

within that range.

## Start packet

Generic framing:

```text
81 <body-length LE16> <4-byte mode metadata> <24-byte records...>
```

Directly accepted project test, official/custom time mode:

```text
81 1c 00 00 05 00 00
2d0b00002d0b0000555555c0000000009a99193f01000000
```

Full hex:

```text
811c00000500002d0b00002d0b0000555555c0000000009a99193f01000000
```

The Olanga working web client uses a one-run/repetition header:

```text
01 01 00 00
```

so Table Tennis Robot Studio uses:

```text
81 <len LE16> 01 01 00 00 <records...>
```

for flow batches, then waits for completion/Ready before sending the next batch.

## Completion transition

Olanga identifies this exact status message as done:

```text
00020300050100
```

which decodes as state 5, detail 1.

Table Tennis Robot Studio recognizes that transition but does not rely on it alone: it also
polls status and requires state 3 / Ready before advancing.

## Batch length

Smee's first reverse-engineering work found 10+ records rejected and initially
used up to 9. Their later client intentionally divides unlimited drills into
individual custom-drill packets **never longer than 6 balls** for better
reliability.

Normal Table Tennis Robot Studio playback currently uses a conservative **9-record** START window. This deliberately crosses ordinary logical set boundaries without STOP/START while staying below the 10+ record size reported unreliable by earlier community testing. Guided Debug contains explicit 16- and 20-record experiments to determine whether a particular Nova firmware accepts larger buffers; those experiments do not silently raise the normal runtime limit.

## Recovered native parameter conversion

Wheel base and spin delta (legacy community variable names use `rpm`, but these are treated here as raw command units, not verified physical RPM):

```text
base_rpm  = 969.9321047526674 + 630.455868089234 * speed_setting
delta_rpm = 342.036255843120 * spin_setting
```

Rotation types 0–3:

```text
A = base_rpm + delta_rpm
B = base_rpm - delta_rpm
```

Rotation types 4–7 swap A/B.

Pitch/up-down relation:

```text
pitch_deg = (up_down - 10) / 3
up_down   = 3 * pitch_deg + 10
```

Placement/yaw relation:

```text
yaw_deg   = 2.2 * placement
placement = yaw_deg / 2.2
```

Community clients clamp wheel speeds around the physical operating envelope;
Table Tennis Robot Studio clamps these fields to raw command values 400–7500. The project does **not** treat these integers as measured physical wheel RPM.

## Evidence and provenance

**Direct project evidence:** authentication vector, response/status framing,
state-aware Init rule, 24-byte layout, parameter conversion, heartbeat bytes,
known Start packet, Start/Stop acknowledgements and state transitions.

**Community evidence used operationally:** Web Bluetooth UUID confirmation,
one-run Start metadata `01 01 00 00`, completion signature state5/detail1,
frequency/pre-pause stopwatch interpretation, 400–7500 raw-command clamp, and historical 6-record
chunking strategy.


## Calibration test shot

The calibration hardware test intentionally does not use a special protocol.
It exercises the exact same controller path as normal Play with a one-record batch:

```text
81 1c 00 01 01 00 00 + one 24-byte ball record
```

The record always has `count = 1`. With no preceding flow edge, Table Tennis Robot Studio uses
the minimum normal pre-pause of approximately 0.667 s (`frequency = 1.5 Hz`).

This makes the calibration shot useful as an end-to-end test of:

- authenticated BLE transport;
- state gating / Ready handling;
- m/s + rps to Nova motor conversion;
- pitch/yaw encoding;
- one-ball Start;
- run-completion detection;
- return-to-Ready confirmation.

## In-app timed protocol debugger

The Robot screen includes a protocol debugger so protocol experiments can be changed as data files rather than app deployments. The debugger deliberately sits above `NovaBleController.sendRaw()` / `requestRaw()` and does not reinterpret bytes.

Script grammar:

- `TX <hex>`: enqueue a raw GATT write and continue after the write completes.
- `REQ <opcode> <hex> [TIMEOUT <duration>]`: write raw bytes and wait for a successful response carrying the expected opcode.
- `WAIT 250ms` / `WAIT 1.5s`: explicit spacing between actions.
- `MARK text`: log-only marker.
- `STATUS`, `HEARTBEAT`, `PAUSE`, `CONTINUE`, `STOP`: macros for frames already represented by `PongbotProtocol.COMMANDS` / the known response opcode.
- `#` and `//` start comments; blank lines are ignored.

The existing controller heartbeat continues during debug scripts unless **Pause app heartbeat while script runs** is checked. This matters when isolating whether `0x83` is required or when comparing exact traces. The debugger records script timing separately while the normal robot protocol log continues to capture all TX/RX frames, including unsolicited notifications.
