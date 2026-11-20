package com.mythbrix.cinetor;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.mythbrix.cinetor.plugins.CinetorNativePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            // Embed players open ad pop-ups through window.open; never let them open automatically.
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSupportMultipleWindows(false);
            settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

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

            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String urlStr = request.getUrl().toString();
                if (urlStr.contains("hakunaymatata.com")) {
                    try {
                        URL url = new URL(urlStr);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod(request.getMethod());

                        for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                            conn.setRequestProperty(entry.getKey(), entry.getValue());
                        }

                        conn.setRequestProperty("Referer", "https://mzfi.me/");
                        conn.setRequestProperty("Origin", "https://mzfi.me");
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

                        conn.connect();
                        int code = conn.getResponseCode();
                        InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                        String contentType = conn.getContentType();
                        if (contentType == null) contentType = urlStr.contains(".m3u8") ? "application/x-mpegURL" : "video/mp4";

                        Map<String, String> headers = new HashMap<>();
                        for (Map.Entry<String, List<String>> header : conn.getHeaderFields().entrySet()) {
                            if (header.getKey() != null && !header.getValue().isEmpty()) {
                                headers.put(header.getKey(), header.getValue().get(0));
                            }
                        }
                        headers.put("Access-Control-Allow-Origin", "*");

                        return new WebResourceResponse(
                            contentType.split(";")[0],
                            conn.getContentEncoding(),
                            code,
                            conn.getResponseMessage(),
                            headers,
                            is
                        );
                    } catch (Exception ignored) {
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

}
