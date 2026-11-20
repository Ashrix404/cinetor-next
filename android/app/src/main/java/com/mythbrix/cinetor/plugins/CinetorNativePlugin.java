package com.mythbrix.cinetor.plugins;

import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** One plugin for every native feature (docs/07-native-plugin.md). */
@CapacitorPlugin(name = "CinetorNative")
public class CinetorNativePlugin extends Plugin {

    private Downloads downloads;

    @Override
    public void load() {
        downloads = Downloads.get(getContext());
        downloads.setListener(p -> notifyListeners("downloadProgress", p));
        new Thread(() -> Net.get(getContext()).apply()).start(); // saved network mode on start
    }

    // ---- network modes (WARP / AntiDPI / DNS over HTTPS) -----------------------------------
    private JSObject netState() {
        Net n = Net.get(getContext());
        JSObject r = new JSObject();
        r.put("warp", n.warp());
        r.put("antiDpi", n.dpi());
        r.put("antiDpiArgs", n.dpiArgs());
        r.put("doh", n.doh());
        r.put("dohUrl", n.dohCustom());
        r.put("warpRunning", n.warpRunning());
        r.put("antiDpiRunning", n.dpiRunning());
        r.put("error", n.error());
        return r;
    }

    @PluginMethod
    public void netGet(PluginCall call) {
        call.resolve(netState());
    }

    @PluginMethod
    public void netSet(PluginCall call) {
        Net n = Net.get(getContext());
        n.save(call.getBoolean("warp"), call.getBoolean("antiDpi"), call.getString("antiDpiArgs"), call.getString("doh"), call.getString("dohUrl"));
        new Thread(() -> {
            n.apply();
            call.resolve(netState());
        }).start();
    }

    // ---- brightness / volume -------------------------------------------------------------
    @PluginMethod
    public void setBrightness(PluginCall call) {
        final boolean reset = !call.getData().has("value") || call.getData().isNull("value");
        final float v = reset ? 0f : call.getFloat("value", 0.5f);
        getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams lp = getActivity().getWindow().getAttributes();
            lp.screenBrightness = reset ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.01f, Math.min(1f, v));
            getActivity().getWindow().setAttributes(lp);
            call.resolve();
        });
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        float b = getActivity().getWindow().getAttributes().screenBrightness;
        if (b < 0) {
            try {
                b = Settings.System.getInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f;
            } catch (Settings.SettingNotFoundException e) {
                b = 0.5f;
            }
        }
        JSObject r = new JSObject();
        r.put("value", b);
        call.resolve(r);
    }

    private AudioManager audio() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float v = call.getFloat("value", 0.5f);
        AudioManager am = audio();
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(Math.max(0f, Math.min(1f, v)) * max), 0);
        call.resolve();
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        AudioManager am = audio();
        JSObject r = new JSObject();
        r.put("value", am.getStreamVolume(AudioManager.STREAM_MUSIC) / (float) Math.max(1, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)));
        call.resolve(r);
    }

    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /** Only needed if the WebView pauses media in the background (T33); kept as a no-op until proven. */
    @PluginMethod
    public void keepAliveForPlayback(PluginCall call) {
        call.resolve();
    }

    // ---- external app / device info ----------------------------------------------------
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url missing");
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(Uri.parse(url), call.getString("mime", "video/*"));
        String title = call.getString("title");
        if (title != null) i.putExtra("title", title);
        Intent chooser = Intent.createChooser(i, "Open with");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("No app can open this link");
        }
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject r = new JSObject();
        UiModeManager um = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        r.put("isTv", um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION);
        JSArray abis = new JSArray();
        for (String a : Build.SUPPORTED_ABIS) abis.put(a);
        r.put("abis", abis);
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("versionCode", PackageInfoCompat.getLongVersionCode(pi));
            r.put("versionName", pi.versionName);
        } catch (PackageManager.NameNotFoundException e) {
            r.put("versionCode", 0);
            r.put("versionName", "");
        }
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    // ---- folder picker (SAF) -----------------------------------------------------------
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            JSObject r = new JSObject();
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        Uri uri = data.getData();
        getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        DocumentFile d = DocumentFile.fromTreeUri(getContext(), uri);
        JSObject r = new JSObject();
        r.put("uri", uri.toString());
        r.put("label", d != null && d.getName() != null ? d.getName() : uri.getLastPathSegment());
        call.resolve(r);
    }

    // ---- downloads ---------------------------------------------------------------------
    @PluginMethod
    public void dlStart(PluginCall call) {
        String id = call.getString("id"), url = call.getString("url"), rel = call.getString("relPath");
        if (id == null || url == null || rel == null) {
            call.reject("id, url and relPath are required");
            return;
        }
        Notify.askPermission(getActivity());
        downloads.start(id, url, rel, call.getInt("connections", 16), call.getString("treeUri"));
        call.resolve();
    }

    @PluginMethod
    public void dlPause(PluginCall call) {
        downloads.pause(call.getString("id"));
        call.resolve();
    }

    @PluginMethod
    public void dlResume(PluginCall call) {
        downloads.resume(call.getString("id"));
        call.resolve();
    }

    @PluginMethod
    public void dlCancel(PluginCall call) {
        downloads.cancel(call.getString("id"));
        call.resolve();
    }

    @PluginMethod
    public void dlList(PluginCall call) {
        JSObject r = new JSObject();
        r.put("items", downloads.list());
        call.resolve(r);
    }

    @PluginMethod
    public void saveBytes(PluginCall call) {
        try {
            byte[] bytes = android.util.Base64.decode(call.getString("base64", ""), android.util.Base64.DEFAULT);
            File tmp = new File(getContext().getCacheDir(), "save-" + System.nanoTime());
            IO.write(tmp, bytes);
            String[] pub = FileSink.publish(getContext(), tmp, call.getString("relPath", "Download/Cinetor/file.bin"), call.getString("mime", "application/octet-stream"), call.getString("treeUri"));
            JSObject r = new JSObject();
            r.put("path", pub[0]);
            r.put("uri", pub[1]);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage());
        }
    }

    // ---- in-app update -----------------------------------------------------------------
    @PluginMethod
    public void updateDownload(PluginCall call) {
        final String url = call.getString("url"), sha = call.getString("sha256");
        if (url == null || sha == null) {
            call.reject("url and sha256 are required");
            return;
        }
        new Thread(() -> {
            try {
                File f = Updater.download(getContext(), url, sha, (done, total) -> {
                    JSObject p = new JSObject();
                    p.put("bytesDone", done);
                    p.put("bytesTotal", total);
                    notifyListeners("updateProgress", p);
                });
                JSObject r = new JSObject();
                r.put("file", f.getAbsolutePath());
                call.resolve(r);
            } catch (Updater.ChecksumException e) {
                call.reject("checksum");
            } catch (Exception e) {
                call.reject("download failed: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void updateInstall(PluginCall call) {
        String file = call.getString("file");
        if (file == null) {
            call.reject("file missing");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, i, "installPermission");
            return;
        }
        install(call, file);
    }

    @ActivityCallback
    private void installPermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject r = new JSObject();
            r.put("started", false);
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        install(call, call.getString("file"));
    }

    private void install(PluginCall call, String file) {
        try {
            Updater.install(getContext(), new File(file));
            JSObject r = new JSObject();
            r.put("started", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("install failed: " + e.getMessage());
        }
    }
}
