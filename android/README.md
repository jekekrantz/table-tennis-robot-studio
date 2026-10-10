# Android wrapper

This is a minimal, local Android host for Table Tennis Robot Studio. It bundles
the generated web application into the APK and displays it in a locked-down
WebView. It does not yet implement the native Camera2 dataset recorder.

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

`camera2Capture` is currently `false`. The next native increment should add a
Camera2 capability inventory and synchronized recording service without moving
video frames through the JavaScript bridge.

## Website distribution

The debug APK is only for local development. Before website distribution,
create a release signing key outside the repository and configure a release
signing setup locally. Keep the application ID and signing key stable so Android
can install future APKs as updates without erasing app data.
