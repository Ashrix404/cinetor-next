package com.mythbrix.cinetor.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Network modes (same set as vega-app): WARP mode (usque → Cloudflare WARP over MASQUE), AntiDPI mode
 * (ByeDPI) and DNS over HTTPS (Cloudflare, Google, AdGuard, Custom, Off). All app traffic — the WebView
 * (androidx.webkit ProxyController) and native downloads/updates — goes through NetProxy when any mode is on.
 */
final class Net implements NetProxy.Route {
    static final String DEFAULT_DPI_ARGS = "--split 1 --disorder 1 --auto=torst";
    private static Net inst;
    private final Context ctx;
    private final SharedPreferences prefs;
    private final NetProxy proxy = new NetProxy(this);
    private Process warpProc, dpiProc;
    private Integer warpPort, dpiPort;
    private String lastError = "";

    static synchronized Net get(Context c) {
        if (inst == null) inst = new Net(c.getApplicationContext());
        return inst;
    }

    private Net(Context c) {
        ctx = c;
        prefs = c.getSharedPreferences("cinetor-net", Context.MODE_PRIVATE);
    }

    boolean warp() { return prefs.getBoolean("warp", false); }
    boolean dpi() { return prefs.getBoolean("dpi", false); }
    String dpiArgs() { return prefs.getString("dpiArgs", DEFAULT_DPI_ARGS); }
    String doh() { return prefs.getString("doh", "off"); }
    String dohCustom() { return prefs.getString("dohUrl", ""); }
    String error() { return lastError; }
    boolean warpRunning() { return warpProc != null && warpProc.isAlive(); }
    boolean dpiRunning() { return dpiProc != null && dpiProc.isAlive(); }

    void save(Boolean warp, Boolean dpi, String args, String doh, String dohUrl) {
        SharedPreferences.Editor e = prefs.edit();
        if (warp != null) e.putBoolean("warp", warp);
        if (dpi != null) e.putBoolean("dpi", dpi);
        if (warp != null && warp) e.putBoolean("dpi", false); // WARP and AntiDPI are exclusive (vega behaviour)
        if (dpi != null && dpi) e.putBoolean("warp", false);
        if (args != null) e.putString("dpiArgs", args.trim().isEmpty() ? DEFAULT_DPI_ARGS : args.trim());
        if (doh != null) e.putString("doh", doh);
        if (dohUrl != null) e.putString("dohUrl", dohUrl.trim());
        e.apply();
    }

    // ---- NetProxy.Route ----
    @Override public synchronized Integer warpPort() { return warpRunning() ? warpPort : null; }
    @Override public synchronized Integer dpiPort() { return dpiRunning() ? dpiPort : null; }
    @Override public String dohUrl() {
        if (warp()) return null; // resolved remotely by WARP
        String u = Doh.endpoint(doh(), dohCustom());
        return u == null || u.isEmpty() ? null : u;
    }

    /** java.net.Proxy for native HttpURLConnection (downloads, updater). */
    Proxy proxy() {
        Integer p = proxy.port();
        return p == null ? Proxy.NO_PROXY : new Proxy(Proxy.Type.HTTP, new InetSocketAddress("127.0.0.1", p));
    }

    /** Applies the saved settings: (re)starts helpers, local proxy and the WebView proxy override. */
    synchronized void apply() {
        lastError = "";
        Doh.clear();
        stopProc(true);
        stopProc(false);
        try {
            if (warp()) startWarp();
            else if (dpi()) startDpi();
        } catch (Exception e) {
            lastError = e.getMessage() == null ? e.toString() : e.getMessage();
        }
        boolean any = warpRunning() || dpiRunning() || dohUrl() != null;
        try {
            if (any) webViewProxy(proxy.start());
            else {
                webViewProxy(null);
                proxy.stop();
            }
        } catch (Exception e) {
            lastError = "proxy: " + e.getMessage();
        }
    }

    private File bin(String name) { return new File(ctx.getApplicationInfo().nativeLibraryDir, name); }

    private static int freePort() throws Exception {
        try (ServerSocket s = new ServerSocket(0)) { return s.getLocalPort(); }
    }

    private static boolean waitPort(int port, Process p, long ms) throws InterruptedException {
        long end = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < end && p.isAlive()) {
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress("127.0.0.1", port), 300);
                return true;
            } catch (Exception e) {
                Thread.sleep(150);
            }
        }
        return false;
    }

    private static String drain(Process p) {
        StringBuilder b = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            String l;
            while (r.ready() && (l = r.readLine()) != null && b.length() < 400) b.append(l).append('\n');
        } catch (Exception ignored) {
        }
        return b.toString().trim();
    }

    private void startWarp() throws Exception {
        File exe = bin("libusque.so");
        if (!exe.exists()) throw new Exception("WARP is not available on this device (" + android.os.Build.SUPPORTED_ABIS[0] + ")");
        File dir = new File(ctx.getFilesDir(), "warp");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot create warp dir");
        File cfg = new File(dir, "config.json");
        if (!cfg.exists()) { // one-time Cloudflare WARP registration (free account, TOS accepted by the user's toggle)
            Process reg = new ProcessBuilder(exe.getAbsolutePath(), "register", "-a", "-c", cfg.getAbsolutePath(), "-n", "Cinetor")
                .directory(dir).redirectErrorStream(true).start();
            if (!reg.waitFor(40, TimeUnit.SECONDS)) { reg.destroy(); throw new Exception("WARP registration timed out"); }
            if (!cfg.exists()) throw new Exception("WARP registration failed: " + drain(reg));
        }
        int port = freePort();
        List<String> cmd = new ArrayList<>(Arrays.asList(exe.getAbsolutePath(), "http-proxy", "-c", cfg.getAbsolutePath(), "-b", "127.0.0.1", "-p", String.valueOf(port), "-d", "1.1.1.1", "-d", "8.8.8.8"));
        Process p = new ProcessBuilder(cmd).directory(dir).redirectErrorStream(true).start();
        if (!waitPort(port, p, 8000)) {
            String out = drain(p);
            p.destroy();
            throw new Exception("Failed to connect to Cloudflare WARP" + (out.isEmpty() ? "" : ": " + out));
        }
        warpProc = p;
        warpPort = port;
        consume(p);
    }

    private void startDpi() throws Exception {
        File exe = bin("libciadpi.so");
        if (!exe.exists()) throw new Exception("AntiDPI is not available on this device (" + android.os.Build.SUPPORTED_ABIS[0] + ")");
        int port = freePort();
        List<String> cmd = new ArrayList<>(Arrays.asList(exe.getAbsolutePath(), "-i", "127.0.0.1", "-p", String.valueOf(port)));
        for (String a : dpiArgs().trim().split("\\s+")) if (!a.isEmpty()) cmd.add(a);
        Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        if (!waitPort(port, p, 4000)) {
            String out = drain(p);
            p.destroy();
            throw new Exception("ByeDPI failed to start" + (out.isEmpty() ? "" : ": " + out));
        }
        dpiProc = p;
        dpiPort = port;
        consume(p);
    }

    private static void consume(Process p) {
        Thread t = new Thread(() -> {
            try (InputStreamReader r = new InputStreamReader(p.getInputStream())) {
                char[] b = new char[1024];
                while (r.read(b) > 0) { /* keep the pipe empty */ }
            } catch (Exception ignored) {
            }
        });
        t.setDaemon(true);
        t.start();
    }

    private void stopProc(boolean warp) {
        Process p = warp ? warpProc : dpiProc;
        if (p != null) p.destroy();
        if (warp) { warpProc = null; warpPort = null; } else { dpiProc = null; dpiPort = null; }
    }

    private void webViewProxy(Integer port) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {
            if (port != null) lastError = "This device's WebView cannot use a proxy; only downloads use the network mode.";
            return;
        }
        Runnable done = () -> {};
        java.util.concurrent.Executor ex = Runnable::run;
        if (port == null) ProxyController.getInstance().clearProxyOverride(ex, done);
        else ProxyController.getInstance().setProxyOverride(
            new ProxyConfig.Builder().addProxyRule("127.0.0.1:" + port).addBypassRule("localhost").addBypassRule("127.0.0.1").build(), ex, done);
    }
}
