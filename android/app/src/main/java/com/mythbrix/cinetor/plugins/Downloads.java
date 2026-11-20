package com.mythbrix.cinetor.plugins;

import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Parallel HTTP Range download engine (docs/06 §Native engine): segments of ≥ 256 KiB, one thread
 * each, RandomAccessFile into getExternalFilesDir("partial"), state in files/downloads.json every
 * second and on pause, running items reload as paused, then FileSink moves the file into place.
 */
public final class Downloads {

    public interface Listener { void onProgress(JSObject p); }

    static final class Seg {
        long a, b, got;
        Seg(long a, long b, long got) { this.a = a; this.b = b; this.got = got; }
        boolean done() { return a + got > b; }
    }

    static final class Job {
        String id, url, rel, tree, status = "queued", path, uri, error;
        int conn;
        long len;
        boolean ranges = true;
        List<Seg> segs = new ArrayList<>();
        volatile boolean stop;
        long lastBytes, lastT;
        long done() { long s = 0; for (Seg g : segs) s += g.got; return s; }
    }

    private static Downloads inst;
    private final Context ctx;
    private final Map<String, Job> jobs = new LinkedHashMap<>();
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private Listener listener;
    private long lastSave;

    public static synchronized Downloads get(Context c) {
        if (inst == null) inst = new Downloads(c.getApplicationContext());
        return inst;
    }

    private Downloads(Context c) {
        ctx = c;
        load();
    }

    void setListener(Listener l) { listener = l; }

    private File stateFile() { return new File(ctx.getFilesDir(), "downloads.json"); }
    private File temp(Job j) { return new File(ctx.getExternalFilesDir("partial"), j.id.replaceAll("[^A-Za-z0-9._-]", "_") + ".part"); }

    // ---- persistence ----
    private synchronized void load() {
        try {
            File f = stateFile();
            if (!f.exists()) return;
            JSONArray arr = new JSONArray(new String(IO.read(f), "UTF-8"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                Job j = new Job();
                j.id = o.getString("id"); j.url = o.getString("url"); j.rel = o.getString("rel");
                j.tree = o.optString("tree", null); j.conn = o.optInt("conn", 16); j.len = o.optLong("len");
                j.ranges = o.optBoolean("ranges", true); j.path = o.optString("path", null); j.uri = o.optString("uri", null);
                j.status = o.optString("status", "paused");
                if (j.status.equals("running") || j.status.equals("queued")) j.status = "paused"; // after restart
                JSONArray s = o.optJSONArray("segs");
                if (s != null) for (int k = 0; k < s.length(); k++) {
                    JSONArray g = s.getJSONArray(k);
                    j.segs.add(new Seg(g.getLong(0), g.getLong(1), g.getLong(2)));
                }
                jobs.put(j.id, j);
            }
        } catch (Exception ignored) {
            // corrupt state: start fresh
        }
    }

    private synchronized void save() {
        try {
            JSONArray arr = new JSONArray();
            for (Job j : jobs.values()) {
                JSONObject o = new JSONObject();
                o.put("id", j.id); o.put("url", j.url); o.put("rel", j.rel); o.put("tree", j.tree); o.put("conn", j.conn);
                o.put("len", j.len); o.put("ranges", j.ranges); o.put("status", j.status); o.put("path", j.path); o.put("uri", j.uri);
                JSONArray s = new JSONArray();
                for (Seg g : j.segs) s.put(new JSONArray().put(g.a).put(g.b).put(g.got));
                o.put("segs", s);
                arr.put(o);
            }
            IO.write(stateFile(), arr.toString().getBytes("UTF-8"));
            lastSave = System.currentTimeMillis();
        } catch (Exception ignored) {
        }
    }

    // ---- API ----
    synchronized void start(String id, String url, String rel, int conn, String tree) {
        Job j = jobs.get(id);
        if (j != null && !j.status.equals("error")) { resume(id); return; }
        j = new Job();
        j.id = id; j.url = url; j.rel = rel; j.conn = conn; j.tree = tree;
        jobs.put(id, j);
        run(j);
    }

    synchronized void pause(String id) {
        Job j = jobs.get(id);
        if (j == null || j.status.equals("done")) return;
        j.stop = true;
        j.status = "paused";
        save();
        emit(j, true);
        service();
    }

    synchronized void resume(String id) {
        Job j = jobs.get(id);
        if (j == null || j.status.equals("done") || j.status.equals("running")) return;
        run(j);
    }

    synchronized void cancel(String id) {
        Job j = jobs.remove(id);
        if (j == null) return;
        j.stop = true;
        temp(j).delete();
        save();
        service();
    }

    synchronized void pauseAll(boolean p) {
        for (Job j : new ArrayList<>(jobs.values())) if (p) pause(j.id); else resume(j.id);
    }

    synchronized JSArray list() {
        JSArray a = new JSArray();
        for (Job j : jobs.values()) a.put(progress(j, 0));
        return a;
    }

    synchronized int[] totals() {
        long d = 0, t = 0; int active = 0;
        for (Job j : jobs.values()) if (j.status.equals("running") || j.status.equals("queued")) { d += j.done(); t += j.len; active++; }
        return new int[] { active, t > 0 ? (int) (d * 100 / t) : 0 };
    }

    // ---- engine ----
    private void run(Job j) {
        j.stop = false;
        j.status = "running";
        j.lastT = System.currentTimeMillis();
        j.lastBytes = j.done();
        service();
        pool.execute(() -> {
            try {
                if (j.len <= 0) probe(j);
                if (j.segs.isEmpty()) plan(j);
                RandomAccessFile raf = new RandomAccessFile(temp(j), "rw");
                if (raf.length() != j.len) raf.setLength(j.len);
                raf.close();
                List<Thread> ts = new ArrayList<>();
                for (Seg s : j.segs) {
                    if (s.done()) continue;
                    Thread t = new Thread(() -> segment(j, s));
                    ts.add(t);
                    t.start();
                }
                for (Thread t : ts) t.join();
                synchronized (this) {
                    if (j.stop) return;
                    for (Seg s : j.segs) if (!s.done()) throw new Exception(j.error != null ? j.error : "incomplete");
                    File tmp = temp(j);
                    if (tmp.length() != j.len) throw new Exception("length mismatch");
                    String[] pub = FileSink.publish(ctx, tmp, j.rel, mime(j.rel), j.tree);
                    j.path = pub[0];
                    j.uri = pub[1];
                    j.status = "done";
                    save();
                    emit(j, true);
                    service();
                }
            } catch (Exception e) {
                synchronized (this) {
                    if (j.stop) return;
                    j.status = "error";
                    j.error = e.getMessage();
                    save();
                    emit(j, true);
                    service();
                }
            }
        });
    }

    private void probe(Job j) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(j.url).openConnection(Net.get(ctx).proxy());
        c.setRequestProperty("Range", "bytes=0-0");
        c.setConnectTimeout(15000);
        c.connect();
        int code = c.getResponseCode();
        String cr = c.getHeaderField("Content-Range");
        if (code == 206 && cr != null && cr.contains("/")) {
            j.len = Long.parseLong(cr.substring(cr.lastIndexOf('/') + 1).trim());
            j.ranges = true;
        } else {
            j.len = c.getContentLengthLong();
            j.ranges = false;
        }
        c.disconnect();
        if (j.len <= 0) throw new Exception("unknown length");
    }

    private void plan(Job j) {
        int n = j.ranges ? (int) Math.max(1, Math.min(j.conn, (j.len + 262143) / 262144)) : 1;
        long size = (j.len + n - 1) / n;
        for (long a = 0; a < j.len; a += size) j.segs.add(new Seg(a, Math.min(j.len, a + size) - 1, 0));
    }

    private void segment(Job j, Seg s) {
        HttpURLConnection c = null;
        try (RandomAccessFile raf = new RandomAccessFile(temp(j), "rw")) {
            long from = s.a + s.got;
            c = (HttpURLConnection) new URL(j.url).openConnection(Net.get(ctx).proxy());
            if (j.ranges) c.setRequestProperty("Range", "bytes=" + from + "-" + s.b);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            InputStream in = c.getInputStream();
            raf.seek(from);
            byte[] buf = new byte[64 * 1024];
            int r;
            while (!j.stop && (r = in.read(buf)) > 0) {
                raf.write(buf, 0, r);
                synchronized (this) { s.got += r; }
                tick(j);
            }
            in.close();
        } catch (Exception e) {
            if (!j.stop) j.error = e.getMessage();
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void tick(Job j) {
        long now = System.currentTimeMillis();
        if (now - j.lastT >= 500) emit(j, false);
        if (now - lastSave >= 1000) save();
    }

    private synchronized void emit(Job j, boolean force) {
        long now = System.currentTimeMillis(), done = j.done();
        double dt = Math.max(0.001, (now - j.lastT) / 1000.0);
        long bps = (long) ((done - j.lastBytes) / dt);
        if (!force && now - j.lastT < 500) return;
        j.lastT = now;
        j.lastBytes = done;
        if (listener != null) listener.onProgress(progress(j, bps));
        Notify.update(ctx, this);
    }

    private JSObject progress(Job j, long bps) {
        JSObject p = new JSObject();
        p.put("id", j.id);
        p.put("bytesDone", j.status.equals("done") ? j.len : j.done());
        p.put("bytesTotal", j.len);
        p.put("bytesPerSec", Math.max(0, bps));
        p.put("status", j.status);
        if (j.path != null) p.put("path", j.path);
        if (j.uri != null) p.put("uri", j.uri);
        if (j.error != null) p.put("error", j.error);
        return p;
    }

    private static String mime(String rel) {
        String r = rel.toLowerCase();
        return r.endsWith(".pdf") ? "application/pdf" : r.endsWith(".mp3") ? "audio/mpeg" : "video/mp4";
    }

    /** Foreground service runs while any download is active. */
    private void service() {
        Intent i = new Intent(ctx, DownloadService.class);
        try {
            if (totals()[0] > 0) ContextCompat.startForegroundService(ctx, i);
            else ctx.stopService(i);
        } catch (Exception ignored) {
            // background start not allowed right now; the next emit retries
        }
    }
}
