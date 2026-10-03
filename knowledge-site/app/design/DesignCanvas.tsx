import { useId, useRef, useState } from 'react';
import { analyzeDesign, type DesignProject } from './design-engine';

export type Selection = string | 'source' | 'screen';
const bounded = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function DesignCanvas({ project, selected, select, commit, addPart }: { project: DesignProject; selected: Selection; select: (s: Selection) => void; commit: (p: DesignProject) => void; addPart: (sku: string, z?: number, y?: number) => void }) {
  const result = analyzeDesign(project);
  const uid = `design-${useId().replaceAll(':', '')}`;
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [showRays, setShowRays] = useState(true);
  const [preview, setPreview] = useState<DesignProject | null>(null);
  const [frozenRange, setFrozenRange] = useState<number | null>(null);
  const drag = useRef<{ id: string; start: { z: number; y: number }; origin: { z: number; y: number }; project: DesignProject; range: number } | null>(null);
  const p = preview ?? project;
  const live = preview ? analyzeDesign(preview) : result;
  const autoRange = Math.max(8, p.source.diameter, p.screenAperture / 2, ...p.elements.map(e => Math.abs(e.y) + e.diameter / 2), ...live.rays.flatMap(r => r.points.map(p => Math.abs(p.y))), ...(live.gaussian?.samples.map(s => Math.abs(s.center) + 2 * s.w) ?? [])) * 1.12;
  const range = frozenRange ?? autoRange;
  const x = (z: number) => 64 + z / p.screen * 1020;
  const y = (height: number) => 215 - height / range * 155;
  const rawPosition = (clientX: number, clientY: number) => {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { z: (point.x - 64) / 1020 * p.screen, y: (215 - point.y) / 155 * range };
  };
  const placedPosition = (at: { z: number; y: number }) => ({ z: bounded(snap ? Math.round(at.z / 5) * 5 : Math.round(at.z * 10) / 10, 1, p.screen - 1), y: bounded(Math.round(at.y * 10) / 10, -50, 50) });
  const stopDrag = (cancel = false) => { if (preview && !cancel) commit(preview); setPreview(null); setFrozenRange(null); drag.current = null; };
  const handleKey = (key: string, id: string) => {
    const e = p.elements.find(el => el.id === id)!;
    if (key === 'Enter' || key === ' ') select(id);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      select(id); const at = placedPosition({ z: e.z + (key === 'ArrowRight' ? 5 : key === 'ArrowLeft' ? -5 : 0), y: e.y + (key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0) });
      commit({ ...project, elements: project.elements.map(el => el.id === id ? { ...el, ...at } : el) });
    }
  };
  const gaussian = live.gaussian;
  const envelope = gaussian?.samples ?? [];
  const outline = (factor: number) => [...envelope.map(s => `${x(s.z)},${y(s.center + factor * s.w)}`), ...[...envelope].reverse().map(s => `${x(s.z)},${y(s.center - factor * s.w)}`)].join(' ');
  return <section className="od-layout" aria-label="光路布局">
    <div className="od-canvas-tools"><div><strong>光路布局</strong><span>+z 顺序传播 · mm</span></div><div><label><input type="checkbox" checked={showRays} onChange={e => setShowRays(e.target.checked)} />光线</label><label><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />5 mm 吸附</label><button aria-label="缩小光路" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom - .5))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="放大光路" disabled={zoom === 3} onClick={() => setZoom(Math.min(3, zoom + .5))}>＋</button><button onClick={() => setZoom(1)}>适应</button></div></div>
    <div className="od-canvas-scroll" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const text = e.dataTransfer.getData('text/plain'); if (text.startsWith('optics:')) { const at = placedPosition(rawPosition(e.clientX, e.clientY)); addPart(text.slice(7), at.z, at.y); } }}>
      <svg ref={svg} id="od-layout-svg" viewBox="0 0 1150 420" style={{ width: `${zoom * 100}%`, minWidth: zoom > 1 ? 850 * zoom : undefined }} className="od-layout-svg" role="group" aria-label="可拖动元件的光路图" onPointerMove={e => { const d = drag.current; if (!d) return; const at = rawPosition(e.clientX, e.clientY); const location = placedPosition({ z: d.origin.z + at.z - d.start.z, y: d.origin.y + at.y - d.start.y }); setPreview({ ...d.project, elements: d.project.elements.map(el => el.id === d.id ? { ...el, ...location } : el) }); }} onPointerUp={() => stopDrag()} onPointerCancel={() => stopDrag(true)}>
        <defs><pattern id={`${uid}-grid`} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#dce6ee" strokeWidth=".6" /></pattern><clipPath id={`${uid}-clip`}><rect x="30" y="44" width="1088" height="334" /></clipPath></defs>
        <rect width="1150" height="420" fill="#fbfdff" /><rect x="25" y="44" width="1095" height="331" fill={`url(#${uid}-grid)`} /><path d="M45 215H1108" stroke="#9caebd" strokeDasharray="6 6" />
        <text x="35" y="28" fill="#6c859a" fontSize="13">y = 0</text><text x="1112" y="28" textAnchor="end" fill="#6c859a" fontSize="13">纵向 ±{range.toFixed(1)} mm · 横纵独立比例</text>
        <g clipPath={`url(#${uid}-clip)`}>{gaussian && <><polygon points={outline(2)} fill="#326fe908" stroke="#5789cc" strokeDasharray="5 5" /><polygon points={outline(1)} fill="#397cf217" stroke="#386ec5" strokeWidth="1.6" /></>}{showRays && live.rays.map((ray, i) => <polyline key={i} points={ray.points.map(point => `${x(point.z)},${y(point.y)}`).join(' ')} fill="none" stroke={ray.blocked ? '#d36643' : p.source.mode === 'gaussian' ? '#6d9fbe' : '#d99335'} strokeWidth="1.2" opacity={ray.blocked ? .7 : .55} />)}{live.rays.filter(ray => ray.blocked).map((ray, i) => { const point = ray.points.at(-1)!; return <path key={i} d={`M${x(point.z) - 3} ${y(point.y) - 3}l6 6m0 -6l-6 6`} stroke="#cf603a" strokeWidth="1.8" />; })}</g>
        <g role="button" tabIndex={0} aria-label="编辑入射光源" aria-pressed={selected === 'source'} onClick={() => select('source')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select('source'); } }} className="od-svg-select"><rect x="38" y="72" width="38" height="272" rx="8" fill={selected === 'source' ? '#2b71cf0c' : 'transparent'} stroke={selected === 'source' ? '#326fc4' : 'transparent'} /><path d={`M64 ${y(p.source.offset + (gaussian?.sourceDiameter ?? p.source.diameter) / 2)}V${y(p.source.offset - (gaussian?.sourceDiameter ?? p.source.diameter) / 2)}`} stroke="#30475f" strokeWidth="6" /><text x="64" y="61" textAnchor="middle" fill="#30475f" fontSize="14">源</text></g>
        {[...p.elements].sort((a, b) => a.z - b.z).map((el, i) => { const px = x(el.z); const top = y(el.y + el.diameter / 2); const bottom = y(el.y - el.diameter / 2); const middle = y(el.y); return <g key={el.id} role="button" tabIndex={0} aria-label={`选择 ${el.name}`} aria-pressed={selected === el.id} className="od-svg-optic" onPointerDown={e => { e.preventDefault(); select(el.id); drag.current = { id: el.id, project, origin: { z: el.z, y: el.y }, start: rawPosition(e.clientX, e.clientY), range }; setFrozenRange(range); e.currentTarget.setPointerCapture(e.pointerId); }} onClick={() => select(el.id)} onKeyDown={e => { if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); handleKey(e.key, el.id); } }}>
          <rect x={px - 17} y="74" width="34" height="275" rx="8" fill={selected === el.id ? '#2b71cf10' : 'transparent'} stroke={selected === el.id ? '#2366bc' : 'transparent'} strokeDasharray="4 4" />
          {el.objective ? <path d={`M${px - 13} ${top}H${px + 8}V${y(el.y + el.aperture / 2)}H${px + 13}V${y(el.y - el.aperture / 2)}H${px + 8}V${bottom}H${px - 13}Z`} fill="#e2eee7" stroke={selected === el.id ? '#245db4' : '#438399'} strokeWidth="2" /> : el.kind === 'lens' ? <path d={el.focal > 0 ? `M${px} ${top}Q${px - 14} ${middle} ${px} ${bottom}Q${px + 14} ${middle} ${px} ${top}Z` : `M${px - 8} ${top}Q${px + 2} ${middle} ${px - 8} ${bottom}H${px + 8}Q${px - 2} ${middle} ${px + 8} ${top}Z`} fill="#76b7cd28" stroke={selected === el.id ? '#245db4' : '#438399'} strokeWidth="2" /> : <path d={`M${px} ${top}V${y(el.y + el.aperture / 2)}M${px} ${y(el.y - el.aperture / 2)}V${bottom}`} stroke="#6e7986" strokeWidth="7" />}
          <path d={`M${px - 7} ${y(el.y + el.aperture / 2)}h14M${px - 7} ${y(el.y - el.aperture / 2)}h14`} stroke="#c28b49" strokeWidth="2" /><text x={px} y={i % 2 === 0 ? 66 : 88} textAnchor="middle" fill="#304c66" fontSize="13">{el.objective ? 'O' : el.kind === 'lens' ? 'L' : 'A'}{i + 1}{el.kind === 'lens' ? ` · ${el.focal > 0 ? '+' : ''}${el.focal}` : ''}</text><text x={px} y={i % 2 === 0 ? 358 : 374} textAnchor="middle" fill="#617f96" fontSize="12">{el.z.toFixed(1)}</text>
        </g>; })}
        <g role="button" tabIndex={0} aria-label="编辑目标面" aria-pressed={selected === 'screen'} onClick={() => select('screen')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select('screen'); } }} className="od-svg-select"><rect x="1070" y="72" width="28" height="280" rx="8" fill={selected === 'screen' ? '#2b71cf10' : 'transparent'} /><path d={p.screenAperture > 0 ? `M1084 78V${y(p.screenAperture / 2)}M1084 ${y(-p.screenAperture / 2)}V348` : 'M1084 78V348'} stroke="#647c91" strokeWidth={p.screenAperture > 0 ? 7 : 3} />{p.screenAperture > 0 && <path d={`M1076 ${y(p.screenAperture / 2)}h16M1076 ${y(-p.screenAperture / 2)}h16`} stroke="#c28b49" strokeWidth="2" />}<text x="1084" y="61" textAnchor="middle" fill="#30475f" fontSize="14">D1 · 目标面{p.screenAperture > 0 ? ` Ø${p.screenAperture}` : ''}</text></g>
        {live.bestFocus && live.bestFocus.afterLastElement && live.bestFocus.z > 0 && live.bestFocus.z <= p.screen && <path d={`M${x(live.bestFocus.z)} 115V325`} stroke="#bc8b46" strokeDasharray="4 6" />}
        {gaussian?.waist.afterLastElement && gaussian.waist.z > 0 && gaussian.waist.z <= p.screen && <g><path d={`M${x(gaussian.waist.z)} 110V326`} stroke="#5571b5" strokeDasharray="3 5" /><text x={x(gaussian.waist.z)} y="103" textAnchor="middle" fontSize="12" fill="#5571b5">束腰</text></g>}
        {Array.from({ length: 6 }, (_, i) => <g key={i}><path d={`M${x(p.screen * i / 5)} 385v6`} stroke="#7c94a8" /><text x={x(p.screen * i / 5)} y="410" textAnchor="middle" fontSize="13" fill="#627d95">{Math.round(p.screen * i / 5)}</text></g>)}
      </svg>
    </div>
    <div className="od-canvas-caption"><span><i className="od-key-ray" />几何采样光线{gaussian && <><i className="od-key-gaussian" />Gaussian 1/e² 包络 · 虚线 2w</>}</span><span>拖动位置与高度 · 方向键微调</span></div>
  </section>;
}
