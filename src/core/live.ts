import { GATEWAY_BASE } from './config';

/** [short, name, hue, number, category, streamUrl] */
export type Channel = [string, string, number, string, string, string];

export const LIVE: Channel[] = [
  ['TS', 'T Sports Live', 10, '01', 'Sports', 'https://tsports.live/live.m3u8'],
  ['RB', 'Red Bull TV Sports', 340, '02', 'Sports', 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'],
  ['S5', 'Sport 5 Gold HD', 45, '03', 'Sports', 'https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5_gold/live.livx/playlist.m3u8'],
  ['SL', 'Sport 5 Live HD', 120, '04', 'Sports', 'https://r.il.cdn-redge.media/livehls/oil/freetv/live/sport_5_live/live.livx/playlist.m3u8'],
  ['SM', 'Somoy TV HD', 0, '10', 'News', 'https://somoynews.tv/live/somoytv.m3u8'],
  ['BC', 'BBC News HD', 210, '11', 'News', 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8'],
  ['DW', 'DW News English', 190, '12', 'News', 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'],
  ['NA', 'NASA TV HD', 220, '20', 'Science', 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8'],
  ['CS', 'Channel S Bangla', 140, '30', 'Bangla', 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI/amarbanglatv.stream/playlist.m3u8'],
  ['FM', '24h Free Movies', 280, '40', 'Movies', 'https://d1j2u714xk898n.cloudfront.net/scheduler/scheduleMaster/145.m3u8'],
  ['CM', 'Classic Movies', 30, '41', 'Movies', 'https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8'],
  ['AH', 'Anime x HIDIVE', 260, '50', 'Anime', 'https://jmp2.uk/plu-6793eaa4bc03978b9bc63db1.m3u8'],
  ['AV', 'Avatar Animation', 160, '51', 'Animation', 'https://jmp2.uk/plu-656df599c0fc8800089c75ab.m3u8'],
  ['1M', '1HD Music TV', 300, '60', 'Music', 'http://176.118.197.101/1HD/index.m3u8'],
  ['4D', '4 Fun Dance Music', 320, '61', 'Music', 'http://92.114.85.87:8018/play/a00k/index.m3u8']
];

export const LIVE_ALL: Channel[] = [...LIVE];

export const channelsIn = (cat: string) => LIVE_ALL.filter((c) => cat === 'All' || c[4] === cat);

export async function syncLiveChannelsFromGateway(): Promise<Channel[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/v1/live`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return LIVE_ALL;
    const data: any = await res.json();
    const channels = data?.channels || [];
    if (channels.length > 0) {
      LIVE_ALL.length = 0;
      for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        const short = c.name.slice(0, 2).toUpperCase();
        const hue = (i * 37) % 360;
        const num = String(i + 1).padStart(2, '0');
        LIVE_ALL.push([short, c.name, hue, num, c.category || 'General', c.url]);
      }
    }
  } catch {}
  return LIVE_ALL;
}
