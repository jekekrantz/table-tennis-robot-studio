package studio.tabletennis.robot;

import android.Manifest;
import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.camera2.params.RggbChannelVector;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Range;
import android.util.Size;
import android.view.PixelCopy;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

final class NativeCameraManager {
    static final int PERMISSION_REQUEST = 1003;
    private final Activity activity;
    private final NativeCameraPreview preview;
    private final SurfaceView previewView;
    private final WebView webView;
    private final CameraManager cameraManager;
    private final Map<String, File> mediaFiles = new ConcurrentHashMap<>();
    private final File captureDirectory;
    private final List<JSONArray> frameMetadata = new ArrayList<>();
    private HandlerThread cameraThread;
    private Handler cameraHandler;
    private volatile CameraDevice camera;
    private CameraCaptureSession session;
    private Surface previewSurface;
    private MediaRecorder recorder;
    private File recordingFile;
    private Size previewSize;
    private Size recordingSize;
    private int recordingFrameRate = 30;
    private String activeCameraId = "";
    private String startRequestId = "";
    private String pendingPermissionRequestId = "";
    private String pendingPreviewRequestId = "";
    private volatile boolean cameraRequested;
    private boolean captureAudioRequested;
    private volatile boolean captureAudio;
    private volatile boolean recording;
    private long droppedFrameMetadata;
    private int viewportLeft = Integer.MIN_VALUE;
    private int viewportTop = Integer.MIN_VALUE;
    private int viewportWidth = -1;
    private int viewportHeight = -1;

    NativeCameraManager(Activity activity, NativeCameraPreview preview, WebView webView) {
        this.activity = activity;
        this.preview = preview;
        this.previewView = preview.surfaceView();
        this.webView = webView;
        this.cameraManager = activity.getSystemService(CameraManager.class);
        this.captureDirectory = new File(activity.getFilesDir(), "developer-captures");
        if (!captureDirectory.isDirectory()) captureDirectory.mkdirs();
        File[] existing = captureDirectory.listFiles(File::isFile);
        if (existing != null) for (File file : existing) mediaFiles.put(file.getName(), file);
        previewView.getHolder().addCallback(surfaceCallback);
        startThread();
    }

    void start(String requestId, String requestedCameraId, boolean withAudio) {
        activity.runOnUiThread(() -> {
            cameraRequested = true;
            startRequestId = requestId;
            activeCameraId = requestedCameraId == null ? "" : requestedCameraId;
            captureAudioRequested = withAudio;
            captureAudio = withAudio && hasMicrophonePermission();
            preview.setVisibility(android.view.View.VISIBLE);
            if (!hasPermissions(withAudio)) {
                pendingPermissionRequestId = requestId;
                activity.requestPermissions(requiredPermissions(withAudio), PERMISSION_REQUEST);
                return;
            }
            postCamera(this::openWhenReady);
        });
    }

    void onPermissionResult(int[] grantResults) {
        String requestId = pendingPermissionRequestId;
        pendingPermissionRequestId = "";
        if (!hasCameraPermission()) {
            cameraRequested = false;
            startRequestId = "";
            activity.runOnUiThread(preview::hideAndClear);
            emit(error(requestId, "Camera permission is required for native capture."));
            return;
        }
        captureAudio = captureAudioRequested && hasMicrophonePermission();
        postCamera(this::openWhenReady);
    }

    private void openWhenReady() {
        if (!cameraRequested || !surfaceReady()) return;
        try { openCamera(); }
        catch (Exception error) { failCameraStart(startRequestId, error.getMessage()); }
    }

    @SuppressWarnings("MissingPermission")
    private void openCamera() throws Exception {
        closeCamera(false);
        if (cameraManager == null) throw new IllegalStateException("Camera2 is unavailable.");
        if (activeCameraId.isEmpty()) activeCameraId = chooseBackCamera();
        CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(activeCameraId);
        StreamConfigurationMap map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        if (map == null) throw new IllegalStateException("Camera stream configuration is unavailable.");
        previewSize = chooseSize(map.getOutputSizes(SurfaceHolder.class), 1920, 1080);
        recordingSize = chooseSize(map.getOutputSizes(MediaRecorder.class), 1920, 1080);
        long minimumFrameDuration = map.getOutputMinFrameDuration(MediaRecorder.class, recordingSize);
        recordingFrameRate = minimumFrameDuration > 0 && minimumFrameDuration <= 17_000_000L ? 60 : 30;
        Range<Integer>[] fpsRanges = characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
        boolean supportsSelectedRate = false;
        if (fpsRanges != null) for (Range<Integer> range : fpsRanges) if (range.contains(recordingFrameRate)) supportsSelectedRate = true;
        if (!supportsSelectedRate) recordingFrameRate = 30;
        runOnUiThreadAndWait(() -> {
            previewView.getHolder().setFixedSize(previewSize.getWidth(), previewSize.getHeight());
            updatePreviewLayout();
        });
        cameraManager.openCamera(activeCameraId, deviceCallback, cameraHandler);
    }

    private String chooseBackCamera() throws CameraAccessException {
        String fallback = null;
        for (String id : cameraManager.getCameraIdList()) {
            if (fallback == null) fallback = id;
            Integer facing = cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
            if (facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) return id;
        }
        if (fallback == null) throw new IllegalStateException("No camera is available.");
        return fallback;
    }

    private final SurfaceHolder.Callback surfaceCallback = new SurfaceHolder.Callback() {
        @Override public void surfaceCreated(SurfaceHolder holder) { if (cameraRequested && camera == null && hasCameraPermission()) postCamera(NativeCameraManager.this::openWhenReady); }
        @Override public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) { updatePreviewLayout(); }
        @Override public void surfaceDestroyed(SurfaceHolder holder) { if (cameraRequested) onHostPause(); else closeCamera(false); }
    };

    private final CameraDevice.StateCallback deviceCallback = new CameraDevice.StateCallback() {
        @Override public void onOpened(CameraDevice device) { camera = device; createPreviewSession(startRequestId); }
        @Override public void onDisconnected(CameraDevice device) { cameraRequested = false; emit(event("camera-disconnected", startRequestId)); closeCamera(true); }
        @Override public void onError(CameraDevice device, int code) {
            String requestId = startRequestId;
            cameraRequested = false;
            emit(error(requestId, "Camera2 error " + code + "."));
            emit(event("camera-disconnected", requestId));
            closeCamera(true);
        }
    };

    private void createPreviewSession(String requestId) {
        if (camera == null || !surfaceReady()) return;
        closeSession();
        previewSurface = previewView.getHolder().getSurface();
        try {
            camera.createCaptureSession(Arrays.asList(previewSurface), new CameraCaptureSession.StateCallback() {
                @Override public void onConfigured(CameraCaptureSession configured) {
                    session = configured;
                    try {
                        CaptureRequest.Builder builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                        builder.addTarget(previewSurface);
                        configureAuto(builder);
                        pendingPreviewRequestId = requestId == null ? "" : requestId;
                        session.setRepeatingRequest(builder.build(), captureCallback, cameraHandler);
                    } catch (Exception error) { failCameraStart(requestId, error.getMessage()); }
                }
                @Override public void onConfigureFailed(CameraCaptureSession failed) { failCameraStart(requestId, "Could not configure native camera preview."); }
            }, cameraHandler);
        } catch (Exception error) { failCameraStart(requestId, error.getMessage()); }
    }

    void startRecording(String requestId, String captureId) {
        postCamera(() -> startRecordingNow(requestId, captureId));
    }

    private void startRecordingNow(String requestId, String captureId) {
        if (camera == null || recording) { emit(error(requestId, recording ? "Recording is already active." : "Native camera is not ready.")); return; }
        try {
            recordingFile = new File(captureDirectory, safeName(captureId) + ".mp4");
            recorder = new MediaRecorder();
            if (captureAudio) recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setOutputFile(recordingFile.getAbsolutePath());
            recorder.setVideoEncodingBitRate(12_000_000);
            recorder.setVideoFrameRate(recordingFrameRate);
            recorder.setVideoSize(recordingSize.getWidth(), recordingSize.getHeight());
            recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
            if (captureAudio) {
                recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                recorder.setAudioEncodingBitRate(192_000);
                recorder.setAudioSamplingRate(48_000);
            }
            CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(activeCameraId);
            Integer orientation = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION);
            Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
            if (orientation != null) {
                int rotation = activity.getWindowManager().getDefaultDisplay().getRotation();
                int deviceDegrees = rotation == Surface.ROTATION_90 ? 90 : rotation == Surface.ROTATION_180 ? 180 : rotation == Surface.ROTATION_270 ? 270 : 0;
                int hint = facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT
                        ? (orientation + deviceDegrees) % 360
                        : (orientation - deviceDegrees + 360) % 360;
                recorder.setOrientationHint(hint);
            }
            recorder.prepare();
            Surface recordSurface = recorder.getSurface();
            closeSession();
            previewSurface = previewView.getHolder().getSurface();
            camera.createCaptureSession(Arrays.asList(previewSurface, recordSurface), new CameraCaptureSession.StateCallback() {
                @Override public void onConfigured(CameraCaptureSession configured) {
                    session = configured;
                    try {
                        synchronized (frameMetadata) { frameMetadata.clear(); droppedFrameMetadata = 0; }
                        CaptureRequest.Builder builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
                        builder.addTarget(previewSurface);
                        builder.addTarget(recordSurface);
                        configureAuto(builder);
                        session.setRepeatingRequest(builder.build(), captureCallback, cameraHandler);
                        recorder.start();
                        recording = true;
                        JSONObject detail = event("recording-started", requestId);
                        put(detail, "cameraId", activeCameraId);
                        put(detail, "width", recordingSize.getWidth());
                        put(detail, "height", recordingSize.getHeight());
                        put(detail, "frameRate", recordingFrameRate);
                        put(detail, "mimeType", "video/mp4");
                        put(detail, "audioEnabled", captureAudio);
                        emit(detail);
                    } catch (Exception error) {
                        recording = false;
                        releaseRecorder();
                        emit(error(requestId, error.getMessage()));
                        createPreviewSession("");
                    }
                }
                @Override public void onConfigureFailed(CameraCaptureSession failed) {
                    recording = false;
                    releaseRecorder();
                    emit(error(requestId, "Could not configure native video recording."));
                    createPreviewSession("");
                }
            }, cameraHandler);
        } catch (Exception error) {
            recording = false;
            releaseRecorder();
            emit(error(requestId, error.getMessage()));
            if (camera != null) createPreviewSession("");
        }
    }

    void stopRecording(String requestId) {
        postCamera(() -> stopRecordingNow(requestId));
    }

    private void stopRecordingNow(String requestId) {
        if (!recording) { emit(error(requestId, "Native recording is not active.")); return; }
        try { session.stopRepeating(); } catch (Exception ignored) {}
        try { recorder.stop(); }
        catch (Exception error) {
            if (recordingFile != null) recordingFile.delete();
            recording = false;
            releaseRecorder();
            emit(error(requestId, "Native recording could not be finalized: " + error.getMessage()));
            createPreviewSession("");
            return;
        }
        recording = false;
        releaseRecorder();
        if (recordingFile != null && recordingFile.isFile()) mediaFiles.put(recordingFile.getName(), recordingFile);
        JSONObject detail = event("recording-stopped", requestId);
        if (recordingFile != null) {
            put(detail, "url", "https://appassets.androidplatform.net/native-media/" + recordingFile.getName());
            put(detail, "bytes", recordingFile.length());
            put(detail, "mimeType", "video/mp4");
        }
        emit(detail);
        createPreviewSession("");
    }

    void captureStill(String requestId, String captureId) {
        activity.runOnUiThread(() -> {
            try {
                int width = Math.max(1, preview.getWidth());
                int height = Math.max(1, preview.getHeight());
                Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                PixelCopy.request(previewView, bitmap, result -> {
                    if (result != PixelCopy.SUCCESS) {
                        bitmap.recycle();
                        emit(error(requestId, "Could not copy the native preview frame (PixelCopy " + result + ")."));
                        return;
                    }
                    try {
                        File file = new File(captureDirectory, safeName(captureId) + ".jpg");
                        try (FileOutputStream output = new FileOutputStream(file)) { bitmap.compress(Bitmap.CompressFormat.JPEG, 94, output); }
                        mediaFiles.put(file.getName(), file);
                        JSONObject detail = event("still-captured", requestId);
                        put(detail, "url", "https://appassets.androidplatform.net/native-media/" + file.getName());
                        put(detail, "bytes", file.length());
                        put(detail, "mimeType", "image/jpeg");
                        emit(detail);
                    } catch (Exception error) { emit(error(requestId, error.getMessage())); }
                    finally { bitmap.recycle(); }
                }, new Handler(Looper.getMainLooper()));
            } catch (Exception error) { emit(error(requestId, error.getMessage())); }
        });
    }

    void stop(String requestId) {
        postCamera(() -> stopNow(requestId));
    }

    private void stopNow(String requestId) {
        if (recording) stopRecordingNow("");
        cameraRequested = false;
        startRequestId = "";
        pendingPermissionRequestId = "";
        closeCamera(true);
        emit(event("camera-stopped", requestId));
    }

    void onHostPause() {
        postCamera(this::onHostPauseNow);
    }

    private void onHostPauseNow() {
        if (!cameraRequested || (camera == null && !recording)) return;
        JSONObject detail = event("camera-suspended", "");
        put(detail, "cameraId", activeCameraId);
        put(detail, "recordingInterrupted", recording);
        if (recording) {
            try { if (session != null) session.stopRepeating(); } catch (Exception ignored) {}
            try {
                recorder.stop();
                if (recordingFile != null && recordingFile.isFile()) {
                    mediaFiles.put(recordingFile.getName(), recordingFile);
                    put(detail, "url", "https://appassets.androidplatform.net/native-media/" + recordingFile.getName());
                    put(detail, "bytes", recordingFile.length());
                    put(detail, "mimeType", "video/mp4");
                }
            } catch (Exception error) {
                if (recordingFile != null) recordingFile.delete();
                put(detail, "recordingError", error.getMessage());
            }
        }
        cameraRequested = false;
        startRequestId = "";
        closeCamera(true);
        emit(detail);
    }

    String stateJson() {
        JSONObject state = new JSONObject();
        put(state, "cameraRequested", cameraRequested);
        put(state, "cameraOpen", camera != null);
        put(state, "recording", recording);
        put(state, "audioEnabled", captureAudio);
        put(state, "cameraId", activeCameraId);
        return state.toString();
    }

    String drainFrameMetadata() {
        JSONObject root = new JSONObject();
        JSONArray frames = new JSONArray();
        synchronized (frameMetadata) {
            for (JSONArray frame : frameMetadata) frames.put(frame);
            frameMetadata.clear();
            put(root, "droppedFrames", droppedFrameMetadata);
            droppedFrameMetadata = 0;
        }
        put(root, "frames", frames);
        put(root, "layout", new JSONArray(Arrays.asList("sensorTimestampNs", "receivedElapsedRealtimeNs", "receivedEpochMs", "frameNumber", "exposureTimeNs", "iso", "frameDurationNs", "rollingShutterSkewNs", "focusDistanceDiopters", "focalLengthMm", "aperture", "aeState", "awbState", "afState", "cropLeft", "cropTop", "cropRight", "cropBottom", "redGain", "greenEvenGain", "greenOddGain", "blueGain")));
        return root.toString();
    }

    File mediaFile(String name) {
        if (name == null || name.contains("/") || name.contains("..")) return null;
        File file = mediaFiles.get(name);
        if (file == null) {
            File candidate = new File(captureDirectory, name);
            if (candidate.isFile()) {
                file = candidate;
                mediaFiles.put(name, candidate);
            }
        }
        return file != null && file.isFile() ? file : null;
    }

    String captureStorageJson() {
        long bytes = 0;
        int files = 0;
        File[] stored = captureDirectory.listFiles(File::isFile);
        if (stored != null) {
            files = stored.length;
            for (File file : stored) bytes += Math.max(0, file.length());
        }
        JSONObject state = new JSONObject();
        put(state, "directory", "internal-app-storage");
        put(state, "files", files);
        put(state, "bytes", bytes);
        put(state, "availableBytes", captureDirectory.getUsableSpace());
        return state.toString();
    }

    String clearStoredMedia() {
        int deleted = 0;
        long bytes = 0;
        File active = recording ? recordingFile : null;
        File[] stored = captureDirectory.listFiles(File::isFile);
        if (stored != null) for (File file : stored) {
            if (active != null && active.equals(file)) continue;
            long length = Math.max(0, file.length());
            if (file.delete()) {
                mediaFiles.remove(file.getName());
                deleted += 1;
                bytes += length;
            }
        }
        JSONObject result = new JSONObject();
        put(result, "deletedFiles", deleted);
        put(result, "deletedBytes", bytes);
        put(result, "recordingPreserved", active != null);
        return result.toString();
    }

    boolean deleteStoredMedia(String name) {
        File file = mediaFile(name);
        if (file == null || (recording && recordingFile != null && recordingFile.equals(file))) return false;
        boolean deleted = file.delete();
        if (deleted) mediaFiles.remove(file.getName());
        return deleted;
    }

    void setViewport(double left, double top, double width, double height) {
        activity.runOnUiThread(() -> {
            int viewWidth = Math.max(1, webView.getWidth());
            int viewHeight = Math.max(1, webView.getHeight());
            int pixelLeft = webView.getLeft() + (int) Math.round(left * viewWidth);
            int pixelTop = webView.getTop() + (int) Math.round(top * viewHeight);
            int pixelWidth = Math.max(1, (int) Math.round(width * viewWidth));
            int pixelHeight = Math.max(1, (int) Math.round(height * viewHeight));
            if (pixelLeft == viewportLeft && pixelTop == viewportTop && pixelWidth == viewportWidth && pixelHeight == viewportHeight) return;
            boolean resized = pixelWidth != viewportWidth || pixelHeight != viewportHeight;
            viewportLeft = pixelLeft;
            viewportTop = pixelTop;
            viewportWidth = pixelWidth;
            viewportHeight = pixelHeight;
            preview.showAt(pixelLeft, pixelTop, pixelWidth, pixelHeight, resized);
            if (resized) updatePreviewLayout();
        });
    }

    void setOverlay(String dataUrl) {
        preview.setGuide(dataUrl);
    }

    private final CameraCaptureSession.CaptureCallback captureCallback = new CameraCaptureSession.CaptureCallback() {
        @Override public void onCaptureCompleted(CameraCaptureSession session, CaptureRequest request, TotalCaptureResult result) {
            if (!pendingPreviewRequestId.isEmpty()) {
                String requestId = pendingPreviewRequestId;
                pendingPreviewRequestId = "";
                JSONObject detail = event("camera-started", requestId);
                put(detail, "cameraId", activeCameraId);
                put(detail, "width", previewSize.getWidth());
                put(detail, "height", previewSize.getHeight());
                put(detail, "frameRate", recordingFrameRate);
                put(detail, "audioEnabled", captureAudio);
                put(detail, "focalLengthMm", result.get(CaptureResult.LENS_FOCAL_LENGTH));
                emit(detail);
            }
            if (!recording) return;
            JSONArray frame = new JSONArray();
            add(frame, result.get(CaptureResult.SENSOR_TIMESTAMP));
            add(frame, SystemClock.elapsedRealtimeNanos());
            add(frame, System.currentTimeMillis());
            add(frame, result.getFrameNumber());
            add(frame, result.get(CaptureResult.SENSOR_EXPOSURE_TIME));
            add(frame, result.get(CaptureResult.SENSOR_SENSITIVITY));
            add(frame, result.get(CaptureResult.SENSOR_FRAME_DURATION));
            add(frame, result.get(CaptureResult.SENSOR_ROLLING_SHUTTER_SKEW));
            add(frame, result.get(CaptureResult.LENS_FOCUS_DISTANCE));
            add(frame, result.get(CaptureResult.LENS_FOCAL_LENGTH));
            add(frame, result.get(CaptureResult.LENS_APERTURE));
            add(frame, result.get(CaptureResult.CONTROL_AE_STATE));
            add(frame, result.get(CaptureResult.CONTROL_AWB_STATE));
            add(frame, result.get(CaptureResult.CONTROL_AF_STATE));
            Rect crop = result.get(CaptureResult.SCALER_CROP_REGION);
            add(frame, crop == null ? null : crop.left); add(frame, crop == null ? null : crop.top); add(frame, crop == null ? null : crop.right); add(frame, crop == null ? null : crop.bottom);
            RggbChannelVector gains = result.get(CaptureResult.COLOR_CORRECTION_GAINS);
            add(frame, gains == null ? null : gains.getRed()); add(frame, gains == null ? null : gains.getGreenEven()); add(frame, gains == null ? null : gains.getGreenOdd()); add(frame, gains == null ? null : gains.getBlue());
            synchronized (frameMetadata) { if (frameMetadata.size() < 10_000) frameMetadata.add(frame); else droppedFrameMetadata += 1; }
        }
    };

    private void configureAuto(CaptureRequest.Builder builder) {
        builder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO);
        builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
        builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_AUTO);
        try {
            CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(activeCameraId);
            int[] afModes = characteristics.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES);
            if (contains(afModes, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)) builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
            else if (contains(afModes, CaptureRequest.CONTROL_AF_MODE_AUTO)) builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO);
            else builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int[] rotateModes = characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_ROTATE_AND_CROP_MODES);
                if (contains(rotateModes, CaptureRequest.SCALER_ROTATE_AND_CROP_AUTO)) builder.set(CaptureRequest.SCALER_ROTATE_AND_CROP, CaptureRequest.SCALER_ROTATE_AND_CROP_AUTO);
            }
            Range<Integer>[] ranges = characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
            if (ranges != null) {
                Range<Integer> best = null;
                for (Range<Integer> range : ranges) {
                    if (range.getUpper() < 30 || range.getUpper() > recordingFrameRate) continue;
                    if (best == null || range.getUpper() > best.getUpper() || (range.getUpper().equals(best.getUpper()) && range.getLower() > best.getLower())) best = range;
                }
                if (best != null) builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, best);
            }
        } catch (Exception ignored) {}
    }

    private void failCameraStart(String requestId, String message) {
        cameraRequested = false;
        startRequestId = "";
        closeCamera(true);
        emit(error(requestId, message));
    }

    private boolean surfaceReady() {
        Surface surface = previewView.getHolder().getSurface();
        return surface != null && surface.isValid();
    }

    private void updatePreviewLayout() {
        preview.fitSurface(previewSize);
    }

    private void closeSession() { if (session != null) { try { session.close(); } catch (Exception ignored) {} session = null; } previewSurface = null; }
    private void closeCamera(boolean hide) {
        pendingPreviewRequestId = "";
        closeSession();
        if (camera != null) {
            camera.close();
            camera = null;
        }
        releaseRecorder();
        recording = false;
        if (hide) activity.runOnUiThread(preview::hideAndClear);
    }
    private void releaseRecorder() { if (recorder != null) { try { recorder.reset(); recorder.release(); } catch (Exception ignored) {} recorder = null; } }
    void destroy() {
        Handler handler = cameraHandler;
        HandlerThread thread = cameraThread;
        cameraHandler = null;
        cameraThread = null;
        if (handler != null) handler.post(() -> {
            if (cameraRequested || recording) onHostPauseNow();
            else closeCamera(true);
            if (thread != null) thread.quitSafely();
        });
    }
    private void startThread() { cameraThread = new HandlerThread("RobotStudioCamera2"); cameraThread.start(); cameraHandler = new Handler(cameraThread.getLooper()); }
    private void postCamera(Runnable action) {
        Handler handler = cameraHandler;
        if (handler != null) handler.post(action);
    }
    private void runOnUiThreadAndWait(Runnable action) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run();
            return;
        }
        CountDownLatch done = new CountDownLatch(1);
        activity.runOnUiThread(() -> {
            try { action.run(); }
            finally { done.countDown(); }
        });
        if (!done.await(2, TimeUnit.SECONDS)) throw new IllegalStateException("Camera preview layout timed out.");
    }
    private boolean hasCameraPermission() { return activity.checkSelfPermission(Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED; }
    private boolean hasMicrophonePermission() { return activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED; }
    private boolean hasPermissions(boolean audio) { if (activity.checkSelfPermission(Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false; return !audio || activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED; }
    private String[] requiredPermissions(boolean audio) { return audio ? new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO} : new String[]{Manifest.permission.CAMERA}; }
    private static boolean contains(int[] values, int expected) { if (values != null) for (int value : values) if (value == expected) return true; return false; }
    private static Size chooseSize(Size[] sizes, int preferredWidth, int preferredHeight) { if (sizes == null || sizes.length == 0) return new Size(1280, 720); return Arrays.stream(sizes).filter(size -> size.getWidth() <= preferredWidth && size.getHeight() <= preferredHeight).min(Comparator.comparingLong(size -> Math.abs((long) size.getWidth() * preferredHeight - (long) size.getHeight() * preferredWidth) + Math.abs((long) size.getWidth() * size.getHeight() - (long) preferredWidth * preferredHeight))).orElse(sizes[0]); }
    private static String safeName(String value) { return (value == null ? "capture" : value).replaceAll("[^A-Za-z0-9._-]", "_"); }
    private void emit(JSONObject detail) { String script = "window.__nativeCameraEvent&&window.__nativeCameraEvent(" + JSONObject.quote(detail.toString()) + ")"; activity.runOnUiThread(() -> webView.evaluateJavascript(script, null)); }
    private static JSONObject event(String type, String requestId) { JSONObject object = new JSONObject(); put(object, "type", type); put(object, "requestId", requestId); return object; }
    private static JSONObject error(String requestId, String message) { JSONObject object = event("error", requestId); put(object, "message", message == null ? "Native camera error" : message); return object; }
    private static void put(JSONObject object, String key, Object value) { try { object.put(key, value == null ? JSONObject.NULL : value); } catch (Exception ignored) {} }
    private static void add(JSONArray array, Object value) { try { array.put(value == null ? JSONObject.NULL : value); } catch (Exception ignored) { array.put(JSONObject.NULL); } }
}
