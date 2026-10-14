import { useEffect, useId, useRef, useState } from 'react';
import type { FoldedAnalysis, FoldedElement, FoldedScene } from './core/folded-engine';
import { foldedLabels } from './folded-labels';
import { ObjectiveInfo } from './ObjectiveInfo';
import { OpticsIcon } from './OpticsIcon';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angle = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;
const fmt = (v: number | null, digits = 3) => v === null || !Number.isFinite(v) ? '—' : v.toFixed(digits);
export function NumberField({ label, value, min, max, unit = 'mm', step = 1, change, nonzero = false }: { label: string; value: number; min: number; max: number; unit?: string; step?: number; change: (v: number) => void; nonzero?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const id = useId();
  const range = `${min}～${max} ${unit}${nonzero ? '，焦距绝对值至少 1 mm' : ''}`;
  const submit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n)) { setError('请输入有效数字；原参数尚未修改。'); return; }
    if (n < min || n > max || (nonzero && Math.abs(n) < 1)) { setError(`允许范围：${range}。原参数尚未修改，按 Esc 恢复。`); return; }
    change(n); setDraft(null); setError('');
  };
  return <label className="fd-number"><span>{label}<small>{unit}</small></span><input type="number" aria-label={label} aria-invalid={!!error} aria-describedby={error ? id : undefined} title={`允许范围：${range}`} value={draft ?? Number(value.toFixed(6))} min={min} max={max} step={step} onChange={e => { setDraft(e.target.value); setError(''); }} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); setError(''); } }} />{error && <small id={id} className="fd-field-error" role="alert">{error}</small>}</label>;
}

function fitBounds(scene: FoldedScene) {
  const points = [scene.source, ...scene.elements];
  const x = points.map(p => p.x), y = points.map(p => p.y);
  const pad = Math.max(35, ...scene.elements.map(e => e.diameter / 2 + 15));
  return { minX: Math.min(...x) - pad, maxX: Math.max(...x) + pad, minY: Math.min(...y) - pad, maxY: Math.max(...y) + pad };
}
function AngleControl({ label, value, change, axial = false }: { label: string; value: number; change: (v: number) => void; axial?: boolean }) {
  return <div className="fd-angle-control">
    <NumberField label={label} value={angle(value)} min={-180} max={180} unit="°" step={.1} change={v => change(angle(v))} />
    <div className="fd-angle-actions"><button type="button" aria-label={`${label}：顺时针旋转5度`} onClick={() => change(angle(value - 5))}>−5°</button><button type="button" aria-label={`${label}：逆时针旋转5度`} onClick={() => change(angle(value + 5))}>+5°</button><button type="button" aria-label={`${label}：归零`} onClick={() => change(0)}>归零</button></div>
    <p className="fd-hint">{axial ? '绕光轴旋转聚焦方向：0° 聚焦 u，90° 聚焦 v；与 XY 平面旋转独立。' : '按朝向法线计角：0° 向右，90° 向上，逆时针为正。也可拖动画布上的圆形旋转柄。'}</p>
  </div>;
}
export function FoldedCanvas({ scene, result, selected, select, commit, add, onPreview, viewportRef }: { scene: FoldedScene; result: FoldedAnalysis; selected: string; select: (id: string, revealLayout?: boolean) => void; commit: (s: FoldedScene) => void; add: (kind: string, x?: number, y?: number) => void; onPreview: (s: FoldedScene | null) => void; viewportRef: React.RefObject<{ x: number; y: number; span: number }> }) {
  const svg = useRef<SVGSVGElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 560 });
  const [view, setView] = useState(() => fitBounds(scene));
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(50);
  const [snapStep, setSnapStep] = useState(5);
  const [snap, setSnap] = useState(true);
  const [showRays, setShowRays] = useState(true);
  const [showNormals, setShowNormals] = useState(false);
  const [lineWidth, setLineWidth] = useState(1.4);
  const [controlsOpen, setControlsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760);
  const [preview, setPreview] = useState<FoldedScene | null>(null);
  const latestPreview = useRef<FoldedScene | null>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'rotate'; angle: number; base: FoldedScene; origin: { x: number; y: number }; start: { x: number; y: number } } | null>(null);
  const pendingFrame = useRef<number | null>(null);
  const p = preview ?? scene;
  const labels = foldedLabels(p);
  const uid = useId().replaceAll(':', '');
  useEffect(() => {
    const media = window.matchMedia('(min-width: 761px)');
    const resize = (event: MediaQueryListEvent) => setControlsOpen(event.matches);
    media.addEventListener('change', resize); return () => media.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    const node = frame.current; if (!node) return;
    const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; if (r.width > 0 && r.height > 0) setSize(previous => Math.abs(previous.width - r.width) < .5 && Math.abs(previous.height - r.height) < .5 ? previous : { width: r.width, height: r.height }); });
    observer.observe(node); return () => { observer.disconnect(); if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current); };
  }, []);
  const { width, height } = size;
  const scale = Math.min((width - 96) / Math.max(80, view.maxX - view.minX), (height - 92) / Math.max(80, view.maxY - view.minY)) * zoom;
  const cx = (view.minX + view.maxX) / 2, cy = (view.minY + view.maxY) / 2;
  useEffect(() => { viewportRef.current = { x: cx, y: cy, span: Math.min(width - 96, height - 92) / scale }; }, [cx, cy, width, height, scale, viewportRef]);
  const x = (v: number) => width / 2 + (v - cx) * scale;
  const y = (v: number) => height / 2 - (v - cy) * scale;
  const world = (clientX: number, clientY: number) => { const r = svg.current!.getBoundingClientRect(); return { x: cx + (clientX - r.left - width / 2) / scale, y: cy - (clientY - r.top - height / 2) / scale }; };
  const placed = (at: { x: number; y: number }) => ({ x: clamp(snap ? Math.round(at.x / snapStep) * snapStep : Math.round(at.x * 100) / 100, scene.bounds.minX, scene.bounds.maxX), y: clamp(snap ? Math.round(at.y / snapStep) * snapStep : Math.round(at.y * 100) / 100, scene.bounds.minY, scene.bounds.maxY) });
  const stop = (cancel = false) => { if (pendingFrame.current !== null) { cancelAnimationFrame(pendingFrame.current); pendingFrame.current = null; } if (latestPreview.current && !cancel) commit(latestPreview.current); latestPreview.current = null; drag.current = null; setPreview(null); onPreview(null); };
  const start = (event: React.PointerEvent<SVGGElement>, id: string, origin: { x: number; y: number }, rotate = false) => { event.preventDefault(); event.stopPropagation(); if (!rotate) select(id, false); event.currentTarget.focus({ preventScroll: true }); drag.current = { id, origin, mode: rotate ? 'rotate' : 'move', angle: id === 'source' ? scene.source.directionDeg : scene.elements.find(e => e.id === id)!.angleDeg, base: scene, start: world(event.clientX, event.clientY) }; event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const current = world(event.clientX, event.clientY);
    let next: FoldedScene;
    if (d.mode === 'rotate') {
      const delta = (Math.atan2(current.y - d.origin.y, current.x - d.origin.x) - Math.atan2(d.start.y - d.origin.y, d.start.x - d.origin.x)) * 180 / Math.PI;
      const step = event.shiftKey ? 15 : .1;
      const value = angle(Math.round((d.angle + delta) / step) * step);
      next = d.id === 'source' ? { ...d.base, source: { ...d.base.source, directionDeg: value } } : { ...d.base, elements: d.base.elements.map(e => e.id === d.id ? { ...e, angleDeg: value } : e) };
    } else {
      const at = placed({ x: d.origin.x + current.x - d.start.x, y: d.origin.y + current.y - d.start.y });
      next = d.id === 'source' ? { ...d.base, source: { ...d.base.source, ...at } } : { ...d.base, elements: d.base.elements.map(e => e.id === d.id ? { ...e, ...at } : e) };
    }
    latestPreview.current = next;
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => { pendingFrame.current = null; setPreview(next); onPreview(next); });
  };
  const keyboard = (event: React.KeyboardEvent<SVGGElement>, id: string) => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(id); }
    const item = id === 'source' ? scene.source : scene.elements.find(e => e.id === id)!;
    if (event.key.startsWith('Arrow')) { event.preventDefault(); const step = event.shiftKey ? 1 : snapStep; const at = placed({ x: item.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: item.y + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0) }); commit(id === 'source' ? { ...scene, source: { ...scene.source, ...at } } : { ...scene, elements: scene.elements.map(e => e.id === id ? { ...e, ...at } : e) }); }
    if (['[', ']'].includes(event.key)) { event.preventDefault(); const delta = event.key === '[' ? -5 : 5; commit(id === 'source' ? { ...scene, source: { ...scene.source, directionDeg: ((scene.source.directionDeg + delta + 540) % 360) - 180 } } : { ...scene, elements: scene.elements.map(e => e.id === id ? { ...e, angleDeg: ((e.angleDeg + delta + 540) % 360) - 180 } : e) }); }
  };
  const rulerStep = grid * Math.max(1, Math.ceil(75 / (grid * scale)));
  const ticks = (a: number, b: number) => Array.from({ length: Math.min(60, Math.ceil((b - a) / rulerStep) + 1) }, (_, i) => Math.ceil(a / rulerStep) * rulerStep + i * rulerStep).filter(v => v <= b);
  const xTicks = ticks(cx - (width / 2 - 35) / scale, cx + (width / 2 - 20) / scale);
  const yTicks = ticks(cy - (height / 2 - 38) / scale, cy + (height / 2 - 25) / scale);
  const stride = Math.max(1, Math.ceil(result.sourceRayCount / 192));
  const segments = result.segments.filter(s => Number(s.rootId.split('-').at(-1)) % stride === 0);
  const maxPower = Math.max(...segments.map(s => s.power), 1e-12);
  const rotating = selected === 'source' ? p.source : p.elements.find(e => e.id === selected);
  const rotationAngle = angle(selected === 'source' ? p.source.directionDeg : p.elements.find(e => e.id === selected)?.angleDeg ?? 0);
  const rotateKey = (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Escape' && drag.current) { event.preventDefault(); stop(true); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const delta = (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) * (event.shiftKey ? 5 : 1);
    const value = event.key === 'Home' ? 0 : angle(rotationAngle + delta);
    commit(selected === 'source' ? { ...scene, source: { ...scene.source, directionDeg: value } } : { ...scene, elements: scene.elements.map(e => e.id === selected ? { ...e, angleDeg: value } : e) });
  };
  return <section className="fd-canvas" aria-label="空间光路画布">
    <div className="fd-canvas-toolbar"><strong><OpticsIcon name="grid" size={18} />空间布局 <small>XY · mm</small></strong><div><button aria-label="缩小空间光路" onClick={() => setZoom(v => Math.max(.5, v / 1.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="放大空间光路" onClick={() => setZoom(v => Math.min(8, v * 1.25))}>＋</button><button onClick={() => { setView(fitBounds(scene)); setZoom(1); }}>适应元件</button></div></div>
    <details className="fd-display-settings" open={controlsOpen} onToggle={e => setControlsOpen(e.currentTarget.open)}><summary>显示与网格 · {grid} mm</summary><div className="fd-grid-controls"><label><input type="checkbox" checked={showRays} onChange={e => setShowRays(e.target.checked)} />光线</label><label><input type="checkbox" checked={showNormals} onChange={e => setShowNormals(e.target.checked)} />法线</label><button onClick={() => { setView(scene.bounds); setZoom(1); }}>完整区域</button><NumberField label="网格间隔" value={grid} min={.1} max={5000} step={1} change={setGrid} /><label><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />{snapStep} mm 吸附</label><NumberField label="吸附间隔" value={snapStep} min={.01} max={1000} step={1} change={setSnapStep} /><label>光线显示线宽<select aria-label="光线显示线宽" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}><option value={.8}>细 · 0.8 px</option><option value={1.4}>清晰 · 1.4 px</option><option value={2.2}>加粗 · 2.2 px</option></select></label></div></details>
    <div ref={frame} className="fd-canvas-scroll" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const data = e.dataTransfer.getData('text/plain'); if (data.startsWith('folded:')) { const at = placed(world(e.clientX, e.clientY)); add(data.slice(7), at.x, at.y); } }}>
      <svg ref={svg} id="fd-layout-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="可拖动和旋转元件的空间光路图" onPointerMove={move} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => { if (drag.current) stop(true); }} onKeyDown={e => { if (e.key === 'Escape' && drag.current) { e.preventDefault(); stop(true); } }}>
        <defs><pattern id={`grid-${uid}`} x={x(0)} y={y(0)} width={grid * scale} height={grid * scale} patternUnits="userSpaceOnUse"><path d={`M${grid * scale} 0H0V${grid * scale}`} fill="none" stroke="#dce5df" strokeWidth={.8} opacity={grid * scale < 3 ? .16 : 1} /></pattern><clipPath id={`clip-${uid}`}><rect x="38" y="14" width={Math.max(1, width - 50)} height={Math.max(1, height - 49)} /></clipPath></defs>
        <rect width={width} height={height} fill="#fafcfb" /><g clipPath={`url(#clip-${uid})`}><rect x="38" y="14" width={width - 50} height={height - 49} fill={`url(#grid-${uid})`} /><rect x={x(scene.bounds.minX)} y={y(scene.bounds.maxY)} width={(scene.bounds.maxX - scene.bounds.minX) * scale} height={(scene.bounds.maxY - scene.bounds.minY) * scale} fill="none" stroke="#8cae9d" strokeDasharray="4 4" />
        {showRays && segments.map((s, i) => <path key={i} d={`M${x(s.start.x)} ${y(s.start.y)}L${x(s.end.x)} ${y(s.end.y)}`} fill="none" stroke={s.event === 'blocked' ? '#ba6242' : s.branchId.includes('R') ? '#2870a2' : '#c78310'} strokeWidth={lineWidth} opacity={.22 + .5 * Math.sqrt(s.power / maxPower)} />)}
        <g role="button" tabIndex={0} aria-label="选择并移动空间光源" aria-pressed={selected === 'source'} onPointerDown={e => start(e, 'source', p.source)} onClick={() => select('source')} onKeyDown={e => keyboard(e, 'source')} className="fd-svg-part" transform={`translate(${x(p.source.x)} ${y(p.source.y)})`}><circle r="14" fill="#e8f2ee" stroke={selected === 'source' ? '#16725c' : '#789686'} strokeWidth="1.6" /><path d="M-7 0H9m-4-4 4 4-4 4" fill="none" stroke="#315749" strokeWidth="2" transform={`rotate(${-p.source.directionDeg})`} /><text y="30" textAnchor="middle" fontSize="12" fill="#34574a">光源</text></g>
        {p.elements.map(e => { const actualHalf = e.diameter * scale / 2, half = Math.max(actualHalf, 13), clear = e.aperture * scale / 2; const color = e.kind === 'beamsplitter' ? '#7d5ca1' : e.kind === 'mirror' ? '#306990' : '#237d65'; return <g key={e.id} role="button" tabIndex={0} aria-label={`选择 ${e.kind === 'detector' ? labels.get(e.id)!.label : e.name}`} aria-pressed={selected === e.id} className="fd-svg-part" onPointerDown={event => start(event, e.id, e)} onClick={() => select(e.id)} onKeyDown={event => keyboard(event, e.id)}><g transform={`translate(${x(e.x)} ${y(e.y)}) rotate(${-e.angleDeg})`}><rect className="fd-part-hitbox" x="-14" y={-half - 6} width="28" height={2 * half + 12} rx="4" fill={selected === e.id ? '#16725c13' : 'transparent'} stroke={selected === e.id ? '#16725c' : 'transparent'} strokeDasharray="3 3" />
          {e.kind === 'lens' || e.kind === 'cylindrical' ? <path d={e.focal > 0 ? `M0 ${-half}Q-9 0 0 ${half}Q9 0 0 ${-half}Z` : `M-5 ${-half}Q3 0 -5 ${half}H5Q-3 0 5 ${-half}Z`} fill="#5ea18d38" stroke={color} strokeWidth="2" /> : e.kind === 'objective' ? <path d={`M-10 ${-half}H7V${-Math.min(clear, half)}H10V${Math.min(clear, half)}H7V${half}H-10Z`} fill="#d9ebe2" stroke={color} strokeWidth="2" /> : e.kind === 'iris' ? <path d={`M0 ${-half}V${-clear}M0 ${clear}V${half}`} stroke={color} strokeWidth="6" /> : <path d={`M0 ${-half}V${half}`} stroke={color} strokeWidth={e.kind === 'detector' ? 6 : 4} strokeDasharray={e.kind === 'beamsplitter' ? '5 3' : undefined} />}
          {e.kind === 'cylindrical' && <path d="M-8 -4h16m-16 8h16" stroke={color} />}{showNormals && <path d="M-22 0H26m-6-4l6 4-6 4" stroke="#83998e" strokeDasharray="3 3" fill="none" />}</g><text x={x(e.x)} y={y(e.y) - half - 12} textAnchor="middle" fontSize="12" fill="#294d3f">{labels.get(e.id)!.tag}{width >= 520 ? ` · ${e.name.length > 12 ? e.name.slice(0, 12) + '…' : e.name}` : ''}</text></g>; })}</g>
        {rotating && <g className="fd-rotation-overlay" transform={`translate(${x(rotating.x)} ${y(rotating.y)}) rotate(${-rotationAngle})`}>
          <path d="M16 0H54" stroke="#21705b" strokeWidth="1.5" strokeDasharray="3 3" />
          <g className="fd-rotation-handle" transform="translate(66 0)" role="slider" tabIndex={0} aria-label={selected === 'source' ? '旋转光源方向' : '旋转所选元件'} aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Number(rotationAngle.toFixed(1))} aria-valuetext={`${rotationAngle.toFixed(1)} 度；方向键微调，Home 归零`} onPointerDown={e => start(e, selected, rotating, true)} onKeyDown={rotateKey}>
            <circle r="24" fill="transparent" /><circle className="fd-rotation-knob" r="18" fill="#fff" stroke="#21705b" strokeWidth="2" />
            <g transform={`rotate(${rotationAngle})`}><path d="M-7 0a7 7 0 1 1 2 5m-2-1v-5h5" fill="none" stroke="#21705b" strokeWidth="1.7" /><title>拖动旋转；Shift 按 15° 吸附</title></g>
          </g>
        </g>}
        <rect x="0" y={height - 35} width={width} height="35" fill="#fff" /><rect width="38" height={height} fill="#fff" />{xTicks.map(v => <text key={v} x={x(v)} y={height - 16} textAnchor="middle" fontSize="11" fill="#486857">{Number(v.toFixed(3))}</text>)}{yTicks.map(v => <text key={v} x="31" y={y(v) + 4} textAnchor="end" fontSize="11" fill="#486857">{Number(v.toFixed(3))}</text>)}<text x={width - 10} y={height - 2} textAnchor="end" fontSize="11" fill="#486857">x / mm</text><text x="42" y="12" fontSize="11" fill="#486857">y / mm</text>
      </svg>
    </div><div className="fd-canvas-selection"><label>选择元件<select aria-label="选择空间元件" value={selected} onChange={e => select(e.target.value)}><option value="source">光源</option>{scene.elements.map(e => <option key={e.id} value={e.id}>{labels.get(e.id)!.label}</option>)}</select></label><span>拖动元件移动 · 拖动圆柄旋转 · [ / ] 微调</span></div><div className="fd-canvas-caption">网格 {grid} mm；坐标与孔径按真实尺寸计算。小元件保留最小图标尺寸，线宽只影响显示。显示抽样 {new Set(segments.map(s => s.rootId)).size} / 计算 {result.sourceRayCount} 条。</div>
  </section>;
}

export function FoldedInspector({ scene, current, source, element, bounds, duplicate, remove, sourceRayCount }: { scene: FoldedScene; current?: FoldedElement; source: (v: Partial<FoldedScene['source']>) => void; element: (v: Partial<FoldedElement>) => void; bounds: (v: Partial<FoldedScene['bounds']>) => void; duplicate: () => void; remove: () => void; sourceRayCount: number }) {
  const [lossless, setLossless] = useState(true);
  const s = scene.source;
  const position = current ?? s;
  const optical = current && ['lens', 'objective', 'cylindrical'].includes(current.kind);
  const update = current ? element : source;
  const beam = s.beam;
  const setBeam = (patch: Partial<NonNullable<typeof beam>>) => source({ beam: { profile: 'gaussian', diameterMinor: Math.max(.01, s.diameter / 2), fullAngleMinor: s.fullAngle / 2, rotationDeg: 0, ...beam, ...patch } });
  return <div className="fd-inspector-fields"><div className="fd-parameter-title"><strong>{current ? `${foldedLabels(scene).get(current.id)!.label}` : '光源设置'}</strong></div>
    {current && <label className="fd-select">元件名称<input aria-label="空间元件名称" value={current.name} maxLength={120} onChange={e => element({ name: e.target.value || '元件' })} /></label>}
    <div className="fd-field-pair"><NumberField label={current ? '元件 x' : '光源 x'} value={position.x} min={scene.bounds.minX} max={scene.bounds.maxX} change={x => update({ x })} /><NumberField label={current ? '元件 y' : '光源 y'} value={position.y} min={scene.bounds.minY} max={scene.bounds.maxY} change={y => update({ y })} /></div>
    <AngleControl label={current ? '旋转角度（XY平面）' : '传播方向'} value={current?.angleDeg ?? s.directionDeg} change={v => current ? element({ angleDeg: v }) : source({ directionDeg: v })} />
    {current?.kind === 'cylindrical' && <AngleControl label="聚焦方向角（绕光轴）" value={current.rollDeg ?? 0} axial change={rollDeg => element({ rollDeg })} />}
    {!current ? <><label className="fd-select">光斑与采样<select aria-label="光源光斑形状" value={beam ? beam.profile : s.model} onChange={e => e.target.value === 'gaussian' || e.target.value === 'uniform' ? setBeam({ profile: e.target.value }) : source({ beam: undefined, model: e.target.value as 'fan' | 'extended' })}><option value="gaussian">椭圆高斯 · 二维</option><option value="uniform">椭圆均匀 · 二维</option><option value="extended">扩展源 · 原一维</option><option value="fan">相关扇形 · 原一维</option></select></label>
      <div className="fd-field-pair"><NumberField label={beam ? '长轴光斑直径' : '入射光源孔径'} value={s.diameter} min={.01} max={100} step={.1} change={diameter => source({ diameter })} />{beam && <NumberField label="短轴光斑直径" value={beam.diameterMinor} min={.01} max={100} step={.1} change={diameterMinor => setBeam({ diameterMinor })} />}</div>
      <div className="fd-field-pair"><NumberField label={beam ? '长轴发散全角' : '发散全角'} value={s.fullAngle} min={0} max={200} step={.1} unit="mrad" change={fullAngle => source({ fullAngle })} />{beam && <NumberField label="短轴发散全角" value={beam.fullAngleMinor} min={0} max={200} step={.1} unit="mrad" change={fullAngleMinor => setBeam({ fullAngleMinor })} />}</div>
      {beam && <NumberField label="椭圆旋转角" value={beam.rotationDeg} min={-180} max={180} unit="°" change={rotationDeg => setBeam({ rotationDeg })} />}
      <NumberField label="采样精度" value={s.rayCount} min={3} max={101} step={2} unit="阶" change={rayCount => source({ rayCount: Math.round(rayCount) })} /><p className="fd-sample-count" role="status">实际追迹 {sourceRayCount} 条{beam ? ' · 阶数²，限制在 64～4096 条' : ' · 原一维采样'}</p><details className="fd-source-advanced"><summary>光源权重与波长</summary><div className="fd-field-pair"><NumberField label="输入相对权重" value={s.intensity} min={0} max={1e6} step={.1} unit="a.u." change={intensity => source({ intensity })} /><NumberField label="波长记录" value={s.wavelength} min={200} max={20000} step={1} unit="nm" change={wavelength => source({ wavelength })} /></div></details>
      <p className="fd-hint">高斯直径与发散角为完整 1/e² 宽度；均匀源为椭圆边界。位置、角度独立采样，二维最多 4096 条。旋转角基于入射横截面 u/v。</p></> : <>
      <div className="fd-field-pair"><NumberField label="表面长度 / 外径" value={current.diameter} min={.01} max={500} change={diameter => element({ diameter, aperture: Math.min(diameter, current.aperture) })} /><NumberField label="模型有效孔径" value={current.aperture} min={.001} max={current.diameter} step={.1} change={aperture => element({ aperture })} /></div>
      {optical && <><NumberField label={current.kind === 'objective' ? '物镜等效焦距' : '薄透镜焦距'} value={current.focal} min={current.kind === 'objective' ? 1 : -10000} max={10000} nonzero change={focal => element({ focal })} />
        <details className="fd-aberrations"><summary>像差 · 自定义瞳面 OPD</summary><p className="fd-hint">归一化瞳面波前项，单位 µm。系数为用户输入，零值为理想薄透镜；并非厂家实测像差。</p>{(['sphericalUm', 'comaUm', 'astigmatismUm'] as const).map((key, i) => <NumberField key={key} label={['球差 W040', '彗差 W131', '像散 W222'][i]} value={current.aberration?.[key] ?? 0} min={-1000} max={1000} step={.01} unit="µm" change={v => element({ aberration: { sphericalUm: 0, comaUm: 0, astigmatismUm: 0, ...current.aberration, [key]: v } })} />)}<p className="fd-hint">W = W040 ρ⁴ + W131 uρ² + W222 (u²−v²)，u/v 为归一化瞳坐标；方向变化来自实际波前斜率。</p></details></>}
      {current.objective && <ObjectiveInfo model={current.objective} focal={current.focal} aperture={current.aperture} diameter={current.diameter} wavelength={s.wavelength} />}
      {['mirror', 'beamsplitter'].includes(current.kind) && <><NumberField label="功率反射率 R" value={current.reflectance} min={0} max={lossless ? 1 : 1 - current.transmittance} step={.01} unit="0–1" change={reflectance => element(current.kind === 'beamsplitter' && lossless ? { reflectance, transmittance: 1 - reflectance } : { reflectance })} />{current.kind === 'beamsplitter' && <><NumberField label="功率透射率 T" value={current.transmittance} min={0} max={lossless ? 1 : 1 - current.reflectance} step={.01} unit="0–1" change={transmittance => element(lossless ? { transmittance, reflectance: 1 - transmittance } : { transmittance })} /><label><input type="checkbox" checked={lossless && Math.abs(current.reflectance + current.transmittance - 1) < 1e-10} onChange={e => { setLossless(e.target.checked); if (e.target.checked) element({ transmittance: 1 - current.reflectance }); }} />保持无损 R+T=1</label></>}</>}
      <div className="fd-edit-actions"><button onClick={duplicate}>复制元件</button><button onClick={remove}>移除</button></div>
    </>}
    <details className="fd-bounds"><summary>计算区域 / mm</summary><div className="fd-field-pair"><NumberField label="x 最小值" value={scene.bounds.minX} min={-10000} max={scene.bounds.maxX - 1} change={minX => bounds({ minX })} /><NumberField label="x 最大值" value={scene.bounds.maxX} min={scene.bounds.minX + 1} max={10000} change={maxX => bounds({ maxX })} /><NumberField label="y 最小值" value={scene.bounds.minY} min={-10000} max={scene.bounds.maxY - 1} change={minY => bounds({ minY })} /><NumberField label="y 最大值" value={scene.bounds.maxY} min={scene.bounds.minY + 1} max={10000} change={maxY => bounds({ maxY })} /></div></details>
  </div>;
}

export function DetectorSpots({ scene, result }: { scene: FoldedScene; result: FoldedAnalysis }) {
  const labels = foldedLabels(scene);
  return <section className="fd-analysis" aria-label="探测器光斑与强度"><div className="fd-section-bar"><h3>探测器 · 实时光斑与强度</h3><span>{scene.source.beam ? '二维几何采样' : '原一维采样 · 启用椭圆源计算二维'}</span></div><div className="fd-detector-grid">{result.detectors.map(detector => <Spot key={detector.elementId} detector={detector} label={labels.get(detector.elementId)!.label} input={result.energy.input} />)}{!result.detectors.length && <p>加入探测面查看接收光斑。</p>}</div><p className="fd-hint">强度图为实际到达光线的功率直方图，积分等于接收功率；a.u./mm² 是相对功率密度；颜色按各图峰值归一化，比较不同探测器应使用功率与峰值读数。不是衍射 PSF 或相干干涉图。u 为探测面内的横向坐标，v 为布局平面外的横向坐标。</p></section>;
}
function useDensityCanvas(grid: FoldedAnalysis['detectors'][number]['spot']['grid']) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const max = Math.max(...grid.irradiance, 1e-30);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    const image = ctx.createImageData(grid.size, grid.size);
    grid.irradiance.forEach((v, i) => { const level = Math.sqrt(v / max); const j = ((grid.size - 1 - Math.floor(i / grid.size)) * grid.size + i % grid.size) * 4; image.data[j] = Math.round(8 + 247 * level); image.data[j + 1] = Math.round(22 + 193 * level); image.data[j + 2] = Math.round(32 + 40 * level); image.data[j + 3] = 255; }); ctx.putImageData(image, 0, 0);
  }, [grid, max]);
  return canvas;
}
export function DetectorPreview({ detector }: { detector: FoldedAnalysis['detectors'][number] }) {
  const { grid } = detector.spot;
  const canvas = useDensityCanvas(grid);
  const extent = Math.max(grid.extentU, grid.extentV);
  return <div className="fd-mini-spot" role="img" aria-label={detector.power ? '当前探测器实际强度预览' : '当前探测器无接收'}>{detector.power ? <canvas ref={canvas} width={grid.size} height={grid.size} style={{ width: `${100 * grid.extentU / extent}%`, height: `${100 * grid.extentV / extent}%` }} /> : <span>无接收</span>}</div>;
}
function Spot({ detector, label, input }: { detector: FoldedAnalysis['detectors'][number]; label: string; input: number }) {
  const [mode, setMode] = useState('density');
  const { spot } = detector;
  const { grid } = spot;
  const canvas = useDensityCanvas(grid);
  const max = Math.max(...grid.irradiance, 1e-30);
  const extent = Math.max(grid.extentU, grid.extentV);
  const received = detector.power > 0;
  const geometricZero = (spot.rms2D ?? 1) < 1e-10;
  const n = grid.size, profileU = Array.from({ length: n }, (_, x) => grid.power.reduce((sum, v, i) => i % n === x ? sum + v : sum, 0)), profileV = Array.from({ length: n }, (_, y) => grid.power.slice(y * n, (y + 1) * n).reduce((sum, v) => sum + v, 0));
  const profile = (data: number[], axisExtent: number) => { const peak = Math.max(...data, 1e-30); return data.map((v, i) => `${140 + (2 * (i + .5) / n - 1) * axisExtent / extent * 130},${70 - v / peak * 58}`).join(' '); };
  return <article className="fd-detector-card"><div className="fd-spot-title"><strong><b className="obj-detector-tag">{label.split(' · ')[0]}</b>{label.split(' · ').slice(1).join(' · ')}</strong><select aria-label={`${label} 显示方式`} value={mode} onChange={e => setMode(e.target.value)}><option value="density">强度分布</option><option value="hits">光线落点</option></select></div><div className="fd-spot-body"><div className="fd-spot-plot" role="img" aria-label={`${label} 二维光斑，接收 ${detector.rayCount} 条，RMS ${fmt(spot.rms2D)} mm`}>
    <canvas ref={canvas} width={grid.size} height={grid.size} style={{ width: `${100 * grid.extentU / extent}%`, height: `${100 * grid.extentV / extent}%` }} hidden={!received || mode !== 'density'} /><svg viewBox="0 0 240 240" style={{ display: received && mode === 'hits' ? 'block' : 'none' }}><rect width="240" height="240" fill="#081620" />{spot.hits.map((h, i) => <circle key={i} cx={120 + h.u / extent * 120} cy={120 - h.v / extent * 120} r="1.3" fill="#facb56" opacity=".65" />)}</svg><span className="fd-spot-u" hidden={!received}>{geometricZero ? '几何焦点 · 非衍射光斑' : `u/v 同比例 · ±${fmt(extent)} mm`}</span><span className="fd-spot-v" hidden={!received}>{grid.size}×{grid.size} · √(I/Imax)</span><div className="fd-no-reception" hidden={received}><strong>无光线到达探测面</strong></div></div><dl><div><dt>接收功率</dt><dd>{fmt(detector.power)} a.u. · {input ? fmt(detector.power / input * 100, 1) : '—'}%</dd></div><div><dt>光线数</dt><dd>{detector.rayCount}</dd></div><div><dt>质心 u / v</dt><dd>{fmt(spot.centroidU)} / {fmt(spot.centroidV)} mm</dd></div><div><dt>RMS u / v</dt><dd>{fmt(spot.rmsU)} / {fmt(spot.rmsV)} mm</dd></div><div><dt>二维 RMS</dt><dd>{fmt(spot.rms2D)} mm</dd></div><div><dt>峰值密度</dt><dd>{!received ? '—（无接收）' : geometricZero ? '—（几何零尺寸）' : `${fmt(detector.power ? max : 0)} a.u./mm²`}</dd></div><div><dt>原横向范围</dt><dd>范围{fmt(detector.span)} mm</dd></div></dl></div>{!received && <p className="fd-reception-guide">依次检查光源传播方向、元件通光孔径，以及探测面的位置与法线方向。可用“适应元件”查看完整光路。</p>}<svg className="fd-spot-profiles" style={{ display: received ? undefined : 'none' }} viewBox="0 0 280 102" role="img" aria-label={`${label} u 与 v 积分强度剖面`}><path d="M10 12V70H270" stroke="#c7d9ce" fill="none" /><polyline points={profile(profileU, grid.extentU)} stroke="#1a7b60" fill="none" strokeWidth="1.5" /><polyline points={profile(profileV, grid.extentV)} stroke="#ae7418" fill="none" strokeWidth="1.5" /><text x="10" y="83" fontSize="10" fill="#456c56">−{fmt(extent)} mm</text><text x="270" y="83" textAnchor="end" fontSize="10" fill="#456c56">+{fmt(extent)} mm</text><text x="12" y="100" fontSize="11" fill="#456c56">u 积分</text><text x="90" y="100" fontSize="11" fill="#8f611b">v 积分 · 各自峰值归一化</text></svg></article>;
}
