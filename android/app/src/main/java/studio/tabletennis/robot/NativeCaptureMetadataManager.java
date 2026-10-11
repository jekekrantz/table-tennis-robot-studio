package studio.tabletennis.robot;

import android.app.Activity;
import android.graphics.Rect;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.SystemClock;
import android.util.Range;
import android.util.Rational;
import android.util.Size;
import android.util.SizeF;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

final class NativeCaptureMetadataManager implements SensorEventListener {
    private static final int SENSOR_PERIOD_US = 10_000; // Requested 100 Hz; hardware may clamp this.
    private static final int MAX_BUFFERED_SAMPLES = 20_000;
    private static final int[] SENSOR_TYPES = {
            Sensor.TYPE_ACCELEROMETER,
            Sensor.TYPE_GYROSCOPE,
            Sensor.TYPE_GYROSCOPE_UNCALIBRATED,
            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_GRAVITY,
            Sensor.TYPE_ROTATION_VECTOR,
            Sensor.TYPE_GAME_ROTATION_VECTOR,
            Sensor.TYPE_MAGNETIC_FIELD
    };

    private final Activity activity;
    private final SensorManager sensors;
    private final List<JSONArray> samples = new ArrayList<>();
    private boolean recording;
    private long droppedSamples;
    private String sessionId = "";
    private long startElapsedRealtimeNs;
    private long startEpochMs;

    NativeCaptureMetadataManager(Activity activity) {
        this.activity = activity;
        this.sensors = activity.getSystemService(SensorManager.class);
    }

    String cameraMetadataJson() {
        JSONObject root = new JSONObject();
        put(root, "schema", "table-tennis-robot-studio/android-camera-metadata/v1");
        put(root, "capturedAtEpochMs", System.currentTimeMillis());
        put(root, "elapsedRealtimeNs", SystemClock.elapsedRealtimeNanos());
        put(root, "dynamicCaptureMetadataAvailable", true);
        put(root, "dynamicCaptureMetadataNote", "The Android app owns preview and recording through Camera2 and records per-frame capture results alongside the encoded MP4.");
        JSONArray cameras = new JSONArray();
        try {
            CameraManager manager = activity.getSystemService(CameraManager.class);
            if (manager != null) {
                for (String cameraId : manager.getCameraIdList()) {
                    try {
                        cameras.put(cameraObject(cameraId, manager.getCameraCharacteristics(cameraId)));
                    } catch (Exception cameraError) {
                        JSONObject unavailable = new JSONObject();
                        put(unavailable, "cameraId", cameraId);
                        put(unavailable, "error", cameraError.getMessage());
                        cameras.put(unavailable);
                    }
                }
            }
        } catch (Exception error) {
            put(root, "error", error.getMessage());
        }
        put(root, "cameras", cameras);
        return root.toString();
    }

    private JSONObject cameraObject(String cameraId, CameraCharacteristics c) {
        JSONObject camera = new JSONObject();
        put(camera, "cameraId", cameraId);
        put(camera, "lensFacing", lensFacing(c.get(CameraCharacteristics.LENS_FACING)));
        put(camera, "sensorOrientationDeg", c.get(CameraCharacteristics.SENSOR_ORIENTATION));
        put(camera, "hardwareLevel", hardwareLevel(c.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)));
        put(camera, "timestampSource", timestampSource(c.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)));
        put(camera, "physicalSizeMm", sizeF(c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)));
        put(camera, "pixelArraySize", size(c.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)));
        put(camera, "activeArray", rect(c.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)));
        put(camera, "preCorrectionActiveArray", rect(c.get(CameraCharacteristics.SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE)));
        put(camera, "exposureTimeRangeNs", range(c.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)));
        put(camera, "sensitivityIsoRange", range(c.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)));
        put(camera, "maxFrameDurationNs", c.get(CameraCharacteristics.SENSOR_INFO_MAX_FRAME_DURATION));
        put(camera, "whiteLevel", c.get(CameraCharacteristics.SENSOR_INFO_WHITE_LEVEL));
        put(camera, "colorFilterArrangement", c.get(CameraCharacteristics.SENSOR_INFO_COLOR_FILTER_ARRANGEMENT));
        put(camera, "focalLengthsMm", floats(c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)));
        put(camera, "apertures", floats(c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)));
        put(camera, "filterDensities", floats(c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FILTER_DENSITIES)));
        put(camera, "intrinsicCalibration", floats(c.get(CameraCharacteristics.LENS_INTRINSIC_CALIBRATION)));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) put(camera, "distortion", floats(c.get(CameraCharacteristics.LENS_DISTORTION)));
        put(camera, "poseRotationQuaternion", floats(c.get(CameraCharacteristics.LENS_POSE_ROTATION)));
        put(camera, "poseTranslationM", floats(c.get(CameraCharacteristics.LENS_POSE_TRANSLATION)));
        put(camera, "focusDistanceCalibration", c.get(CameraCharacteristics.LENS_INFO_FOCUS_DISTANCE_CALIBRATION));
        put(camera, "minimumFocusDistanceDiopters", c.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE));
        put(camera, "hyperfocalDistanceDiopters", c.get(CameraCharacteristics.LENS_INFO_HYPERFOCAL_DISTANCE));
        put(camera, "opticalStabilizationModes", ints(c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION)));
        put(camera, "videoStabilizationModes", ints(c.get(CameraCharacteristics.CONTROL_AVAILABLE_VIDEO_STABILIZATION_MODES)));
        put(camera, "aeModes", ints(c.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES)));
        put(camera, "awbModes", ints(c.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_MODES)));
        put(camera, "afModes", ints(c.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES)));
        put(camera, "aeCompensationRange", range(c.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE)));
        Rational step = c.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP);
        put(camera, "aeCompensationStepEv", step == null ? null : step.doubleValue());
        put(camera, "targetFpsRanges", ranges(c.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)));
        put(camera, "maxRegions", objectArray(
                c.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AE),
                c.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AWB),
                c.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AF)));
        put(camera, "flashAvailable", c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE));
        put(camera, "capabilities", ints(c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)));
        StreamConfigurationMap map = c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        if (map != null) {
            put(camera, "videoSizes", sizes(map.getOutputSizes(MediaRecorder.class)));
            put(camera, "jpegSizes", sizes(map.getOutputSizes(android.graphics.ImageFormat.JPEG)));
            try { put(camera, "highSpeedVideoSizes", sizes(map.getHighSpeedVideoSizes())); }
            catch (Exception error) { put(camera, "highSpeedVideoSizesError", error.getMessage()); }
        }
        JSONArray requestKeys = new JSONArray();
        for (CaptureRequest.Key<?> key : c.getAvailableCaptureRequestKeys()) requestKeys.put(key.getName());
        JSONArray resultKeys = new JSONArray();
        for (CaptureResult.Key<?> key : c.getAvailableCaptureResultKeys()) resultKeys.put(key.getName());
        put(camera, "availableCaptureRequestKeys", requestKeys);
        put(camera, "availableCaptureResultKeys", resultKeys);
        return camera;
    }

    String sensorCatalogJson() {
        JSONObject root = timeAnchors();
        put(root, "schema", "table-tennis-robot-studio/android-sensor-catalog/v1");
        put(root, "requestedPeriodUs", SENSOR_PERIOD_US);
        JSONArray catalog = new JSONArray();
        if (sensors != null) {
            for (int type : SENSOR_TYPES) {
                Sensor sensor = sensors.getDefaultSensor(type);
                if (sensor != null) catalog.put(sensorObject(sensor));
            }
        }
        put(root, "sensors", catalog);
        return root.toString();
    }

    String startMotionCapture(String id) {
        synchronized (samples) {
            samples.clear();
            droppedSamples = 0;
            sessionId = id == null ? "" : id;
            startElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos();
            startEpochMs = System.currentTimeMillis();
            recording = true;
        }
        activity.runOnUiThread(() -> {
            if (sensors == null) return;
            sensors.unregisterListener(this);
            for (int type : SENSOR_TYPES) {
                Sensor sensor = sensors.getDefaultSensor(type);
                if (sensor != null) sensors.registerListener(this, sensor, SENSOR_PERIOD_US);
            }
        });
        JSONObject result = timeAnchors();
        put(result, "sessionId", sessionId);
        put(result, "requestedPeriodUs", SENSOR_PERIOD_US);
        return result.toString();
    }

    String drainMotionSamples() {
        return drain(false);
    }

    String stopMotionCapture() {
        synchronized (samples) { recording = false; }
        activity.runOnUiThread(() -> { if (sensors != null) sensors.unregisterListener(this); });
        return drain(true);
    }

    void destroy() {
        synchronized (samples) { recording = false; samples.clear(); }
        if (sensors != null) sensors.unregisterListener(this);
    }

    @Override public void onSensorChanged(SensorEvent event) {
        long receivedElapsedNs = SystemClock.elapsedRealtimeNanos();
        long epochMs = System.currentTimeMillis();
        JSONArray sample = new JSONArray();
        sample.put(event.sensor.getType());
        sample.put(event.timestamp);
        sample.put(receivedElapsedNs);
        sample.put(epochMs);
        sample.put(event.accuracy);
        for (float value : event.values) put(sample, value);
        synchronized (samples) {
            if (!recording) return;
            if (samples.size() >= MAX_BUFFERED_SAMPLES) { droppedSamples += 1; return; }
            samples.add(sample);
        }
    }

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private String drain(boolean stopped) {
        JSONObject result = timeAnchors();
        JSONArray batch = new JSONArray();
        synchronized (samples) {
            for (JSONArray sample : samples) batch.put(sample);
            samples.clear();
            put(result, "droppedSamples", droppedSamples);
            droppedSamples = 0;
            put(result, "sessionId", sessionId);
        }
        put(result, "stopped", stopped);
        put(result, "samples", batch);
        return result.toString();
    }

    private JSONObject sensorObject(Sensor sensor) {
        JSONObject object = new JSONObject();
        put(object, "type", sensor.getType());
        put(object, "stringType", sensor.getStringType());
        put(object, "name", sensor.getName());
        put(object, "vendor", sensor.getVendor());
        put(object, "version", sensor.getVersion());
        put(object, "resolution", sensor.getResolution());
        put(object, "maximumRange", sensor.getMaximumRange());
        put(object, "powerMa", sensor.getPower());
        put(object, "minimumDelayUs", sensor.getMinDelay());
        put(object, "maximumDelayUs", sensor.getMaxDelay());
        put(object, "reportingMode", sensor.getReportingMode());
        put(object, "wakeUp", sensor.isWakeUpSensor());
        return object;
    }

    private JSONObject timeAnchors() {
        JSONObject object = new JSONObject();
        put(object, "epochMs", System.currentTimeMillis());
        put(object, "elapsedRealtimeNs", SystemClock.elapsedRealtimeNanos());
        put(object, "uptimeMs", SystemClock.uptimeMillis());
        put(object, "startEpochMs", startEpochMs);
        put(object, "startElapsedRealtimeNs", startElapsedRealtimeNs);
        return object;
    }

    private static String lensFacing(Integer value) { if (value == null) return "unknown"; if (value == CameraCharacteristics.LENS_FACING_BACK) return "back"; if (value == CameraCharacteristics.LENS_FACING_FRONT) return "front"; if (value == CameraCharacteristics.LENS_FACING_EXTERNAL) return "external"; return String.valueOf(value); }
    private static String hardwareLevel(Integer value) { if (value == null) return "unknown"; if (value == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY) return "legacy"; if (value == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED) return "limited"; if (value == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL) return "full"; if (value == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3) return "level-3"; if (value == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL) return "external"; return String.valueOf(value); }
    private static String timestampSource(Integer value) { if (value == null) return "unknown"; return value == CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME ? "realtime" : value == CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN ? "unknown" : String.valueOf(value); }
    private static JSONArray floats(float[] values) { JSONArray array = new JSONArray(); if (values != null) for (float value : values) put(array, value); return array; }
    private static JSONArray ints(int[] values) { JSONArray array = new JSONArray(); if (values != null) for (int value : values) array.put(value); return array; }
    private static JSONArray sizes(Size[] values) { JSONArray array = new JSONArray(); if (values != null) for (Size value : values) array.put(size(value)); return array; }
    private static JSONArray ranges(Range<Integer>[] values) { JSONArray array = new JSONArray(); if (values != null) for (Range<Integer> value : values) array.put(range(value)); return array; }
    private static JSONArray objectArray(Object... values) { JSONArray array = new JSONArray(); for (Object value : values) array.put(value == null ? JSONObject.NULL : value); return array; }
    private static JSONObject size(Size value) { if (value == null) return null; JSONObject object = new JSONObject(); put(object, "width", value.getWidth()); put(object, "height", value.getHeight()); return object; }
    private static JSONObject sizeF(SizeF value) { if (value == null) return null; JSONObject object = new JSONObject(); put(object, "width", value.getWidth()); put(object, "height", value.getHeight()); return object; }
    private static JSONObject rect(Rect value) { if (value == null) return null; JSONObject object = new JSONObject(); put(object, "left", value.left); put(object, "top", value.top); put(object, "right", value.right); put(object, "bottom", value.bottom); put(object, "width", value.width()); put(object, "height", value.height()); return object; }
    private static JSONObject range(Range<?> value) { if (value == null) return null; JSONObject object = new JSONObject(); put(object, "lower", value.getLower()); put(object, "upper", value.getUpper()); return object; }
    private static void put(JSONObject object, String key, Object value) { try { object.put(key, value == null ? JSONObject.NULL : value); } catch (Exception ignored) {} }
    private static void put(JSONArray array, Object value) { try { array.put(value == null ? JSONObject.NULL : value); } catch (Exception ignored) { array.put(JSONObject.NULL); } }
}
