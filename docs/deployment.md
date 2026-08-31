# Deployment integrity

Table Tennis Robot Studio is a static GitHub Pages application. A deployment must be **atomic at the repository level**: do not mix files from different releases.

## Production runtime

Development keeps the JavaScript sources separate, but `index.html` loads one generated file:

- `runtime.bundle.js`

Its version comes from `BUILD_ID`. Generate/update it with:

```bash
python3 scripts/build_runtime_bundle.py
```

Check that the committed bundle exactly matches the sources with:

```bash
python3 scripts/build_runtime_bundle.py --check
```

The full preflight includes that check.

## Recommended update

From the repository root after copying/extracting a complete release over the checkout:

```bash
bash scripts/preflight.sh
git add -A
git status
git commit -m "Update Table Tennis Robot Studio"
git push
```

Use `git add -A`, not a hand-picked list of old files. New releases can add JavaScript sources, documentation, debug packs, vendor files, or other required assets.

## Failure mode this prevents

A partial deployment can leave a new `app.js` or `index.html` in the repository while newer runtime modules are absent. The browser then loads only part of the application and startup fails. The single production runtime bundle reduces this failure mode, while preflight and GitHub Actions catch stale or incomplete source trees before release.
