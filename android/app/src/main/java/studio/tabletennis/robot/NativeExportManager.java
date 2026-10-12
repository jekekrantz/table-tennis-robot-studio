package studio.tabletennis.robot;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Routes generated developer artifacts through Android's system document saver. */
final class NativeExportManager {
    static final int CREATE_DOCUMENT_REQUEST = 1004;

    private final Activity activity;
    private final NativeCameraManager camera;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private PendingExport pending;

    NativeExportManager(Activity activity, NativeCameraManager camera) {
        this.activity = activity;
        this.camera = camera;
    }

    void exportText(String filename, String mimeType, String content) {
        executor.execute(() -> {
            try {
                File file = temporaryFile(filename);
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
                }
                requestDestination(file, filename, mimeType, true);
            } catch (Exception error) {
                showError("Could not prepare the file", error);
            }
        });
    }

    void exportMedia(String sourceName, String filename, String mimeType) {
        File file = camera.mediaFile(sourceName);
        if (file == null || file.length() <= 0) {
            showError("Recording is no longer available", null);
            return;
        }
        requestDestination(file, filename, mimeType, false);
    }

    void exportDataset(String filename, String manifestJson, String mediaJson) {
        mainHandler.post(() -> Toast.makeText(activity, "Preparing dataset ZIP…", Toast.LENGTH_SHORT).show());
        executor.execute(() -> {
            File zip = null;
            try {
                zip = temporaryFile(filename);
                JSONArray media = new JSONArray(mediaJson == null ? "[]" : mediaJson);
                Set<String> archiveNames = new HashSet<>();
                try (ZipOutputStream output = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(zip)))) {
                    // Camera MP4/JPEG files are already compressed. Deflating them again
                    // delays the Save dialog without materially shrinking the dataset.
                    output.setLevel(Deflater.NO_COMPRESSION);
                    addBytes(output, archiveNames, "manifest.json", (manifestJson == null ? "{}" : manifestJson).getBytes(StandardCharsets.UTF_8));
                    for (int index = 0; index < media.length(); index += 1) {
                        JSONObject entry = media.optJSONObject(index);
                        if (entry == null) continue;
                        File source = camera.mediaFile(entry.optString("sourceName"));
                        if (source == null || source.length() <= 0) {
                            throw new IllegalStateException("A requested capture file is missing: " + entry.optString("archiveName"));
                        }
                        addFile(output, archiveNames, safeArchiveName(entry.optString("archiveName")), source);
                    }
                }
                requestDestination(zip, filename, "application/zip", true);
            } catch (Exception error) {
                if (zip != null) zip.delete();
                showError("Could not prepare the dataset ZIP", error);
            }
        });
    }

    void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != CREATE_DOCUMENT_REQUEST) return;
        PendingExport export = pending;
        pending = null;
        if (export == null) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            if (export.deleteAfter) export.file.delete();
            return;
        }
        Uri destination = data.getData();
        executor.execute(() -> {
            try (InputStream input = new BufferedInputStream(new FileInputStream(export.file));
                 OutputStream output = new BufferedOutputStream(activity.getContentResolver().openOutputStream(destination, "w"))) {
                if (output == null) throw new IllegalStateException("The selected destination is unavailable.");
                copy(input, output);
                mainHandler.post(() -> Toast.makeText(activity, "Saved " + export.filename, Toast.LENGTH_LONG).show());
            } catch (Exception error) {
                showError("Could not save " + export.filename, error);
            } finally {
                if (export.deleteAfter) export.file.delete();
            }
        });
    }

    void destroy() {
        PendingExport export = pending;
        pending = null;
        if (export != null && export.deleteAfter) export.file.delete();
        executor.shutdownNow();
    }

    private void requestDestination(File file, String filename, String mimeType, boolean deleteAfter) {
        mainHandler.post(() -> {
            if (pending != null) {
                if (deleteAfter) file.delete();
                Toast.makeText(activity, "Finish the current save first.", Toast.LENGTH_LONG).show();
                return;
            }
            String safeFilename = safeFilename(filename);
            pending = new PendingExport(file, safeFilename, deleteAfter);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType)
                    .putExtra(Intent.EXTRA_TITLE, safeFilename);
            try {
                activity.startActivityForResult(intent, CREATE_DOCUMENT_REQUEST);
            } catch (Exception error) {
                pending = null;
                if (deleteAfter) file.delete();
                showError("Android could not open the Save dialog", error);
            }
        });
    }

    private File temporaryFile(String filename) {
        return new File(activity.getCacheDir(), "export-" + System.nanoTime() + "-" + safeFilename(filename));
    }

    private static String safeFilename(String value) {
        String safe = value == null ? "robot-studio-data" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return safe.isEmpty() ? "robot-studio-data" : safe;
    }

    private static String safeArchiveName(String value) {
        return safeFilename(value).replace("..", "_");
    }

    private static void addBytes(ZipOutputStream output, Set<String> names, String name, byte[] bytes) throws Exception {
        if (!names.add(name)) return;
        output.putNextEntry(new ZipEntry(name));
        output.write(bytes);
        output.closeEntry();
    }

    private static void addFile(ZipOutputStream output, Set<String> names, String name, File file) throws Exception {
        if (!names.add(name)) return;
        output.putNextEntry(new ZipEntry(name));
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            copy(input, output);
        }
        output.closeEntry();
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
    }

    private void showError(String prefix, Exception error) {
        String suffix = error == null || error.getMessage() == null ? "" : ": " + error.getMessage();
        mainHandler.post(() -> Toast.makeText(activity, prefix + suffix, Toast.LENGTH_LONG).show());
    }

    private static final class PendingExport {
        final File file;
        final String filename;
        final boolean deleteAfter;

        PendingExport(File file, String filename, boolean deleteAfter) {
            this.file = file;
            this.filename = filename;
            this.deleteAfter = deleteAfter;
        }
    }
}
