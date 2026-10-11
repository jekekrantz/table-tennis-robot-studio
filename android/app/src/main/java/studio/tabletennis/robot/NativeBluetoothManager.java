package studio.tabletennis.robot;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

final class NativeBluetoothManager {
    static final int PERMISSION_REQUEST = 1002;
    private static final UUID ADVERTISEMENT_UUID = UUID.fromString("0000feff-0000-1000-8000-00805f9b34fb");
    private static final UUID SERVICE_UUID = UUID.fromString("02f00000-0000-0000-0000-00000000fe00");
    private static final UUID WRITE_UUID = UUID.fromString("02f00000-0000-0000-0000-00000000ff01");
    private static final UUID NOTIFY_UUID = UUID.fromString("02f00000-0000-0000-0000-00000000ff02");
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothDevice> scanResults = new LinkedHashMap<>();
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writeCharacteristic;
    private BluetoothGattCharacteristic notifyCharacteristic;
    private String pendingWriteRequestId;
    private boolean disconnectRequested;
    private Runnable pendingPermissionAction;

    NativeBluetoothManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    boolean isSupported() {
        BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
        return manager != null && manager.getAdapter() != null && activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
    }

    void connect() {
        activity.runOnUiThread(() -> {
            if (!isSupported()) {
                emit(error("connect", "Bluetooth Low Energy is unavailable on this device."));
                return;
            }
            if (!hasPermissions()) {
                pendingPermissionAction = this::startScan;
                activity.requestPermissions(requiredPermissions(), PERMISSION_REQUEST);
                return;
            }
            startScan();
        });
    }

    void onPermissionResult(int[] grantResults) {
        Runnable continuation = pendingPermissionAction;
        pendingPermissionAction = null;
        if (grantResults.length == 0) {
            emit(error("connect", "Nearby devices permission was not granted."));
            return;
        }
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                emit(error("connect", "Nearby devices permission is required to connect to Nova."));
                return;
            }
        }
        if (continuation != null) activity.runOnUiThread(continuation);
    }

    @SuppressWarnings("MissingPermission")
    private void startScan() {
        BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            emit(error("connect", "Turn on Bluetooth, then press Connect Nova again."));
            return;
        }
        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            emit(error("connect", "Android could not start Bluetooth scanning."));
            return;
        }
        disconnectRequested = false;
        scanResults.clear();
        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(ADVERTISEMENT_UUID)).build());
        ScanSettings settings = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        emit(event("scan-start"));
        scanner.startScan(filters, settings, scanCallback);
        main.postDelayed(this::finishScan, 3000);
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (device != null) scanResults.put(device.getAddress(), device);
        }

        @Override public void onScanFailed(int errorCode) {
            emit(error("connect", "Bluetooth scan failed (Android code " + errorCode + ")."));
        }
    };

    @SuppressWarnings("MissingPermission")
    private void finishScan() {
        if (scanner != null) {
            try { scanner.stopScan(scanCallback); } catch (Exception ignored) {}
            scanner = null;
        }
        if (scanResults.isEmpty()) {
            emit(error("connect", "No Pongbot Nova was found. Make sure it is powered on and nearby."));
            return;
        }
        List<BluetoothDevice> devices = new ArrayList<>(scanResults.values());
        if (devices.size() == 1) {
            connectDevice(devices.get(0));
            return;
        }
        String[] labels = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) {
            String name;
            try { name = devices.get(i).getName(); } catch (SecurityException ignored) { name = null; }
            labels[i] = (name == null || name.isEmpty() ? "Pongbot Nova" : name) + "\n" + devices.get(i).getAddress();
        }
        new AlertDialog.Builder(activity)
                .setTitle("Choose Nova")
                .setItems(labels, (dialog, which) -> connectDevice(devices.get(which)))
                .setNegativeButton("Cancel", (dialog, which) -> emit(error("connect", "Device selection was cancelled.")))
                .setOnCancelListener(dialog -> emit(error("connect", "Device selection was cancelled.")))
                .show();
    }

    @SuppressWarnings("MissingPermission")
    private void connectDevice(BluetoothDevice device) {
        closeGatt();
        emit(event("connecting"));
        gatt = device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt activeGatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                if (!hasPermissions()) return;
                activeGatt.discoverServices();
                return;
            }
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                JSONObject detail = event("disconnected");
                put(detail, "expected", disconnectRequested);
                emit(detail);
                closeGatt();
            } else if (status != BluetoothGatt.GATT_SUCCESS) {
                emit(error("connect", "Bluetooth connection failed (Android status " + status + ")."));
                closeGatt();
            }
        }

        @Override public void onServicesDiscovered(BluetoothGatt activeGatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emit(error("connect", "Nova services could not be discovered (Android status " + status + ")."));
                closeGatt();
                return;
            }
            BluetoothGattService service = activeGatt.getService(SERVICE_UUID);
            writeCharacteristic = service == null ? null : service.getCharacteristic(WRITE_UUID);
            notifyCharacteristic = service == null ? null : service.getCharacteristic(NOTIFY_UUID);
            if (writeCharacteristic == null || notifyCharacteristic == null) {
                emit(error("connect", "The selected device does not expose the Nova BLE service."));
                closeGatt();
                return;
            }
            if (!hasPermissions() || !activeGatt.setCharacteristicNotification(notifyCharacteristic, true)) {
                emit(error("connect", "Nova notifications could not be enabled."));
                closeGatt();
                return;
            }
            BluetoothGattDescriptor descriptor = notifyCharacteristic.getDescriptor(CCCD_UUID);
            if (descriptor == null) {
                emit(error("connect", "Nova notification descriptor is missing."));
                closeGatt();
                return;
            }
            if (Build.VERSION.SDK_INT >= 33) {
                activeGatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            } else {
                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                activeGatt.writeDescriptor(descriptor);
            }
        }

        @Override public void onDescriptorWrite(BluetoothGatt activeGatt, BluetoothGattDescriptor descriptor, int status) {
            if (!CCCD_UUID.equals(descriptor.getUuid())) return;
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emit(error("connect", "Nova notifications were rejected (Android status " + status + ")."));
                closeGatt();
                return;
            }
            JSONObject detail = event("connected");
            try {
                put(detail, "name", activeGatt.getDevice().getName());
                put(detail, "id", activeGatt.getDevice().getAddress());
            } catch (SecurityException ignored) {}
            emit(detail);
        }

        @Override public void onCharacteristicChanged(BluetoothGatt activeGatt, BluetoothGattCharacteristic characteristic, byte[] value) {
            emitNotification(value);
        }

        @SuppressWarnings("deprecation")
        @Override public void onCharacteristicChanged(BluetoothGatt activeGatt, BluetoothGattCharacteristic characteristic) {
            emitNotification(characteristic.getValue());
        }

        @Override public void onCharacteristicWrite(BluetoothGatt activeGatt, BluetoothGattCharacteristic characteristic, int status) {
            String requestId = pendingWriteRequestId;
            pendingWriteRequestId = null;
            JSONObject detail = event(status == BluetoothGatt.GATT_SUCCESS ? "write-complete" : "write-error");
            put(detail, "requestId", requestId);
            if (status != BluetoothGatt.GATT_SUCCESS) put(detail, "message", "Native BLE write failed (Android status " + status + ").");
            emit(detail);
        }
    };

    void write(String requestId, String hex) {
        activity.runOnUiThread(() -> writeOnMain(requestId, hex));
    }

    @SuppressWarnings({"MissingPermission", "deprecation"})
    private void writeOnMain(String requestId, String hex) {
        if (gatt == null || writeCharacteristic == null) {
            emit(writeError(requestId, "Nova is not connected."));
            return;
        }
        byte[] value;
        try { value = decodeHex(hex); }
        catch (Exception error) { emit(writeError(requestId, "Invalid BLE command.")); return; }
        pendingWriteRequestId = requestId;
        int properties = writeCharacteristic.getProperties();
        int writeType = (properties & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
                ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
        int result;
        if (Build.VERSION.SDK_INT >= 33) {
            result = gatt.writeCharacteristic(writeCharacteristic, value, writeType);
        } else {
            writeCharacteristic.setWriteType(writeType);
            writeCharacteristic.setValue(value);
            result = gatt.writeCharacteristic(writeCharacteristic) ? 0 : -1;
        }
        if (result != 0) {
            pendingWriteRequestId = null;
            emit(writeError(requestId, "Android rejected the BLE write (code " + result + ")."));
        }
    }

    void disconnect() {
        activity.runOnUiThread(() -> {
            disconnectRequested = true;
            if (scanner != null && hasPermissions()) {
                try { scanner.stopScan(scanCallback); } catch (Exception ignored) {}
                scanner = null;
            }
            if (gatt != null && hasPermissions()) gatt.disconnect();
            else closeGatt();
        });
    }

    void destroy() {
        main.removeCallbacksAndMessages(null);
        disconnectRequested = true;
        closeGatt();
    }

    private void emitNotification(byte[] value) {
        JSONObject detail = event("notification");
        put(detail, "hex", encodeHex(value));
        emit(detail);
    }

    private void emit(JSONObject detail) {
        String script = "window.__nativeBluetoothEvent&&window.__nativeBluetoothEvent(" + JSONObject.quote(detail.toString()) + ")";
        main.post(() -> webView.evaluateJavascript(script, null));
    }

    private boolean hasPermissions() {
        for (String permission : requiredPermissions()) {
            if (activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) return false;
        }
        return true;
    }

    private String[] requiredPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return new String[]{ Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT };
        }
        return new String[]{ Manifest.permission.ACCESS_FINE_LOCATION };
    }

    @SuppressWarnings("MissingPermission")
    private void closeGatt() {
        if (gatt != null) {
            try { gatt.close(); } catch (Exception ignored) {}
        }
        gatt = null;
        writeCharacteristic = null;
        notifyCharacteristic = null;
        pendingWriteRequestId = null;
    }

    private static JSONObject event(String type) { JSONObject object = new JSONObject(); put(object, "type", type); return object; }
    private static JSONObject error(String operation, String message) { JSONObject object = event("error"); put(object, "operation", operation); put(object, "message", message); return object; }
    private static JSONObject writeError(String requestId, String message) { JSONObject object = event("write-error"); put(object, "requestId", requestId); put(object, "message", message); return object; }
    private static void put(JSONObject object, String key, Object value) { try { object.put(key, value == null ? JSONObject.NULL : value); } catch (Exception ignored) {} }
    private static String encodeHex(byte[] bytes) { StringBuilder result = new StringBuilder(); if (bytes != null) for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value & 0xff)); return result.toString(); }
    private static byte[] decodeHex(String value) { if (value == null || (value.length() & 1) != 0) throw new IllegalArgumentException(); byte[] bytes = new byte[value.length() / 2]; for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16); return bytes; }
}
