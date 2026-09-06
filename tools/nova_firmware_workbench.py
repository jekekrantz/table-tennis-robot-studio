#!/usr/bin/env python3
"""Offline inspection and preparation tools for Pongbot Nova MCU firmware.

This module has deliberately no Bluetooth, serial, USB, or network support. It
can inspect a firmware image, describe the recovered OTA framing, and create an
explicitly experimental two-instruction patch. It cannot install firmware.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from dataclasses import dataclass
from pathlib import Path


IMAGE_BASE = 0x08004000
STOCK_VERSION = "30.0.6"
STOCK_SIZE = 32_856
STOCK_MD5 = "79199b29fe241a599c508e29f2cd892a"
STOCK_SHA256 = "908e3fe176cf2fdb850bf2234e5f6efaab81bd36b0626121be299890cf23ae2c"
OTA_CHUNK_SIZE = 235


@dataclass(frozen=True)
class PatchSite:
    name: str
    address: int
    original: bytes
    replacement: bytes
    effect: str

    @property
    def offset(self) -> int:
        return self.address - IMAGE_BASE


SIGNED_WHEEL_PATCHES = (
    PatchSite(
        "wheel_a_lower_clamp_branch",
        0x08009210,
        bytes.fromhex("01da"),
        bytes.fromhex("01e0"),
        "change BGE to B so negative wheel-A commands bypass the zero clamp",
    ),
    PatchSite(
        "wheel_b_lower_clamp_branch",
        0x08009228,
        bytes.fromhex("01da"),
        bytes.fromhex("01e0"),
        "change BGE to B so negative wheel-B commands bypass the zero clamp",
    ),
)


def hashes(data: bytes) -> dict[str, str]:
    return {
        "md5": hashlib.md5(data).hexdigest(),  # noqa: S324 - vendor OTA checksum
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def is_exact_stock(data: bytes) -> bool:
    digest = hashes(data)
    return (
        len(data) == STOCK_SIZE
        and digest["md5"] == STOCK_MD5
        and digest["sha256"] == STOCK_SHA256
    )


def vector_info(data: bytes) -> dict[str, object]:
    if len(data) < 8:
        return {"valid": False, "reason": "image is shorter than the vector table"}
    initial_sp, reset_vector = struct.unpack_from("<II", data)
    reset_address = reset_vector & ~1
    image_end = IMAGE_BASE + len(data)
    return {
        "initial_sp": f"0x{initial_sp:08x}",
        "reset_vector": f"0x{reset_vector:08x}",
        "thumb_entry": bool(reset_vector & 1),
        "entry_in_image": IMAGE_BASE <= reset_address < image_end,
        "sram_stack_plausible": 0x20000000 <= initial_sp < 0x20100000,
        "valid": bool(reset_vector & 1)
        and IMAGE_BASE <= reset_address < image_end
        and 0x20000000 <= initial_sp < 0x20100000,
    }


def patch_site_info(data: bytes) -> list[dict[str, object]]:
    result = []
    for site in SIGNED_WHEEL_PATCHES:
        actual = data[site.offset : site.offset + len(site.original)]
        state = "stock" if actual == site.original else "patched" if actual == site.replacement else "unknown"
        result.append(
            {
                "name": site.name,
                "address": f"0x{site.address:08x}",
                "file_offset": f"0x{site.offset:x}",
                "expected": site.original.hex(),
                "replacement": site.replacement.hex(),
                "actual": actual.hex(),
                "state": state,
                "effect": site.effect,
            }
        )
    return result


def inspect_image(data: bytes) -> dict[str, object]:
    digest = hashes(data)
    return {
        "offline_only": True,
        "size": len(data),
        **digest,
        "exact_stock_30_0_6": is_exact_stock(data),
        "image_base": f"0x{IMAGE_BASE:08x}",
        "vectors": vector_info(data),
        "patch_sites": patch_site_info(data),
    }


def ota_packets(data: bytes, file_type: int = 0) -> dict[str, object]:
    if not 0 <= file_type <= 255:
        raise ValueError("file type must fit in one byte")
    size_le = struct.pack("<I", len(data))
    md5_ascii = hashes(data)["md5"].encode("ascii")
    chunks = []
    for offset in range(0, len(data), OTA_CHUNK_SIZE):
        payload = struct.pack("<I", offset) + data[offset : offset + OTA_CHUNK_SIZE]
        chunks.append(bytes([0xC2]) + struct.pack("<H", len(payload)) + payload)
    return {
        "start": bytes([0xC0, 0, 0]),
        "announce": bytes([0xC1, 5, 0, file_type]) + size_le,
        "chunks": chunks,
        # The recovered app declares 32 digest bytes while also carrying type.
        "check_md5": bytes([0xC3, 32, 0, file_type]) + md5_ascii,
        "transfer_complete": bytes([0xC4, 0, 0]),
        "activate": bytes([0xC5, 37, 0, file_type]) + size_le + md5_ascii,
    }


def ota_plan(data: bytes, file_type: int = 0) -> dict[str, object]:
    packets = ota_packets(data, file_type)
    chunks = packets["chunks"]
    return {
        "offline_only": True,
        "recovered_not_live_captured": True,
        "file_type": file_type,
        "image_size": len(data),
        **hashes(data),
        "chunk_size": OTA_CHUNK_SIZE,
        "chunk_count": len(chunks),
        "sequence": ["start", "announce", "chunks", "check_md5", "transfer_complete", "activate"],
        "fixed_packets_hex": {
            name: packet.hex()
            for name, packet in packets.items()
            if name != "chunks"
        },
        "first_chunk_header_hex": chunks[0][:7].hex() if chunks else None,
        "last_chunk_header_hex": chunks[-1][:7].hex() if chunks else None,
        "last_chunk_data_length": len(chunks[-1]) - 7 if chunks else 0,
        "warning": "This is a static reconstruction of the official app protocol, not proof that a modified image is accepted by the bootloader.",
    }


def apply_unbounded_signed_wheel_patch(data: bytes) -> tuple[bytes, list[dict[str, str]]]:
    patched = bytearray(data)
    changes = []
    for site in SIGNED_WHEEL_PATCHES:
        actual = bytes(patched[site.offset : site.offset + len(site.original)])
        if actual != site.original:
            raise ValueError(
                f"{site.name}: expected {site.original.hex()} at 0x{site.offset:x}, got {actual.hex()}"
            )
        patched[site.offset : site.offset + len(site.original)] = site.replacement
        changes.append(
            {
                "name": site.name,
                "address": f"0x{site.address:08x}",
                "file_offset": f"0x{site.offset:x}",
                "before": site.original.hex(),
                "after": site.replacement.hex(),
            }
        )
    return bytes(patched), changes


def build_experimental(source: Path, output: Path, acknowledgement: bool) -> dict[str, object]:
    if not acknowledgement:
        raise ValueError("the explicit unbounded-negative acknowledgement is required")
    data = source.read_bytes()
    if not is_exact_stock(data):
        raise ValueError("refusing to patch: input is not the exact verified stock 30.0.6 image")
    patched, changes = apply_unbounded_signed_wheel_patch(data)
    if output.resolve() == source.resolve():
        raise ValueError("refusing to overwrite the stock image")
    if output.exists():
        raise ValueError(f"refusing to overwrite existing output: {output}")
    output.write_bytes(patched)
    return {
        "offline_only": True,
        "installed": False,
        "source": str(source),
        "output": str(output),
        "source_hashes": hashes(data),
        "output_hashes": hashes(patched),
        "changes": changes,
        "critical_warning": "The simple patch removes the zero floor but does not add a firmware-side negative limit. Do not install this candidate.",
    }


def print_json(value: object) -> None:
    print(json.dumps(value, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect", help="inspect and fingerprint an image")
    inspect_parser.add_argument("image", type=Path)

    plan_parser = subparsers.add_parser("ota-plan", help="print the recovered offline OTA packet plan")
    plan_parser.add_argument("image", type=Path)
    plan_parser.add_argument("--file-type", type=int, default=0)

    patch_parser = subparsers.add_parser(
        "build-unbounded-negative-experiment",
        help="build a non-installable research candidate from exact stock 30.0.6",
    )
    patch_parser.add_argument("image", type=Path)
    patch_parser.add_argument("output", type=Path)
    patch_parser.add_argument(
        "--i-understand-negative-input-is-unbounded",
        action="store_true",
        help="required acknowledgement; this still does not install anything",
    )

    args = parser.parse_args()
    try:
        if args.command == "inspect":
            print_json(inspect_image(args.image.read_bytes()))
        elif args.command == "ota-plan":
            print_json(ota_plan(args.image.read_bytes(), args.file_type))
        else:
            print_json(
                build_experimental(
                    args.image,
                    args.output,
                    args.i_understand_negative_input_is_unbounded,
                )
            )
    except (OSError, ValueError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
