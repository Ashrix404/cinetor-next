import { MDI } from '../../../assets/mdi';
import { MARK, SVP } from '../../../assets/svp';

/** MDI icon (prototype `I(name)`): <i class="mi"><svg/></i>. */
export function I({ n }: { n: string }) {
  return (
    <i class="mi" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={MDI[n] || ''} />
      </svg>
    </i>
  );
}

/** Custom stroke icon (prototype `SV(name)`), or the C-mark for `mark`. */
export function SV({ n }: { n: string }) {
  if (n === 'mark') return <svg class="svm" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MARK }} />;
  return <svg class="svi" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SVP[n] || '' }} />;
}
