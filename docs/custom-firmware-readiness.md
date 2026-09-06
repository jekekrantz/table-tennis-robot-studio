# Nova custom-firmware readiness

## Current status

We can inspect and reproducibly modify the official Nova MCU application image offline. We are **not ready to install custom firmware** yet. Nothing in this workbench connects to the robot or transmits an update.

The recovered official image is version `30.0.6`, 32,856 bytes, with:

- SHA-256 `908e3fe176cf2fdb850bf2234e5f6efaab81bd36b0626121be299890cf23ae2c`
- MD5 `79199b29fe241a599c508e29f2cd892a`
- image base `0x08004000`
- initial stack pointer `0x20001288`
- reset vector `0x08004149`

The vector table shows that the downloaded file is a raw Cortex-M application image. Its base also implies that a separate bootloader occupies the lower flash region; that bootloader is not present in the downloaded image.

## What the official app gives us

Static analysis of the official Android app recovered the MCU update sequence:

1. Start update: `c0 00 00`.
2. Announce a file: opcode `c1`, file type, and 32-bit little-endian size.
3. Send 235-byte chunks: opcode `c2`, a 16-bit payload length, a 32-bit little-endian file offset, and data.
4. Ask the robot to verify the lowercase ASCII MD5: opcode `c3`.
5. Mark transfer complete: `c4 00 00`.
6. Activate using opcode `c5`, file type, size, and MD5.

The app performs an MD5 integrity check. No public-key signature, certificate, RSA, or ECDSA validation was found in the relevant app update path. That is encouraging, but it does not prove that the robot bootloader accepts modified images: acceptance or additional checks may live entirely in the missing bootloader.

This framing is reconstructed from app code, not yet confirmed by a passive packet capture. `tools/nova_firmware_workbench.py ota-plan` reports the exact recovered packet layout without writing or transmitting packets.

## Signed-wheel patch finding

Firmware `30.0.6` clamps each signed wheel command below zero to zero and above 7500 to 7500. The two lower-clamp branches are:

- wheel A: address `0x08009210`, file offset `0x5210`, `01 da` (`BGE`)
- wheel B: address `0x08009228`, file offset `0x5228`, `01 da` (`BGE`)

Changing each instruction to `01 e0` (`B`) bypasses the lower clamp while retaining the existing 7500 upper clamps. This is only a proof that negative commands can reach the downstream conversion logic.

The two-instruction patch is not safe firmware: it has no firmware-side negative floor. A malformed or out-of-range command could therefore reach the motor conversion. The offline builder requires an exact stock image, refuses to overwrite it, and uses a deliberately explicit acknowledgement flag. Its output must not be installed.

A usable custom build should instead enforce a conservative signed lower bound inside the firmware. There is not enough inline instruction space at either clamp, and the stock image contains no obvious erased code cave large enough for a safe bounded implementation. That likely requires a carefully verified trampoline, replacement of a larger routine, or a source-level reimplementation.

## Offline workbench

Inspect and verify a locally held vendor image:

```bash
python3 tools/nova_firmware_workbench.py inspect /path/to/mcu-30.0.6.bin
```

Show the recovered update framing and hashes:

```bash
python3 tools/nova_firmware_workbench.py ota-plan /path/to/mcu-30.0.6.bin
```

The repository intentionally does not contain the vendor APK, vendor firmware, credentials, device identifiers, or an OTA sender.

## Gates before any installation

All of these should be completed before authorizing a custom flash:

- Identify the exact MCU and board revision.
- Locate SWD/debug pads and make a verified full-flash backup, including bootloader and option bytes.
- Confirm that the backup can be read consistently and establish a wired recovery procedure before changing flash.
- Reverse engineer the bootloader’s image validation, flash layout, rollback behavior, and power-loss behavior.
- Passively capture an official update to confirm every recovered packet field and timing rule.
- Implement and review a firmware-side negative lower limit; do not rely only on the controller UI.
- Confirm STOP, disconnect, watchdog, over-current, and invalid-command behavior with wheels mechanically guarded and no balls loaded.
- Flash a recoverable test target first, then perform a powered bench test before any firing test.

Until those gates are met, the official `30.0.6` firmware remains the recovery reference and custom images remain offline research artifacts.
