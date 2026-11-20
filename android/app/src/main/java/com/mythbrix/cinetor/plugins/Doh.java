package com.mythbrix.cinetor.plugins;

import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.Proxy;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** DNS over HTTPS (RFC 8484, wire format GET) with a small TTL cache. */
final class Doh {
    static String endpoint(String provider, String custom) {
        switch (provider) {
            case "cloudflare": return "https://cloudflare-dns.com/dns-query";
            case "google": return "https://dns.google/dns-query";
            case "adguard": return "https://dns.adguard-dns.com/dns-query";
            case "custom": return custom;
            default: return null;
        }
    }

    private static final Map<String, Object[]> cache = new HashMap<>(); // host -> {expiresAt, InetAddress[]}

    static synchronized void clear() { cache.clear(); }

    static InetAddress[] resolve(String url, String host, Proxy via) throws Exception {
        synchronized (Doh.class) {
            Object[] c = cache.get(host);
            if (c != null && (Long) c[0] > System.currentTimeMillis()) return (InetAddress[]) c[1];
        }
        List<InetAddress> out = new ArrayList<>();
        long ttl = query(url, host, 1, via, out);
        if (out.isEmpty()) ttl = query(url, host, 28, via, out);
        if (out.isEmpty()) throw new Exception("DoH: no address for " + host);
        InetAddress[] arr = out.toArray(new InetAddress[0]);
        synchronized (Doh.class) {
            cache.put(host, new Object[] { System.currentTimeMillis() + Math.max(60, ttl) * 1000L, arr });
        }
        return arr;
    }

    private static long query(String url, String host, int type, Proxy via, List<InetAddress> out) throws Exception {
        ByteArrayOutputStream q = new ByteArrayOutputStream();
        q.write(new byte[] { 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0 }); // id 0, RD, 1 question
        for (String label : host.split("\\.")) {
            byte[] b = label.getBytes("US-ASCII");
            q.write(b.length);
            q.write(b);
        }
        q.write(new byte[] { 0, 0, (byte) type, 0, 1 });
        String dns = Base64.encodeToString(q.toByteArray(), Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        HttpURLConnection c = (HttpURLConnection) new URL(url + (url.contains("?") ? "&" : "?") + "dns=" + dns).openConnection(via);
        c.setRequestProperty("accept", "application/dns-message");
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        byte[] r;
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            IO.copy(in, o);
            r = o.toByteArray();
        } finally {
            c.disconnect();
        }
        int an = ((r[6] & 0xff) << 8) | (r[7] & 0xff);
        int p = 12;
        p = skipName(r, p) + 4; // question
        long ttl = 300;
        for (int i = 0; i < an && p < r.length; i++) {
            p = skipName(r, p);
            int t = ((r[p] & 0xff) << 8) | (r[p + 1] & 0xff);
            long tt = ((long) (r[p + 4] & 0xff) << 24) | ((r[p + 5] & 0xff) << 16) | ((r[p + 6] & 0xff) << 8) | (r[p + 7] & 0xff);
            int len = ((r[p + 8] & 0xff) << 8) | (r[p + 9] & 0xff);
            p += 10;
            if ((t == 1 && len == 4) || (t == 28 && len == 16)) {
                byte[] a = new byte[len];
                System.arraycopy(r, p, a, 0, len);
                out.add(InetAddress.getByAddress(host, a));
                ttl = Math.min(ttl, tt);
            }
            p += len;
        }
        return ttl;
    }

    private static int skipName(byte[] r, int p) {
        while (p < r.length) {
            int l = r[p] & 0xff;
            if (l == 0) return p + 1;
            if ((l & 0xc0) == 0xc0) return p + 2;
            p += l + 1;
        }
        return p;
    }
}
