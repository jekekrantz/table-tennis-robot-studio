# Android wrapper

This is a local Android host for Table Tennis Robot Studio. It bundles the
generated web application into the APK and displays it in a locked-down WebView.
Camera2 recording, motion-sensor capture, native Bluetooth, and system document
export are implemented by the Android bridge.

## Build a development APK

Requirements: JDK 17 and an Android SDK containing platform 36.

```bash
cd android
./gradlew assembleDebug
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The website download button uses the staged preview copy at:

```text
downloads/table-tennis-robot-studio-android-preview.apk
```

After validating a new debug APK, replace that staged preview copy before
publishing the website. It is intentionally labelled as a preview until a
persistent release-signing key is configured.

Then generate the descriptor used by the native startup update check:

```bash
python3 scripts/android_update_manifest.py --write
```

Publish the APK and `android-update.json` together. On startup the installed app
checks the descriptor, compares `versionCode`, verifies the downloaded APK's
SHA-256, and opens Android's package installer. Android always requires the user
to approve installation; it cannot be completed silently by an ordinary app.

Install it on a connected Android phone with:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The Gradle build copies `index.html`, `styles.css`, `runtime.bundle.js`, and
`BUILD_ID` from the repository root. Rebuild the generated runtime bundle before
building the APK whenever web source files change.

## Native bridge

Trusted bundled JavaScript can inspect the host using:

```js
JSON.parse(NativeApp.getInfo())
```

`camera2Capture` reports the native Camera2 recorder and metadata inventory.
Generated logs and media use Android's system document saver; complete datasets
are exported as a single ZIP.

## Website distribution

The debug APK is only for local development. Before website distribution,
create a release signing key outside the repository and configure a release
signing setup locally. Keep the application ID and signing key stable so Android
can install future APKs as updates without erasing app data.
