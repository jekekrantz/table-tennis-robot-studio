#!/usr/bin/env python3
"""Render deterministic mobile GUI fixtures without opening a visible browser."""

from __future__ import annotations

import argparse
from html import unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import math
import re
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "artifacts" / "visual-fixtures"
FIXTURES = (
    "library", "run", "editor-graph", "add-node", "add-random", "add-repeat",
    "add-subdrill", "shot-intuitive", "shot-manual", "serve-intuitive",
    "pose-calibration", "robot", "calibration",
)
SEAM_PX = 5
SEAM_COLOR = (235, 61, 73)

# Primary navigation and contextual transitions represented by the fixture set.
NAVIGATION_EDGES = (
    ("library", "run", "open drill", False, None),
    ("library", "editor-graph", "edit drill", False, None),
    ("library", "add-node", "New drill", False, "new-drill"),
    ("library", "robot", "robot", False, None),
    ("run", "editor-graph", "Run / Edit", True, None),
    ("run", "pose-calibration", "Calibrate pose", False, None),
    ("editor-graph", "add-node", "add", False, None),
    ("editor-graph", "shot-intuitive", "tap existing", False, None),
    ("editor-graph", "serve-intuitive", "tap existing", False, None),
    ("add-node", "shot-intuitive", "Shot", False, None),
    ("add-node", "serve-intuitive", "Serve", False, None),
    ("add-node", "add-random", "Random", False, None),
    ("add-node", "add-repeat", "Repeat", False, None),
    ("add-node", "add-subdrill", "Sub-drill", False, None),
    ("shot-intuitive", "shot-manual", "manual tab", True, None),
    ("robot", "calibration", "calibration", False, None),
)
NAVIGATION_COLUMNS = {
    "library": 0,
    "run": 0,
    "pose-calibration": 0,
    "editor-graph": 2,
    "shot-intuitive": 2,
    "shot-manual": 2,
    "serve-intuitive": 3,
    "add-node": 4,
    "add-random": 4,
    "add-repeat": 5,
    "add-subdrill": 6,
    "robot": 8,
    "calibration": 8,
}

NAVIGATION_GROUPS = (
    ("Drill workflow", ("library", "run"), "#274463"),
    ("Drill pose", ("pose-calibration",), "#315b55"),
    ("Edit and add to drill", ("editor-graph", "add-node", "shot-intuitive", "serve-intuitive", "add-random", "add-repeat", "add-subdrill", "shot-manual"), "#59406d"),
    ("Robot setup", ("robot", "calibration"), "#654a32"),
)


class QuietNoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, _format: str, *_args: object) -> None:
        pass


def browser_binary() -> str:
    configured = os.environ.get("TTRS_CHROME")
    candidates = [configured, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]
    for candidate in candidates:
        if candidate and shutil.which(candidate):
            return shutil.which(candidate) or candidate
    raise SystemExit("No Chromium browser was found. Set TTRS_CHROME to its executable path.")


def display_path(path: Path) -> Path:
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def chromium_command(browser: str, profile: str, width: int, height: int, url: str) -> list[str]:
    return [
        browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--disable-background-networking", "--disable-extensions", "--no-first-run",
        "--run-all-compositor-stages-before-draw", "--force-device-scale-factor=1",
        f"--window-size={width},{height}", f"--user-data-dir={profile}",
        "--virtual-time-budget=1800", url,
    ]


def fixture_url(port: int, name: str, page: int = 0) -> str:
    return (
        f"http://127.0.0.1:{port}/index.html?visualFixture={quote(name)}"
        f"&visualScrollPage={page}"
    )


def scroll_page_info(browser: str, profile: str, width: int, height: int, url: str) -> tuple[int, list[int]]:
    command = chromium_command(browser, profile, width, height, url)
    command.insert(-1, "--dump-dom")
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode:
        detail = (completed.stderr or completed.stdout).strip()
        raise SystemExit(f"Could not inspect fixture scroll range: {detail}")
    dom = unescape(completed.stdout)
    def value(attribute: str, default: int) -> int:
        match = re.search(fr'{attribute}=["\'](\d+)["\']', dom)
        return int(match.group(1)) if match else default
    pages = max(1, value("data-visual-scroll-pages", 1))
    start = value("data-visual-scroll-start", 0)
    maximum = value("data-visual-scroll-maximum", start)
    viewport = max(1, value("data-visual-scroll-viewport", height))
    offsets = [min(maximum, start + page * viewport) for page in range(pages)]
    return pages, offsets


def capture_page(browser: str, profile: str, width: int, height: int, url: str, staging: Path) -> None:
    command = chromium_command(browser, profile, width, height, url)
    command.insert(-1, f"--screenshot={staging}")
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode:
        detail = (completed.stderr or completed.stdout).strip()
        raise SystemExit(f"Could not render fixture: {detail}")
    if not staging.is_file() or staging.stat().st_size < 1000:
        raise SystemExit("Chromium did not create a usable screenshot")


def stitch_pages(pages: list[Path], offsets: list[int], output: Path) -> int:
    images = [Image.open(path).convert("RGB") for path in pages]
    if len(images) == 1:
        images[0].save(output)
        return 1
    additions = [images[0]]
    for index, image in enumerate(images[1:], start=1):
        revealed = max(1, min(image.height, offsets[index] - offsets[index - 1]))
        addition = image.crop((0, image.height - revealed, image.width, image.height))
        colors = addition.getcolors(maxcolors=addition.width * addition.height) or []
        background = max(colors, key=lambda item: item[0])[1] if colors else addition.getpixel((0, addition.height - 1))
        last_content_row = -1
        for y in range(addition.height):
            changed = sum(
                1 for pixel in (addition.getpixel((x, y)) for x in range(addition.width))
                if sum(abs(pixel[channel] - background[channel]) for channel in range(3)) > 24
            )
            if changed >= max(4, addition.width // 100):
                last_content_row = y
        if last_content_row >= 0:
            additions.append(addition.crop((0, 0, addition.width, min(addition.height, last_content_row + 9))))
    width = max(image.width for image in additions)
    height = sum(image.height for image in additions) + SEAM_PX * (len(additions) - 1)
    stitched = Image.new("RGB", (width, height), "#090d13")
    y = 0
    draw = ImageDraw.Draw(stitched)
    for index, image in enumerate(additions):
        if index:
            draw.rectangle((0, y, width, y + SEAM_PX - 1), fill=SEAM_COLOR)
            y += SEAM_PX
        stitched.paste(image, (0, y))
        y += image.height
    stitched.save(output)
    return len(additions)


def navigation_map(rendered: dict[str, Path], output: Path, phone_width: int, phone_height: int) -> None:
    # Keep screenshots at their native phone width. Downscaling them made the
    # overview convenient in size but defeated its purpose as a visual guide:
    # UI text and the red joins in stitched captures became hard to inspect.
    preview_width = phone_width
    card_width = preview_width + 32
    gap_x, gap_y = 180, 140
    margin_x, margin_y = 80, 180
    source_images = {
        name: Image.open(path).convert("RGB")
        for name, path in rendered.items()
    }
    preview_sizes: dict[str, tuple[int, int]] = {}
    card_heights: dict[str, int] = {}
    for name, source in source_images.items():
        preview_height = round(source.height * preview_width / source.width)
        preview_sizes[name] = (preview_width, preview_height)
        card_heights[name] = preview_height + 70

    canvas_width = margin_x * 2 + card_width * 9 + gap_x * 8
    node_tops = {
        "library": margin_y,
        "robot": margin_y,
    }
    workflow_y = node_tops["library"] + card_heights["library"] + gap_y
    node_tops.update({
        "run": workflow_y,
        "editor-graph": workflow_y,
        "add-node": workflow_y,
    })
    node_tops["pose-calibration"] = node_tops["run"] + card_heights["run"] + gap_y
    detail_y = max(
        node_tops["editor-graph"] + card_heights["editor-graph"],
        node_tops["add-node"] + card_heights["add-node"],
    ) + gap_y
    for name in ("shot-intuitive", "serve-intuitive", "add-random", "add-repeat", "add-subdrill"):
        node_tops[name] = detail_y
    node_tops["shot-manual"] = detail_y + card_heights["shot-intuitive"] + gap_y
    node_tops["calibration"] = node_tops["robot"] + card_heights["robot"] + gap_y
    canvas_height = max(
        node_tops[name] + card_heights[name]
        for name in rendered
    ) + 90
    canvas = Image.new("RGB", (canvas_width, canvas_height), "#090d13")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("DejaVuSans.ttf", 22)
    title_font = ImageFont.truetype("DejaVuSans.ttf", 32)
    boxes: dict[str, tuple[int, int, int, int]] = {}
    draw.text((margin_x, 30), "App navigation · mobile visual fixtures", fill="#eef4fa", font=title_font)
    draw.text((margin_x, 72), "Scrollable screens are stitched in full; red seams separate phone viewports.", fill="#aab7c6", font=font)

    for name, column in NAVIGATION_COLUMNS.items():
        if name not in rendered:
            continue
        x = margin_x + column * (card_width + gap_x)
        y = node_tops[name]
        boxes[name] = (x, y, x + card_width, y + card_heights[name])

    for title, members, color in NAVIGATION_GROUPS:
        member_boxes = [boxes[name] for name in members if name in boxes]
        if not member_boxes:
            continue
        group_box = (
            min(box[0] for box in member_boxes) - 28,
            min(box[1] for box in member_boxes) - 42,
            max(box[2] for box in member_boxes) + 28,
            max(box[3] for box in member_boxes) + 28,
        )
        draw.rounded_rectangle(group_box, radius=18, fill="#0d141e", outline=color, width=3)
        draw.text((group_box[0] + 14, group_box[1] + 10), title, fill="#dce9f6", font=font)

    def arrowhead(tip: tuple[int, int], tail: tuple[int, int]) -> None:
        dx, dy = tip[0] - tail[0], tip[1] - tail[1]
        length = math.hypot(dx, dy) or 1
        ux, uy = dx / length, dy / length
        px, py = -uy, ux
        base_x, base_y = tip[0] - ux * 13, tip[1] - uy * 13
        draw.polygon((tip, (base_x + px * 7, base_y + py * 7), (base_x - px * 7, base_y - py * 7)), fill="#ef5360")

    for source, target, label, bidirectional, routing in NAVIGATION_EDGES:
        if source not in boxes or target not in boxes:
            continue
        sx1, sy1, sx2, sy2 = boxes[source]
        tx1, ty1, tx2, ty2 = boxes[target]
        start = ((sx1 + sx2) // 2, sy2)
        end = ((tx1 + tx2) // 2, ty1)
        if sy1 == ty1:
            start = (sx2, (sy1 + sy2) // 2)
            end = (tx1, (ty1 + ty2) // 2)
        points = [start, end]
        if routing == "new-drill":
            # Travel through the open gutter between Library and the editor row.
            # This keeps the new-drill shortcut from crossing either card.
            corridor_y = sy2 + gap_y // 2
            points = [start, (start[0], corridor_y), (end[0], corridor_y), end]
        draw.line(points, fill="#ef5360", width=4, joint="curve")
        arrowhead(end, points[-2])
        if bidirectional:
            arrowhead(start, points[1])
        longest = max(zip(points, points[1:]), key=lambda pair: math.dist(*pair))
        segment_dx = longest[1][0] - longest[0][0]
        segment_dy = longest[1][1] - longest[0][1]
        segment_length = math.hypot(segment_dx, segment_dy) or 1
        label_x = (longest[0][0] + longest[1][0]) // 2 - segment_dy / segment_length * 16
        label_y = (longest[0][1] + longest[1][1]) // 2 + segment_dx / segment_length * 16
        label_box = draw.textbbox((label_x, label_y), label, font=font, anchor="mm")
        draw.rounded_rectangle((label_box[0] - 5, label_box[1] - 3, label_box[2] + 5, label_box[3] + 3), radius=4, fill="#090d13")
        draw.text((label_x, label_y), label, fill="#f6a0a8", font=font, anchor="mm")

    for name, box in boxes.items():
        x1, y1, x2, y2 = box
        draw.rounded_rectangle(box, radius=10, fill="#131b26", outline="#40516a", width=2)
        source = source_images[name]
        preview_size = preview_sizes[name]
        preview = source if source.size == preview_size else source.resize(preview_size, Image.Resampling.LANCZOS)
        preview_x = x1 + 16
        preview_y = y1 + 16
        canvas.paste(preview, (preview_x, preview_y))
        title = name.replace("-", " ").title()
        draw.text(((x1 + x2) // 2, y2 - 25), title, fill="#eef4fa", font=font, anchor="mm")

    canvas.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixtures", nargs="*", help="fixtures to render; defaults to all")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--height", type=int, default=844)
    parser.add_argument("--list", action="store_true", help="list fixture names without rendering")
    parser.add_argument("--map-only", action="store_true", help="rebuild the overview from existing PNGs without launching Chromium")
    args = parser.parse_args()
    if args.list:
        print("\n".join(FIXTURES))
        return
    if not 280 <= args.width <= 600 or not 480 <= args.height <= 1200:
        raise SystemExit("Fixture dimensions must remain phone-sized (width 280..600, height 480..1200).")

    unknown = sorted(set(args.fixtures) - set(FIXTURES))
    if unknown:
        raise SystemExit(f"Unknown fixture(s): {', '.join(unknown)}. Use --list to see valid names.")
    selected = args.fixtures or list(FIXTURES)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    if args.map_only:
        if args.fixtures:
            raise SystemExit("--map-only uses every fixture and cannot be combined with fixture names.")
        rendered = {name: output_dir / f"{name}-{args.width}x{args.height}.png" for name in FIXTURES}
        missing = [path.name for path in rendered.values() if not path.is_file()]
        if missing:
            raise SystemExit(f"Cannot rebuild navigation map; missing: {', '.join(missing)}")
        navigation = output_dir / f"navigation-map-{args.width}x{args.height}.png"
        navigation_map(rendered, navigation, args.width, args.height)
        print(display_path(navigation))
        contact_sheet = output_dir / f"contact-sheet-{args.width}x{args.height}.png"
        shutil.copyfile(navigation, contact_sheet)
        print(display_path(contact_sheet))
        return
    handler = lambda *handler_args, **handler_kwargs: QuietNoCacheHandler(
        *handler_args, directory=str(ROOT), **handler_kwargs
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    browser = browser_binary()

    try:
        rendered: dict[str, Path] = {}
        with tempfile.TemporaryDirectory(prefix="ttrs-visual-profile-") as profile, tempfile.TemporaryDirectory(prefix=".ttrs-visual-pages-", dir=ROOT) as pages_dir:
            for name in selected:
                page_count, offsets = scroll_page_info(
                    browser, profile, args.width, args.height,
                    fixture_url(server.server_port, name),
                )
                page_paths = []
                for page in range(page_count):
                    staging = Path(pages_dir) / f"{name}-{page}.png"
                    capture_page(
                        browser, profile, args.width, args.height,
                        fixture_url(server.server_port, name, page), staging,
                    )
                    page_paths.append(staging)
                output = output_dir / f"{name}-{args.width}x{args.height}.png"
                stitched_views = stitch_pages(page_paths, offsets, output)
                rendered[name] = output
                suffix = f" ({stitched_views} views, red seams)" if stitched_views > 1 else ""
                print(f"{display_path(output)}{suffix}")

        if len(rendered) > 1:
            navigation = output_dir / f"navigation-map-{args.width}x{args.height}.png"
            navigation_map(rendered, navigation, args.width, args.height)
            print(display_path(navigation))
            contact_sheet = output_dir / f"contact-sheet-{args.width}x{args.height}.png"
            shutil.copyfile(navigation, contact_sheet)
            print(display_path(contact_sheet))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
