#!/usr/bin/env python3
"""Direct, bounded Pongbot Nova BLE diagnostics using BlueZ via Bleak.

The default ``probe`` command authenticates and exchanges only device-info,
status, and heartbeat frames. The explicit motion tests send a bounded START
followed by either one experimental 0x84 live update or a second START, then
STOP.
"""

from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict, deque
from datetime import datetime
import hashlib
import json
import struct
import time
from typing import Deque

from bleak import BleakClient, BleakScanner


ADVERTISEMENT_SERVICE = "0000feff-0000-1000-8000-00805f9b34fb"
SERVICE_UUID = "02f00000-0000-0000-0000-00000000fe00"
WRITE_UUID = "02f00000-0000-0000-0000-00000000ff01"
NOTIFY_UUID = "02f00000-0000-0000-0000-00000000ff02"
SALT = b"Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw"

COMMANDS = {
    "info": bytes.fromhex("010000"),
    "status": bytes.fromhex("020000"),
    "access": bytes.fromhex("070000"),
    "init": bytes.fromhex("80010000"),
    "stop": bytes.fromhex("80010001"),
    "heartbeat": bytes.fromhex("830600"),
}

STATE_NAMES = {
    0: "Uninitialized",
    2: "Initializing",
    3: "Ready",
    4: "Running",
    5: "Stopping",
    6: "Paused",
    7: "Busy",
    10: "Reading module",
    60: "Joint adjustment",
    202: "Error",
}


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="milliseconds")


class Trace:
    def __init__(self, output_path: str | None):
        self.started = time.monotonic()
        self.output_path = output_path
        self.rows: list[dict[str, object]] = []

    def add(self, kind: str, message: str, data: bytes | None = None, **extra: object) -> None:
        row: dict[str, object] = {
            "time": now_iso(),
            "elapsed_ms": round((time.monotonic() - self.started) * 1000, 1),
            "kind": kind,
            "message": message,
        }
        if data is not None:
            row["hex"] = data.hex()
        row.update(extra)
        self.rows.append(row)
        suffix = f" {data.hex()}" if data is not None else ""
        print(f"{row['elapsed_ms']:>8.1f} ms {kind:>5} {message}{suffix}", flush=True)

    def save(self) -> None:
        if not self.output_path:
            return
        with open(self.output_path, "w", encoding="utf-8") as handle:
            json.dump(self.rows, handle, indent=2)
            handle.write("\n")
        print(f"Trace saved to {self.output_path}", flush=True)


def parse_frame(data: bytes) -> dict[str, object]:
    if len(data) < 4:
        raise ValueError(f"short response ({len(data)} bytes)")
    status, opcode, declared_length = data[0], data[1], data[2] | (data[3] << 8)
    payload = data[4:]
    return {
        "status": status,
        "opcode": opcode,
        "declared_length": declared_length,
        "payload": payload,
        "length_matches": len(payload) == declared_length,
    }


def parse_status(frame: dict[str, object]) -> tuple[int, int]:
    payload = bytes(frame["payload"])
    if int(frame["opcode"]) != 0x02 or int(frame["status"]) != 0 or not payload:
        raise ValueError("invalid status response")
    state = payload[0]
    detail = payload[1] | (payload[2] << 8) if len(payload) >= 3 else 0
    return state, detail


def verification_command(access_frame: dict[str, object]) -> tuple[str, bytes]:
    payload = bytes(access_frame["payload"])
    if len(payload) < 2:
        raise ValueError("access payload too short")
    serial_length, challenge_length = payload[0], payload[1]
    expected = 2 + serial_length + challenge_length
    if len(payload) < expected:
        raise ValueError(f"truncated access payload ({len(payload)}/{expected})")
    serial_bytes = payload[2 : 2 + serial_length]
    challenge_bytes = payload[2 + serial_length : expected]
    mapped = bytes(SALT[value % 36] for value in serial_bytes)
    digest = hashlib.md5(serial_bytes + mapped + challenge_bytes).hexdigest()
    return serial_bytes.decode(errors="replace"), bytes.fromhex("082000") + digest.encode("ascii")


def ball_record(
    *, wheel_a: int, wheel_b: int, pitch_deg: float, yaw_deg: float,
    frequency_hz: float, count: int = 1,
) -> bytes:
    return struct.pack("<iifffi", wheel_a, wheel_b, pitch_deg, yaw_deg, frequency_hz, count)


def start_packet(records: list[bytes], *, mode: int = 1, value: int = 1, mirror: int = 0, random: int = 0) -> bytes:
    body = bytes((mode, value & 0xFF, mirror, random)) + b"".join(records)
    return bytes((0x81, len(body) & 0xFF, len(body) >> 8)) + body


def live_update_packet(records: list[bytes]) -> bytes:
    body = b"".join(records)
    return bytes((0x84, len(body) & 0xFF, len(body) >> 8)) + body


class NovaSession:
    def __init__(self, client: BleakClient, trace: Trace):
        self.client = client
        self.trace = trace
        self.waiters: dict[int, Deque[asyncio.Future[dict[str, object]]]] = defaultdict(deque)
        self.last_status: tuple[int, int] | None = None
        self.ball_events: asyncio.Queue[bytes] = asyncio.Queue()
        self.ball_event_count = 0

    def on_notify(self, _characteristic: object, incoming: bytearray) -> None:
        data = bytes(incoming)
        try:
            frame = parse_frame(data)
            opcode = int(frame["opcode"])
            self.trace.add(
                "RX", f"opcode=0x{opcode:02x} status={frame['status']} length_ok={frame['length_matches']}", data
            )
            if opcode == 0x02 and int(frame["status"]) == 0:
                self.last_status = parse_status(frame)
                state, detail = self.last_status
                self.trace.add("STATE", f"{STATE_NAMES.get(state, f'State {state}')} detail={detail}")
            elif opcode == 0x05 and int(frame["status"]) == 0:
                self.ball_event_count += 1
                self.ball_events.put_nowait(data)
                self.trace.add("BALL", f"event {self.ball_event_count}")
            queue = self.waiters.get(opcode)
            if queue:
                future = queue.popleft()
                if not future.done():
                    future.set_result(frame)
        except Exception as error:  # Keep notification delivery alive for later frames.
            self.trace.add("ERROR", f"notification parse failed: {error}", data)

    async def write(self, data: bytes, label: str) -> None:
        self.trace.add("TX", label, data)
        try:
            await self.client.write_gatt_char(WRITE_UUID, data, response=True)
        except Exception as first_error:
            self.trace.add("WARN", f"write-with-response failed ({first_error}); trying without-response")
            await self.client.write_gatt_char(WRITE_UUID, data, response=False)

    async def request(self, data: bytes, expected_opcode: int, label: str, timeout: float = 6.0) -> dict[str, object]:
        future: asyncio.Future[dict[str, object]] = asyncio.get_running_loop().create_future()
        self.waiters[expected_opcode].append(future)
        try:
            await self.write(data, label)
            frame = await asyncio.wait_for(future, timeout)
        except Exception:
            queue = self.waiters.get(expected_opcode)
            if queue and future in queue:
                queue.remove(future)
            raise
        if int(frame["status"]) != 0:
            raise RuntimeError(f"{label} rejected: status={frame['status']} opcode=0x{expected_opcode:02x}")
        return frame

    async def authenticate(self) -> str:
        access = await self.request(COMMANDS["access"], 0x07, "access-info")
        serial, verification = verification_command(access)
        self.trace.add("INFO", f"access challenge received for {serial}")
        await self.request(verification, 0x08, "verification")
        self.trace.add("INFO", "authentication accepted")
        return serial

    async def status(self) -> tuple[int, int]:
        frame = await self.request(COMMANDS["status"], 0x02, "status", timeout=4.0)
        return parse_status(frame)

    async def heartbeat(self) -> None:
        await self.request(COMMANDS["heartbeat"], 0x83, "heartbeat", timeout=3.5)

    async def next_ball_event(self, timeout: float = 4.0) -> bytes:
        return await asyncio.wait_for(self.ball_events.get(), timeout)

    async def wait_ready(self, timeout: float) -> tuple[int, int]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            state, detail = await self.status()
            if state == 3:
                return state, detail
            if state == 202:
                raise RuntimeError("Nova entered Error state")
            await asyncio.sleep(0.35)
        raise TimeoutError(f"Nova did not become Ready; last={self.last_status}")

    async def stop(self) -> None:
        try:
            state, _ = await self.status()
            if state == 3:
                self.trace.add("INFO", "STOP skipped because Nova is already Ready")
                return
        except Exception as error:
            self.trace.add("WARN", f"pre-STOP status failed: {error}")
        await self.request(COMMANDS["stop"], 0x80, "STOP")
        await self.wait_ready(25.0)


async def find_nova(address: str | None, timeout: float, trace: Trace):
    if address:
        trace.add("INFO", f"using requested BLE address {address}")
        return address
    trace.add("INFO", f"scanning {timeout:.0f}s for NOVA_ / service 0xFEFF")
    devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
    for _key, (device, advertisement) in devices.items():
        name = device.name or advertisement.local_name or ""
        service_uuids = {value.lower() for value in advertisement.service_uuids or []}
        if name.upper().startswith("NOVA_") or ADVERTISEMENT_SERVICE in service_uuids:
            trace.add("INFO", f"found {name or 'Nova'} at RSSI {advertisement.rssi} dBm")
            return device
    raise RuntimeError("No advertising Nova was found")


async def prepare_session(args: argparse.Namespace, trace: Trace):
    device = await find_nova(args.address, args.scan_timeout, trace)
    client = BleakClient(device, timeout=15.0)
    trace.add("INFO", "connecting")
    await client.connect()
    trace.add("INFO", f"connected; MTU={client.mtu_size}")
    service = client.services.get_service(SERVICE_UUID)
    if service is None:
        raise RuntimeError(f"Nova service {SERVICE_UUID} not found")
    write_char = service.get_characteristic(WRITE_UUID)
    notify_char = service.get_characteristic(NOTIFY_UUID)
    if write_char is None or notify_char is None:
        raise RuntimeError("Nova write/notify characteristics not found")
    trace.add("INFO", f"write properties={write_char.properties}; notify properties={notify_char.properties}")
    session = NovaSession(client, trace)
    await client.start_notify(notify_char, session.on_notify)
    trace.add("INFO", "notifications enabled")
    return client, session


async def run_probe(args: argparse.Namespace, trace: Trace) -> None:
    client, session = await prepare_session(args, trace)
    try:
        await session.authenticate()
        await session.request(COMMANDS["info"], 0x01, "device-info", timeout=4.0)
        state, detail = await session.status()
        trace.add("RESULT", f"initial state={STATE_NAMES.get(state, state)} detail={detail}")
        await session.heartbeat()
        await asyncio.sleep(0.5)
        state, detail = await session.status()
        trace.add("RESULT", f"post-heartbeat state={STATE_NAMES.get(state, state)} detail={detail}")
    finally:
        await client.disconnect()
        trace.add("INFO", "disconnected")


async def ensure_ready(session: NovaSession) -> None:
    state, _ = await session.status()
    if state == 0:
        await session.request(COMMANDS["init"], 0x80, "initialize")
        await session.wait_ready(45.0)
    elif state in (2, 5):
        await session.wait_ready(45.0 if state == 2 else 25.0)
    elif state != 3:
        raise RuntimeError(f"Nova must be Ready, currently {STATE_NAMES.get(state, state)}")


async def run_stream_test(
    args: argparse.Namespace,
    trace: Trace,
    *,
    update_opcode: int,
    start_mode: int = 1,
    start_value: int = 1,
) -> None:
    client, session = await prepare_session(args, trace)
    heartbeat_task: asyncio.Task[None] | None = None
    stop_attempted = False
    try:
        await session.authenticate()
        await ensure_ready(session)
        await session.heartbeat()

        async def heartbeat_loop() -> None:
            while True:
                await asyncio.sleep(10.0)
                await session.heartbeat()

        heartbeat_task = asyncio.create_task(heartbeat_loop())
        first_records = [
            ball_record(
                wheel_a=args.wheels,
                wheel_b=args.wheels,
                pitch_deg=args.pitch,
                yaw_deg=(-4.0 if index % 2 == 0 else 4.0),
                frequency_hz=args.frequency,
            )
            for index in range(args.first_count)
        ]
        update_records = [
            ball_record(
                wheel_a=args.wheels,
                wheel_b=args.wheels,
                pitch_deg=args.pitch,
                yaw_deg=(4.0 if index % 2 == 0 else -4.0),
                frequency_hz=args.frequency,
            )
            for index in range(args.update_count)
        ]
        initial_packet = start_packet(first_records, mode=start_mode, value=start_value)
        mode_label = "endless" if start_mode == 3 else f"{start_value}-combo"
        await session.request(initial_packet, 0x81, f"START {args.first_count} records ({mode_label})")
        trace.add("MARK", f"START acknowledged; live update scheduled after {args.update_after:.2f}s")
        await asyncio.sleep(args.update_after)
        before_state, before_detail = await session.status()
        trace.add("MARK", f"pre-update state={STATE_NAMES.get(before_state, before_state)} detail={before_detail}")
        if update_opcode == 0x84:
            update = live_update_packet(update_records)
            label = f"LIVE-UPDATE {args.update_count} records"
        else:
            update = start_packet(update_records)
            label = f"SECOND START {args.update_count} records"
        await session.request(update, update_opcode, label)
        trace.add("MARK", f"0x{update_opcode:02x} update acknowledged")

        observe_deadline = time.monotonic() + args.observe_seconds
        while time.monotonic() < observe_deadline:
            await asyncio.sleep(0.5)
            await session.status()
        stop_attempted = True
        await session.stop()
        trace.add("RESULT", "bounded stream test ended in Ready")
    finally:
        if heartbeat_task:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
        if client.is_connected and not stop_attempted:
            trace.add("WARN", "test exited early; attempting emergency STOP")
            try:
                await session.stop()
            except Exception as error:
                trace.add("ERROR", f"emergency STOP failed: {error}")
        if client.is_connected:
            await client.disconnect()
        trace.add("INFO", "disconnected")


async def run_single_slot_test(args: argparse.Namespace, trace: Trace) -> None:
    client, session = await prepare_session(args, trace)
    try:
        await session.authenticate()
        await ensure_ready(session)
        await session.heartbeat()
        first = ball_record(
            wheel_a=args.wheels,
            wheel_b=args.wheels,
            pitch_deg=args.pitch,
            yaw_deg=-6.0,
            frequency_hz=args.frequency,
        )
        await session.request(
            start_packet([first], mode=1, value=args.shot_count),
            0x81,
            f"START one streaming slot for {args.shot_count} combos",
        )
        for completed in range(1, args.shot_count + 1):
            await session.next_ball_event(timeout=max(4.0, 2.5 / args.frequency))
            trace.add("MARK", f"observed shot {completed}/{args.shot_count}")
            if completed < args.shot_count:
                next_yaw = 6.0 if completed % 2 else -6.0
                replacement = ball_record(
                    wheel_a=args.wheels,
                    wheel_b=args.wheels,
                    pitch_deg=args.pitch,
                    yaw_deg=next_yaw,
                    frequency_hz=args.frequency,
                )
                await session.request(
                    live_update_packet([replacement]),
                    0x84,
                    f"next-slot update yaw={next_yaw:+.1f}",
                )
        await session.wait_ready(8.0)
        trace.add("RESULT", f"single-slot stream completed exactly {args.shot_count} notified shots")
    finally:
        if client.is_connected and session.last_status and session.last_status[0] != 3:
            trace.add("WARN", "single-slot test did not finish Ready; attempting STOP")
            try:
                await session.stop()
            except Exception as error:
                trace.add("ERROR", f"cleanup STOP failed: {error}")
        if client.is_connected:
            await client.disconnect()
        trace.add("INFO", "disconnected")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument(
        "mode",
        choices=(
            "probe",
            "stream-test",
            "append-test",
            "endless-update-test",
            "combo-update-test",
            "single-slot-test",
        ),
        nargs="?",
        default="probe",
    )
    result.add_argument("--address", help="BLE address; otherwise discover a NOVA_ device")
    result.add_argument("--scan-timeout", type=float, default=8.0)
    result.add_argument("--trace", help="write the complete trace as JSON")
    result.add_argument("--wheels", type=int, default=2400, help="equal raw wheel values for the bounded test")
    result.add_argument("--pitch", type=float, default=15.0)
    result.add_argument("--frequency", type=float, default=1.0)
    result.add_argument("--first-count", type=int, default=6)
    result.add_argument("--update-count", type=int, default=4)
    result.add_argument("--update-after", type=float, default=4.0)
    result.add_argument("--observe-seconds", type=float, default=8.0)
    result.add_argument("--shot-count", type=int, default=6)
    return result


async def main() -> int:
    args = parser().parse_args()
    if not 400 <= args.wheels <= 7500:
        raise SystemExit("--wheels must be within 400..7500")
    if not 1 <= args.first_count <= 9 or not 1 <= args.update_count <= 9:
        raise SystemExit("record counts must be within 1..9")
    if not 0.5 <= args.frequency <= 1.5:
        raise SystemExit("--frequency must be within 0.5..1.5 Hz")
    if not 0.5 <= args.update_after <= 30 or not 1 <= args.observe_seconds <= 60:
        raise SystemExit("timing arguments are outside bounded diagnostic limits")
    if not 2 <= args.shot_count <= 50:
        raise SystemExit("--shot-count must be within 2..50")
    trace = Trace(args.trace)
    try:
        if args.mode == "probe":
            await run_probe(args, trace)
        elif args.mode == "single-slot-test":
            await run_single_slot_test(args, trace)
        else:
            is_endless = args.mode == "endless-update-test"
            is_multi_combo = args.mode == "combo-update-test"
            await run_stream_test(
                args,
                trace,
                update_opcode=0x81 if args.mode == "append-test" else 0x84,
                start_mode=3 if is_endless else 1,
                start_value=2 if is_multi_combo else (0 if is_endless else 1),
            )
        return 0
    except Exception as error:
        trace.add("ERROR", f"{type(error).__name__}: {error}")
        return 1
    finally:
        trace.save()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
