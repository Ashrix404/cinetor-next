package com.mythbrix.cinetor.plugins;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;

/**
 * Local HTTP proxy (127.0.0.1) that every request of the app goes through when a network mode is on.
 * WARP → chained to the usque HTTP proxy (DNS resolved by Cloudflare);
 * AntiDPI → connects through the ByeDPI SOCKS5 proxy; DoH → hostnames resolved with Doh.
 */
final class NetProxy {
    interface Route {
        Integer warpPort();
        Integer dpiPort();
        String dohUrl();
    }

    private final Route route;
    private ServerSocket server;

    NetProxy(Route r) { route = r; }

    synchronized int start() throws Exception {
        if (server != null && !server.isClosed()) return server.getLocalPort();
        server = new ServerSocket(0, 64, InetAddress.getByName("127.0.0.1"));
        final ServerSocket s = server;
        Thread t = new Thread(() -> {
            while (!s.isClosed()) {
                try {
                    Socket c = s.accept();
                    new Thread(() -> handle(c)).start();
                } catch (Exception ignored) {
                }
            }
        }, "cinetor-netproxy");
        t.setDaemon(true);
        t.start();
        return server.getLocalPort();
    }

    synchronized void stop() {
        try {
            if (server != null) server.close();
        } catch (Exception ignored) {
        }
        server = null;
    }

    synchronized Integer port() { return server != null && !server.isClosed() ? server.getLocalPort() : null; }

    private static String readHead(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int st = 0, c;
        while ((c = in.read()) != -1) {
            b.write(c);
            st = (c == '\r' || c == '\n') ? st + 1 : 0;
            if (st == 4 || b.size() > 65536) break;
        }
        return b.toString("ISO-8859-1");
    }

    private void handle(Socket client) {
        Socket up = null;
        try {
            client.setSoTimeout(0);
            InputStream cin = client.getInputStream();
            OutputStream cout = client.getOutputStream();
            String head = readHead(cin);
            if (head.isEmpty()) { client.close(); return; }
            String[] first = head.substring(0, head.indexOf('\r')).split(" ");
            boolean connect = first[0].equalsIgnoreCase("CONNECT");
            String host; int port; String forward = null;
            if (connect) {
                String hp = first[1];
                int i = hp.lastIndexOf(':');
                host = hp.substring(0, i).replace("[", "").replace("]", "");
                port = Integer.parseInt(hp.substring(i + 1));
            } else {
                URI u = new URI(first[1]);
                host = u.getHost();
                port = u.getPort() > 0 ? u.getPort() : 80;
                String path = (u.getRawPath() == null || u.getRawPath().isEmpty() ? "/" : u.getRawPath()) + (u.getRawQuery() != null ? "?" + u.getRawQuery() : "");
                forward = first[0] + " " + path + " " + first[2] + head.substring(head.indexOf('\r'));
            }
            Integer warp = route.warpPort();
            if (warp != null) {
                up = new Socket();
                up.connect(new InetSocketAddress("127.0.0.1", warp), 10000);
                OutputStream uo = up.getOutputStream();
                if (connect) {
                    uo.write(("CONNECT " + host + ":" + port + " HTTP/1.1\r\nHost: " + host + ":" + port + "\r\n\r\n").getBytes("ISO-8859-1"));
                    String resp = readHead(up.getInputStream());
                    if (!resp.contains(" 200")) throw new Exception("WARP refused " + host);
                } else uo.write(head.getBytes("ISO-8859-1")); // absolute URI form for the upstream proxy
            } else {
                String doh = route.dohUrl();
                Integer dpi = route.dpiPort();
                InetAddress addr = doh != null ? Doh.resolve(doh, host, dpi != null ? new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", dpi)) : Proxy.NO_PROXY)[0] : InetAddress.getByName(host);
                up = dpi != null ? new Socket(new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", dpi))) : new Socket();
                up.setTcpNoDelay(true);
                up.connect(new InetSocketAddress(addr, port), 15000);
                if (!connect) up.getOutputStream().write(forward.getBytes("ISO-8859-1"));
            }
            if (connect) cout.write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes("ISO-8859-1"));
            cout.flush();
            final Socket u = up;
            Thread t = new Thread(() -> pipe(cin, out(u), client, u));
            t.start();
            pipe(up.getInputStream(), cout, client, up);
        } catch (Exception e) {
            try {
                client.getOutputStream().write("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n".getBytes("ISO-8859-1"));
            } catch (Exception ignored) {
            }
            close(client, up);
        }
    }

    private static OutputStream out(Socket s) {
        try {
            return s.getOutputStream();
        } catch (Exception e) {
            return null;
        }
    }

    private static void pipe(InputStream in, OutputStream out, Socket a, Socket b) {
        byte[] buf = new byte[32 * 1024];
        try {
            int r;
            while (out != null && (r = in.read(buf)) > 0) {
                out.write(buf, 0, r);
                out.flush();
            }
        } catch (Exception ignored) {
        }
        close(a, b);
    }

    private static void close(Socket a, Socket b) {
        try { a.close(); } catch (Exception ignored) {}
        try { if (b != null) b.close(); } catch (Exception ignored) {}
    }
}
