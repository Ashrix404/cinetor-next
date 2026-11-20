import { GATEWAY_BASE } from './config';
import { timeoutSignal } from './embeds';

/** [short, name, hue, number, category, streamUrl, nativeOnly?]
 * Category is one of the TV genres the UI lists (catalog GEN.tv), otherwise the channel is never shown.
 * `nativeOnly` = the CDN only allows its own origin (CORS) and redirects per session, so it plays in a
 * native HLS <video> (APK, Safari) but not through hls.js / the proxy. */
export type Channel = [string, string, number, string, string, string, (1 | 0)?];

/** Every URL here was checked on 2026-11-20 (curl: playlist -> variant -> segment all 200/206 with
 * video/MP2T, plus the CI stream-probe in real Chrome). Dropped as dead: tsports.live (returns an HTML
 * page), somoynews.tv (HTML), NASA TV (variant 404), Channel S / ncare (segments 403), plain-http IP
 * streams (mixed content on https pages, refused by the gateway). */
export const LIVE: Channel[] = [
  ['RB', 'Red Bull TV', 340, '01', 'Sports', 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'],
  ['S5', 'Sport 5', 120, '02', 'Sports', 'https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5/live.livx/playlist.m3u8'],
  ['SG', 'Sport 5 Gold', 45, '03', 'Sports', 'https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5_gold/live.livx/playlist.m3u8'],
  ['DD', 'DD Sports', 20, '04', 'Sports', 'https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8'],
  ['CG', 'Cricket Gold', 95, '05', 'Sports', 'https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8'],
  ['FI', 'FIFA+', 200, '06', 'Sports', 'https://95cedebd.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/Vml6aW9fRklGQVBsdXNFbmdsaXNoX0hMUw/playlist.m3u8'],
  ['PG', 'PGA Tour', 150, '07', 'Sports', 'https://d11k1mnrgfposz.cloudfront.net/playlist.m3u8'],
  ['FS', 'Fox Sports News', 15, '08', 'Sports', 'https://skynewsau-live-premium.akamaized.net/hls/live/2105307/foxsportsnews/live_1080p.m3u8'],
  ['BC', 'BBC News HD', 210, '10', 'News', 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8'],
  ['DW', 'DW News English', 190, '11', 'News', 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'],
  ['AJ', 'Al Jazeera English', 35, '12', 'News', 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8'],
  ['AB', 'ABC News', 230, '13', 'News', 'https://abc-news-dmd-streams-1.akamaized.net/out/v1/701126012d044971b3fa89406a440133/index.m3u8'],
  ['BV', 'Bangla Vision', 140, '20', 'Regional', 'https://tvsen5.aynaott.com/banglavision/index.m3u8'],
  ['NT', 'NTV Bangla', 0, '21', 'Regional', 'https://tvsen5.aynaott.com/xV4jEKf3D9zc/index.m3u8'],
  ['NX', 'Nexus TV', 260, '22', 'Regional', 'https://tvsen6.aynaott.com/Epm7WrFa/index.m3u8'],
  ['DT', 'Deshi TV', 80, '23', 'Regional', 'https://deshitv.deshitv24.net/live/myStream/playlist.m3u8'],
  ['ET', 'Ekushey TV', 170, '24', 'Regional', 'https://ekusheyserver.com/etvlivesn.m3u8'],
  ['RT', 'Rajdhani TV', 300, '25', 'Regional', 'https://stream.shariarsuvo.com/hls5/rajdhanicable.m3u8'],
  ['AZ', 'Azan TV', 110, '26', 'Religion', 'https://dbcanada.sonarbanglatv.com/azantv/atv/index.m3u8'],
  ['FM', '24h Free Movies', 280, '30', 'Movies', 'https://d1j2u714xk898n.cloudfront.net/scheduler/scheduleMaster/145.m3u8'],
  ['CM', 'Classic Movies', 30, '31', 'Movies', 'https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8'],
  ['JM', 'Jalsha Movies', 330, '32', 'Movies', 'https://box.bbaria.net:8083/Jalsha_Movie/tracks-v1a1/mono.m3u8'],
  ['MA', 'MAX Anime', 270, '40', 'Kids', 'https://cdnlive.klicgo.net/maxanime/live/playlist.m3u8'],
  ['CN', 'Cartoon Network', 190, '41', 'Kids', 'https://vodzong.mjunoon.tv:8087/streamtest/cartoon-network-87/live/87H/chunks.m3u8'],
  ['AH', 'Anime x HIDIVE', 260, '42', 'Kids', 'https://jmp2.uk/plu-6793eaa4bc03978b9bc63db1.m3u8', 1],
  ['AV', 'Avatar Animation', 160, '43', 'Kids', 'https://jmp2.uk/plu-656df599c0fc8800089c75ab.m3u8', 1],
  ['3M', '30A Music', 300, '50', 'Music', 'https://30a-tv.com/music.m3u8'],
  ['DM', 'Deluxe Music', 320, '51', 'Music', 'https://sdn-global-live-streaming-packager-cache.3qsdn.com/13456/13456_264_live.m3u8'],
  ['BD', 'Best of Dance TV', 290, '52', 'Music', 'https://m1b2.worldcast.tv/dancetelevisionone/dancetelevisionone.m3u8'],
  ['B4', 'B4U Music', 350, '53', 'Music', 'https://amg00877-b4unew-amg00877c3-xiaomi-in-5474.playouts.now.amagi.tv/720p/index.m3u8'],
];

export const LIVE_ALL: Channel[] = [...LIVE];

export const channelsIn = (cat: string) => LIVE_ALL.filter((c) => cat === 'All' || c[4] === cat);

/** Known dead hosts the gateway's /v1/live still lists (it cannot be redeployed from here). */
const DEAD = /(^|\.)(tsports\.live|somoynews\.tv|ntv1\.akamaized\.net|ncare\.live)$/i;
const CAT: Record<string, string> = { Bangla: 'Regional', Science: 'Documentary', Anime: 'Kids', Animation: 'Kids' };

/** A gateway channel is usable when it is https (no mixed content), not a known-dead host and an HLS URL. */
export function usableChannelUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && !DEAD.test(x.hostname) && /\.m3u8(\?|$)/i.test(x.pathname + x.search);
  } catch {
    return false;
  }
}

/** True when a response body is a real HLS playlist (some "m3u8" URLs return an HTML page). */
export const isPlaylist = (text: string) => /^﻿?#EXTM3U/.test(text.trimStart());

/** Channel for a label: exact name/short match, else a channel of a matching category, else the first sports channel. */
export function pickChannel(label: string, list: Channel[] = LIVE_ALL): Channel | undefined {
  const l = (label || '').toLowerCase();
  const hit = list.find((c) => c[1].toLowerCase() === l || c[0].toLowerCase() === l);
  if (hit) return hit;
  const cat = /news|bulletin/.test(l) ? 'News' : /cinema|movie|film/.test(l) ? 'Movies' : /music|dance/.test(l) ? 'Music' : /nature|tidal|docu/.test(l) ? 'Documentary' : 'Sports';
  return list.find((c) => c[4] === cat) || list[0];
}

/** Merge extra gateway channels (deduplicated, dead hosts and http dropped) after the verified list. */
export function mergeGatewayChannels(base: Channel[], gw: { name?: string; url?: string; category?: string }[]): Channel[] {
  const out = [...base];
  const seen = new Set(base.map((c) => c[5]));
  for (const c of gw) {
    if (!c?.name || !c.url || seen.has(c.url) || !usableChannelUrl(c.url)) continue;
    seen.add(c.url);
    const i = out.length;
    out.push([c.name.slice(0, 2).toUpperCase(), c.name, (i * 37) % 360, String(i + 1).padStart(2, '0'), CAT[c.category || ''] || c.category || 'Entertainment', c.url]);
  }
  return out;
}

export async function syncLiveChannelsFromGateway(): Promise<Channel[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/v1/live`, { signal: timeoutSignal(3000) });
    if (!res.ok) return LIVE_ALL;
    const data: { channels?: { name?: string; url?: string; category?: string }[] } = await res.json();
    const merged = mergeGatewayChannels(LIVE, data?.channels || []);
    LIVE_ALL.length = 0;
    LIVE_ALL.push(...merged);
  } catch {
    /* keep the verified list */
  }
  return LIVE_ALL;
}
