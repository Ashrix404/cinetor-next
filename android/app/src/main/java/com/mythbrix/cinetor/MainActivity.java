package com.mythbrix.cinetor;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.mythbrix.cinetor.plugins.CinetorNativePlugin.class);
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
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
