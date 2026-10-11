package studio.tabletennis.robot;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.SurfaceView;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int MEDIA_PERMISSION_REQUEST = 1001;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = APP_ORIGIN + "/assets/www/index.html";
    private static final String UPDATE_MANIFEST_URL = "https://jekekrantz.github.io/table-tennis-robot-studio/android-update.json";
    private static final int UPDATE_CONNECT_TIMEOUT_MS = 8_000;
    private static final int UPDATE_READ_TIMEOUT_MS = 20_000;
    private static final int MAX_UPDATE_MANIFEST_BYTES = 64 * 1024;

    private WebView webView;
    private NativeBluetoothManager nativeBluetooth;
    private NativeCaptureMetadataManager nativeCaptureMetadata;
    private NativeCameraManager nativeCamera;
    private PermissionRequest pendingWebPermission;
    private String[] pendingWebResources;
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        FrameLayout appRoot = new FrameLayout(this);
        appRoot.setBackgroundColor(Color.rgb(17, 21, 26));
        webView = new WebView(this);
        appRoot.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        FrameLayout nativeCameraPreviewContainer = new FrameLayout(this);
        nativeCameraPreviewContainer.setClipChildren(true);
        nativeCameraPreviewContainer.setBackgroundColor(Color.BLACK);
        nativeCameraPreviewContainer.setVisibility(android.view.View.GONE);
        nativeCameraPreviewContainer.setClickable(false);
        nativeCameraPreviewContainer.setFocusable(false);
        nativeCameraPreviewContainer.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        SurfaceView nativeCameraPreview = new SurfaceView(this);
        nativeCameraPreview.setZOrderOnTop(false);
        nativeCameraPreview.setZOrderMediaOverlay(true);
        nativeCameraPreview.setClickable(false);
        nativeCameraPreview.setFocusable(false);
        nativeCameraPreviewContainer.addView(nativeCameraPreview, new FrameLayout.LayoutParams(1, 1));
        NativeCameraOverlayView nativeCameraOverlay = new NativeCameraOverlayView(this);
        nativeCameraPreviewContainer.addView(nativeCameraOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        // Keep the camera above the hardware-accelerated WebView. Samsung WebView
        // builds may not reveal a SurfaceView placed behind a transparent WebView.
        appRoot.addView(nativeCameraPreviewContainer, new FrameLayout.LayoutParams(1, 1));
        appRoot.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets safe = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                left = safe.left;
                top = safe.top;
                right = safe.right;
                bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return new WindowInsets.Builder(insets)
                        .setInsets(
                                WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout(),
                                android.graphics.Insets.NONE
                        )
                        .build();
            }
            return insets.consumeSystemWindowInsets();
        });
        setContentView(appRoot);
        appRoot.requestApplyInsets();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setBackgroundColor(Color.TRANSPARENT);

        nativeBluetooth = new NativeBluetoothManager(this, webView);
        nativeCaptureMetadata = new NativeCaptureMetadataManager(this);
        nativeCamera = new NativeCameraManager(this, nativeCameraPreviewContainer, nativeCameraPreview, nativeCameraOverlay, webView);
        webView.addJavascriptInterface(new NativeAppBridge(this, nativeBluetooth, nativeCaptureMetadata, nativeCamera), "NativeApp");
        webView.setWebViewClient(new LocalOnlyWebViewClient(assetLoader));
        webView.setWebChromeClient(new LocalWebChromeClient());
        webView.loadUrl(START_URL);
        checkForAppUpdate();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (nativeCamera != null) nativeCamera.onHostPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (nativeBluetooth != null) nativeBluetooth.destroy();
        if (nativeCaptureMetadata != null) nativeCaptureMetadata.destroy();
        if (nativeCamera != null) nativeCamera.destroy();
        if (webView != null) {
            webView.removeJavascriptInterface("NativeApp");
            webView.destroy();
        }
        updateExecutor.shutdownNow();
        super.onDestroy();
    }

    private void checkForAppUpdate() {
        updateExecutor.execute(() -> {
            try {
                JSONObject update = readUpdateManifest();
                int remoteVersionCode = update.getInt("versionCode");
                if (remoteVersionCode <= BuildConfig.VERSION_CODE) return;
                String versionName = update.optString("versionName", String.valueOf(remoteVersionCode));
                String apkUrl = requireHttpsUrl(update.getString("apkUrl"));
                String sha256 = update.getString("sha256").trim().toLowerCase(Locale.ROOT);
                if (!sha256.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Invalid update hash");
                mainHandler.post(() -> showUpdatePrompt(versionName, remoteVersionCode, apkUrl, sha256));
            } catch (Exception ignored) {
                // Startup must remain usable while offline or before the update manifest is published.
            }
        });
    }

    private JSONObject readUpdateManifest() throws Exception {
        HttpURLConnection connection = openHttpsConnection(UPDATE_MANIFEST_URL);
        connection.setRequestProperty("Accept", "application/json");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Update manifest HTTP " + connection.getResponseCode());
            }
            try (InputStream input = new BufferedInputStream(connection.getInputStream())) {
                byte[] bytes = readLimited(input, MAX_UPDATE_MANIFEST_BYTES);
                return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            }
        } finally {
            connection.disconnect();
        }
    }

    private void showUpdatePrompt(String versionName, int versionCode, String apkUrl, String sha256) {
        if (isFinishing() || isDestroyed()) return;
        new AlertDialog.Builder(this)
                .setTitle("Update available")
                .setMessage("Robot Studio " + versionName + " is available. Download and install it now?")
                .setNegativeButton("Later", null)
                .setPositiveButton("Update", (dialog, which) -> downloadAndInstallUpdate(versionName, versionCode, apkUrl, sha256))
                .show();
    }

    private void downloadAndInstallUpdate(String versionName, int versionCode, String apkUrl, String expectedSha256) {
        Toast.makeText(this, "Downloading Robot Studio " + versionName + "…", Toast.LENGTH_LONG).show();
        updateExecutor.execute(() -> {
            File target = null;
            try {
                File updateDirectory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (updateDirectory == null) throw new IllegalStateException("Update storage is unavailable");
                if (!updateDirectory.exists() && !updateDirectory.mkdirs()) throw new IllegalStateException("Could not create update directory");
                target = new File(updateDirectory, "robot-studio-update-" + versionCode + ".apk");
                downloadUpdate(apkUrl, target);
                String actualSha256 = sha256(target);
                if (!expectedSha256.equals(actualSha256)) throw new SecurityException("Downloaded update did not pass its integrity check");
                File verified = target;
                mainHandler.post(() -> openPackageInstaller(verified));
            } catch (Exception error) {
                if (target != null) target.delete();
                String message = error.getMessage() == null ? "Update download failed" : error.getMessage();
                mainHandler.post(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
            }
        });
    }

    private void downloadUpdate(String apkUrl, File target) throws Exception {
        HttpURLConnection connection = openHttpsConnection(requireHttpsUrl(apkUrl));
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Update download HTTP " + connection.getResponseCode());
            }
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[32 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openHttpsConnection(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(requireHttpsUrl(url)).openConnection();
        connection.setConnectTimeout(UPDATE_CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(UPDATE_READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private String requireHttpsUrl(String value) {
        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            throw new IllegalArgumentException("Update URL must use HTTPS");
        }
        return value;
    }

    private byte[] readLimited(InputStream input, int maximumBytes) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > maximumBytes) throw new IllegalStateException("Update manifest is too large");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new java.io.FileInputStream(file))) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        StringBuilder value = new StringBuilder();
        for (byte item : digest.digest()) value.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        return value.toString();
    }

    private void openPackageInstaller(File apk) {
        try {
            Uri apkUri = FileProvider.getUriForFile(this, BuildConfig.APPLICATION_ID + ".updates", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apkUri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "Could not open the Android installer: " + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NativeBluetoothManager.PERMISSION_REQUEST) {
            if (nativeBluetooth != null) nativeBluetooth.onPermissionResult(grantResults);
            return;
        }
        if (requestCode == NativeCameraManager.PERMISSION_REQUEST) {
            if (nativeCamera != null) nativeCamera.onPermissionResult(grantResults);
            return;
        }
        if (requestCode != MEDIA_PERMISSION_REQUEST || pendingWebPermission == null) return;

        PermissionRequest request = pendingWebPermission;
        pendingWebPermission = null;
        String[] resources = pendingWebResources;
        pendingWebResources = null;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                request.deny();
                return;
            }
        }
        request.grant(resources);
    }

    private final class LocalOnlyWebViewClient extends WebViewClient {
        private final WebViewAssetLoader assetLoader;

        LocalOnlyWebViewClient(WebViewAssetLoader assetLoader) {
            this.assetLoader = assetLoader;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (nativeCamera != null && request.getUrl().getPath() != null && request.getUrl().getPath().startsWith("/native-media/")) {
                String name = request.getUrl().getLastPathSegment();
                File file = nativeCamera.mediaFile(name);
                if (file != null) {
                    try {
                        String mime = name.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
                        return new WebResourceResponse(mime, null, new java.io.FileInputStream(file));
                    } catch (Exception ignored) {}
                }
            }
            return assetLoader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) {
                return false;
            }
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        }
    }

    private final class LocalWebChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> handleWebPermissionRequest(request));
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (!"https".equals(origin.getScheme()) || !"appassets.androidplatform.net".equals(origin.getHost())) {
            request.deny();
            return;
        }

        List<String> needed = new ArrayList<>();
        List<String> allowedResources = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                allowedResources.add(resource);
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.CAMERA);
                }
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                allowedResources.add(resource);
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.RECORD_AUDIO);
                }
            } else {
                request.deny();
                return;
            }
        }

        String[] resources = allowedResources.toArray(new String[0]);

        if (needed.isEmpty()) {
            request.grant(resources);
            return;
        }

        if (pendingWebPermission != null) pendingWebPermission.deny();
        pendingWebPermission = request;
        pendingWebResources = resources;
        requestPermissions(needed.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
    }
}
