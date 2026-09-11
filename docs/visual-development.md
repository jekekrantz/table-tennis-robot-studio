# Mobile visual development

Table Tennis Robot Studio has one phone-oriented interface at every window
width. GUI development and review should use the deterministic mobile visual
fixtures in addition to structural and behavioral tests.

The fixture system loads production markup, `styles.css`, and the generated
runtime. It supplies deterministic drills and UI states, uses an isolated
temporary Chromium profile, and never connects to Nova. Chromium runs headless,
so capturing fixtures does not open or take over an active browser window.

Render every fixture at the standard 390 × 844 viewport:

```bash
python3 scripts/render_mobile_fixtures.py
```

Render only the surfaces affected by a change:

```bash
python3 scripts/render_mobile_fixtures.py shot-intuitive shot-manual
```

List the independently renderable fixture names:

```bash
python3 scripts/render_mobile_fixtures.py --list
```

Passing one name updates only that component PNG and deliberately skips the
navigation-map work. Every screenshot box used by the overview is also stored
as its own full-resolution file, so routine component review stays cheap.
After a targeted render, refresh the overview from those saved PNGs without
launching Chromium:

```bash
python3 scripts/render_mobile_fixtures.py --map-only
```

For narrow-width overflow investigations, render the relevant fixture at
320 × 844:

```bash
python3 scripts/render_mobile_fixtures.py shot-intuitive --width 320
```

Outputs are written to `artifacts/visual-fixtures/`. If a surface scrolls, the
renderer captures each successive phone viewport and stitches those views
vertically. A red horizontal seam marks every scroll transition, so the result
does not pretend to be one continuous browser viewport.

Rendering multiple fixtures also creates `navigation-map-390x844.png`. It
orders the screenshots by the app's navigation and draws labeled arrows for
the transitions represented by the fixtures. This includes New drill from the
Library, two-way Run/Edit navigation, and every Add-node destination. The same
map is embedded in the repository README as a user-facing app overview.
`contact-sheet-390x844.png` is an alias of that map for existing review links. Set `TTRS_CHROME` only when
Chromium is installed at a non-standard path. `visual-harness.html` shows all
fixtures as live 390 × 844 frames when a browsable gallery is useful.

Current fixtures cover Library, Run, the graph editor, intuitive and manual Shot
details, Serve details, the Add node chooser, Random/Repeat/Sub-drill creation,
drill-pose calibration, Robot, and robot-model Calibration. The navigation map
shows Add branching to all five node types and groups related workflows. When a
new primary surface or materially different state is introduced,
add a deterministic fixture in the same change. Do not duplicate production
markup in the harness.

For GUI changes:

1. Render each affected fixture.
2. Inspect the PNG at full size for clipping, overlap, hierarchy, touch-target,
   text-legibility, and problems revealed after each red scroll seam.
3. Include the relevant PNGs when presenting the change for review.
4. Run the normal preflight before release.

Screenshots complement interaction testing. Pointer behavior, focus, scrolling,
animation, latency, and robot safety still require their existing tests.
