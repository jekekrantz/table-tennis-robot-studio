package studio.tabletennis.robot;

import android.os.Build;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

final class NativeAppBridge {
    private final Activity activity;
    private final NativeBluetoothManager bluetooth;
    private final NativeCaptureMetadataManager captureMetadata;
    private final NativeCameraManager camera;
    private final NativeExportManager export;

    NativeAppBridge(Activity activity, NativeBluetoothManager bluetooth, NativeCaptureMetadataManager captureMetadata, NativeCameraManager camera, NativeExportManager export) {
        this.activity = activity;
        this.bluetooth = bluetooth;
        this.captureMetadata = captureMetadata;
        this.camera = camera;
        this.export = export;
    }

    @JavascriptInterface
    public boolean isNativeHost() {
        return true;
    }

    @JavascriptInterface
    public boolean supportsNativeBluetooth() {
        return bluetooth.isSupported();
    }

    @JavascriptInterface
    public void bluetoothConnect() {
        bluetooth.connect();
    }

    @JavascriptInterface
    public void bluetoothWrite(String requestId, String hex) {
        bluetooth.write(requestId, hex);
    }

    @JavascriptInterface
    public void bluetoothDisconnect() {
        bluetooth.disconnect();
    }

    @JavascriptInterface
    public String getCameraMetadata() {
        return captureMetadata.cameraMetadataJson();
    }

    @JavascriptInterface
    public String getSensorCatalog() {
        return captureMetadata.sensorCatalogJson();
    }

    @JavascriptInterface
    public String startMotionCapture(String sessionId) {
        return captureMetadata.startMotionCapture(sessionId);
    }

    @JavascriptInterface
    public String drainMotionSamples() {
        return captureMetadata.drainMotionSamples();
    }

    @JavascriptInterface
    public String stopMotionCapture() {
        return captureMetadata.stopMotionCapture();
    }

    @JavascriptInterface
    public void startNativeCamera(String requestId, String cameraId, boolean captureAudio) {
        camera.start(requestId, cameraId, captureAudio);
    }

    @JavascriptInterface
    public void stopNativeCamera(String requestId) {
        camera.stop(requestId);
    }

    @JavascriptInterface
    public void startNativeRecording(String requestId, String captureId) {
        camera.startRecording(requestId, captureId);
    }

    @JavascriptInterface
    public void stopNativeRecording(String requestId) {
        camera.stopRecording(requestId);
    }

    @JavascriptInterface
    public void captureNativeStill(String requestId, String captureId) {
        camera.captureStill(requestId, captureId);
    }

    @JavascriptInterface
    public String drainNativeFrameMetadata() {
        return camera.drainFrameMetadata();
    }

    @JavascriptInterface
    public String getNativeCameraState() {
        return camera.stateJson();
    }

    @JavascriptInterface
    public void setNativeCameraViewport(double left, double top, double width, double height) {
        camera.setViewport(left, top, width, height);
    }

    @JavascriptInterface
    public void setNativeCameraOverlay(String dataUrl) {
        camera.setOverlay(dataUrl);
    }

    @JavascriptInterface
    public void exportTextFile(String filename, String mimeType, String content) {
        export.exportText(filename, mimeType, content);
    }

    @JavascriptInterface
    public void exportNativeMedia(String sourceName, String filename, String mimeType) {
        export.exportMedia(sourceName, filename, mimeType);
    }

    @JavascriptInterface
    public void exportDatasetZip(String filename, String manifestJson, String mediaJson) {
        export.exportDataset(filename, manifestJson, mediaJson);
    }

    @JavascriptInterface
    public String getNativeCaptureStorage() {
        return camera.captureStorageJson();
    }

    @JavascriptInterface
    public String clearNativeCaptureMedia() {
        return camera.clearStoredMedia();
    }

    @JavascriptInterface
    public boolean deleteNativeCaptureMedia(String sourceName) {
        return camera.deleteStoredMedia(sourceName);
    }

    @JavascriptInterface
    public void enterShotAnalysisLandscape() {
        activity.runOnUiThread(() -> {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        });
    }

    @JavascriptInterface
    public void exitShotAnalysisLandscape() {
        activity.runOnUiThread(() -> {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        });
    }

    @JavascriptInterface
    public String getInfo() {
        JSONObject info = new JSONObject();
        try {
            info.put("platform", "android");
            info.put("androidApi", Build.VERSION.SDK_INT);
            info.put("androidRelease", Build.VERSION.RELEASE);
            info.put("manufacturer", Build.MANUFACTURER);
            info.put("model", Build.MODEL);
            info.put("applicationId", BuildConfig.APPLICATION_ID);
            info.put("versionName", BuildConfig.VERSION_NAME);
            info.put("versionCode", BuildConfig.VERSION_CODE);
            info.put("camera2Capture", true);
            info.put("camera2StaticMetadata", true);
            info.put("nativeMotionSensors", true);
            info.put("nativeArtifactExport", true);
            info.put("nativeCaptureStorage", true);
        } catch (JSONException ignored) {
            return "{\"platform\":\"android\"}";
        }
        return info.toString();
    }
}
