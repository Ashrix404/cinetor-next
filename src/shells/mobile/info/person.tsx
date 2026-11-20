// Person page (prototype V.person): photo, department, bio, Movies / Series segments.
import { loadPerson } from '../../../core/details';
import { img } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { BackTop, Empty, ErrorCard, Poster } from '../ui/common';
import { useAsync } from '../ui/hooks';
import { opt, param, setOpt } from '../state';

export function Person() {
  const id = param<number>('id')!, name = param<string>('name') || '';
  const r = useAsync(() => loadPerson(id), String(id));
  const pr = r.data, seg = opt('pseg') || 'Movies';
  const list = pr ? (seg === 'Movies' ? pr.movies : pr.series) : [];
  return (
    <>
      <BackTop t="" />
      <div class="scroll">
        <div class="phd">
          <u style={pr?.photo ? `background:url(${img(pr.photo, 'w185')}) center/cover` : ''}>{pr?.photo ? '' : (name || '?')[0]}</u>
          <div><b>{pr?.name || name}</b><small>{pr ? (pr.dept ? pr.dept + ' · ' : '') + pr.movies.length + ' movies · ' + pr.series.length + ' series' : 'Loading…'}</small></div>
        </div>
        {pr?.bio && <div class="body-s" style="padding:0 16px 8px;max-height:64px;overflow:hidden">{pr.bio.slice(0, 220)}…</div>}
        <div class="seg2" style="margin:8px 16px">
          {['Movies', 'Series'].map((x) => (
            <span key={x} class={x === seg ? 'on' : ''} onClick={() => setOpt('pseg', x)}><I n={x === 'Movies' ? 'movie-open-outline' : 'television-play'} /> {x} {pr && '(' + (x === 'Movies' ? pr.movies.length : pr.series.length) + ')'}</span>
          ))}
        </div>
        {r.error != null && !pr && <ErrorCard error={r.error} retry={r.retry} />}
        {list.length ? <div class="pgrid">{list.slice(0, 30).map((t) => <Poster key={t.id} t={t} />)}</div> : <Empty h={260} d={!pr ? 'Loading…' : 'No ' + seg.toLowerCase() + ' found'} />}
      </div>
    </>
  );
}
