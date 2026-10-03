import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { blankFoldedScene, foldedElement, foldedPresets, parseFoldedScene, traceFoldedScene, type FoldedElement, type FoldedScene } from './folded-engine';
import foldedCatalog from './folded-catalog.json';
import { downloadText } from './design-export';
import { foldedCsv, foldedEngineeringFile, foldedReport, parseFoldedEngineeringFile } from './folded-export';
import { FoldedScan } from './FoldedScan';
import { OpticsIcon, type OpticsIconName } from './OpticsIcon';
import './folded-designer.css';

const DRAFT = 'pcsel-folded-optics-draft-v1';
const LIBRARY = 'pcsel-folded-optics-library-v1';
const kinds: { kind: FoldedElement['kind']; name: string; symbol: string; description: string }[] = [
  { kind: 'lens', name: '薄透镜', symbol: '()', description: '正 / 负焦距 · 局部近轴' },
  { kind: 'iris', name: '光阑', symbol: '‖', description: '有限孔径 · 阻挡光线' },
  { kind: 'mirror', name: '平面反射镜', symbol: '／', description: '反射定律 · 可旋转' },
  { kind: 'beamsplitter', name: '半透半反镜', symbol: '╱→', description: '独立反射 / 透射分支' },
  { kind: 'detector', name: '探测面', symbol: '▏', description: '接收权重 · 一维光斑' },
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const fmt = (value: number | null | undefined, precision = 3) => value === null || value === undefined || !Number.isFinite(value) ? '—' : (Math.abs(value) < 1e-10 ? 0 : value).toFixed(precision);
const percentage = (value: number, input: number) => input > 0 ? `${fmt(value / input * 100, 1)}%` : '—';
const typeName = (kind: FoldedElement['kind']) => kinds.find(k => k.kind === kind)?.name ?? kind;
const kindIcon = (kind: FoldedElement['kind']): OpticsIconName => kind === 'beamsplitter' ? 'splitter' : kind;
type LibraryEntry = { id: string; savedAt: string; scene: FoldedScene };
function readScene() {
  try { const text = localStorage.getItem(DRAFT); if (text) return parseFoldedEngineeringFile(JSON.parse(text), parseFoldedScene); } catch { /* A broken draft must not stop the workbench. */ }
  return foldedPresets().split;
}
function readLibrary(): LibraryEntry[] {
  try {
    const input: unknown = JSON.parse(localStorage.getItem(LIBRARY) ?? '[]');
    if (!Array.isArray(input)) return [];
    return input.slice(0, 20).flatMap(item => {
      try {
        if (!item || typeof item.id !== 'string' || typeof item.savedAt !== 'string') return [];
        return [{ id: item.id, savedAt: item.savedAt, scene: parseFoldedScene(item.scene) }];
      } catch { return []; }
    });
  } catch { return []; }
}
function NumberField({ label, value, min, max, unit = 'mm', step = 1, change, compact = false }: { label: string; value: number; min: number; max: number; unit?: string; step?: number; change: (value: number) => void; compact?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => { if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) change(clamp(Number(draft), min, max)); setDraft(null); };
  return <label className={`fd-number ${compact ? 'fd-compact' : ''}`}>{!compact && <span>{label}<small>{unit}</small></span>}<input type="number" aria-label={label} value={draft ?? Number(value.toFixed(6))} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} /></label>;
}
function NameField({ id, label, value, change }: { id: string; label: string; value: string; change: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => { if (draft?.trim()) change(draft.trim()); setDraft(null); };
  return <input id={id} aria-label={label} maxLength={120} value={draft ?? value} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} />;
}

function FoldedCanvas({ scene, selected, select, commit, add }: { scene: FoldedScene; selected: string; select: (id: string) => void; commit: (scene: FoldedScene) => void; add: (kind: string, x?: number, y?: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<FoldedScene | null>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [showNormals, setShowNormals] = useState(false);
  const [showRays, setShowRays] = useState(true);
  const drag = useRef<{ id: string; base: FoldedScene; start: { x: number; y: number }; origin: { x: number; y: number } } | null>(null);
  const p = preview ?? scene;
  const traced = useMemo(() => traceFoldedScene(p), [p]);
  const uid = `folded-${useId().replaceAll(':', '')}`;
  const width = 1120, height = 620, margin = 55;
  const scale = Math.min((width - 2 * margin) / (p.bounds.maxX - p.bounds.minX), (height - 2 * margin) / (p.bounds.maxY - p.bounds.minY));
  const left = (width - (p.bounds.maxX - p.bounds.minX) * scale) / 2;
  const top = (height - (p.bounds.maxY - p.bounds.minY) * scale) / 2;
  const x = (world: number) => left + (world - p.bounds.minX) * scale;
  const y = (world: number) => top + (p.bounds.maxY - world) * scale;
  const tickTarget = Math.max(p.bounds.maxX - p.bounds.minX, p.bounds.maxY - p.bounds.minY) / 12;
  const base = 10 ** Math.floor(Math.log10(tickTarget));
  const tick = [1, 2, 5, 10].find(n => n * base >= tickTarget)! * base;
  const xTicks = Array.from({ length: Math.ceil((p.bounds.maxX - p.bounds.minX) / tick) + 1 }, (_, i) => Math.ceil(p.bounds.minX / tick) * tick + i * tick).filter(v => v <= p.bounds.maxX);
  const yTicks = Array.from({ length: Math.ceil((p.bounds.maxY - p.bounds.minY) / tick) + 1 }, (_, i) => Math.ceil(p.bounds.minY / tick) * tick + i * tick).filter(v => v <= p.bounds.maxY);
  const location = (clientX: number, clientY: number) => {
    const position = new DOMPoint(clientX, clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: p.bounds.minX + (position.x - left) / scale, y: p.bounds.maxY - (position.y - top) / scale };
  };
  const placed = (at: { x: number; y: number }) => ({ x: clamp(snap ? Math.round(at.x / 5) * 5 : Math.round(at.x * 10) / 10, p.bounds.minX, p.bounds.maxX), y: clamp(snap ? Math.round(at.y / 5) * 5 : Math.round(at.y * 10) / 10, p.bounds.minY, p.bounds.maxY) });
  const stop = (cancel = false) => { if (preview && !cancel) commit(preview); drag.current = null; setPreview(null); };
  const start = (event: React.PointerEvent<SVGGElement>, id: string, at: { x: number; y: number }) => { event.preventDefault(); select(id); drag.current = { id, base: scene, origin: at, start: location(event.clientX, event.clientY) }; event.currentTarget.setPointerCapture(event.pointerId); };
  const keyboard = (event: React.KeyboardEvent<SVGGElement>, id: string) => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(id); }
    const element = scene.elements.find(e => e.id === id);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); select(id); const origin = id === 'source' ? scene.source : element!; const step = event.shiftKey ? 1 : 5;
      const at = placed({ x: origin.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: origin.y + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0) });
      commit(id === 'source' ? { ...scene, source: { ...scene.source, ...at } } : { ...scene, elements: scene.elements.map(e => e.id === id ? { ...e, ...at } : e) });
    }
    if (['[', ']'].includes(event.key)) { event.preventDefault(); const amount = event.key === '[' ? -5 : 5; commit(id === 'source' ? { ...scene, source: { ...scene.source, directionDeg: ((scene.source.directionDeg + amount + 540) % 360) - 180 } } : { ...scene, elements: scene.elements.map(e => e.id === id ? { ...e, angleDeg: ((e.angleDeg + amount + 540) % 360) - 180 } : e) }); }
  };
  const maxPower = Math.max(...traced.segments.map(s => s.power), 1e-12);
  return <section className="fd-canvas" aria-label="空间光路画布">
    <div className="fd-canvas-toolbar"><div><OpticsIcon name="grid" size={18} /><strong>空间布局</strong><span>真实 XY 等比例 · mm</span></div><div><label><input type="checkbox" checked={showRays} onChange={e => setShowRays(e.target.checked)} />光线</label><label><input type="checkbox" checked={showNormals} onChange={e => setShowNormals(e.target.checked)} />法线</label><label><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />5 mm 吸附</label><button aria-label="缩小空间光路" disabled={zoom <= 1} onClick={() => setZoom(v => Math.max(1, v - .5))}>−</button><span>{zoom * 100}%</span><button aria-label="放大空间光路" disabled={zoom >= 3} onClick={() => setZoom(v => Math.min(3, v + .5))}>＋</button><button onClick={() => setZoom(1)}>适应</button></div></div>
    <div className="fd-canvas-scroll" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const data = e.dataTransfer.getData('text/plain'); if (data.startsWith('folded:')) { const at = placed(location(e.clientX, e.clientY)); add(data.slice(7), at.x, at.y); } }}>
      <svg ref={svg} id="fd-layout-svg" viewBox={`0 0 ${width} ${height}`} style={{ width: `${zoom * 100}%`, minWidth: zoom > 1 ? 750 * zoom : undefined }} role="group" aria-label="可拖动和旋转元件的空间光路图" onPointerMove={e => { const d = drag.current; if (!d) return; const current = location(e.clientX, e.clientY); const at = placed({ x: d.origin.x + current.x - d.start.x, y: d.origin.y + current.y - d.start.y }); setPreview(d.id === 'source' ? { ...d.base, source: { ...d.base.source, ...at } } : { ...d.base, elements: d.base.elements.map(el => el.id === d.id ? { ...el, ...at } : el) }); }} onPointerUp={() => stop()} onPointerCancel={() => stop(true)}>
        <defs><clipPath id={`${uid}-bounds`}><rect x={x(p.bounds.minX)} y={y(p.bounds.maxY)} width={(p.bounds.maxX - p.bounds.minX) * scale} height={(p.bounds.maxY - p.bounds.minY) * scale} /></clipPath></defs>
        <rect width={width} height={height} fill="#fff" /><rect x={x(p.bounds.minX)} y={y(p.bounds.maxY)} width={(p.bounds.maxX - p.bounds.minX) * scale} height={(p.bounds.maxY - p.bounds.minY) * scale} fill="#fafcfb" stroke="#ceded6" />
        {xTicks.map(v => <g key={`x${v}`}><path d={`M${x(v)} ${y(p.bounds.maxY)}V${y(p.bounds.minY)}`} stroke="#e1e9ef" strokeWidth="1" /><text x={x(v)} y={y(p.bounds.minY) + 22} textAnchor="middle" fill="#6a7e90" fontSize="12">{v}</text></g>)}
        {yTicks.map(v => <g key={`y${v}`}><path d={`M${x(p.bounds.minX)} ${y(v)}H${x(p.bounds.maxX)}`} stroke="#e1e9ef" strokeWidth="1" /><text x={x(p.bounds.minX) - 9} y={y(v) + 4} textAnchor="end" fill="#6a7e90" fontSize="12">{v}</text></g>)}
        <text x={x(p.bounds.maxX)} y={y(p.bounds.minY) + 40} textAnchor="end" fill="#6a7e90" fontSize="12">x / mm</text><text x={x(p.bounds.minX) - 15} y={y(p.bounds.maxY) - 12} fill="#6a7e90" fontSize="12">y / mm</text>
        <g clipPath={`url(#${uid}-bounds)`}>{showRays && traced.segments.map((segment, i) => <g key={i}><path d={`M${x(segment.start.x)} ${y(segment.start.y)}L${x(segment.end.x)} ${y(segment.end.y)}`} fill="none" stroke={segment.event === 'blocked' ? '#b77561' : segment.branchId.includes('R') ? '#3d7ea8' : '#d09b39'} strokeWidth={.8 + Math.sqrt(segment.power / maxPower) * .8} opacity={.18 + Math.sqrt(segment.power / maxPower) * .65} />{segment.event === 'blocked' && <path d={`M${x(segment.end.x) - 3} ${y(segment.end.y) - 3}l6 6m0 -6l-6 6`} stroke="#b56546" strokeWidth="1.4" />}</g>)}</g>
        <g role="button" tabIndex={0} aria-label="选择并移动空间光源" aria-pressed={selected === 'source'} className="fd-svg-part" onPointerDown={e => start(e, 'source', p.source)} onKeyDown={e => keyboard(e, 'source')} onClick={() => select('source')} transform={`translate(${x(p.source.x)} ${y(p.source.y)})`}>
          <circle r="21" fill={selected === 'source' ? '#daeaf7' : '#edf2f6'} stroke={selected === 'source' ? '#2671b8' : '#8da4b8'} strokeWidth="1.5" /><g transform={`rotate(${-p.source.directionDeg})`}><path d={`M0 ${-p.source.diameter / 2 * scale}V${p.source.diameter / 2 * scale}`} stroke="#304c64" strokeWidth="5" /><path d="M3 0h26m-7-5l7 5-7 5" stroke="#304c64" fill="none" strokeWidth="2" /></g><text y="-29" textAnchor="middle" fill="#304c64" fontSize="13">光源</text>
        </g>
        {p.elements.map((e, i) => { const half = e.diameter * scale / 2; const clear = e.aperture * scale / 2; const color = e.kind === 'beamsplitter' ? '#8867b4' : e.kind === 'mirror' ? '#476d92' : e.kind === 'detector' ? '#518273' : e.kind === 'iris' ? '#7b8290' : '#43929f'; return <g key={e.id} role="button" tabIndex={0} aria-label={`选择 ${e.name}`} aria-pressed={selected === e.id} className="fd-svg-part" onPointerDown={event => start(event, e.id, e)} onClick={() => select(e.id)} onKeyDown={event => keyboard(event, e.id)}>
          <g transform={`translate(${x(e.x)} ${y(e.y)}) rotate(${-e.angleDeg})`}><rect x="-16" y={-Math.max(half + 8, 22)} width="32" height={Math.max(2 * half + 16, 44)} rx="5" fill={selected === e.id ? '#347fbc12' : 'transparent'} stroke={selected === e.id ? '#2c77b7' : 'transparent'} strokeDasharray="3 3" />
            {e.kind === 'lens' ? <path d={e.focal > 0 ? `M0 ${-half}Q-8 0 0 ${half}Q8 0 0 ${-half}Z` : `M-5 ${-half}Q2 0 -5 ${half}H5Q-2 0 5 ${-half}Z`} fill="#75b2c52b" stroke={color} strokeWidth="2" /> : e.kind === 'iris' ? <path d={`M0 ${-half}V${-clear}M0 ${clear}V${half}`} stroke={color} strokeWidth="7" /> : <path d={`M0 ${-half}V${half}`} stroke={color} strokeWidth={e.kind === 'detector' ? 6 : 4} strokeDasharray={e.kind === 'beamsplitter' ? '5 3' : undefined} />}
            <path d={`M-5 ${-clear}h10M-5 ${clear}h10`} stroke="#ad8650" strokeWidth="1.5" />{showNormals && <path d="M-22 0H26m-6-4l6 4-6 4" stroke="#8395a7" strokeDasharray="3 3" strokeWidth="1" />}
          </g><text x={x(e.x)} y={y(e.y) - Math.max(half + 16, 33)} textAnchor="middle" fontSize="12" fill={color}>{i + 1} · {e.name.length > 18 ? e.name.slice(0, 18) + '…' : e.name}</text>
        </g>; })}
      </svg>
    </div><div className="fd-canvas-caption"><span><i className="fd-key-transmit" />传播 / 透射 <i className="fd-key-reflect" />反射分支 <i className="fd-key-splitter" />分光面</span><span>拖动 · 方向键移动 · [ / ] 旋转 5° · 色深表示相对采样权重</span></div>
  </section>;
}

export function FoldedDesigner({ initialScene, onReturnSequential }: { initialScene?: FoldedScene; onReturnSequential?: () => void }) {
  const [history, setHistory] = useState<{ past: FoldedScene[]; present: FoldedScene; future: FoldedScene[] }>(() => ({ past: [], present: initialScene ? parseFoldedScene(initialScene) : readScene(), future: [] }));
  const scene = history.present;
  const result = useMemo(() => traceFoldedScene(scene), [scene]);
  const [selected, setSelected] = useState('source');
  const [sidebar, setSidebar] = useState<'parts' | 'saved'>('parts');
  const [library, setLibrary] = useState(readLibrary);
  const [notice, setNotice] = useState('从分光模板开始，拖入元件，再设置位置、法线和 R/T。');
  const [stored, setStored] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const [analysisTab, setAnalysisTab] = useState<'detectors' | 'energy'>('detectors');
  const seenInitial = useRef(initialScene);
  const [losslessPreferences, setLosslessPreferences] = useState<Record<string, boolean>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const current = scene.elements.find(e => e.id === selected);
  const lossless = current?.kind === 'beamsplitter' && (losslessPreferences[current.id] ?? true) && Math.abs(current.reflectance + current.transmittance - 1) < 1e-10;
  const catalogPart = current ? foldedCatalog.parts.find(part => current.name.startsWith(part.sku + ' · ')) : null;
  const commit = (next: FoldedScene) => {
    try { const checked = parseFoldedScene(next); setHistory(h => JSON.stringify(checked) === JSON.stringify(h.present) ? h : { past: [...h.past, h.present].slice(-60), present: checked, future: [] }); }
    catch (error) { setNotice(error instanceof Error ? error.message : '参数不合法。'); }
  };
  useEffect(() => {
    if (!initialScene || seenInitial.current === initialScene) return;
    seenInitial.current = initialScene;
    try {
      const checked = parseFoldedScene(initialScene);
      setHistory(h => ({ past: [...h.past, h.present].slice(-60), present: checked, future: [] }));
      setSelected('source');
      setNotice('已复制顺序几何光路；原空间草稿可撤销恢复。目标面使用有限探测孔径，请检查视场与计算区域。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '空间复制未完成。'); }
  }, [initialScene]);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(foldedEngineeringFile(scene))); setStored(true); } catch { setStored(false); } }, [scene]);
  useEffect(() => { if (importOpen && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [importOpen]);
  const source = (patch: Partial<FoldedScene['source']>) => commit({ ...scene, source: { ...scene.source, ...patch } });
  const element = (patch: Partial<FoldedElement>) => { if (!current) return; commit({ ...scene, elements: scene.elements.map(e => e.id === current.id ? { ...e, ...patch } : e) }); };
  const add = (kindOrSku: string, posX?: number, posY?: number) => {
    const part = foldedCatalog.parts.find(part => part.sku === kindOrSku);
    const kind = part ? part.kind === 'splitter' ? 'beamsplitter' : 'mirror' : kindOrSku as FoldedElement['kind'];
    if (!kinds.some(k => k.kind === kind)) return;
    if (scene.elements.length >= 48) { setNotice('当前空间工程最多放置 48 个元件。'); return; }
    const e = foldedElement(kind, crypto.randomUUID(), posX ?? (scene.bounds.minX + scene.bounds.maxX) / 2, posY ?? (scene.bounds.minY + scene.bounds.maxY) / 2);
    if (part) { e.name = `${part.sku} · 理想等效面`; e.diameter = part.modelDefaults.surfaceLengthMm; e.aperture = part.modelDefaults.clearSurfaceLengthMm; e.reflectance = part.modelDefaults.reflectance; e.transmittance = part.modelDefaults.transmittance; }
    commit({ ...scene, elements: [...scene.elements, e] }); setSelected(e.id); setNotice(`已加入 ${e.name}；参数可编辑，元件顺序由实际交点决定。`);
  };
  const load = (next: FoldedScene) => { commit(next); setSelected('source'); setLosslessPreferences({}); setNotice('已打开空间工程；可撤销恢复上一个布局。'); };
  const save = () => { const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), scene: structuredClone(scene) }; const next = [entry, ...library].slice(0, 20); try { localStorage.setItem(LIBRARY, JSON.stringify(next)); setLibrary(next); setNotice(`已保存「${scene.name}」的空间工程副本。`); } catch { setNotice('保存失败，请导出 JSON 文件。'); } };
  const removeSaved = (id: string) => { const next = library.filter(e => e.id !== id); try { localStorage.setItem(LIBRARY, JSON.stringify(next)); setLibrary(next); } catch { setNotice('浏览器存储不可用，未移除副本。'); } };
  const undo = () => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setSelected('source'); };
  const redo = () => { setHistory(h => h.future.length ? { past: [...h.past, h.present].slice(-60), present: h.future[0], future: h.future.slice(1) } : h); setSelected('source'); };
  const importText = () => { try { if (new Blob([jsonText]).size > 250_000) throw new Error('工程文件最大 250 KB。'); const next = parseFoldedEngineeringFile(JSON.parse(jsonText), parseFoldedScene); load(next); setImportOpen(false); } catch (error) { setImportError(error instanceof Error ? error.message : '无法读取工程。'); } };
  const exportReport = () => { const svg = document.getElementById('fd-layout-svg')?.cloneNode(true) as SVGSVGElement | undefined; if (svg) { svg.removeAttribute('style'); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex')); } downloadText('folded-optics-report.html', 'text/html;charset=utf-8', foldedReport(scene, svg?.outerHTML ?? '')); };
  const bounds = (patch: Partial<FoldedScene['bounds']>) => commit({ ...scene, bounds: { ...scene.bounds, ...patch } });
  const presetOptions = foldedPresets();
  return <div className="fd-workbench">
    <div className="fd-heading"><div><h1>空间折转与分光</h1><span>XY 自由布局 · 分支几何追迹</span></div><div>{onReturnSequential && <button onClick={onReturnSequential}><OpticsIcon name="layers" size={16} />顺序近轴设计</button>}<button className="fd-report-button" onClick={exportReport}><OpticsIcon name="report" size={16} />导出 HTML 报告</button></div></div>
    <div className="fd-project-bar"><label className="fd-project-name" htmlFor="fd-project-name"><span>当前工程</span><NameField id="fd-project-name" label="空间工程名称" value={scene.name} change={name => commit({ ...scene, name })} /></label><label><span className="fd-sr-only">载入空间模板</span><select aria-label="载入空间模板" value="" onChange={e => { if (e.target.value) load(presetOptions[e.target.value as keyof typeof presetOptions]); }}><option value="">载入模板…</option><option value="split">50/50 分光 · 双路聚焦</option><option value="mirror">90° 平面镜折转</option><option value="focus">透镜聚焦</option><option value="blank">空白空间工程</option></select></label><button disabled={!history.past.length} onClick={undo}><OpticsIcon name="undo" size={16} />撤销</button><button disabled={!history.future.length} onClick={redo}><OpticsIcon name="redo" size={16} />重做</button><button className="fd-primary" onClick={save}><OpticsIcon name="save" size={16} />保存副本</button><button onClick={() => { setImportError(''); setJsonText(''); setImportOpen(true); }}><OpticsIcon name="import" size={16} />导入</button><button onClick={() => downloadText('folded-optics-project.json', 'application/json;charset=utf-8', JSON.stringify(foldedEngineeringFile(scene), null, 2))}><OpticsIcon name="export" size={16} />导出 JSON</button></div>
    <p className={`fd-notice ${!stored ? 'fd-alert' : ''}`} role="status">{!stored ? '浏览器无法保存草稿，请导出工程文件。' : notice}</p>
    <div className="fd-grid">
      <aside className="fd-library" aria-label="空间元件库"><div className="fd-tabs"><button aria-pressed={sidebar === 'parts'} onClick={() => setSidebar('parts')}><OpticsIcon name="layers" size={16} />元件库</button><button aria-pressed={sidebar === 'saved'} onClick={() => setSidebar('saved')}><OpticsIcon name="save" size={16} />我的工程</button></div>{sidebar === 'parts' ? <><p className="fd-hint">点击加入，或拖入画布开始组装</p>{kinds.map(k => <button key={k.kind} draggable onDragStart={e => e.dataTransfer.setData('text/plain', `folded:${k.kind}`)} className={`fd-part-card fd-part-${k.kind}`} onClick={() => add(k.kind)}><b><OpticsIcon name={kindIcon(k.kind)} size={23} /></b><span><strong>{k.name}</strong><small>{k.description}</small></span><OpticsIcon name="arrowRight" size={14} className="fd-part-arrow" /></button>)}<h3>索雷博参考器件</h3>{foldedCatalog.parts.map(part => <div className="fd-catalog-card" key={part.sku}><button draggable onDragStart={e => e.dataTransfer.setData('text/plain', `folded:${part.sku}`)} onClick={() => add(part.sku)}><strong>{part.sku}<span className="fd-reference-tag">参考</span></strong><span>{part.title}</span><small>加入理想等效面</small></button><a href={part.sourceUrl} target="_blank" rel="noreferrer">官方规格 ↗</a></div>)}<p className="fd-hint">厚度仅供查阅。分光比、表面长度和孔径仍是可编辑模型参数。</p></> : <><p className="fd-hint">最多保留 20 份副本；草稿自动保存。</p>{library.length ? library.map(item => <article className="fd-saved-card" key={item.id}><strong>{item.scene.name}</strong><small>{new Date(item.savedAt).toLocaleString('zh-CN')} · {item.scene.elements.length} 个元件</small><div><button onClick={() => load(item.scene)}>打开</button><button onClick={() => downloadText('folded-optics-project.json', 'application/json;charset=utf-8', JSON.stringify(foldedEngineeringFile(item.scene), null, 2))}>导出</button><button onClick={() => removeSaved(item.id)}>移除</button></div></article>) : <p className="fd-empty">尚无工程副本。设计完成后点击“保存副本”。</p>}</>}</aside>
      <main className="fd-main"><div className="fd-metrics"><div><span>探测器接收</span><strong>{percentage(result.energy.captured, result.energy.input)}</strong></div><div><span>离开范围</span><strong>{percentage(result.energy.escaped, result.energy.input)}</strong></div><div><span>截光 / 损耗</span><strong>{percentage(result.energy.absorbed, result.energy.input)}</strong></div><div><span>未完成追迹</span><strong>{percentage(result.energy.unresolved, result.energy.input)}</strong></div></div><FoldedCanvas scene={scene} selected={selected} select={setSelected} commit={commit} add={add} />
        {result.warnings.length > 0 && <details className="fd-warnings"><summary>模型提示 · {result.warnings.length}</summary><ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
        <section className="fd-prescription" aria-label="空间元件参数表"><div className="fd-section-bar"><h3>元件参数表</h3><span>最近交点决定传播顺序</span><button onClick={() => downloadText('folded-optics-prescription.csv', 'text/csv;charset=utf-8', foldedCsv(scene))}>导出 CSV</button></div><div className="fd-table-scroll"><table><thead><tr><th>元件</th><th>x / mm</th><th>y / mm</th><th>法线 / °</th><th>孔径 / mm</th><th>f / mm</th><th>R / T</th><th /></tr></thead><tbody>{scene.elements.map((e, i) => <tr key={e.id} className={selected === e.id ? 'fd-selected-row' : ''}><td><button onClick={() => setSelected(e.id)}>{i + 1} · {e.name}<small>{typeName(e.kind)}</small></button></td><td>{fmt(e.x, 1)}</td><td>{fmt(e.y, 1)}</td><td>{fmt(e.angleDeg, 1)}</td><td>{fmt(e.aperture, 2)}</td><td>{e.kind === 'lens' ? fmt(e.focal, 1) : '—'}</td><td>{['mirror', 'beamsplitter'].includes(e.kind) ? `${fmt(e.reflectance, 2)} / ${fmt(e.transmittance, 2)}` : '—'}</td><td><button aria-label={`移除 ${e.name}`} onClick={() => { commit({ ...scene, elements: scene.elements.filter(item => item.id !== e.id) }); setSelected('source'); }}>×</button></td></tr>)}</tbody></table>{!scene.elements.length && <p className="fd-empty">将透镜、反射镜或分光镜加入画布。</p>}</div></section>
        <section className="fd-analysis" aria-label="分支分析"><div className="fd-tabs"><button aria-pressed={analysisTab === 'detectors'} onClick={() => setAnalysisTab('detectors')}>探测面与分支</button><button aria-pressed={analysisTab === 'energy'} onClick={() => setAnalysisTab('energy')}>元件权重与守恒</button></div>{analysisTab === 'detectors' ? <><p className="fd-hint">统计沿探测面切线的一维采样分布。接收率按光线权重计算，分光后采样数不会直接当作功率。</p><div className="fd-detector-grid">{result.detectors.map(d => <article className="fd-detector-card" key={d.elementId}><button onClick={() => setSelected(d.elementId)}><strong>{scene.elements.find(e => e.id === d.elementId)?.name ?? '探测面'}</strong><span>{percentage(d.power, result.energy.input)}</span></button><div className="fd-power-track"><i style={{ width: `${clamp(result.energy.input > 0 ? d.power / result.energy.input * 100 : 0, 0, 100)}%` }} /></div><dl><div><dt>到达采样数</dt><dd>{d.rayCount}</dd></div><div><dt>接收权重</dt><dd>{fmt(d.power, 5)}</dd></div><div><dt>中心</dt><dd>{fmt(d.centroid)} mm</dd></div><div><dt>RMS</dt><dd>{fmt(d.rms)} mm</dd></div><div><dt>范围</dt><dd>{fmt(d.span)} mm</dd></div><div><dt>角度 RMS</dt><dd>{fmt(d.angleRms)} mrad</dd></div></dl></article>)}</div>{!result.detectors.length && <p className="fd-empty">加入探测面以读取每条输出分支。</p>}</> : <><p className="fd-hint">输入 = 接收 + 离开范围 + 截光 / 损耗 + 未完成追迹。闭合残差 {fmt(result.energy.balanceError, 10)}。</p><div className="fd-table-scroll"><table><thead><tr><th>元件</th><th>入射权重</th><th>透射</th><th>反射</th><th>接收</th><th>吸收 / 截光</th><th>交点次数</th></tr></thead><tbody>{result.footprints.map(f => <tr key={f.elementId}><td>{scene.elements.find(e => e.id === f.elementId)?.name}</td><td>{fmt(f.incomingPower, 4)}</td><td>{fmt(f.transmittedPower, 4)}</td><td>{fmt(f.reflectedPower, 4)}</td><td>{fmt(f.capturedPower, 4)}</td><td>{fmt(f.absorbedPower, 4)}</td><td>{f.hits}</td></tr>)}</tbody></table></div><p className="fd-hint">同一元件可被多次照射；各行入射权重之和并非系统输入。</p></>}</section><FoldedScan scene={scene} commit={commit} />
      </main>
      <aside className="fd-inspector" aria-label="空间参数设置"><div className="fd-inspector-header"><h3>{current ? typeName(current.kind) : '入射光源'}</h3><button aria-pressed={selected === 'source'} onClick={() => setSelected('source')}>光源</button></div>{!current ? <><NumberField label="光源 x" value={scene.source.x} min={scene.bounds.minX} max={scene.bounds.maxX} change={x => source({ x })} /><NumberField label="光源 y" value={scene.source.y} min={scene.bounds.minY} max={scene.bounds.maxY} change={y => source({ y })} /><NumberField label="传播方向" value={scene.source.directionDeg} min={-180} max={180} unit="°" change={directionDeg => source({ directionDeg })} /><NumberField label="入射光源孔径" value={scene.source.diameter} min={.01} max={100} step={.1} change={diameter => source({ diameter })} /><NumberField label="发散全角" value={scene.source.fullAngle} min={0} max={200} step={.1} unit="mrad" change={fullAngle => source({ fullAngle })} /><label className="fd-select"><span>采样模型</span><select aria-label="空间光源采样模型" value={scene.source.model} onChange={e => source({ model: e.target.value as 'fan' | 'extended' })}><option value="fan">相关扇形</option><option value="extended">扩展源 · 高度与角度独立</option></select></label><NumberField label="请求采样数" value={scene.source.rayCount} min={3} max={101} step={2} unit="条" change={rayCount => source({ rayCount: Math.round(rayCount) })} /><NumberField label="输入相对权重" value={scene.source.intensity} min={0} max={1e6} step={.1} unit="a.u." change={intensity => source({ intensity })} /><NumberField label="波长记录" value={scene.source.wavelength} min={200} max={20000} step={1} unit="nm" change={wavelength => source({ wavelength })} /><p className="fd-hint">孔径与发散角独立设置。扩展源采用高度 × 角度网格，当前实际采样 {result.sourceRayCount} 条。波长不驱动镀膜色散；采样采用均匀输入权重。</p></> : <><label className="fd-select" htmlFor="fd-element-name"><span>元件名称</span><NameField key={current.id} id="fd-element-name" label="空间元件名称" value={current.name} change={name => element({ name })} /></label><NumberField label="元件 x" value={current.x} min={scene.bounds.minX} max={scene.bounds.maxX} change={x => element({ x })} /><NumberField label="元件 y" value={current.y} min={scene.bounds.minY} max={scene.bounds.maxY} change={y => element({ y })} /><NumberField label="表面法线方向" value={current.angleDeg} min={-180} max={180} unit="°" change={angleDeg => element({ angleDeg })} /><div className="fd-rotate-actions"><button onClick={() => element({ angleDeg: ((current.angleDeg - 5 + 540) % 360) - 180 })}>↶ 5°</button><button onClick={() => element({ angleDeg: ((current.angleDeg + 5 + 540) % 360) - 180 })}>↷ 5°</button></div><NumberField label="表面长度 / 外径" value={current.diameter} min={.01} max={500} change={diameter => element({ diameter, aperture: Math.min(current.aperture, diameter) })} /><NumberField label="模型有效孔径" value={current.aperture} min={.001} max={current.diameter} step={.1} change={aperture => element({ aperture })} />{current.kind === 'lens' && <><NumberField label="薄透镜焦距" value={current.focal} min={-10000} max={10000} change={focal => { if (Math.abs(focal) < 1) setNotice('薄透镜焦距需满足 |f| ≥ 1 mm。'); else element({ focal }); }} /><p className="fd-hint">正焦距会聚、负焦距发散；局部近轴模型，过大入射角请查看模型提示。</p></>}{['mirror', 'beamsplitter'].includes(current.kind) && <><NumberField label="功率反射率 R" value={current.reflectance} min={0} max={current.kind === 'mirror' || lossless ? 1 : 1 - current.transmittance} step={.01} unit="0–1" change={reflectance => element(lossless ? { reflectance, transmittance: 1 - reflectance } : { reflectance })} />{current.kind === 'beamsplitter' && <NumberField label="功率透射率 T" value={current.transmittance} min={0} max={lossless ? 1 : 1 - current.reflectance} step={.01} unit="0–1" change={transmittance => element(lossless ? { transmittance, reflectance: 1 - transmittance } : { transmittance })} />}{current.kind === 'beamsplitter' ? <><label className="fd-lossless-toggle"><input type="checkbox" checked={lossless} onChange={e => { const checked = e.target.checked; setLosslessPreferences(previous => ({ ...previous, [current.id]: checked })); if (checked) element({ transmittance: 1 - current.reflectance }); }} />保持无损 R+T=1</label><p className="fd-hint">勾选时 R 与 T 联动。取消后可先降低任一系数，设置 R+T&lt;1 的吸收；剩余部分计入损耗。</p></> : <p className="fd-hint">镜面只产生反射分支；1−R 计入吸收，透射系数不参与此镜面计算。</p>}<p className="fd-hint">系数为强度比例，分支不计算相位或干涉。</p>{current.kind === 'beamsplitter' && <div className="fd-rotate-actions"><button onClick={() => element({ reflectance: .5, transmittance: .5 })}>理想 50 / 50</button><button onClick={() => element({ reflectance: .3, transmittance: .7 })}>理想 30 / 70</button></div>}</>}{current.kind === 'detector' && <p className="fd-hint">探测面吸收孔径内到达光线；孔径外截光。RMS 和中心均以本探测面中心为坐标原点。</p>}<div className="fd-edit-actions"><button onClick={() => { if (scene.elements.length >= 48) return; const e = { ...current, id: crypto.randomUUID(), name: current.name + ' 副本', x: clamp(current.x + 20, scene.bounds.minX, scene.bounds.maxX), y: clamp(current.y + 20, scene.bounds.minY, scene.bounds.maxY) }; commit({ ...scene, elements: [...scene.elements, e] }); setSelected(e.id); }}>复制元件</button><button onClick={() => { commit({ ...scene, elements: scene.elements.filter(e => e.id !== current.id) }); setSelected('source'); }}>移除</button></div>{catalogPart && <details className="fd-catalog-note"><summary>{catalogPart.sku} · 参考规格与模型依据</summary><p>{catalogPart.title}</p><p>{catalogPart.thicknessMm === null ? '立方外形尺寸：' + catalogPart.dimensionsMm?.join(' × ') + ' mm。' : '标称厚度：' + catalogPart.thicknessMm + ' mm。'}厚度未进入本模型。</p><p>图上元件为单一理想等效面；R/T 与孔径可自定义。当前数值不是实测镀膜参数。</p>{catalogPart.notes.map(note => <p key={note}>{note}</p>)}<a href={catalogPart.sourceUrl} target="_blank" rel="noreferrer">官方产品页 ↗</a> · <a href={catalogPart.evidenceUrl} target="_blank" rel="noreferrer">规格依据 ↗</a></details>}</>}
        <details className="fd-bounds"><summary>计算区域 / mm</summary><NumberField label="x 最小值" value={scene.bounds.minX} min={-10000} max={scene.bounds.maxX - 1} change={minX => bounds({ minX })} /><NumberField label="x 最大值" value={scene.bounds.maxX} min={scene.bounds.minX + 1} max={10000} change={maxX => bounds({ maxX })} /><NumberField label="y 最小值" value={scene.bounds.minY} min={-10000} max={scene.bounds.maxY - 1} change={minY => bounds({ minY })} /><NumberField label="y 最大值" value={scene.bounds.maxY} min={scene.bounds.minY + 1} max={10000} change={maxY => bounds({ maxY })} /><p className="fd-hint">光源和元件中心应在区域内，离开区域的光线记为逸出。画布横纵等比例。</p><button onClick={() => load(blankFoldedScene())}>新建空白工程</button></details>
      </aside>
    </div><footer className="fd-footer"><strong>模型范围</strong><p>真实 XY 反射与分光，局部近轴薄透镜。分光系数为非相干强度比例；预设 50/50 属于教学假设。本模式尚未计算厚透镜、像差、色差、偏振、干涉及 Gaussian q 包络。探测结果是一维几何采样统计，不是二维衍射 PSF。</p><p>参考器件尺寸来自 <a href="https://www.thorlabs.com/" target="_blank" rel="noreferrer">Thorlabs</a> 官方页面与官方目录，核对日期 {foldedCatalog.checkedOn}。{foldedCatalog.provenanceNote}</p></footer>
    {importOpen && <dialog ref={dialog} className="fd-import-dialog" onCancel={e => { e.preventDefault(); setImportOpen(false); }}><div className="fd-section-bar"><h3>导入空间工程</h3><button aria-label="关闭工程导入" onClick={() => setImportOpen(false)}>×</button></div><p>导入本工作台导出的 JSON 文件，或粘贴完整工程。最大 250 KB。</p><input ref={inputFile} type="file" accept=".json,application/json" aria-label="选择空间工程文件" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 250_000) { setImportError('工程文件最大 250 KB。'); return; } try { setJsonText(await file.text()); setImportError(''); } catch { setImportError('文件读取失败。'); } }} /><textarea aria-label="空间工程 JSON" value={jsonText} onChange={e => setJsonText(e.target.value)} rows={12} spellCheck={false} />{importError && <p className="fd-import-error" role="alert">{importError}</p>}<div className="fd-dialog-actions"><button onClick={() => setImportOpen(false)}>取消</button><button className="fd-primary" onClick={importText}>导入工程</button></div></dialog>}
  </div>;
}
