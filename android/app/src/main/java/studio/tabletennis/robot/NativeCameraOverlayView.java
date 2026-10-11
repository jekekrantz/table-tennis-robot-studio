package studio.tabletennis.robot;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.util.Base64;
import android.view.View;

/** Draws the web camera guide above the native SurfaceView without blocking touches. */
final class NativeCameraOverlayView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private Bitmap bitmap;

    NativeCameraOverlayView(Context context) {
        super(context);
        initialize();
    }

    private void initialize() {
        setWillNotDraw(false);
        setClickable(false);
        setFocusable(false);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    void setDataUrl(String dataUrl) {
        Bitmap decoded = null;
        try {
            if (dataUrl != null && dataUrl.startsWith("data:image/png;base64,")) {
                int separator = dataUrl.indexOf(',');
                if (separator >= 0) {
                    byte[] bytes = Base64.decode(dataUrl.substring(separator + 1), Base64.DEFAULT);
                    decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                }
            }
        } catch (Exception ignored) {
            decoded = null;
        }
        Bitmap next = decoded;
        post(() -> replaceBitmap(next));
    }

    void clear() {
        post(() -> replaceBitmap(null));
    }

    private void replaceBitmap(Bitmap next) {
        Bitmap previous = bitmap;
        bitmap = next;
        invalidate();
        if (previous != null && previous != next && !previous.isRecycled()) previous.recycle();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        Bitmap current = bitmap;
        if (current == null || current.isRecycled() || getWidth() <= 0 || getHeight() <= 0) return;
        canvas.drawBitmap(current, null, new Rect(0, 0, getWidth(), getHeight()), paint);
    }
}
