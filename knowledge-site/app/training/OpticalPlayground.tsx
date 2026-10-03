import { useEffect, useId, useRef, useState } from 'react';
import catalog from './thorlabs-catalog.json';
import { blankScene, customLens, missionChecks, missionStart, parseScene, traceBench, type BenchElement, type BenchScene, type Mission } from './bench-engine';
import './optical-playground.css';

const STORAGE = 'pcsel-optical-playground-v1';
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const fmt = (n: number | null, digits = 2) => n === null ? '—' : n.toFixed(digits);
const titles: Record<Mission, string> = { free: '自由搭建', collimate: '01 准直发散光', expand: '02 两倍扩束', focus: '03 找到焦平面' };
function initialScene(): BenchScene {
  try {
    const stored = localStorage.getItem(STORAGE);
    if (stored) {
      const raw = JSON.parse(stored) as BenchScene;
      const parsed = parseScene(raw);
      parsed.elements = parsed.elements.map((e, i) => {
        const p = catalog.find(p => p.sku === raw.elements[i].sku);
        return p && e.kind === 'lens' && e.focal === p.focal && e.diameter === p.diameter && e.aperture === p.aperture ? { ...e, name: p.sku, sku: p.sku } : e;
      });
      return parsed;
    }
  } catch { /* Start clean on corrupt or inaccessible storage. */ }
  const s = blankScene();
  s.elements = [customLens('example-1', 100), { ...customLens('example-2', 250), focal: 100 }];
  return s;
}
function NumberField({ label, value, min, max, step = 1, unit = 'mm', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onChange(clamp(Number(draft), min, max)); setDraft(null); };
  return <label className="op-field"><span>{label}<small>{unit}</small></span><input type="number" aria-label={label} min={min} max={max} step={step} value={draft ?? value} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /></label>;
}

export function OpticalPlayground() {
  const [history, setHistory] = useState<{ past: BenchScene[]; present: BenchScene; future: BenchScene[] }>(() => ({ past: [], present: initialScene(), future: [] }));
  const scene = history.present;
  const [selected, setSelected] = useState<string | null>(null);
  const [mission, setMission] = useState<Mission>('free');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [snap, setSnap] = useState(true);
  const [notice, setNotice] = useState('从左侧加入元件，再拖动镜片。点击元件可编辑精确位置。');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [zoom, setZoom] = useState(false);
  const [dragRange, setDragRange] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; before: BenchScene; dz: number; dy: number } | null>(null);
  const uid = useId().replaceAll(':', '');
  const result = traceBench(scene);
  const current = scene.elements.find(e => e.id === selected);
  const product = current?.sku ? catalog.find(p => p.sku === current.sku) : null;
  const checks = missionChecks(mission, scene, result);
  const won = checks.length > 0 && checks.every(c => c.pass);
  const commit = (next: BenchScene) => setHistory(h => JSON.stringify(h.present) === JSON.stringify(next) ? h : ({ past: [...h.past, h.present].slice(-50), present: next, future: [] }));
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(scene)); } catch { /* UI remains usable without storage. */ } }, [scene]);
  const edit = (change: Partial<BenchElement>, custom = false) => {
    commit({ ...scene, elements: scene.elements.map(e => e.id === selected ? { ...e, ...change, ...(custom ? { sku: undefined, name: e.kind === 'lens' ? '自定义透镜' : '可调光阑' } : {}) } : e) });
  };
  const add = (part: string, at?: { z: number; y: number }) => {
    if (scene.elements.length >= 16) { setNotice('当前最多放置 16 个元件；可先移除一片。'); return; }
    const found = catalog.find(p => p.sku === part);
    const z = at?.z ?? clamp((scene.elements.at(-1)?.z ?? 0) + 80, 5, scene.screen - 5);
    const e = customLens(crypto.randomUUID(), z);
    if (found) Object.assign(e, { name: found.sku, sku: found.sku, focal: found.focal, diameter: found.diameter, aperture: found.aperture });
    else if (part === 'iris') Object.assign(e, { kind: 'iris', name: '可调光阑', aperture: 3 });
    e.y = at?.y ?? 0;
    commit({ ...scene, elements: [...scene.elements, e] }); setSelected(e.id); setNotice(`已加入 ${e.name}。拖动调整位置，右侧可输入精确数值。`);
  };
  const changeMission = (next: Mission) => { setMission(next); if (next !== 'free') { commit(missionStart(next)); setSelected(null); } setNotice(next === 'free' ? '保留当前光路，继续自由搭建。' : '已载入练习起点；完成条件会实时更新。可撤销光路变化。'); };
  const undo = () => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setSelected(null); };
  const redo = () => { setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setSelected(null); };
  // Separate longitudinal and transverse scales keep the near-axis geometry legible.
  const range = dragRange ?? Math.max(20, scene.diameter, ...scene.elements.map(e => Math.abs(e.y) + e.diameter / 2), ...result.rays.flatMap(r => r.points.map(p => Math.abs(p.y)))) * 1.15;
  const x = (z: number) => 45 + z / scene.screen * 810;
  const y = (height: number) => 180 - height / range * 125;
  const position = (clientX: number, clientY: number, moving = false) => {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    const round = (n: number) => snap ? Math.round(n / 5) * 5 : Math.round(n * 10) / 10;
    return { z: clamp(round((point.x - 45) / 810 * scene.screen - (moving ? drag.current?.dz ?? 0 : 0)), 5, scene.screen - 5), y: clamp(Math.round(((180 - point.y) / 125 * range - (moving ? drag.current?.dy ?? 0 : 0)) * 10) / 10, -30, 30) };
  };
  const finishDrag = () => { if (!drag.current) return; const before = drag.current.before; setHistory(h => JSON.stringify(before) === JSON.stringify(h.present) ? h : ({ past: [...h.past, before].slice(-50), present: h.present, future: [] })); drag.current = null; setDragRange(null); };
  const importScene = () => { try { if (jsonText.length > 50000) throw new Error('文件过大。'); commit(parseScene(JSON.parse(jsonText))); setMission('free'); setSelected(null); setJsonOpen(false); setJsonError(''); setNotice('已导入；文件中的元件按自定义参数处理。'); } catch (error) { setJsonError(`导入失败：${error instanceof Error ? error.message : 'JSON 无效'}`); } };
  const filtered = catalog.filter(p => (filter === 'all' || p.kind === filter) && `${p.sku} ${p.focal}`.toLowerCase().includes(query.toLowerCase()));
  return <section id="optical-playground" className="op-playground ob-container" aria-labelledby="op-title">
    <header className="op-heading"><div><span className="op-eyebrow">OPTICAL PLAYGROUND / 交互实验室</span><h2 id="op-title">把透镜当积木，把光路搭出来。</h2><p>选器件 → 拖到光路 → 调参数 → 看光线。每一条光线都由当前设置实时计算。</p></div><span className="op-live"><i /> 本地设计台 · v0.3</span></header>
    <nav className="op-missions" aria-label="光路挑战">{(Object.keys(titles) as Mission[]).map(m => <button key={m} aria-pressed={mission === m} className={mission === m ? 'active' : ''} onClick={() => changeMission(m)}>{titles[m]}<span>{m === 'free' ? '无限次试错' : m === 'collimate' ? '把方向调平' : m === 'expand' ? '组合两片镜' : '让光线交会'}</span></button>)}</nav>
    <div className="op-workspace">
      <aside className="op-library"><div className="op-panel-title"><h3>器件盒</h3><span>12 型号</span></div><input className="op-search" aria-label="搜索器件" placeholder="搜索型号 / 焦距" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="器件分类" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部透镜</option><option value="convex">平凸 · 会聚</option><option value="concave">平凹 · 发散</option><option value="doublet">消色差双胶合</option></select><div className="op-parts">{filtered.map(p => <button key={p.sku} draggable onDragStart={e => e.dataTransfer.setData('text/plain', p.sku)} onClick={() => add(p.sku)} className="op-part" aria-label={`加入 ${p.sku}`}><span className={`op-part-art ${p.kind}`} aria-hidden="true">{p.kind === 'concave' ? ')(' : p.kind === 'doublet' ? '(|)' : '()'}</span><span><strong>{p.sku}</strong><small>f {p.focal > 0 ? '+' : ''}{p.focal} · Ø{p.diameter} mm</small><em>{p.coating}</em></span><b aria-hidden="true">＋</b></button>)}{!filtered.length && <p>没有匹配型号。</p>}</div><div className="op-custom"><button onClick={() => add('custom')}>＋ 自定义透镜</button><button onClick={() => add('iris')}>＋ 可调光阑</button></div><p className="op-muted">点击加入，也可从器件盒拖入画布。支持最多 16 个元件。</p></aside>
      <div className="op-center"><div className="op-toolbar"><span><b>{scene.elements.length}</b> 个元件 · 空气中传播</span><div><button onClick={undo} disabled={!history.past.length} aria-label="撤销光路修改">↶ 撤销</button><button onClick={redo} disabled={!history.future.length} aria-label="重做光路修改">↷ 重做</button><button onClick={() => { commit({ ...scene, elements: [] }); setSelected(null); }}>清空</button></div></div>
        <div className={`op-stage ${zoom ? 'op-zoom' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const part = e.dataTransfer.getData('text/plain'); if (catalog.some(p => p.sku === part)) add(part, position(e.clientX, e.clientY)); }}>
          <svg ref={svg} viewBox="0 0 900 355" aria-label="可拖动的自由组合光路" className="op-bench" onPointerMove={e => { if (!drag.current) return; const at = position(e.clientX, e.clientY, true); const id = drag.current.id; setHistory(h => ({ ...h, present: { ...h.present, elements: h.present.elements.map(el => el.id === id ? { ...el, ...at } : el) } })); }} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
            <defs><pattern id={`${uid}-holes`} width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#344a48" /></pattern><clipPath id={`${uid}-clip`}><rect x="25" y="40" width="855" height="280" /></clipPath></defs>
            <rect x="0" y="0" width="900" height="355" rx="12" fill="#142b2b" /><rect x="20" y="40" width="860" height="275" fill={`url(#${uid}-holes)`} /><path d="M35 180H865" stroke="#658280" strokeDasharray="5 6" /><text x="28" y="27" fill="#b2c8bd" fontSize="11">光沿 +z 方向传播 →</text><text x="865" y="27" textAnchor="end" fill="#9ab3ac" fontSize="10">纵向 ±{fmt(range, 1)} mm · 横纵独立比例</text>
            <g clipPath={`url(#${uid}-clip)`}>{result.rays.map((r, i) => <g key={i}><polyline points={r.points.map(p => `${x(p.z)},${y(p.y)}`).join(' ')} fill="none" stroke={r.blocked ? '#fba67a' : '#bde894'} strokeWidth="1.2" opacity={r.blocked ? .45 : .6} />{r.blocked && <path d={`M${x(r.points.at(-1)!.z) - 3} ${y(r.points.at(-1)!.y) - 3}l6 6m0 -6l-6 6`} stroke="#ff8969" strokeWidth="2" />}</g>)}</g>
            <path d={`M45 ${y(scene.diameter / 2)}V${y(-scene.diameter / 2)}`} stroke="#ffd39b" strokeWidth="6" /><text x="45" y="330" textAnchor="middle" fill="#c8d9d0" fontSize="11">光源 0</text>
            <path d="M855 52V307" stroke="#a9bfc0" strokeWidth="3" />{result.rays.filter(r => !r.blocked).map((r, i) => <circle key={i} cx="855" cy={y(r.points.at(-1)!.y)} r="2" fill="#e4fdb4" />)}<text x="852" y="330" textAnchor="end" fill="#c8d9d0" fontSize="11">目标面 {scene.screen} mm</text>
            {[...scene.elements].sort((a, b) => a.z - b.z).map((el, i) => { const px = x(el.z); const top = y(el.y + el.diameter / 2); const bottom = y(el.y - el.diameter / 2); const middle = y(el.y); return <g key={el.id} className="op-optic" role="button" tabIndex={0} aria-label={`选择元件 ${i + 1} ${el.name}`} aria-pressed={selected === el.id} onPointerDown={e => { e.preventDefault(); setSelected(el.id); const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()); drag.current = { id: el.id, before: scene, dz: (point.x - 45) / 810 * scene.screen - el.z, dy: (180 - point.y) / 125 * range - el.y }; setDragRange(range); e.currentTarget.setPointerCapture(e.pointerId); }} onClick={() => setSelected(el.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(el.id); } if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); commit({ ...scene, elements: scene.elements.map(item => item.id === el.id ? { ...item, z: clamp(item.z + (e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0), 5, scene.screen - 5), y: clamp(item.y + (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0), -30, 30) } : item) }); } }}>
              <rect x={px - 15} y="49" width="30" height="261" rx="8" fill={selected === el.id ? '#d3ffb30d' : 'transparent'} stroke={selected === el.id ? '#bce48d' : 'transparent'} strokeDasharray="3 4" />
              {el.kind === 'lens' ? <path d={el.focal > 0 ? `M${px} ${top}Q${px - 15} ${middle} ${px} ${bottom}Q${px + 15} ${middle} ${px} ${top}Z` : `M${px - 7} ${top}Q${px + 1} ${middle} ${px - 7} ${bottom}H${px + 7}Q${px - 1} ${middle} ${px + 7} ${top}Z`} fill="#8cdbdd44" stroke="#b3edf0" strokeWidth="2" /> : <path d={`M${px} ${top}V${y(el.y + el.aperture / 2)}M${px} ${y(el.y - el.aperture / 2)}V${bottom}`} stroke="#efbf83" strokeWidth="7" />}
              <path d={`M${px - 8} ${y(el.y + el.aperture / 2)}h16M${px - 8} ${y(el.y - el.aperture / 2)}h16`} stroke="#e3b888" strokeWidth="2" /><text x={px} y={i % 2 ? 77 : 60} textAnchor="middle" fontSize="11" fill="#d6ede3">{el.kind === 'lens' ? 'L' : 'A'}{i + 1}</text><text x={px} y={i % 2 ? 297 : 312} textAnchor="middle" fontSize="10" fill="#a8c4b7">{fmt(el.z, 0)}</text>
            </g>; })}
          </svg>
        </div>
        <div className="op-stage-footer"><label><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />横向吸附 5 mm</label><button aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? '还原画布' : '放大画布'}</button><span>拖动：位置 / 高度 · 方向键：微调 · 橙色 ×：截光</span></div>
        <div className="op-metrics"><div><span>目标面几何范围</span><strong>{fmt(result.span)}<small> mm</small></strong></div><div><span>输出角度范围</span><strong>{fmt(result.angleSpan)}<small> mrad</small></strong></div><div><span>通过采样光线</span><strong>{result.passed}<small> / {result.total}</small></strong></div></div>
        <div className="op-feedback" role="status">{result.maxSlope > .1 ? '当前部分光线角度超过 0.1 rad，近轴误差可能明显，请减小发散角或使用更长焦距。' : result.coincidences ? '有元件间距小于 1 mm。计算仍按薄透镜处理，请拉开位置；这里不校验真实镜架碰撞。' : result.passed < result.total ? '光线被通光孔径挡住了。试着增大光阑、减小入射口径，或将镜片移回光轴。' : notice}</div>
        {mission !== 'free' && <div className={`op-challenge ${won ? 'won' : ''}`}><div><strong>{won ? '✓ 挑战达成' : titles[mission]}</strong><span>{checks.filter(c => c.pass).length} / {checks.length}</span></div>{checks.map(c => <p key={c.label}><span>{c.pass ? '●' : '○'}</span>{c.label}</p>)}<details><summary>看一个思路</summary><p>{mission === 'collimate' ? '关联光束的虚拟起点在入射面之前 D/Θ = 50 mm。放置 f = 100 mm 的薄透镜，使虚拟起点位于它的前焦点：z = 50 mm。' : mission === 'expand' ? '开普勒扩束：f₁ = 50 mm、f₂ = 100 mm，镜间距 f₁ + f₂ = 150 mm。例如两片放在 z = 100 和 250 mm。' : '平行入射经过 f = 100 mm 的薄透镜，焦点位于其后 100 mm。目标面在 z = 400 mm 时，镜片应放在哪里？'}</p></details></div>}
        <div className="op-source"><div className="op-panel-title"><h3>入射光源</h3><span>z = 0 mm</span></div><div className="op-source-fields"><NumberField label="入射光源口径" value={scene.diameter} min={.1} max={30} step={.1} onChange={n => commit({ ...scene, diameter: n })} /><NumberField label="发散全角" value={scene.fullAngle} min={0} max={100} step={1} unit="mrad" onChange={n => commit({ ...scene, fullAngle: n })} /><NumberField label="目标面位置" value={scene.screen} min={Math.max(100, ...scene.elements.map(e => e.z + 5))} max={1500} onChange={n => commit({ ...scene, screen: n })} /></div><label className="op-model">光源模型<select aria-label="光源模型" value={scene.sourceModel} onChange={e => commit({ ...scene, sourceModel: e.target.value as BenchScene['sourceModel'] })}><option value="fan">关联发散束 · 边缘角度最大</option><option value="extended">扩展源 · 每个位置向多个角度发光</option></select></label><p>口径 D 是入射面几何直径；全角 Θ = 2α，当前半角 α = {fmt(scene.fullAngle / 2, 1)} mrad（{fmt(scene.fullAngle / 2000 * 180 / Math.PI, 2)}°）。Θ = 0 表示平行入射。不是高斯束 1/e² 定义。</p></div>
      </div>
      <aside className="op-inspector"><div className="op-panel-title"><h3>元件检查器</h3><span>{current ? '已选中' : '点击镜片'}</span></div>{current ? <><h4>{current.name}</h4><p className="op-muted">{product ? '厂家标称 f / 外径 · 薄透镜近似' : '自定义教学元件'}</p><div className="op-inspector-fields"><NumberField key={`${current.id}-z`} label="元件位置 z" value={current.z} min={5} max={scene.screen - 5} onChange={n => edit({ z: n })} /><NumberField key={`${current.id}-y`} label="中心高度 y" value={current.y} min={-30} max={30} step={.1} onChange={n => edit({ y: n })} />{current.kind === 'lens' && <NumberField key={`${current.id}-f`} label="焦距 f" value={current.focal} min={-1000} max={1000} onChange={n => { if (Math.abs(n) < 5) { setNotice('焦距不能为零，|f| 至少为 5 mm。'); return; } edit({ focal: n }, true); }} />}<NumberField key={`${current.id}-d`} label="元件外径" value={current.diameter} min={1} max={60} step={.1} onChange={n => edit({ diameter: n, aperture: Math.min(n, current.aperture) }, true)} /><NumberField key={`${current.id}-a`} label="通光孔径" value={current.aperture} min={.1} max={current.diameter} step={.1} onChange={n => edit({ aperture: n }, true)} /></div>{product && <div className="op-spec"><span>镀膜波段 {product.coating}</span><p>通光孔径暂按外径 90% 建模。厚度、后焦距及厂家通光孔径尚未核验。修改光学参数会转为自定义元件。</p><a href={product.source} target="_blank" rel="noreferrer">官网产品页 ↗</a><a href={product.record} download>下载官网规格记录 ↓</a></div>}<div className="op-element-actions"><button onClick={() => { if (scene.elements.length >= 16) { setNotice('已达到 16 个元件上限。'); return; } const e = { ...current, id: crypto.randomUUID(), z: clamp(current.z + 30, 5, scene.screen - 5) }; commit({ ...scene, elements: [...scene.elements, e] }); setSelected(e.id); }}>复制元件</button><button onClick={() => { commit({ ...scene, elements: scene.elements.filter(e => e.id !== selected) }); setSelected(null); }}>移除元件</button></div></> : <div className="op-empty"><span aria-hidden="true">( )</span><h4>你的下一片透镜</h4><p>从器件盒加入一片，或点击画布中的镜片。可输入负焦距，探索发散透镜。</p></div>}<div className="op-order"><h4>光路顺序</h4>{[...scene.elements].sort((a, b) => a.z - b.z).map((e, i) => <button key={e.id} onClick={() => setSelected(e.id)} aria-pressed={selected === e.id}><b>{String(i + 1).padStart(2, '0')}</b><span>{e.name}<small>z = {fmt(e.z, 1)} mm</small></span></button>)}{!scene.elements.length && <p>一张空白实验台，等你开始。</p>}</div></aside>
    </div>
    <div className="op-bottom-bar"><span>本机自动保存光路 · 可撤销最近 50 次修改</span><button onClick={() => { setJsonText(JSON.stringify(scene, null, 2)); setJsonOpen(!jsonOpen); }}>保存 / 导入设计 JSON</button></div>
    {jsonOpen && <div className="op-json"><label htmlFor={`${uid}-json`}>光路设计 JSON（导入后元件按自定义处理）</label><textarea id={`${uid}-json`} value={jsonText} onChange={e => { setJsonText(e.target.value); setJsonError(''); }} rows={8} />{jsonError && <p role="alert">{jsonError}</p>}<div><a download="optical-bench-scene.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(scene, null, 2))}`}>下载当前设计</a><button onClick={importScene}>导入文本</button><button onClick={() => setJsonOpen(false)}>关闭</button></div></div>}
    <details className="op-docs"><summary>器件数据来源、下载与计算边界</summary><p>12 个型号的外径、标称焦距、镀膜波段来自 2026-09-30 下载的 Thorlabs 官方公开产品接口。原始记录随页面保留。官网 CAD 文件服务器返回 HTTP 403，因此工程图、厚度、后焦距与真实通光孔径尚未核验；未提供虚假的 PDF 下载。</p><div className="op-downloads"><a href="/training/thorlabs/catalog.csv" download>器件参数 CSV ↓</a><a href="/training/thorlabs/catalog.json" download>器件参数 JSON ↓</a><a href="/training/thorlabs/download-manifest.json" download>原始来源与下载状态 ↓</a></div><div className="op-table-scroll"><table><caption>官网标称参数；通光孔径为明确标注的教学假设</caption><thead><tr><th>型号 / 原始记录</th><th>外径 mm</th><th>标称 f mm</th><th>镀膜 nm</th><th>模型孔径 mm</th></tr></thead><tbody>{catalog.map(p => <tr key={p.sku}><td><a href={p.record} target="_blank" rel="noreferrer">{p.sku}</a></td><td>{p.diameter}</td><td>{p.focal}</td><td>{p.coating}</td><td>{p.aperture}（假设）</td></tr>)}</tbody></table></div><p>计算采用 y₂ = y₁ + dθ₁、θ₂ = θ₁ − (y − y镜)/f，元件位置代表理想薄透镜平面。支持沿一条轴的透镜和光阑组合；双胶合透镜在此以其等效焦距表示，未模拟色差、像差、衍射、反射镜折转、真实镜架与厚透镜主面偏移。目标面无有限孔径。通过光线数是离散采样指标，不是透过率或功率。</p><p>关联发散束用 θ = (2y/D)α；扩展源独立采样位置和角度。单一透镜通常无法把扩展源所有光线都准直。几何焦点范围可为零，但真实焦斑不会为零。</p></details>
  </section>;
}
