package studio.tabletennis.robot;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.webkit.WebViewAssetLoader;

import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int MEDIA_PERMISSION_REQUEST = 1001;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = APP_ORIGIN + "/assets/www/index.html";

    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private String[] pendingWebResources;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new NativeAppBridge(), "NativeApp");
        webView.setWebViewClient(new LocalOnlyWebViewClient(assetLoader));
        webView.setWebChromeClient(new LocalWebChromeClient());
        webView.loadUrl(START_URL);
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
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("NativeApp");
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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
