package com.mythbrix.cinetor.plugins;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/** APK download with SHA-256 verify while streaming, then the system installer (docs/07 §Update install flow). */
final class Updater {
    static final class ChecksumException extends Exception {}
    interface Progress { void on(long done, long total); }

    static File download(Context ctx, String url, String sha256, Progress p) throws Exception {
        File dir = new File(ctx.getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot create cache dir");
        File out = new File(dir, "cinetor-update.apk");
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(20000);
        c.setReadTimeout(30000);
        long total = c.getContentLengthLong(), done = 0, last = 0;
        try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024];
            int r;
            while ((r = in.read(buf)) > 0) {
                o.write(buf, 0, r);
                md.update(buf, 0, r);
                done += r;
                long now = System.currentTimeMillis();
                if (now - last > 300) { p.on(done, total); last = now; }
            }
        } finally {
            c.disconnect();
        }
        p.on(done, total);
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        if (!hex.toString().equalsIgnoreCase(sha256.trim())) {
            out.delete(); // never open the installer with a wrong file
            throw new ChecksumException();
        }
        return out;
    }

    static void install(Context ctx, File apk) {
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }
}
