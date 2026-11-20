#!/usr/bin/env python3
"""Writes live.json for the probe: every candidate channel x (direct hls.js, proxied hls.js, native <video>)."""
import json

# initial candidate list (the live.json in git is generated from src/core/live.ts)
C = [
    ("T Sports (old)", "https://tsports.live/live.m3u8"),
    ("Somoy TV (old)", "https://somoynews.tv/live/somoytv.m3u8"),
    ("NASA TV (old)", "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8"),
    ("Red Bull TV", "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8"),
    ("Sport 5", "https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5/live.livx/playlist.m3u8"),
    ("Sport 5 Gold", "https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5_gold/live.livx/playlist.m3u8"),
    ("Eurosport 1", "https://r.eu.cdn-redge.media/livehls/oeu/mt/live/eurosport_1/live.livx/playlist.m3u8"),
    ("DD Sports", "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8"),
    ("Cricket Gold", "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8"),
    ("FIFA+", "https://95cedebd.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/Vml6aW9fRklGQVBsdXNFbmdsaXNoX0hMUw/playlist.m3u8"),
    ("beIN SPORTS XTRA", "https://bein-xtra-bein.amagi.tv/playlist.m3u8"),
    ("PGA Tour", "https://d11k1mnrgfposz.cloudfront.net/playlist.m3u8"),
    ("Fox Sports News", "https://skynewsau-live-premium.akamaized.net/hls/live/2105307/foxsportsnews/live_1080p.m3u8"),
    ("BBC News", "https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8"),
    ("DW News", "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8"),
    ("Al Jazeera English", "https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8"),
    ("ABC News", "https://abc-news-dmd-streams-1.akamaized.net/out/v1/701126012d044971b3fa89406a440133/index.m3u8"),
    ("CNN International", "https://d3bp6dwmpbdajl.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-ury0meh5m4nzm/index.m3u8"),
    ("Bangla Vision", "https://tvsen5.aynaott.com/banglavision/index.m3u8"),
    ("NTV", "https://tvsen5.aynaott.com/xV4jEKf3D9zc/index.m3u8"),
    ("Nexus TV", "https://tvsen6.aynaott.com/Epm7WrFa/index.m3u8"),
    ("Deshi TV", "https://deshitv.deshitv24.net/live/myStream/playlist.m3u8"),
    ("Ekushey TV", "https://ekusheyserver.com/etvlivesn.m3u8"),
    ("Rajdhani TV", "https://stream.shariarsuvo.com/hls5/rajdhanicable.m3u8"),
    ("Azan TV", "https://dbcanada.sonarbanglatv.com/azantv/atv/index.m3u8"),
    ("24h Free Movies", "https://d1j2u714xk898n.cloudfront.net/scheduler/scheduleMaster/145.m3u8"),
    ("30A Classic Movies", "https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8"),
    ("Jalsha Movies", "https://box.bbaria.net:8083/Jalsha_Movie/tracks-v1a1/mono.m3u8"),
    ("MAX Anime", "https://cdnlive.klicgo.net/maxanime/live/playlist.m3u8"),
    ("Cartoon Network PK", "https://vodzong.mjunoon.tv:8087/streamtest/cartoon-network-87/live/87H/chunks.m3u8"),
    ("MeTV Toons", "https://sr-live-weigel1.akamaized.net/out/v1/0d1dbf29e64e47bc991796cc24fbeb97/index_2.m3u8"),
    ("Anime x HIDIVE", "https://jmp2.uk/plu-6793eaa4bc03978b9bc63db1.m3u8"),
    ("30A Music", "https://30a-tv.com/music.m3u8"),
    ("Deluxe Music", "https://sdn-global-live-streaming-packager-cache.3qsdn.com/13456/13456_264_live.m3u8"),
    ("Best of Dance TV", "https://m1b2.worldcast.tv/dancetelevisionone/dancetelevisionone.m3u8"),
    ("B4U Music", "https://amg00877-b4unew-amg00877c3-xiaomi-in-5474.playouts.now.amagi.tv/720p/index.m3u8"),
    ("California Music Channel", "https://cmc-cmctv-cineverse.amagi.tv/playlist.m3u8"),
]
rows = [[n, u, via] for n, u in C for via in ("direct", "proxy", "native")]
json.dump(rows, open(__file__.replace("channels.py", "live.json"), "w"), indent=0)
print(len(rows))
