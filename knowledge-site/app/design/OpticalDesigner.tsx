import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import catalog from '../training/thorlabs-catalog.json';
import { analyzeDesign, catalogDesignLens, customDesignLens, optimizePositions, type DesignElement, type DesignProject, type DesignSource, type OptimizeResult } from './design-engine';
import { DesignCanvas, type Selection } from './DesignCanvas';
import { DesignAnalysis, formatValue as fmt } from './DesignAnalysis';
import { DRAFT_KEY, LIBRARY_KEY, loadDraft, loadLibrary, parseDesignFile, presetProject, presets, type DesignFile, type DesignGoal, type SavedDesign } from './design-projects';
import { designReport, downloadText, prescriptionCsv } from './design-export';
import { FoldedDesigner } from './FoldedDesigner';
import { convertSequentialProject } from './design-conversion';
import type { FoldedScene } from './folded-engine';
import { OpticsIcon } from './OpticsIcon';
import { WorkspacePanel } from './WorkspacePanel';
import './optical-designer.css';
import './sequential-polish.css';
import './designer-theme.css';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function Numeric({ label, value, onChange, min, max, unit = 'mm', step = 1, compact = false }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string; step?: number; compact?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => { if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onChange(clamp(Number(draft), min, max)); setDraft(null); };
  return <label className={`od-number ${compact ? 'compact' : ''}`}>{!compact && <span>{label}<small>{unit}</small></span>}<input type="number" aria-label={label} value={draft ?? Number(value.toFixed(6))} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} /></label>;
}
export function OpticalDesigner() {
  const [mode, setMode] = useState<'sequential' | 'spatial'>(() => {
    try { return localStorage.getItem('pcsel-optics-workspace-mode-v1') === 'sequential' ? 'sequential' : 'spatial'; } catch { return 'spatial'; }
  });
  const [spatial, setSpatial] = useState<FoldedScene>();
  const sequentialTab = useRef<HTMLButtonElement>(null);
  const spatialTab = useRef<HTMLButtonElement>(null);
  const changeModelWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'sequential' : event.key === 'End' ? 'spatial' : mode === 'sequential' ? 'spatial' : 'sequential';
    setMode(next);
    (next === 'sequential' ? sequentialTab : spatialTab).current?.focus();
  };
  useEffect(() => { try { localStorage.setItem('pcsel-optics-workspace-mode-v1', mode); } catch { /* Both workspaces still support downloadable files. */ } }, [mode]);
  const copyToSpatial = (p: DesignProject) => {
    setSpatial(convertSequentialProject(p));
    setMode('spatial');
  };
  return <div className="od-design-app">
    <nav className="od-mode-switch" aria-label="设计模式">
      <span className="ol-model-label">计算模型</span>
      <div role="tablist" aria-label="计算模型">
        <button ref={sequentialTab} id="od-sequential-tab" role="tab" aria-label="顺序光路 · Gaussian / 优化" tabIndex={mode === 'sequential' ? 0 : -1} aria-selected={mode === 'sequential'} aria-controls="od-sequential-panel" onKeyDown={changeModelWithKeyboard} onClick={() => setMode('sequential')}><OpticsIcon name="layers" size={17} /><span>顺序光路<span className="od-mode-detail"> · Gaussian / 优化</span></span></button>
        <button ref={spatialTab} id="od-spatial-tab" role="tab" aria-label="空间光路 · 折转 / 分光" tabIndex={mode === 'spatial' ? 0 : -1} aria-selected={mode === 'spatial'} aria-controls="od-spatial-panel" onKeyDown={changeModelWithKeyboard} onClick={() => setMode('spatial')}><OpticsIcon name="splitter" size={17} /><span>空间光路<span className="od-mode-detail"> · 折转 / 分光</span></span></button>
      </div><span className="od-local-badge"><i />本地工作台</span>
    </nav>
    <div id="od-sequential-panel" role="tabpanel" aria-labelledby="od-sequential-tab" hidden={mode !== 'sequential'} style={{ display: mode === 'sequential' ? undefined : 'none' }}><SequentialDesigner onConvert={copyToSpatial} /></div>
    <div id="od-spatial-panel" role="tabpanel" aria-labelledby="od-spatial-tab" hidden={mode !== 'spatial'} style={{ display: mode === 'spatial' ? undefined : 'none' }}><FoldedDesigner initialScene={spatial} /></div>
  </div>;
}

function SequentialDesigner({ onConvert }: { onConvert: (project: DesignProject) => void }) {
  const [initial] = useState(loadDraft);
  const [history, setHistory] = useState<{ past: DesignProject[]; present: DesignProject; future: DesignProject[] }>(() => ({ past: [], present: initial.project, future: [] }));
  const project = history.present;
  const [goal, setGoal] = useState<DesignGoal>(initial.goal);
  const [variableIds, setVariableIds] = useState(initial.variableIds);
  const [selected, setSelected] = useState<Selection>('source');
  const [sidebar, setSidebar] = useState('parts');
  const [inspectorTab, setInspectorTab] = useState('inspect');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [saved, setSaved] = useState<SavedDesign[]>(loadLibrary);
  const [notice, setNotice] = useState('工程草稿保存在当前浏览器。可从模板或器件库开始设计。');
  const [stored, setStored] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const [minGap, setMinGap] = useState(initial.constraints?.minGap ?? 5);
  const [maxAngle, setMaxAngle] = useState(initial.constraints?.maxOutputAngle ?? (initial.goal.kind === 'diameter' ? 1 : 0));
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<{ hash: string; result: OptimizeResult } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const file: DesignFile = useMemo(() => ({ format: 'pcsel-optics-design', formatVersion: 1, project, goal, variableIds: [...new Set(variableIds.filter(id => project.elements.some(e => e.id === id)))], constraints: { minGap, maxOutputAngle: maxAngle } }), [project, goal, variableIds, minGap, maxAngle]);
  const a = analyzeDesign(project);
  const current = project.elements.find(e => e.id === selected);
  const part = current?.sku ? catalog.find(c => c.sku === current.sku) : null;
  const ordered = [...project.elements].sort((a, b) => a.z - b.z);
  const activeCandidate = candidate?.hash === JSON.stringify(file) ? candidate.result : null;
  const metric = project.source.mode === 'gaussian' ? a.gaussian?.screen.diameter ?? null : a.span;
  const commit = (next: DesignProject) => setHistory(h => JSON.stringify(next) === JSON.stringify(h.present) ? h : ({ past: [...h.past, h.present].slice(-60), present: next, future: [] }));
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(file)); setStored(true); } catch { setStored(false); } }, [file]);
  const updateSource = (patch: Partial<DesignSource>) => commit({ ...project, source: { ...project.source, ...patch } });
  const editElement = (id: string, patch: Partial<DesignElement>, optical = false) => {
    if (patch.focal !== undefined && Math.abs(patch.focal) < 5) { setNotice('焦距不能为零，|f| 至少 5 mm。'); return; }
    commit({ ...project, elements: project.elements.map(e => e.id === id ? { ...e, ...patch, ...(optical ? { sku: undefined, apertureBasis: 'custom' as const } : {}) } : e) });
  };
  const setScreen = (z: number) => { const minimum = Math.max(10, ...project.elements.map(e => e.z + .1)); commit({ ...project, screen: clamp(z, minimum, 5000) }); };
  const addPart = (sku: string, position?: number, height = 0) => {
    if (project.elements.length >= 24) { setNotice('最多支持 24 个顺序元件。'); return; }
    const last = ordered.at(-1)?.z ?? 0;
    const z = position ?? clamp(last + 60, .1, project.screen - .1);
    const catalogPart = catalog.find(p => p.sku === sku);
    if (!catalogPart && !['custom', 'negative', 'iris'].includes(sku)) return;
    const element = catalogPart ? catalogDesignLens(catalogPart, crypto.randomUUID(), z) : customDesignLens(crypto.randomUUID(), z);
    element.y = height;
    if (sku === 'negative') { element.focal = -50; element.name = '自定义负透镜'; }
    if (sku === 'iris') { element.kind = 'iris'; element.name = '可调光阑'; element.aperture = 3; }
    commit({ ...project, elements: [...project.elements, element] }); setSelected(element.id); setInspectorTab('inspect');
    if (element.kind === 'lens') setVariableIds(ids => [...ids, element.id]);
    setNotice(`已加入 ${element.name}，点击或拖动元件继续调整。`);
  };
  const removeElement = (id: string) => { commit({ ...project, elements: project.elements.filter(e => e.id !== id) }); setSelected('source'); };
  const copyElement = (el: DesignElement) => {
    if (project.elements.length >= 24) { setNotice('已达到 24 个元件上限。'); return; }
    const copy = { ...el, id: crypto.randomUUID(), z: clamp(el.z + 20, .1, project.screen - .1) };
    commit({ ...project, elements: [...project.elements, copy] }); setSelected(copy.id);
    if (variableIds.includes(el.id)) setVariableIds(ids => [...ids, copy.id]);
  };
  const loadFile = (next: DesignFile) => { commit(next.project); setGoal(next.goal); setVariableIds(next.variableIds); setMinGap(next.constraints?.minGap ?? 5); setMaxAngle(next.constraints?.maxOutputAngle ?? (next.goal.kind === 'diameter' ? 1 : 0)); setSelected('source'); setInspectorTab('inspect'); setNotice('已打开工程。上一个光路仍可通过撤销恢复。'); };
  const loadPreset = (id: string) => { const p = presetProject(id); loadFile({ format: 'pcsel-optics-design', formatVersion: 1, project: p, goal: { kind: id === 'kepler' || id === 'galilean' ? 'diameter' : 'focus', value: 8 }, variableIds: p.elements.filter(e => e.kind === 'lens').map(e => e.id) }); };
  const saveProject = () => {
    const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), file: JSON.parse(JSON.stringify(file)) as DesignFile };
    const next = [entry, ...saved].slice(0, 20);
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); setSaved(next); setNotice(`已保存工程副本「${project.name}」。`); } catch { setNotice('浏览器存储不可用，请导出工程 JSON 保存。'); }
  };
  const importText = (text: string) => {
    try { if (text.length > 250000) throw new Error('工程文件超过 250 KB。'); loadFile(parseDesignFile(JSON.parse(text))); setImportOpen(false); setImportError(''); setNotice('工程导入完成；目录型号仅在焦距与外径匹配时保留厂家身份。'); } catch (error) { setImportError(error instanceof Error ? error.message : '无法读取工程。'); }
  };
  const undo = () => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setSelected('source'); };
  const redo = () => { setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setSelected('source'); };
  const optimize = async () => {
    setBusy(true); setCandidate(null);
    await new Promise(resolve => setTimeout(resolve, 30));
    try { const result = optimizePositions(project, { target: goal, selectedIds: file.variableIds, minGap, maxIterations: 45, gaussianClearanceFactor: 2, ...(maxAngle > 0 ? { maxOutputAngle: maxAngle } : {}) }); setCandidate({ hash: JSON.stringify(file), result }); } catch (error) { setNotice(error instanceof Error ? error.message : '优化计算未完成。'); }
    setBusy(false);
  };
  const goalMetric = (value: number) => goal.kind === 'diameter' ? `${fmt(value * 100, 2)} %` : `${fmt(value, 5)} ${goal.kind === 'collimation' ? 'mrad' : 'mm'}`;
  const filtered = catalog.filter(p => (category === 'all' || p.kind === category) && `${p.sku} ${p.focal}`.toLowerCase().includes(query.toLowerCase()));
  const select = (id: Selection) => { setSelected(id); setInspectorTab('inspect'); };
  const exportReport = () => {
    const diagram = document.getElementById('od-layout-svg')?.cloneNode(true) as SVGSVGElement | undefined;
    if (diagram) { diagram.style.width = '100%'; diagram.style.minWidth = ''; }
    downloadText('optical-design-report.html', 'text/html;charset=utf-8', designReport(project, diagram?.outerHTML ?? '', file));
    setNotice('已导出自包含 HTML 设计记录。');
  };
  return <div className="od-designer"><a className="skip-link" href="#od-workspace">跳到光路编辑器</a>
    <header className="od-topbar"><h1>光路设计工作台</h1><span className="od-model-tag">顺序近轴模型</span><nav aria-label="光学工具导航"><button disabled={project.source.mode === 'gaussian'} title={project.source.mode === 'gaussian' ? '空间模式目前使用几何光源，请先切换传播模型。' : '复制到二维空间模式，可再加入反射镜和分光镜；原工程保留。'} onClick={() => onConvert(project)}>复制到空间光路</button><button onClick={() => { setSidebar('projects'); setNotice('工程库保存当前浏览器中的设计副本。'); }}>工程库</button></nav></header>
    <div className="od-projectbar"><label className="od-project-name">工程<input aria-label="工程名称" value={project.name} maxLength={120} onChange={e => commit({ ...project, name: e.target.value })} /></label><label className="od-template-label">模板<select aria-label="载入光路模板" value="" onChange={e => { if (e.target.value) loadPreset(e.target.value); }}><option value="">选择设计起点</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="od-project-actions"><button onClick={undo} disabled={!history.past.length}>撤销</button><button onClick={redo} disabled={!history.future.length}>重做</button><button className="od-primary" onClick={saveProject}>保存副本</button><details className="od-file-menu"><summary>工程文件</summary><div><button onClick={() => { setImportOpen(true); setJsonText(''); setImportError(''); }}>导入</button><button onClick={() => downloadText('optical-design.json', 'application/json;charset=utf-8', JSON.stringify(file, null, 2))}>导出工程</button><button onClick={exportReport}>导出设计记录</button></div></details></div></div>
    <main id="od-workspace" className="od-workspace">
      <aside className="od-sidebar"><WorkspacePanel title="器件与工程" icon="layers" revealKey={sidebar}><div className="od-sidebar-tabs" role="tablist" aria-label="器件与工程"><button role="tab" aria-selected={sidebar === 'parts'} onClick={() => setSidebar('parts')}>器件库</button><button role="tab" aria-selected={sidebar === 'projects'} onClick={() => setSidebar('projects')}>工程库</button></div>
        {sidebar === 'parts' ? <><div className="od-library-filter"><input aria-label="搜索透镜型号" placeholder="型号 / 焦距" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="透镜类型" value={category} onChange={e => setCategory(e.target.value)}><option value="all">全部 · 12 个型号</option><option value="convex">平凸透镜</option><option value="concave">平凹透镜</option><option value="doublet">消色差双胶合</option></select></div><div className="od-custom-parts"><button draggable onDragStart={e => e.dataTransfer.setData('text/plain', 'optics:custom')} onClick={() => addPart('custom')}>＋ 正透镜</button><button draggable onDragStart={e => e.dataTransfer.setData('text/plain', 'optics:negative')} onClick={() => addPart('negative')}>＋ 负透镜</button><button draggable onDragStart={e => e.dataTransfer.setData('text/plain', 'optics:iris')} onClick={() => addPart('iris')}>＋ 光阑</button></div><div className="od-catalog-list">{filtered.map(p => <button key={p.sku} draggable onDragStart={e => e.dataTransfer.setData('text/plain', `optics:${p.sku}`)} onClick={() => addPart(p.sku)} aria-label={`加入 ${p.sku}`} className="od-catalog-item"><strong>{p.sku}</strong><span>f {p.focal > 0 ? '+' : ''}{p.focal} mm <b>Ø{p.diameter}</b></span><small>{p.kind === 'doublet' ? '双胶合' : p.kind === 'concave' ? '平凹' : '平凸'} · {p.coating}</small></button>)}{!filtered.length && <p className="od-muted">没有匹配器件。</p>}</div><div className="od-library-foot"><p>点击加入或拖入画布。目录焦距为厂家标称值；孔径暂用外径 90% 假设。</p><a href="/training/thorlabs/catalog.csv" download>下载目录 CSV</a></div></> : <div className="od-saved-projects"><h2>本机工程副本</h2><p>副本保存在当前浏览器，也可导出 JSON 在其他电脑打开。</p>{saved.map(entry => <button key={entry.id} onClick={() => loadFile(entry.file)}><strong>{entry.file.project.name || '未命名光路'}</strong><span>{entry.file.project.elements.length} 个元件 · {entry.file.project.source.mode === 'gaussian' ? 'Gaussian' : '几何光线'}</span><small>{new Date(entry.savedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</small></button>)}{!saved.length && <div className="od-empty-library">尚无副本。点击上方“保存副本”保留当前方案。</div>}<button className="od-legacy" onClick={() => { try { const old = localStorage.getItem('pcsel-optical-playground-v1'); if (!old) { setNotice('当前浏览器没有旧版自由搭建草稿。'); return; } loadFile(parseDesignFile(JSON.parse(old))); } catch { setNotice('旧版草稿无法读取，请使用导入工程检查内容。'); } }}>读取旧版自由搭建草稿</button></div>}
      </WorkspacePanel></aside>
      <div className="od-main"><div className="od-readout"><div><span>{project.source.mode === 'gaussian' ? '目标面 1/e² 直径' : '目标面几何范围'}</span><strong>{fmt(metric, 4)}<small> mm</small></strong></div><div><span>{project.source.mode === 'gaussian' ? '出射远场全角' : '出射角度范围'}</span><strong>{fmt(a.gaussian?.waist.fullAngle ?? a.angleSpan, 3)}<small> mrad</small></strong></div><div><span>通过几何采样</span><strong>{a.passed}<small> / {a.total}</small></strong></div><div><span>光程总长</span><strong>{fmt(project.screen, 1)}<small> mm</small></strong></div></div>
        <DesignCanvas project={project} selected={selected} select={select} commit={commit} addPart={addPart} />
        {a.warnings.length > 0 && <details className="od-warnings"><summary>{a.warnings.length} 项模型 / 孔径提示{a.passed < a.total ? ' · 存在截光' : a.gaussian && !a.gaussian.valid ? ' · Gaussian 孔径不足' : ''}</summary><ul>{a.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
      </div>
      <aside className="od-inspector"><WorkspacePanel title="参数与分析" icon="settings" revealKey={String(selected)}><div className="od-inspector-tabs" role="tablist" aria-label="编辑与设计目标"><button role="tab" aria-selected={inspectorTab === 'inspect'} onClick={() => setInspectorTab('inspect')}>参数</button><button role="tab" aria-selected={inspectorTab === 'goal'} onClick={() => setInspectorTab('goal')}>设计目标</button></div>
        {inspectorTab === 'inspect' ? <div className="od-inspector-content"><div className="od-selection-buttons"><button aria-pressed={selected === 'source'} onClick={() => select('source')}>光源</button><button aria-pressed={selected === 'screen'} onClick={() => select('screen')}>目标面</button></div>
          {selected === 'source' || !current && selected !== 'screen' ? <><h2>入射光源</h2><label className="od-select-field">传播模型<select aria-label="光源传播模型" value={project.source.mode} onChange={e => updateSource({ mode: e.target.value as DesignSource['mode'] })}><option value="geometric">几何光线 · 独立口径 / 发散角</option><option value="gaussian">Gaussian · q 参数传播</option></select></label>{project.source.mode === 'geometric' ? <><div className="od-inspector-grid"><Numeric label="入射光源口径" value={project.source.diameter} min={.01} max={100} step={.1} onChange={diameter => updateSource({ diameter })} /><Numeric label="发散全角" value={project.source.fullAngle} min={0} max={200} unit="mrad" onChange={fullAngle => updateSource({ fullAngle })} /></div><label className="od-select-field">位置与角度分布<select aria-label="几何光源分布" value={project.source.model} onChange={e => updateSource({ model: e.target.value as DesignSource['model'] })}><option value="fan">关联发散束</option><option value="extended">扩展源：每个位置多角度</option></select></label><p className="od-field-help">口径是入射面几何直径。全角 Θ = 2α，当前半角 {fmt(project.source.fullAngle / 2, 2)} mrad；0 表示平行输入。</p></> : <><div className="od-inspector-grid"><Numeric label="波长" value={project.source.wavelength} min={200} max={20000} unit="nm" onChange={wavelength => updateSource({ wavelength })} /><Numeric label="束腰半径 w₀" value={project.source.w0} min={.001} max={50} step={.01} onChange={w0 => updateSource({ w0 })} /><Numeric label="束腰位置 z₀" value={project.source.waistZ} min={-10000} max={10000} onChange={waistZ => updateSource({ waistZ })} /><Numeric label="光束质量 M²" value={project.source.m2} min={1} max={20} step={.1} unit="" onChange={m2 => updateSource({ m2 })} /></div><div className="od-derived"><span>入射面 1/e² 直径<b>{fmt(a.gaussian?.sourceDiameter, 4)} mm</b></span><span>光源远场发散全角<b>{fmt(a.gaussian?.sourceFullAngle, 4)} mrad</b></span></div><p className="od-field-help">Gaussian 发散由波长、束腰与 M² 推导。z₀ = 0 表示束腰在入射面；正值表示入射束正在会聚。M² &gt; 1 为有效波长包络近似。目录镜片使用标称焦距，未引入色散。</p></>}
            <div className="od-inspector-grid"><Numeric label="光源中心 y" value={project.source.offset} min={-100} max={100} step={.1} onChange={offset => updateSource({ offset })} /><Numeric label="光源中心倾角" value={project.source.tilt} min={-100} max={100} unit="mrad" onChange={tilt => updateSource({ tilt })} /></div></> : selected === 'screen' ? <><h2>目标面</h2><Numeric label="目标面位置" value={project.screen} min={Math.max(10, ...project.elements.map(e => e.z + .1))} max={5000} onChange={setScreen} /><Numeric label="目标面通光孔径" value={project.screenAperture} min={0} max={100} step={.1} onChange={screenAperture => commit({ ...project, screenAperture })} /><p className="od-field-help">孔径 0 表示不限制。目标面以 y = 0 为中心；设置有限孔径后，超出范围的采样光线计为被挡。</p><div className="od-derived"><span>目标面几何范围<b>{fmt(a.span)} mm</b></span><span>目标面中心 y<b>{fmt(a.centroid)} mm</b></span></div><button className="od-wide-button" disabled={!a.bestFocus?.afterLastElement || a.bestFocus.z <= 10 || a.bestFocus.z > 5000} onClick={() => a.bestFocus && setScreen(a.bestFocus.z)}>移动到几何最佳交会</button><button className="od-wide-button" disabled={!a.gaussian?.waist.afterLastElement || a.gaussian.waist.z <= 10 || a.gaussian.waist.z > 5000} onClick={() => a.gaussian && setScreen(a.gaussian.waist.z)}>移动到 Gaussian 束腰</button></> : current ? <><h2>{current.kind === 'lens' ? '透镜参数' : '光阑参数'}</h2><label className="od-select-field">名称<input aria-label="选中元件名称" value={current.name} maxLength={120} onChange={e => editElement(current.id, { name: e.target.value })} /></label><div className="od-inspector-grid"><Numeric key={`${current.id}-z`} label="元件位置 z" value={current.z} min={.1} max={project.screen - .1} step={.1} onChange={z => editElement(current.id, { z })} /><Numeric key={`${current.id}-y`} label="元件偏心 y" value={current.y} min={-100} max={100} step={.1} onChange={y => editElement(current.id, { y })} />{current.kind === 'lens' && <Numeric key={`${current.id}-f`} label="元件焦距 f" value={current.focal} min={-5000} max={5000} onChange={focal => editElement(current.id, { focal }, true)} />}<Numeric key={`${current.id}-d`} label="元件外径" value={current.diameter} min={.1} max={100} step={.1} onChange={diameter => editElement(current.id, { diameter, aperture: Math.min(current.aperture, diameter) }, true)} /><Numeric key={`${current.id}-a`} label="元件通光孔径" value={current.aperture} min={.01} max={current.diameter} step={.1} onChange={aperture => editElement(current.id, { aperture }, true)} /></div><label className="od-variable-check"><input type="checkbox" checked={variableIds.includes(current.id)} onChange={e => setVariableIds(ids => e.target.checked ? [...ids, current.id] : ids.filter(id => id !== current.id))} />位置参与自动优化</label><div className="od-element-buttons"><button onClick={() => copyElement(current)}>复制</button><button onClick={() => removeElement(current.id)}>移除</button></div>{part ? <div className="od-provenance"><h3>厂家目录 · {part.sku}</h3><p>f = {part.focal} mm · Ø{part.diameter} mm<br />镀膜 {part.coating}<br />当前通光孔径 {fmt(current.aperture)} mm · {current.apertureBasis === 'assumed-90-percent' ? '外径 90% 假设' : '自定义孔径'}。厚度与实际后焦距尚未核验。</p><a href={part.source} target="_blank" rel="noreferrer">官网参数页</a><a href={part.record} download>原始规格记录</a></div> : <p className="od-field-help">自定义元件。z 表示理想薄透镜平面。修改厂家元件的光学规格会转为自定义。</p>}</> : null}
        </div> : <div className="od-goal-panel"><h2>按需求调整光路</h2><label className="od-select-field">优化目标<select aria-label="优化目标" value={goal.kind} onChange={e => { setGoal({ ...goal, kind: e.target.value as DesignGoal['kind'] }); setMaxAngle(e.target.value === 'diameter' ? 1 : 0); }}><option value="focus">目标面聚焦</option><option value="diameter">目标光束直径</option><option value="collimation">降低出射发散</option></select></label>{goal.kind === 'diameter' && <Numeric label="期望目标面直径" value={goal.value} min={.001} max={100} step={.1} onChange={value => setGoal({ ...goal, value })} />}<p className="od-field-help">{goal.kind === 'focus' ? project.source.mode === 'gaussian' ? '最小化目标面 Gaussian 1/e² 直径。' : '最小化目标面采样高度 y-RMS。' : goal.kind === 'diameter' ? '匹配目标面直径；同时检查出射角度约束。' : project.source.mode === 'gaussian' ? '最小化输出束腰对应的远场发散全角。' : '最小化输出角度 y-RMS。'}</p><h3>约束与变量</h3><Numeric label="最小镜间距" value={minGap} min={.1} max={500} onChange={setMinGap} /><Numeric label="最大出射全角" value={maxAngle} min={0} max={200} unit="mrad" step={.1} onChange={setMaxAngle} /><p className="od-field-help">全角上限 0 表示不限制。只移动勾选元件，保持元件顺序、光源、目标面和焦距。要求全部几何采样通过；Gaussian 还需留足 2w 径向余量。</p><div className="od-variable-list">{ordered.map(e => <label key={e.id}><input type="checkbox" checked={variableIds.includes(e.id)} onChange={event => setVariableIds(ids => event.target.checked ? [...ids, e.id] : ids.filter(id => id !== e.id))} /><span>{e.name}<small>z = {fmt(e.z, 1)} mm</small></span></label>)}{!ordered.length && <p>先加入一片透镜。</p>}</div><button className="od-primary od-optimize-button" disabled={busy || !file.variableIds.length} onClick={optimize}>{busy ? '正在计算候选…' : '计算位置优化候选'}</button>{activeCandidate && <div className="od-candidate" role="status"><h3>{activeCandidate.improved ? '找到改进方案' : activeCandidate.feasible && activeCandidate.project.elements.some(e => Math.abs(e.z - (project.elements.find(p => p.id === e.id)?.z ?? e.z)) > 1e-7) ? '找到可行修复方案' : '本次搜索结果'}</h3><dl><dt>原方案目标值</dt><dd>{goalMetric(activeCandidate.before)}</dd><dt>候选目标值</dt><dd>{goalMetric(activeCandidate.after)}</dd><dt>约束检查</dt><dd>{activeCandidate.feasible ? '通过' : '未通过'}</dd><dt>实际计算次数</dt><dd>{activeCandidate.evaluations}</dd></dl><p>{activeCandidate.reason}</p>{activeCandidate.project.elements.filter(e => Math.abs(e.z - (project.elements.find(p => p.id === e.id)?.z ?? e.z)) > .0001).map(e => <p className="od-candidate-move" key={e.id}>{e.name}：{fmt(project.elements.find(p => p.id === e.id)?.z, 2)} → {fmt(e.z, 2)} mm</p>)}<button className="od-primary" disabled={!activeCandidate.feasible || !activeCandidate.project.elements.some(e => Math.abs(e.z - (project.elements.find(p => p.id === e.id)?.z ?? e.z)) > 1e-7)} onClick={() => { commit(activeCandidate.project); setNotice('已应用优化候选；可用一次撤销恢复原方案。'); setCandidate(null); }}>应用候选到光路</button></div>}<p className="od-field-help">有限迭代的局部位置搜索，不保证全局最优。应用前可检查前后读数，应用后可撤销。</p></div>}
      </WorkspacePanel></aside>
      <div className="od-results">
        <section className="od-prescription" aria-labelledby="od-prescription-title"><div className="od-section-title"><h2 id="od-prescription-title">顺序元件表</h2><div><span>{project.elements.length} / 24 个元件</span><button onClick={() => downloadText('optical-prescription.csv', 'text/csv;charset=utf-8', prescriptionCsv(project))}>导出 CSV</button></div></div><div className="od-data-scroll"><table><thead><tr><th>变量</th><th>名称 / 类型</th><th>z / mm</th><th>前间距 / mm</th><th>y / mm</th><th>f / mm</th><th>孔径 / mm</th><th>操作</th></tr></thead><tbody>{ordered.map((e, i) => <tr key={e.id} className={selected === e.id ? 'od-selected-row' : ''}><td><input aria-label={`${e.name}位置参与优化`} type="checkbox" checked={variableIds.includes(e.id)} onChange={event => setVariableIds(ids => event.target.checked ? [...ids, e.id] : ids.filter(id => id !== e.id))} /></td><td><button className="od-row-name" onClick={() => select(e.id)}>{e.name}<small>{e.kind === 'iris' ? '光阑' : e.sku ? '厂家标称 f / 外径' : '自定义透镜'}</small></button></td><td><Numeric compact label={`${e.name}位置 z`} value={e.z} min={.1} max={project.screen - .1} step={.1} onChange={z => editElement(e.id, { z })} /></td><td><Numeric compact label={`${e.name}前间距`} value={e.z - (ordered[i - 1]?.z ?? 0)} min={.1} max={project.screen - (ordered[i - 1]?.z ?? 0) - .1} step={.1} onChange={gap => editElement(e.id, { z: (ordered[i - 1]?.z ?? 0) + gap })} /></td><td><Numeric compact label={`${e.name}偏心 y`} value={e.y} min={-100} max={100} step={.1} onChange={y => editElement(e.id, { y })} /></td><td>{e.kind === 'lens' ? <Numeric compact label={`${e.name}焦距 f`} value={e.focal} min={-5000} max={5000} onChange={focal => editElement(e.id, { focal }, true)} /> : '—'}</td><td><Numeric compact label={`${e.name}通光孔径`} value={e.aperture} min={.01} max={e.diameter} step={.1} onChange={aperture => editElement(e.id, { aperture }, true)} /></td><td><button className="od-table-action" onClick={() => copyElement(e)}>复制</button><button className="od-table-action" onClick={() => removeElement(e.id)}>移除</button></td></tr>)}</tbody></table>{!ordered.length && <div className="od-table-empty">当前只有光源与目标面。从器件库加入第一片透镜。</div>}</div></section>
        <DesignAnalysis project={project} selected={selected} commit={commit} setScreen={setScreen} />
      </div>
    </main>
    <div className="od-statusbar" role="status"><span>{notice}</span><span className={!stored ? 'od-negative' : ''}>{stored ? '本机草稿已保存' : '浏览器存储不可用'} · 一阶设计 v0.4</span></div>
    <footer className="od-model-details"><details><summary>模型范围与数据来源</summary><p>顺序模式支持沿一条直轴的透镜与光阑设计。空气近轴薄透镜模型计算一阶光线、Gaussian q 包络和仿射 ABCD；镜片位置代表理想主面。反射镜与半透半反镜请切换上方空间光路模式；该模式使用几何追迹，不传播 Gaussian q。两种模式均未加入厚透镜、色差、像差、衍射截光和真实镜架碰撞。通过采样数不能作为功率透过率。</p><p>目录包含 12 个 Thorlabs 型号，厂家标称焦距、外径与镀膜规格来自 2026-09-30 保存的官方记录。工程图下载未成功，通光孔径暂按外径 90% 假设。模型后焦距与厂家 BFL 分别处理；波长改变不会自动改变目录焦距。</p><p>计算依据：<a href="https://www.edmundoptics.com/knowledge-center/application-notes/lasers/gaussian-beam-propagation/" target="_blank" rel="noreferrer">Gaussian 传播公式</a> · <a href="https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/e9852c138493233bc2813f683da5b199_gaussian_bem_res.pdf" target="_blank" rel="noreferrer">ABCD 与 q 参数</a> · <a href="/training/thorlabs/download-manifest.json" download>厂家来源记录</a></p></details></footer>
    {importOpen && <div className="od-modal-backdrop"><section className="od-import-dialog" role="dialog" aria-modal="true" aria-labelledby="od-import-title"><h2 id="od-import-title">打开光路工程</h2><p>支持本工作台工程 JSON，以及旧版自由搭建光路 JSON。</p><input ref={fileInput} type="file" accept=".json,application/json" aria-label="选择工程 JSON 文件" onChange={async e => { const selected = e.target.files?.[0]; if (!selected) return; if (selected.size > 250000) { setImportError('工程文件超过 250 KB。'); return; } try { importText(await selected.text()); } catch { setImportError('无法读取文件。'); } }} /><label htmlFor="od-import-text">也可粘贴 JSON</label><textarea id="od-import-text" value={jsonText} onChange={e => { setJsonText(e.target.value); setImportError(''); }} rows={9} />{importError && <p className="od-negative" role="alert">{importError}</p>}<div><button onClick={() => setImportOpen(false)}>取消</button><button className="od-primary" disabled={!jsonText.trim()} onClick={() => importText(jsonText)}>导入文本</button></div></section></div>}
  </div>;
}
