import type { FoldedDetector } from '../design/core/folded-engine';

/** Actual detector intersections, with equal u/v scale; never a synthetic PSF. */
export function TeachingSpot({ detector, diameter }: { detector: FoldedDetector; diameter: number }) {
  const { spot } = detector;
  const extent = Math.max(diameter * .65, ...spot.hits.map(hit => Math.max(Math.abs(hit.u), Math.abs(hit.v)) * 1.1));
  const project = (v: number) => v / extent * 86;
  const format = (v: number | null) => v === null ? '—' : v.toFixed(3);
  return <figure className="lj-spot" data-rms-u={spot.rmsU ?? ''} data-rms-v={spot.rmsV ?? ''}>
    <figcaption>接收屏上的光线落点</figcaption>
    <svg viewBox="0 0 240 234" role="img" aria-label={`二维几何落点图，接收 ${spot.hits.length} 条光线，u 和 v 使用相同比例`}>
      <rect x="24" y="16" width="192" height="192" fill="#fafbf8" stroke="#dce5db" />
      <path d="M24 112H216M120 16V208" stroke="#cbd8d0" strokeDasharray="3 3" />
      {spot.hits.map((hit, index) => <circle key={index} cx={120 + project(hit.u)} cy={112 - project(hit.v)} r="1.5" fill="#326e99" opacity=".65" />)}
      <text x="212" y="108" textAnchor="end">u</text><text x="125" y="28">v</text>
      <text x="24" y="226">−{extent.toFixed(1)}</text><text x="216" y="226" textAnchor="end">+{extent.toFixed(1)} mm</text>
      {!spot.hits.length && <text x="120" y="90" textAnchor="middle">接收屏未收到光线</text>}
    </svg>
    <p aria-live="polite"><span>RMS u {format(spot.rmsU)} mm</span><span>RMS v {format(spot.rmsV)} mm</span></p>
    <small>点为实际追迹的落点，宽度为相对质心的 RMS；理想焦线或焦点不含衍射宽度。</small>
  </figure>;
}
