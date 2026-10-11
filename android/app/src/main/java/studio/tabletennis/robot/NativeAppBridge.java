package studio.tabletennis.robot;

import android.os.Build;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.webkit.JavascriptInterface;

import org.json.JSONException;
import org.json.JSONObject;

final class NativeAppBridge {
    private final Activity activity;
    private final NativeBluetoothManager bluetooth;

    NativeAppBridge(Activity activity, NativeBluetoothManager bluetooth) {
        this.activity = activity;
        this.bluetooth = bluetooth;
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
    public void enterShotAnalysisLandscape() {
        activity.runOnUiThread(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
    }

    @JavascriptInterface
    public void exitShotAnalysisLandscape() {
        activity.runOnUiThread(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
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
            info.put("camera2Capture", false);
        } catch (JSONException ignored) {
            return "{\"platform\":\"android\"}";
        }
        return info.toString();
    }
}
