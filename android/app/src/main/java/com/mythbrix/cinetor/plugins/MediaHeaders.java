package com.mythbrix.cinetor.plugins;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Referer/Origin a CDN wants, per host (v2: Media3 per-source request headers). Filled from JS
 * (CinetorNative.setMediaHeaders) before a direct file plays; MainActivity.shouldInterceptRequest
 * fetches every request to such a host (video ranges and HLS segments included) with these headers.
 */
public final class MediaHeaders {
    private static final Map<String, Map<String, String>> RULES = new ConcurrentHashMap<>();

    static {
        // MovieBox CDN (the gateway's MovieBox sources): needs the MovieBox web player as Referer.
        Map<String, String> mb = new HashMap<>();
        mb.put("Referer", "https://mzfi.me/");
        mb.put("Origin", "https://mzfi.me");
        RULES.put("hakunaymatata.com", mb);
    }

    private MediaHeaders() {}

    public static void put(String host, Map<String, String> headers) {
        if (host == null || host.isEmpty() || headers == null || headers.isEmpty()) return;
        RULES.put(host.toLowerCase(java.util.Locale.US), new HashMap<>(headers));
    }

    /** Headers for `host` or any parent domain (cdn1.example.com matches example.com), else null. */
    public static Map<String, String> forHost(String host) {
        if (host == null) return null;
        String h = host.toLowerCase(java.util.Locale.US);
        while (true) {
            Map<String, String> r = RULES.get(h);
            if (r != null) return r;
            int dot = h.indexOf('.');
            if (dot < 0 || h.indexOf('.', dot + 1) < 0) return null;
            h = h.substring(dot + 1);
        }
    }
}
