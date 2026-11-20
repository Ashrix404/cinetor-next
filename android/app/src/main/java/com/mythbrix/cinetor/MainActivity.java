package com.mythbrix.cinetor;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.annotation.Nullable;
import androidx.webkit.UserAgentMetadata;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import com.mythbrix.cinetor.plugins.MediaHeaders;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    private View fsView;
    private android.webkit.WebChromeClient.CustomViewCallback fsCallback;
    private BridgeWebChromeClient chrome;
    /** Hardware Back leaves embed fullscreen first (added after Capacitor's callback, so it runs first). */
    private final androidx.activity.OnBackPressedCallback fsBack = new androidx.activity.OnBackPressedCallback(false) {
        @Override
        public void handleOnBackPressed() {
            if (chrome != null) chrome.onHideCustomView();
        }
    };

    /** "; wv)" and "Version/4.0 " mark the Android WebView; embed players (vidsrc.su) refuse it. */
    static String cleanUserAgent(String ua) {
        if (ua == null) return null;
        return ua.replace("; wv)", ")").replaceAll("\\bVersion/\\d+(\\.\\d+)* ", "");
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.mythbrix.cinetor.plugins.CinetorNativePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            // Embed players open ad pop-ups through window.open; never let them open automatically.
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSupportMultipleWindows(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            hideWebView(webView, settings);

            android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        // Capacitor's chrome client hides every fullscreen request at once (callback.onCustomViewHidden()),
        // so the fullscreen button inside an embed player did nothing. Show the custom view instead.
        chrome = new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fsView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fsView = view;
                fsCallback = callback;
                ViewGroup decor = (ViewGroup) getWindow().getDecorView();
                decor.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                view.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );
                fsBack.setEnabled(true);
            }

            @Override
            public void onHideCustomView() {
                if (fsView == null) return;
                ((ViewGroup) getWindow().getDecorView()).removeView(fsView);
                fsView = null;
                if (fsCallback != null) fsCallback.onCustomViewHidden();
                fsCallback = null;
                fsBack.setEnabled(false);
            }
        };
        getBridge().getWebView().setWebChromeClient(chrome);
        getOnBackPressedDispatcher().addCallback(this, fsBack);

        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            /**
             * Capacitor's default sends EVERY navigation to another host to the external browser, including
             * navigations inside an iframe (embed players redirect and swap their inner frames), so the
             * player iframe never loaded in the APK. Rules:
             * - sub-frame http(s): load it inside the iframe;
             * - sub-frame other schemes (intent://, market://: ad redirects): block;
             * - main-frame http(s) to a foreign host (an embed hijacking the top window): block, stay in the app;
             * - everything else (the app itself, intent:// links we open on purpose): Capacitor default.
             */
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme() == null ? "" : url.getScheme();
                boolean web = scheme.equals("http") || scheme.equals("https");
                if (!request.isForMainFrame()) return !web;
                String host = url.getHost() == null ? "" : url.getHost();
                if (web && !host.equals("localhost")) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            /** Direct media files whose CDN wants a Referer/Origin (MediaHeaders rules): fetched here with them. */
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Map<String, String> extra = MediaHeaders.forHost(request.getUrl().getHost());
                if (extra != null && "GET".equalsIgnoreCase(request.getMethod())) {
                    WebResourceResponse r = fetchWith(request, extra);
                    if (r != null) return r;
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    /**
     * The page (and every embed frame) must not see that this is a WebView: native UA string without
     * "; wv" / "Version/x", Client Hints brands without "Android WebView", and the embed guard
     * (res/raw/embed_shim.js) at document start in every frame (pop-ups, _blank links, ready/playing/blocked).
     */
    private void hideWebView(WebView webView, WebSettings settings) {
        try {
            settings.setUserAgentString(cleanUserAgent(settings.getUserAgentString()));
        } catch (Exception ignored) {
        }
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) {
                UserAgentMetadata md = WebSettingsCompat.getUserAgentMetadata(settings);
                List<UserAgentMetadata.BrandVersion> out = new ArrayList<>();
                for (UserAgentMetadata.BrandVersion b : md.getBrandVersionList()) {
                    if ("Android WebView".equals(b.getBrand())) {
                        out.add(new UserAgentMetadata.BrandVersion.Builder(b).setBrand("Google Chrome").build());
                    } else {
                        out.add(b);
                    }
                }
                WebSettingsCompat.setUserAgentMetadata(settings, new UserAgentMetadata.Builder(md).setBrandVersionList(out).build());
            }
        } catch (Exception ignored) {
        }
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(webView, readRaw(R.raw.embed_shim), Collections.singleton("*"));
            }
        } catch (Exception ignored) {
        }
    }

    private String readRaw(int id) throws java.io.IOException {
        try (InputStream in = getResources().openRawResource(id)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    /** GET `request` with its own headers + `extra` (Range kept, so seeking works); null on any error. */
    @Nullable
    private static WebResourceResponse fetchWith(WebResourceRequest request, Map<String, String> extra) {
        try {
            String urlStr = request.getUrl().toString();
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            for (Map.Entry<String, String> e : request.getRequestHeaders().entrySet()) conn.setRequestProperty(e.getKey(), e.getValue());
            for (Map.Entry<String, String> e : extra.entrySet()) conn.setRequestProperty(e.getKey(), e.getValue());
            conn.connect();
            int code = conn.getResponseCode();
            InputStream is = code >= 200 && code < 400 ? conn.getInputStream() : conn.getErrorStream();
            String type = conn.getContentType();
            if (type == null) type = urlStr.contains(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp4";
            Map<String, String> headers = new HashMap<>();
            for (Map.Entry<String, List<String>> h : conn.getHeaderFields().entrySet()) {
                if (h.getKey() != null && !h.getValue().isEmpty()) headers.put(h.getKey(), h.getValue().get(0));
            }
            headers.put("Access-Control-Allow-Origin", "*");
            String reason = conn.getResponseMessage();
            return new WebResourceResponse(type.split(";")[0].trim(), conn.getContentEncoding(), code, reason == null || reason.isEmpty() ? "OK" : reason, headers, is);
        } catch (Exception e) {
            return null;
        }
    }
}
