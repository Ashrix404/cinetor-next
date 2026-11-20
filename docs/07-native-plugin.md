# 07 — `CinetorNative` (our own Capacitor plugin, Java)

One plugin for every native feature, so we never depend on unverified community plugins.

Location: `android/app/src/main/java/com/mythbrix/cinetor/plugins/` (create the package folder if the generated `MainActivity` package differs, then use the generated package name everywhere).

## Verified APIs you may use (Android SDK / AndroidX / Capacitor)

| Need | API |
|---|---|
| plugin base | `com.getcapacitor.Plugin`, `@CapacitorPlugin(name="CinetorNative")`, `@PluginMethod`, `PluginCall#getFloat/getString/getInt/getBoolean`, `call.resolve(JSObject)`, `call.reject(String)`, `notifyListeners(String, JSObject)`, `startActivityForResult(call, intent, "cbName")` + `@ActivityCallback` |
| brightness | `WindowManager.LayoutParams#screenBrightness`, `BRIGHTNESS_OVERRIDE_NONE` (run on the UI thread) |
| volume | `AudioManager#getStreamMaxVolume/getStreamVolume/setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)` |
| external app | `Intent.ACTION_VIEW`, `Intent#setDataAndType`, `Intent.createChooser`, `FLAG_ACTIVITY_NEW_TASK` |
| TV check | `UiModeManager#getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION` |
| ABIs | `Build.SUPPORTED_ABIS` |
| version | `PackageManager#getPackageInfo` + `androidx.core.content.pm.PackageInfoCompat.getLongVersionCode` |
| APK install | `FileProvider.getUriForFile`, `PackageManager#canRequestPackageInstalls()` (API 26), `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`, `Intent.ACTION_VIEW` with type `application/vnd.android.package-archive`, `FLAG_GRANT_READ_URI_PERMISSION` |
| hashing | `java.security.MessageDigest.getInstance("SHA-256")` |
| downloads | `HttpURLConnection`, `RandomAccessFile`, `ExecutorService`, `MediaStore.Downloads.EXTERNAL_CONTENT_URI` (API 29), `MediaStore.MediaColumns.RELATIVE_PATH` (API 29), `Intent.ACTION_OPEN_DOCUMENT_TREE`, `ContentResolver#takePersistableUriPermission`, `androidx.documentfile.provider.DocumentFile.fromTreeUri` |
| foreground service | `Service`, `startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)` (API 29+; use the 2-arg version below 29), `NotificationCompat`, `ContextCompat.startForegroundService` |

Gradle (app module): `implementation "androidx.documentfile:documentfile:1.1.0"`.

## Plugin methods (JS contract)

```ts
// src/native/cinetor-native.ts
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export interface DlProgress { id: string; bytesDone: number; bytesTotal: number; bytesPerSec: number; status: 'queued'|'running'|'paused'|'done'|'error'; path?: string; error?: string }
export interface CinetorNativePlugin {
  setBrightness(o: { value: number | null }): Promise<void>;     // null = back to system
  getBrightness(): Promise<{ value: number }>;
  setVolume(o: { value: number }): Promise<void>;                // 0..1
  getVolume(): Promise<{ value: number }>;
  openExternal(o: { url: string; mime: string; title?: string }): Promise<void>;
  deviceInfo(): Promise<{ isTv: boolean; abis: string[]; versionCode: number; versionName: string; sdk: number }>;
  pickFolder(): Promise<{ uri: string; label: string } | { cancelled: true }>;
  dlStart(o: { id: string; url: string; relPath: string; connections: 16|32|64; treeUri?: string }): Promise<void>;
  dlPause(o: { id: string }): Promise<void>;
  dlResume(o: { id: string }): Promise<void>;
  dlCancel(o: { id: string }): Promise<void>;
  dlList(): Promise<{ items: DlProgress[] }>;
  saveBytes(o: { relPath: string; base64: string; mime: string; treeUri?: string }): Promise<{ path: string }>;
  updateDownload(o: { url: string; sha256: string }): Promise<{ file: string }>;   // progress via "updateProgress" event
  updateInstall(o: { file: string }): Promise<{ started: boolean; needsPermission?: boolean }>;
  keepAliveForPlayback(o: { on: boolean }): Promise<void>;       // only if T33 proves it is needed
  addListener(e: 'downloadProgress', fn: (p: DlProgress) => void): Promise<PluginListenerHandle>;
  addListener(e: 'updateProgress', fn: (p: { bytesDone: number; bytesTotal: number }) => void): Promise<PluginListenerHandle>;
}
export const CinetorNative = registerPlugin<CinetorNativePlugin>('CinetorNative');
```

## Java skeleton (key parts only; fill in the rest from the table above)

```java
package com.mythbrix.cinetor.plugins;

import android.content.Context; import android.content.Intent; import android.net.Uri;
import android.media.AudioManager; import android.view.WindowManager;
import com.getcapacitor.*; import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CinetorNative")
public class CinetorNativePlugin extends Plugin {

  @PluginMethod
  public void setBrightness(PluginCall call) {
    Float v = call.getFloat("value");                // null → system default
    getActivity().runOnUiThread(() -> {
      WindowManager.LayoutParams lp = getActivity().getWindow().getAttributes();
      lp.screenBrightness = (v == null) ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                                        : Math.max(0.01f, Math.min(1f, v));
      getActivity().getWindow().setAttributes(lp);
      call.resolve();
    });
  }

  @PluginMethod
  public void setVolume(PluginCall call) {
    float v = call.getFloat("value", 0.5f);
    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
    am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(Math.max(0f, Math.min(1f, v)) * max), 0);
    call.resolve();
  }

  @PluginMethod
  public void openExternal(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_VIEW);
    i.setDataAndType(Uri.parse(call.getString("url")), call.getString("mime", "video/*"));
    Intent chooser = Intent.createChooser(i, "Open with");
    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(chooser);
    call.resolve();
  }
  // deviceInfo, pickFolder (+@ActivityCallback), dl*, saveBytes, updateDownload, updateInstall:
  // implement with the APIs in the table; keep each in its own class:
  //   DownloadStore.java (JSON persistence), SegmentDownloader.java (Range threads),
  //   DownloadService.java (foreground service), FileSink.java (MediaStore / SAF / legacy),
  //   Updater.java (download + sha256 + install intent).
}
```

Register it in the generated `MainActivity` before `super.onCreate`:

```java
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(com.mythbrix.cinetor.plugins.CinetorNativePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

## Manifest additions (main)

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
<application android:hardwareAccelerated="true" ...>
  <service android:name=".plugins.DownloadService" android:exported="false"
           android:foregroundServiceType="dataSync" />
</application>
```

FileProvider: the Capacitor 8 template already declares `${applicationId}.fileprovider`, and its `res/xml/file_paths.xml` contains `<cache-path name="my_cache_images" path="." />`, which already covers `cache/updates/`. Do not add a second provider. Check the generated file once and write what you saw in PROGRESS.md.

## Update install flow (Updater.java)

1. `updateDownload`: stream to `getCacheDir()/updates/cinetor-<code>.apk`, emit `updateProgress`, compute SHA-256 while streaming. On a mismatch, delete the file and reject with `"checksum"`.
2. `updateInstall`: if `!getPackageManager().canRequestPackageInstalls()`, open `ACTION_MANAGE_UNKNOWN_APP_SOURCES` with `package:<pkg>` through `startActivityForResult` and resolve `{started:false, needsPermission:true}` from the callback when it is still denied. Otherwise start `ACTION_VIEW` with the FileProvider URI and the APK mime type, using `FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK`, and resolve `{started:true}`.
3. The new APK must be signed with the SAME key (`docs/03-github-setup.md` Step 4), or Android refuses to update.
