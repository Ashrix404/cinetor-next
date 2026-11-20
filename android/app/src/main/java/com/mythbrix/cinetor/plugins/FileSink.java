package com.mythbrix.cinetor.plugins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.documentfile.provider.DocumentFile;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Moves a finished file to its destination (docs/06 §Native engine step 6):
 * a user-picked SAF folder, MediaStore Downloads (API 29+), or public Downloads (API 26–28).
 */
final class FileSink {
    /** relPath like "Download/Cinetor/Comics/Name - Chapter 214.pdf". Returns {display path, playable uri}. */
    static String[] publish(Context ctx, File src, String relPath, String mime, String treeUri) throws Exception {
        String name = relPath.substring(relPath.lastIndexOf('/') + 1);
        String dir = relPath.contains("/") ? relPath.substring(0, relPath.lastIndexOf('/')) : "Download/Cinetor";
        String sub = dir.endsWith("/Comics") ? "Comics" : dir.endsWith("/Music") ? "Music" : "";
        ContentResolver cr = ctx.getContentResolver();
        if (treeUri != null && !treeUri.isEmpty()) {
            DocumentFile root = DocumentFile.fromTreeUri(ctx, Uri.parse(treeUri));
            if (root == null) throw new Exception("folder not available");
            DocumentFile d = root;
            if (!sub.isEmpty()) {
                DocumentFile s = root.findFile(sub);
                d = s != null ? s : root.createDirectory(sub);
                if (d == null) throw new Exception("cannot create " + sub);
            }
            DocumentFile old = d.findFile(name);
            if (old != null) old.delete();
            DocumentFile f = d.createFile(mime, name);
            if (f == null) throw new Exception("cannot create file");
            copy(src, cr.openOutputStream(f.getUri()));
            src.delete();
            return new String[] { (root.getName() != null ? root.getName() : "Folder") + "/" + (sub.isEmpty() ? "" : sub + "/") + name, f.getUri().toString() };
        }
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            String rel = dir.startsWith("Download") ? dir : "Download/Cinetor" + (sub.isEmpty() ? "" : "/" + sub);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new Exception("MediaStore insert failed");
            copy(src, cr.openOutputStream(uri));
            src.delete();
            return new String[] { rel + "/" + name, uri.toString() };
        }
        File base = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File out = new File(new File(base, "Cinetor" + (sub.isEmpty() ? "" : "/" + sub)), name);
        File parent = out.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) throw new Exception("cannot create folder");
        copy(src, new java.io.FileOutputStream(out));
        src.delete();
        return out.getAbsolutePath();
    }

    private static void copy(File src, OutputStream out) throws Exception {
        if (out == null) throw new Exception("no output stream");
        try (InputStream in = new FileInputStream(src); OutputStream o = out) {
            IO.copy(in, o);
        }
    }
}
