package studio.tabletennis.robot;

import android.content.Context;
import android.graphics.Color;
import android.util.Size;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

/** Foreground Camera2 preview, including the non-interactive alignment guide. */
final class NativeCameraPreview extends FrameLayout {
    private final SurfaceView surfaceView;
    private final NativeCameraOverlayView overlayView;

    NativeCameraPreview(Context context) {
        super(context);
        setClipChildren(true);
        setBackgroundColor(Color.BLACK);
        setVisibility(View.GONE);
        setClickable(false);
        setFocusable(false);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);

        surfaceView = new SurfaceView(context);
        surfaceView.setZOrderMediaOverlay(true);
        surfaceView.setClickable(false);
        surfaceView.setFocusable(false);
        addView(surfaceView, new LayoutParams(1, 1));

        overlayView = new NativeCameraOverlayView(context);
        addView(overlayView, new LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    SurfaceView surfaceView() {
        return surfaceView;
    }

    void showAt(int left, int top, int width, int height, boolean resized) {
        if (resized) setLayoutParams(new FrameLayout.LayoutParams(width, height));
        setX(left);
        setY(top);
        setVisibility(View.VISIBLE);
    }

    void fitSurface(Size sourceSize) {
        if (sourceSize == null || getWidth() <= 0 || getHeight() <= 0) return;
        double scale = Math.max(
                (double) getWidth() / sourceSize.getWidth(),
                (double) getHeight() / sourceSize.getHeight()
        );
        int width = Math.max(1, (int) Math.ceil(sourceSize.getWidth() * scale));
        int height = Math.max(1, (int) Math.ceil(sourceSize.getHeight() * scale));
        LayoutParams params = new LayoutParams(width, height);
        params.leftMargin = (getWidth() - width) / 2;
        params.topMargin = (getHeight() - height) / 2;
        surfaceView.setLayoutParams(params);
    }

    void setGuide(String dataUrl) {
        overlayView.setDataUrl(dataUrl);
    }

    void hideAndClear() {
        overlayView.clear();
        setVisibility(View.GONE);
    }
}
