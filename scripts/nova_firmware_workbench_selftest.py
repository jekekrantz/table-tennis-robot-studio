#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = ROOT / "tools" / "nova_firmware_workbench.py"
SPEC = importlib.util.spec_from_file_location("nova_firmware_workbench", MODULE_PATH)
assert SPEC and SPEC.loader
workbench = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = workbench
SPEC.loader.exec_module(workbench)


def synthetic_image() -> bytes:
    data = bytearray(workbench.STOCK_SIZE)
    struct.pack_into("<II", data, 0, 0x20001288, workbench.IMAGE_BASE + 0x149)
    for site in workbench.SIGNED_WHEEL_PATCHES:
        data[site.offset : site.offset + len(site.original)] = site.original
    return bytes(data)


def main() -> None:
    source = synthetic_image()
    info = workbench.inspect_image(source)
    assert info["vectors"]["valid"] is True
    assert info["exact_stock_30_0_6"] is False
    assert [site["state"] for site in info["patch_sites"]] == ["stock", "stock"]

    patched, changes = workbench.apply_unbounded_signed_wheel_patch(source)
    assert len(patched) == len(source)
    assert len(changes) == 2
    changed_offsets = [index for index, pair in enumerate(zip(source, patched)) if pair[0] != pair[1]]
    assert changed_offsets == [site.offset + 1 for site in workbench.SIGNED_WHEEL_PATCHES]
    assert [site["state"] for site in workbench.patch_site_info(patched)] == ["patched", "patched"]

    packets = workbench.ota_packets(source, file_type=0)
    chunks = packets["chunks"]
    assert packets["start"] == bytes.fromhex("c00000")
    assert packets["announce"] == bytes.fromhex("c1050000") + struct.pack("<I", len(source))
    assert packets["transfer_complete"] == bytes.fromhex("c40000")
    assert packets["check_md5"][:4] == bytes.fromhex("c3200000")
    assert packets["activate"][:4] == bytes.fromhex("c5250000")
    assert len(packets["check_md5"]) == 36
    assert len(packets["activate"]) == 40
    assert all(packet[0] == 0xC2 for packet in chunks)
    assert all(struct.unpack_from("<H", packet, 1)[0] == len(packet) - 3 for packet in chunks)
    rebuilt = b"".join(packet[7:] for packet in chunks)
    assert rebuilt == source
    assert [struct.unpack_from("<I", packet, 3)[0] for packet in chunks] == list(
        range(0, len(source), workbench.OTA_CHUNK_SIZE)
    )

    try:
        workbench.apply_unbounded_signed_wheel_patch(patched)
    except ValueError:
        pass
    else:
        raise AssertionError("patching an already modified image must fail")

    print("Nova firmware workbench self-test: PASS")


if __name__ == "__main__":
    main()
