# Third-party and provenance notes

Table Tennis Robot Studio is distributed under GPL-3.0.

The project implements compatibility with the Pongbot Nova S Pro protocol. Protocol
behavior, field meanings, and interoperability constants were informed by direct
hardware observations during this project and by public community documentation,
including:

- https://github.com/olanga/nova
- https://github.com/smee/nova-s-custom-drills
- https://www.tabletennisdaily.com/forum/topics/pongbot-nova-s-pro-owners-review-and-discussion-thread.36322/
- Pongbot's public Nova S Pro documentation.

Except for the small QR generator documented below, no third-party implementation source tree is vendored. Protocol UUIDs, packet values, mathematical constants, and observed wire-format facts are retained for interoperability. Contributors should not add third-party implementation code unless its license is identified and compatible and all required notices are preserved.

The trajectory model also cites scientific/standards sources in `MODEL_SOURCES.md`;
those references describe the model and do not bundle the referenced publications.

Pongbot/PONGBOT and other product names may be trademarks of their respective owners.
This is an independent community project and is not affiliated with or endorsed by
Pongbot.

## Vendored QR generator

`vendor/qrcode.min.js` contains the **QRCode for JavaScript** implementation by
Kazuhiko Arase (copyright 2009), as distributed inside the `qrcode-terminal`
package. That QRCode component is MIT-licensed. This project adds a small browser/SVG
wrapper so drill QR sharing works fully offline and does not depend on a CDN at
runtime. See `vendor/QRCode-LICENSE.txt` for the retained license notice.
