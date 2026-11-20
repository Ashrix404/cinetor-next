#!/usr/bin/env python3
"""CI-only YouTube Music probe (stdlib only). Run by .github/workflows/ytm-probe.yml.

From the runner's (datacenter) IP it checks, per InnerTube client: player playability, which
audio itags come back with a direct `url`, and whether the WHOLE file downloads (PO-token-less
streams stop with HTTP 403 after 1 MiB). It also checks the metadata endpoints the app uses and
the deployed gateway's /v1/proxy. Prints a markdown table and writes probe.json + urls.json
(one direct URL per working client, consumed by audio.mjs in a real Chrome).
"""
import http.client, json, sys, time, urllib.error, urllib.parse, urllib.request

GATEWAY = 'https://cinetor-api.sofasraful.workers.dev'
VIDEOS = ['fsiPzT50ZiM', 'kJQP7kiw5Fk', 'Umqb9KENgmk']  # ATV song, OMV, OMV
CLIENTS = {
    'IOS_PRODUCER': dict(v='0.147.945', id=92, ua='com.google.ios.youtubeproducer/0.147.945 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)', x=dict(deviceMake='Apple', deviceModel='iPhone16,2', osName='iPhone', osVersion='18.3.2.22D82')),
    'VISIONOS': dict(v='1.02', id=101, ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', x=dict(deviceMake='Apple', deviceModel='RealityDevice17,1', osName='visionOS', osVersion='26.5.23O471')),
    'ANDROID_VR': dict(v='1.65.10', id=28, ua='com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip', x=dict(deviceMake='Oculus', deviceModel='Quest 3', androidSdkVersion=32, osName='Android', osVersion='12L')),
    'IOS': dict(v='21.26.4', id=5, ua='com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)', x=dict(deviceMake='Apple', deviceModel='iPhone16,2', osName='iPhone', osVersion='18.3.2.22D82')),
    'ANDROID': dict(v='21.26.364', id=3, ua='com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip', x=dict(androidSdkVersion=30, osName='Android', osVersion='11')),
    'WEB_REMIX': dict(v='1.20261117.06.00', id=67, ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', x={}, host='music.youtube.com'),
}


def innertube(endpoint, cname, body, visitor=None, origin=None):
    c = CLIENTS[cname]
    client = dict(clientName=cname, clientVersion=c['v'], hl='en', gl='US', **c['x'])
    if visitor:
        client['visitorData'] = visitor
    data = json.dumps({'context': {'client': client}, **body}).encode()
    host = c.get('host', 'www.youtube.com')
    req = urllib.request.Request(f'https://{host}/youtubei/v1/{endpoint}?prettyPrint=false', data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', c['ua'])
    req.add_header('X-YouTube-Client-Name', str(c['id']))
    req.add_header('X-YouTube-Client-Version', c['v'])
    if visitor:
        req.add_header('X-Goog-Visitor-Id', visitor)
    if origin:
        req.add_header('Origin', origin)
    try:
        r = urllib.request.urlopen(req, timeout=20)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:  # network
        return 0, {'err': str(e)}


def full_fetch(url, clen):
    """Fetch the whole file in 512 KiB ranges on one connection; returns bytes received."""
    u = urllib.parse.urlparse(url)
    conn = http.client.HTTPSConnection(u.netloc, timeout=20)
    got, step = 0, 512 * 1024
    for start in range(0, clen, step):
        end = min(start + step, clen) - 1
        conn.request('GET', u.path + '?' + u.query, headers={'Range': f'bytes={start}-{end}', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://localhost/'})
        r = conn.getresponse()
        b = r.read()
        if r.status != 206:
            return got, r.status
        got += len(b)
    return got, 206


def main():
    rows, urls = [], {}
    st, vd_resp = innertube('browse', 'WEB_REMIX', {'browseId': 'FEmusic_home'})
    visitor = (vd_resp or {}).get('responseContext', {}).get('visitorData')
    print(f'visitorData from WEB_REMIX browse: {"yes" if visitor else "no"} (HTTP {st})')
    for vid in VIDEOS:
        for cname in ['IOS_PRODUCER', 'VISIONOS', 'ANDROID_VR', 'IOS', 'ANDROID']:
            for use_vd in (False, True):
                st, js = innertube('player', cname, {'videoId': vid, 'contentCheckOk': True, 'racyCheckOk': True}, visitor if use_vd else None)
                ps = (js or {}).get('playabilityStatus', {})
                fm = (js or {}).get('streamingData', {}).get('adaptiveFormats', [])
                aud = {f['itag']: f for f in fm if f.get('mimeType', '').startswith('audio') and 'url' in f}
                row = dict(video=vid, client=cname, visitor=use_vd, http=st, status=ps.get('status'), reason=(ps.get('reason') or '')[:40], itags=sorted(aud))
                f = aud.get(140) or aud.get(251)
                if f:
                    clen = int(f.get('contentLength') or 0)
                    got, last = full_fetch(f['url'], clen)
                    row.update(clen=clen, got=got, full=got == clen, last=last)
                    if got == clen and cname not in urls:
                        urls[cname] = dict(url=f['url'], mime=f['mimeType'], itag=f['itag'])
                rows.append(row)
                time.sleep(0.3)
    print('\n| video | client | visitorData | playability | audio itags (url) | full download |')
    print('|---|---|---|---|---|---|')
    for r in rows:
        full = '-' if 'clen' not in r else ('yes' if r['full'] else f"no: {r['got']}/{r['clen']} then HTTP {r['last']}")
        print(f"| {r['video']} | {r['client']} | {r['visitor']} | {r['http']} {r['status']} {r['reason']} | {r['itags']} | {full} |")

    meta = {}
    checks = [
        ('search songs', 'search', {'query': 'tum hi ho', 'params': 'EgWKAQIIAWoSEAQQAxAFEAkQChAVEA4QEBAR'}),
        ('home', 'browse', {'browseId': 'FEmusic_home'}),
        ('moods', 'browse', {'browseId': 'FEmusic_moods_and_genres'}),
        ('charts', 'browse', {'browseId': 'FEmusic_charts'}),
        ('next/radio', 'next', {'videoId': 'fsiPzT50ZiM', 'playlistId': 'RDAMVMfsiPzT50ZiM', 'isAudioOnly': True}),
        ('suggestions', 'music/get_search_suggestions', {'input': 'arij'}),
    ]
    print('\n| metadata (WEB_REMIX) | no Origin | Origin https://localhost |')
    print('|---|---|---|')
    for name, ep, body in checks:
        a, ja = innertube(ep, 'WEB_REMIX', body)
        b, _ = innertube(ep, 'WEB_REMIX', body, origin='https://localhost')
        meta[name] = [a, b, len(json.dumps(ja or {}))]
        print(f'| {name} | {a} ({meta[name][2]} B) | {b} |')

    gw = {}
    for name, url in [('gateway /v1/music/search', f'{GATEWAY}/v1/music/search?q=tum%20hi%20ho'),
                      ('gateway /v1/music/home', f'{GATEWAY}/v1/music/home'),
                      ('gateway /v1/proxy YTM html', f'{GATEWAY}/v1/proxy?referer=https%3A%2F%2Fmusic.youtube.com%2F&url=' + urllib.parse.quote('https://music.youtube.com/search?q=tum+hi+ho', safe=''))]:
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ytm-probe'}), timeout=25)
            body = r.read()
            gw[name] = f'{r.status} {len(body)} B' + (' initialData' if b'initialData.push' in body else '')
        except urllib.error.HTTPError as e:
            gw[name] = f'HTTP {e.code}'
        except Exception as e:
            gw[name] = 'ERR ' + str(e)[:60]
        print(f'{name}: {gw[name]}')

    json.dump(dict(rows=rows, meta=meta, gateway=gw), open('probe.json', 'w'), indent=1)
    json.dump(urls, open('urls.json', 'w'))
    print('\nclients with a fully downloadable URL from this runner:', sorted(urls) or 'NONE')


if __name__ == '__main__':
    sys.exit(main())
