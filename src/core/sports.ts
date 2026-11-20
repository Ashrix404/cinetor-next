// Mock sports data, ported as-is from the prototype (SPORT, HILITES, FLAGS, TEAMS, spCounts, upSoon).
export interface Match { id: number; sport: string; league: string; a: string; b: string; st: 'live' | 'up' | 'hl'; el?: number; time?: string; date?: string; hrs?: number }

export const SPORT: Match[] = [
  { id: 1, sport: 'Cricket', league: 'Asia Cup Rising Stars', a: 'Pakistan A', b: 'UAE', st: 'live', el: 3053 },
  { id: 2, sport: 'Cricket', league: 'ICC World Test Championship', a: 'Pakistan', b: 'Sri Lanka', st: 'live', el: 8447 },
  { id: 3, sport: 'Cricket', league: 'ICC World Test Championship', a: 'New Zealand', b: 'India', st: 'live', el: 31847 },
  { id: 4, sport: 'Motorsports', league: 'Formula 1', a: 'Formula 1', b: 'Formula 1', st: 'live', el: 22847 },
  { id: 5, sport: 'Basketball', league: 'NBA', a: 'Memphis Grizzlies', b: 'Golden State Warriors', st: 'live', el: 21799 },
  { id: 6, sport: 'Basketball', league: 'NBA', a: 'Milwaukee Bucks', b: 'Portland Trail Blazers', st: 'live', el: 21799 },
  { id: 7, sport: 'Basketball', league: 'NBA', a: 'Minnesota Timberwolves', b: 'New York Knicks', st: 'live', el: 21799 },
  { id: 8, sport: 'Basketball', league: 'NBA', a: 'San Antonio Spurs', b: 'Los Angeles Clippers', st: 'live', el: 21799 },
  { id: 9, sport: 'Football', league: 'International Friendly', a: 'Portugal', b: 'Poland', st: 'live', el: 3130 },
  { id: 10, sport: 'Cricket', league: 'Asia Cup Rising Stars', a: 'India A', b: 'Nepal A', st: 'up', time: '04:00 PM', date: '20/11/2026', hrs: 3.2 },
  { id: 11, sport: 'Cricket', league: 'One Day International', a: 'Australia', b: 'England', st: 'up', time: '02:15 PM', date: '21/11/2026', hrs: 25.4 },
  { id: 12, sport: 'Cricket', league: 'ICC World Test Championship', a: 'South Africa', b: 'Bangladesh', st: 'up', time: '02:00 PM', date: '23/11/2026', hrs: 73.2 },
  { id: 13, sport: 'Cricket', league: 'Nepal Premier League, 2026', a: 'NPL', b: 'NPL', st: 'up', time: '05:15 PM', date: '21/11/2026', hrs: 28.4 },
  { id: 14, sport: 'Cricket', league: 'Abu Dhabi T10 League, 2026', a: 'Abu Dhabi T10', b: 'Abu Dhabi T10', st: 'up', time: '07:30 PM', date: '20/11/2026', hrs: 6.7 },
  { id: 15, sport: 'Cricket', league: 'T20 International', a: 'India', b: 'South Africa', st: 'up', time: '07:00 PM', date: '22/11/2026', hrs: 54.2 },
  { id: 16, sport: 'WWE', league: 'Friday Night SmackDown', a: 'Friday Night SmackDown', b: 'Friday Night SmackDown', st: 'up', time: '06:00 AM', date: '21/11/2026', hrs: 17.2 },
  { id: 17, sport: 'WWE', league: 'Monday Night Raw', a: 'Monday Night Raw', b: 'Monday Night Raw', st: 'up', time: '06:00 AM', date: '24/11/2026', hrs: 89.2 },
  { id: 18, sport: 'Motorsports', league: 'MotoGP', a: 'MotoGP', b: 'MotoGP', st: 'up', time: '04:45 PM', date: '20/11/2026', hrs: 3.9 },
];

export const HILITES: Match[] = ([['Spain', 'England'], ['France', 'Türkiye'], ['Belgium', 'Italy'], ['Croatia', 'Czechia']] as const).map(([a, b], i) => ({
  id: 100 + i, sport: 'Football', league: 'UEFA Nations League', a, b, st: 'hl' as const, date: '16/11/2026',
}));

export const SPORTS = ['All', 'Basketball', 'Cricket', 'Motorsports', 'WWE', 'Football'];
export const SP_TABS = ['Recent', 'Live', 'Upcoming', 'All', 'Highlights'] as const;
export type SpTab = (typeof SP_TABS)[number];
export const SPICON: Record<string, string> = { Cricket: 'cricket', Basketball: 'basketball', Motorsports: 'racing-helmet', WWE: 'boxing-glove', Football: 'soccer' };

export const FLAGS: Record<string, string> = {
  Pakistan: 'linear-gradient(90deg,#fff 0 26%,#01411C 26%)', 'Pakistan A': 'linear-gradient(90deg,#fff 0 26%,#01411C 26%)',
  UAE: 'linear-gradient(90deg,#d62828 0 28%,transparent 28%),linear-gradient(#00732f 0 33.3%,#fff 33.3% 66.6%,#000 66.6%)',
  India: 'radial-gradient(circle,#000080 0 9%,transparent 10%),linear-gradient(#ff9933 0 33.3%,#fff 33.3% 66.6%,#138808 66.6%)', 'India A': 'radial-gradient(circle,#000080 0 9%,transparent 10%),linear-gradient(#ff9933 0 33.3%,#fff 33.3% 66.6%,#138808 66.6%)',
  'Nepal A': 'linear-gradient(135deg,#003893 0 7%,#dc143c 7%)',
  Australia: 'radial-gradient(circle at 26% 28%,#fff 0 12%,transparent 13%),#012169',
  England: 'linear-gradient(90deg,transparent 44%,#cf142b 44% 56%,transparent 56%),linear-gradient(transparent 44%,#cf142b 44% 56%,transparent 56%),#fff',
  'South Africa': 'linear-gradient(135deg,#007a4d 0 34%,#ffb612 34% 41%,#000 41% 50%,transparent 50%),linear-gradient(#de3831 0 50%,#002395 50%)',
  Bangladesh: 'radial-gradient(circle at 45% 50%,#f42a41 0 31%,transparent 32%),#006a4e',
  'Sri Lanka': 'linear-gradient(90deg,#ffbe29 0 14%,#00534e 14% 28%,#8d153a 28%)',
  'New Zealand': 'radial-gradient(circle at 70% 38%,#cc142b 0 6%,transparent 7%),radial-gradient(circle at 80% 62%,#cc142b 0 6%,transparent 7%),radial-gradient(circle at 62% 68%,#cc142b 0 6%,transparent 7%),#00247d',
  Spain: 'linear-gradient(#aa151b 0 25%,#f1bf00 25% 75%,#aa151b 75%)',
  France: 'linear-gradient(90deg,#0055a4 0 33.3%,#fff 33.3% 66.6%,#ef4135 66.6%)',
  Türkiye: 'radial-gradient(circle at 42% 50%,#fff 0 19%,transparent 20%),#e30a17',
  Belgium: 'linear-gradient(90deg,#000 0 33.3%,#fae042 33.3% 66.6%,#ed2939 66.6%)',
  Italy: 'linear-gradient(90deg,#009246 0 33.3%,#fff 33.3% 66.6%,#ce2b37 66.6%)',
  Croatia: 'linear-gradient(#ff0000 0 33.3%,#fff 33.3% 66.6%,#171796 66.6%)',
  Czechia: 'linear-gradient(135deg,#11457e 0 42%,transparent 42%),linear-gradient(#fff 0 50%,#d7141a 50%)',
  Portugal: 'linear-gradient(90deg,#006600 0 40%,#ff0000 40%)', Poland: 'linear-gradient(#fff 0 50%,#dc143c 50%)',
};
/** [short, hue, variant] — variant 1 = dark, 2 = F1, 3 = MotoGP. */
export const TEAMS: Record<string, [string, number, number?]> = {
  'Memphis Grizzlies': ['MEM', 215], 'Golden State Warriors': ['GSW', 48], 'Milwaukee Bucks': ['MIL', 140], 'Portland Trail Blazers': ['POR', 0],
  'Minnesota Timberwolves': ['MIN', 205], 'New York Knicks': ['NYK', 25], 'San Antonio Spurs': ['SAS', 0, 1], 'Los Angeles Clippers': ['LAC', 350],
  'Formula 1': ['F1', 0, 2], MotoGP: ['GP', 0, 3], 'Abu Dhabi T10': ['T10', 28], NPL: ['NPL', 8], 'Friday Night SmackDown': ['SD', 212], 'Monday Night Raw': ['RAW', 0],
};

export const hashS = (str: string) => [...str].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
export const inSport = (sp: string) => SPORT.filter((m) => sp === 'All' || m.sport === sp);
export const upSoon = (m: Match) => m.st === 'up' && (m.hrs ?? Infinity) < 24;

export function spCounts(sp: string): Record<SpTab, number> {
  const l = inSport(sp);
  return {
    Recent: l.filter((m) => m.st === 'live').length,
    Live: l.filter((m) => m.st === 'live').length,
    Upcoming: l.filter(upSoon).length,
    All: l.length,
    Highlights: HILITES.filter((m) => sp === 'All' || m.sport === sp).length,
  };
}

/** Matches for a sport + tab (prototype V.sports list logic). */
export function matchesFor(sp: string, tab: SpTab): Match[] {
  if (tab === 'Highlights') return HILITES.filter((m) => sp === 'All' || m.sport === sp);
  const l = inSport(sp);
  if (tab === 'Recent' || tab === 'Live') return l.filter((m) => m.st === 'live');
  if (tab === 'Upcoming') return l.filter(upSoon);
  return l;
}

/** Crest: flag gradient, or initials + hue (prototype `crest`). */
export function crestOf(n: string): { flag: string } | { short: string; hue: number; variant: number } {
  const f = FLAGS[n];
  if (f) return { flag: f };
  const t = TEAMS[n] || [n.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase(), hashS(n) % 360];
  return { short: t[0], hue: t[1], variant: t[2] || 0 };
}

export const fmtHMS = (x: number) => {
  const v = Math.max(0, Math.floor(x));
  return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60].map((n) => String(n).padStart(2, '0')).join(':');
};
