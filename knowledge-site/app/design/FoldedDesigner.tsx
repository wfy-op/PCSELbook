import { useEffect, useMemo, useRef, useState } from 'react';
import lensCatalog from '../training/thorlabs-catalog.json';
import { foldedElement, foldedPresets, parseFoldedScene, traceFoldedScene, type FoldedElement, type FoldedScene } from './core/folded-engine';
import { objectiveDefaults, objectiveParts, parseObjectiveModel } from './core/objective-model';
import foldedCatalog from './folded-catalog.json';
import { cylindricalParts } from './equipment-catalog';
import { foldedLabels } from './folded-labels';
import { EquipmentLibrary } from './EquipmentLibrary';
import { FoldedCanvas, FoldedInspector, DetectorSpots } from './FoldedWorkspace';
import { FoldedOptimizer } from './FoldedOptimizer';
import { FoldedScan } from './FoldedScan';
import { downloadText } from './design-export';
import { foldedCsv, foldedEngineeringFile, foldedReport, parseFoldedEngineeringFile } from './folded-export';
import { OpticsIcon } from './OpticsIcon';
import './folded-designer.css';

const DRAFT = 'pcsel-folded-optics-draft-v1';
const LIBRARY = 'pcsel-folded-optics-library-v1';
const kindNames: Record<FoldedElement['kind'], string> = { lens: '薄透镜', cylindrical: '柱透镜', objective: '物镜', iris: '光阑', mirror: '平面反射镜', beamsplitter: '半透半反镜', detector: '探测面' };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmt = (v: number | null | undefined, precision = 3) => v === null || v === undefined || !Number.isFinite(v) ? '—' : (Math.abs(v) < 1e-10 ? 0 : v).toFixed(precision);
const percentage = (v: number, input: number) => input > 0 ? `${fmt(v / input * 100, 1)}%` : '—';
type LibraryEntry = { id: string; savedAt: string; scene: FoldedScene };

function defaultScene(): FoldedScene {
  const scene = foldedPresets().split;
  return { ...scene, source: { ...scene.source, diameter: 6, fullAngle: 25, model: 'extended', beam: { profile: 'gaussian', diameterMinor: 3, fullAngleMinor: 12, rotationDeg: 0 } } };
}
function readScene(): FoldedScene {
  try { const text = localStorage.getItem(DRAFT); if (text) return parseFoldedEngineeringFile(JSON.parse(text), parseFoldedScene); } catch { /* A broken draft must not stop the workbench. */ }
  return defaultScene();
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
function templates() {
  const original = foldedPresets();
  const source = { ...original.focus.source, diameter: 6, fullAngle: 12, rayCount: 45, model: 'extended' as const, beam: { profile: 'gaussian' as const, diameterMinor: 2, fullAngleMinor: 4, rotationDeg: 0 } };
  const ellipse: FoldedScene = { ...original.focus, name: '椭圆高斯 · 双轴聚焦', source };
  const cylindrical: FoldedScene = { ...original.focus, name: '柱透镜 · 单轴聚焦', source, elements: original.focus.elements.map(e => e.kind === 'lens' ? { ...e, kind: 'cylindrical', name: '理想柱透镜 f100', focalSagittal: null, rollDeg: 0 } : e) };
  return { ...original, ellipse, cylindrical };
}
function NameField({ id, label, value, change }: { id: string; label: string; value: string; change: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => { if (draft?.trim()) change(draft.trim()); setDraft(null); };
  return <input id={id} aria-label={label} maxLength={120} value={draft ?? value} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} />;
}

export function FoldedDesigner({ initialScene }: { initialScene?: FoldedScene }) {
  const [history, setHistory] = useState<{ past: FoldedScene[]; present: FoldedScene; future: FoldedScene[] }>(() => ({ past: [], present: initialScene ? parseFoldedScene(initialScene) : readScene(), future: [] }));
  const scene = history.present;
  const [preview, setPreview] = useState<FoldedScene | null>(null);
  const displayScene = preview ?? scene;
  const result = useMemo(() => traceFoldedScene(displayScene), [displayScene]);
  const labels = useMemo(() => foldedLabels(scene), [scene]);
  const [selected, setSelected] = useState('source');
  const [drawer, setDrawer] = useState<'parts' | 'saved' | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const compact = () => { if (!media.matches) setInspectorOpen(false); };
    media.addEventListener('change', compact);
    return () => media.removeEventListener('change', compact);
  }, []);
  const [canvasKey, setCanvasKey] = useState(0);
  const [library, setLibrary] = useState(readLibrary);
  const [notice, setNotice] = useState('选型、拖动元件；光斑随参数实时更新。');
  const [stored, setStored] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const seenInitial = useRef(initialScene);
  const dialog = useRef<HTMLDialogElement>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const current = scene.elements.find(e => e.id === selected);
  const select = (id: string) => { setSelected(id); setInspectorOpen(true); };
  const commit = (next: FoldedScene) => {
    try {
      const checked = parseFoldedScene(next);
      setPreview(null);
      setHistory(h => JSON.stringify(checked) === JSON.stringify(h.present) ? h : { past: [...h.past, h.present].slice(-60), present: checked, future: [] });
    } catch (error) { setNotice(error instanceof Error ? error.message : '参数不合法。'); }
  };
  useEffect(() => {
    if (!initialScene || seenInitial.current === initialScene) return;
    seenInitial.current = initialScene;
    try {
      const checked = parseFoldedScene(initialScene);
      setHistory(h => ({ past: [...h.past, h.present].slice(-60), present: checked, future: [] }));
      setPreview(null); setSelected('source'); setCanvasKey(k => k + 1);
      setNotice('已复制顺序几何光路；原空间草稿可撤销恢复。目标面使用有限探测孔径，请检查视场与计算区域。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '空间复制未完成。'); }
  }, [initialScene]);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(foldedEngineeringFile(scene))); setStored(true); } catch { setStored(false); } }, [scene]);
  useEffect(() => { if (importOpen && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [importOpen]);
  const source = (patch: Partial<FoldedScene['source']>) => commit({ ...scene, source: { ...scene.source, ...patch } });
  const element = (patch: Partial<FoldedElement>) => {
    if (!current) return;
    const optical = patch.focal !== undefined || patch.aperture !== undefined || patch.diameter !== undefined;
    commit({ ...scene, elements: scene.elements.map(e => e.id === current.id ? { ...e, ...patch, ...(optical && e.objective ? { objective: { ...e.objective, catalogSku: undefined } } : {}) } : e) });
  };
  const add = (identifier: string, posX?: number, posY?: number) => {
    if (scene.elements.length >= 48) { setNotice('当前空间工程最多放置 48 个元件。'); return; }
    const lens = lensCatalog.find(p => p.sku === identifier);
    const cylinder = cylindricalParts.find(p => p.sku === identifier);
    const objective = objectiveParts.find(p => p.sku === identifier);
    const folded = foldedCatalog.parts.find(p => p.sku === identifier);
    const kind: FoldedElement['kind'] = lens ? 'lens' : cylinder ? 'cylindrical' : objective ? 'objective' : folded ? folded.kind === 'splitter' ? 'beamsplitter' : 'mirror' : identifier as FoldedElement['kind'];
    if (!Object.hasOwn(kindNames, kind)) return;
    const e = foldedElement(kind, crypto.randomUUID(), posX ?? (scene.bounds.minX + scene.bounds.maxX) / 2, posY ?? (scene.bounds.minY + scene.bounds.maxY) / 2);
    if (lens) Object.assign(e, { name: `${lens.sku} · 等效薄透镜`, focal: lens.focal, diameter: lens.diameter, aperture: lens.aperture });
    if (cylinder) Object.assign(e, { name: `${cylinder.sku} · 等效柱透镜`, focal: cylinder.focal, diameter: cylinder.diameter, aperture: cylinder.aperture, focalSagittal: null, rollDeg: 0 });
    if (objective) { e.name = `${objective.sku} · ${objective.magnification}× 物镜`; e.objective = parseObjectiveModel(objective); Object.assign(e, objectiveDefaults(e.objective)); }
    if (folded) Object.assign(e, { name: `${folded.sku} · 理想等效面`, diameter: folded.modelDefaults.surfaceLengthMm, aperture: folded.modelDefaults.clearSurfaceLengthMm, reflectance: folded.modelDefaults.reflectance, transmittance: folded.modelDefaults.transmittance });
    commit({ ...scene, elements: [...scene.elements, e] }); select(e.id); setDrawer(null);
    setNotice(`已加入 ${e.name}；参数可编辑，元件顺序由实际交点决定。`);
  };
  const load = (next: FoldedScene) => { commit(next); setSelected('source'); setCanvasKey(k => k + 1); setDrawer(null); setNotice('已打开空间工程；可撤销恢复上一个布局。'); };
  const save = () => {
    const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), scene: structuredClone(scene) };
    const next = [entry, ...library].slice(0, 20);
    try { localStorage.setItem(LIBRARY, JSON.stringify(next)); setLibrary(next); setNotice(`已保存「${scene.name}」的空间工程副本。`); } catch { setNotice('保存失败，请导出 JSON 文件。'); }
  };
  const removeSaved = (id: string) => { const next = library.filter(e => e.id !== id); try { localStorage.setItem(LIBRARY, JSON.stringify(next)); setLibrary(next); } catch { setNotice('浏览器存储不可用，未移除副本。'); } };
  const undo = () => { setPreview(null); setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setSelected('source'); };
  const redo = () => { setPreview(null); setHistory(h => h.future.length ? { past: [...h.past, h.present].slice(-60), present: h.future[0], future: h.future.slice(1) } : h); setSelected('source'); };
  const remove = (id = current?.id) => { if (!id) return; commit({ ...scene, elements: scene.elements.filter(e => e.id !== id) }); setSelected('source'); };
  const duplicate = () => {
    if (!current) return;
    if (scene.elements.length >= 48) { setNotice('当前空间工程最多放置 48 个元件。'); return; }
    const e = { ...current, id: crypto.randomUUID(), name: current.name.slice(0, 116) + ' 副本', x: clamp(current.x + 20, scene.bounds.minX, scene.bounds.maxX), y: clamp(current.y + 20, scene.bounds.minY, scene.bounds.maxY) };
    commit({ ...scene, elements: [...scene.elements, e] }); select(e.id);
  };
  const importText = () => {
    try { if (new Blob([jsonText]).size > 250_000) throw new Error('工程文件最大 250 KB。'); const next = parseFoldedEngineeringFile(JSON.parse(jsonText), parseFoldedScene); load(next); setImportOpen(false); } catch (error) { setImportError(error instanceof Error ? error.message : '无法读取工程。'); }
  };
  const exportReport = () => {
    const svg = document.getElementById('fd-layout-svg')?.cloneNode(true) as SVGSVGElement | undefined;
    if (svg) { svg.removeAttribute('style'); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex')); }
    downloadText('folded-optics-report.html', 'text/html;charset=utf-8', foldedReport(scene, svg?.outerHTML ?? ''));
  };
  const bounds = (patch: Partial<FoldedScene['bounds']>) => commit({ ...scene, bounds: { ...scene.bounds, ...patch } });
  const presetOptions = templates();
  const enableBeam = () => { source({ model: 'extended', beam: { profile: 'gaussian', diameterMinor: Math.max(.01, scene.source.diameter / 2), fullAngleMinor: scene.source.fullAngle / 2, rotationDeg: 0 } }); setNotice('已启用二维椭圆高斯采样；在光源参数中设置两轴直径与发散全角。'); };

  return <div className="fd-workbench">
    <div className="fd-heading"><div><h1>空间光路工作台</h1><span>等比例布局 · 双轴光束 · 实时探测</span></div></div>
    <div className="fd-project-bar">
      <label className="fd-project-name" htmlFor="fd-project-name"><span>当前工程</span><NameField id="fd-project-name" label="空间工程名称" value={scene.name} change={name => commit({ ...scene, name })} /></label>
      <label className="fd-template-picker"><span className="fd-sr-only">载入空间模板</span><select aria-label="载入空间模板" value="" onChange={e => { if (e.target.value) load(presetOptions[e.target.value as keyof typeof presetOptions]); }}><option value="">载入模板…</option><option value="ellipse">椭圆高斯 · 双轴聚焦</option><option value="cylindrical">柱透镜 · 单轴聚焦</option><option value="split">50/50 分光 · 双路聚焦</option><option value="mirror">90° 平面镜折转</option><option value="focus">透镜聚焦</option><option value="objective">10× 物镜与筒镜成像</option><option value="blank">空白空间工程</option></select></label>
      <button className="fd-undo" disabled={!history.past.length} onClick={undo}><OpticsIcon name="undo" size={16} />撤销</button><button className="fd-redo" disabled={!history.future.length} onClick={redo}><OpticsIcon name="redo" size={16} />重做</button><button className="fd-primary" onClick={save}><OpticsIcon name="save" size={16} />保存副本</button>
      <details className="od-file-menu"><summary>工程文件</summary><div><button onClick={() => { setImportError(''); setJsonText(''); setImportOpen(true); }}><OpticsIcon name="import" size={16} />导入</button><button onClick={() => downloadText('folded-optics-project.json', 'application/json;charset=utf-8', JSON.stringify(foldedEngineeringFile(scene), null, 2))}><OpticsIcon name="export" size={16} />导出 JSON</button><button onClick={exportReport}><OpticsIcon name="report" size={16} />导出 HTML 报告</button></div></details>
    </div>
    <p className={`fd-notice ${!stored ? 'fd-alert' : ''}`} role="status">{!stored ? '浏览器无法保存草稿，请导出工程文件。' : notice}</p>
    <div className="fd-workspace-actions"><div><button aria-expanded={drawer === 'parts'} aria-controls="fd-equipment-drawer" onClick={() => setDrawer(drawer === 'parts' ? null : 'parts')}><OpticsIcon name="layers" size={16} />元件库</button><button aria-expanded={drawer === 'saved'} aria-controls="fd-equipment-drawer" onClick={() => setDrawer(drawer === 'saved' ? null : 'saved')}><OpticsIcon name="save" size={16} />我的工程</button><button aria-expanded={inspectorOpen} aria-controls="fd-parameter-panel" onClick={() => setInspectorOpen(v => !v)}><OpticsIcon name="settings" size={16} />{inspectorOpen ? '收起参数' : '显示参数'}</button></div><div className="fd-budget-inline" aria-label="光路能量预算"><span>接收 <strong>{percentage(result.energy.captured, result.energy.input)}</strong></span><span>损耗 <strong>{percentage(result.energy.absorbed, result.energy.input)}</strong></span><span>逸出 <strong>{percentage(result.energy.escaped, result.energy.input)}</strong></span><span>未完成 <strong>{percentage(result.energy.unresolved, result.energy.input)}</strong></span></div></div>
    <main className={`fd-grid${inspectorOpen ? '' : ' fd-wide-canvas'}`} id="fd-workspace">
      {drawer && <aside id="fd-equipment-drawer" className="fd-library fd-equipment-drawer" aria-label="空间元件库"><div className="fd-drawer-header"><strong>{drawer === 'parts' ? '元件选型' : '我的工程'}</strong><button aria-label="关闭元件与工程" onClick={() => setDrawer(null)}>关闭</button></div>{drawer === 'parts' ? <EquipmentLibrary onPick={add} prefix="folded" compact /> : <><p className="fd-hint">最多保留 20 份副本；草稿自动保存。</p>{library.length ? library.map(item => <article className="fd-saved-card" key={item.id}><strong>{item.scene.name}</strong><small>{new Date(item.savedAt).toLocaleString('zh-CN')} · {item.scene.elements.length} 个元件</small><div><button onClick={() => load(item.scene)}>打开</button><button onClick={() => downloadText('folded-optics-project.json', 'application/json;charset=utf-8', JSON.stringify(foldedEngineeringFile(item.scene), null, 2))}>导出</button><button onClick={() => removeSaved(item.id)}>移除</button></div></article>) : <p className="fd-empty">尚无工程副本。设计完成后点击“保存副本”。</p>}</>}</aside>}
      <div className="fd-main"><FoldedCanvas key={canvasKey} scene={scene} result={result} selected={selected} select={select} commit={commit} add={add} onPreview={setPreview} />{!scene.source.beam && <div className="fd-legacy-source"><span>当前工程保留原一维光源采样。</span><button onClick={enableBeam}>启用二维椭圆光束</button></div>}</div>
      {inspectorOpen && <aside id="fd-parameter-panel" className="fd-inspector" aria-label="空间参数设置"><div className="fd-inspector-header"><h3>参数设置</h3><button aria-pressed={selected === 'source'} onClick={() => select('source')}>光源</button></div><FoldedInspector scene={scene} current={current} source={source} element={element} bounds={bounds} duplicate={duplicate} remove={() => remove()} /></aside>}
      <div className="fd-results">
        <DetectorSpots scene={displayScene} result={result} />
        <FoldedOptimizer scene={scene} result={result} onApply={commit} />
        <details className="fd-detail-panel fd-scan-panel"><summary>参数扫描</summary><FoldedScan scene={scene} commit={commit} /></details>
        <details className="fd-prescription fd-detail-panel" aria-label="空间元件参数表"><summary>元件参数表 · {scene.elements.length} 个元件</summary><div className="fd-section-bar"><span>最近交点决定传播顺序</span><button onClick={() => downloadText('folded-optics-prescription.csv', 'text/csv;charset=utf-8', foldedCsv(scene))}>导出 CSV</button></div><div className="fd-table-scroll"><table><thead><tr><th>元件</th><th>x / mm</th><th>y / mm</th><th>法线 / °</th><th>孔径 / mm</th><th>f / mm</th><th>R / T</th><th /></tr></thead><tbody>{scene.elements.map(e => <tr key={e.id} className={selected === e.id ? 'fd-selected-row' : ''}><td><button onClick={() => select(e.id)}>{labels.get(e.id)!.label}<small>{kindNames[e.kind]}</small></button></td><td>{fmt(e.x, 1)}</td><td>{fmt(e.y, 1)}</td><td>{fmt(e.angleDeg, 1)}</td><td>{fmt(e.aperture, 2)}</td><td>{['lens', 'objective', 'cylindrical'].includes(e.kind) ? fmt(e.focal, 1) : '—'}</td><td>{['mirror', 'beamsplitter'].includes(e.kind) ? `${fmt(e.reflectance, 2)} / ${fmt(e.transmittance, 2)}` : '—'}</td><td><button aria-label={`移除 ${e.name}`} onClick={() => remove(e.id)}>移除</button></td></tr>)}</tbody></table>{!scene.elements.length && <p className="fd-empty">从元件库加入透镜、反射镜或分光镜。</p>}</div></details>
        <details className="fd-detail-panel fd-model-notes"><summary>模型说明与能量预算{result.warnings.length ? ` · ${result.warnings.length} 条提示` : ''}</summary><div className="fd-model-content"><p>XY 为实际等比例布局，u/v 为独立横向光束坐标。平面镜用反射定律，透镜与物镜用局部近轴等效主平面；柱透镜支持单轴光焦度和柱轴旋转。球差、彗差、像散系数是用户输入的瞳面波前项，不是目录元件的实测像差。</p><p>二维光斑与功率密度来自实际追迹落点的非相干直方图。当前不计算衍射 PSF、相干干涉、玻璃色散、厚透镜、多片物镜处方、偏振或完整高 NA 矢量场；镀膜波段只作选型参考，默认 R/T 为可编辑理想功率系数。</p><p>输入 = 接收 + 离开范围 + 截光 / 损耗 + 未完成追迹。闭合残差 {fmt(result.energy.balanceError, 10)}；实际追迹采样 {result.sourceRayCount} 条。</p>{result.warnings.length > 0 && <ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}<div className="fd-table-scroll"><table><thead><tr><th>元件</th><th>入射权重</th><th>透射</th><th>反射</th><th>接收</th><th>吸收 / 截光</th><th>交点次数</th></tr></thead><tbody>{result.footprints.map(f => <tr key={f.elementId}><td>{labels.get(f.elementId)?.label}</td><td>{fmt(f.incomingPower, 4)}</td><td>{fmt(f.transmittedPower, 4)}</td><td>{fmt(f.reflectedPower, 4)}</td><td>{fmt(f.capturedPower, 4)}</td><td>{fmt(f.absorbedPower, 4)}</td><td>{f.hits}</td></tr>)}</tbody></table></div><p>同一元件可被多次照射，各行入射权重之和不等于系统输入。元件库的官方标称参数与模型假设分别列示，工程参数仍可编辑。</p></div></details>
      </div>
    </main>
    {importOpen && <dialog ref={dialog} className="fd-import-dialog" aria-labelledby="fd-import-title" onCancel={e => { e.preventDefault(); setImportOpen(false); }}><div className="fd-section-bar"><h3 id="fd-import-title">导入空间工程</h3><button aria-label="关闭工程导入" onClick={() => setImportOpen(false)}>关闭</button></div><p>导入本工作台导出的 JSON 文件，或粘贴完整工程。最大 250 KB。</p><input ref={inputFile} type="file" accept=".json,application/json" aria-label="选择空间工程文件" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 250_000) { setImportError('工程文件最大 250 KB。'); return; } try { setJsonText(await file.text()); setImportError(''); } catch { setImportError('文件读取失败。'); } }} /><textarea aria-label="空间工程 JSON" value={jsonText} onChange={e => setJsonText(e.target.value)} rows={12} spellCheck={false} />{importError && <p className="fd-import-error" role="alert">{importError}</p>}<div className="fd-dialog-actions"><button onClick={() => setImportOpen(false)}>取消</button><button className="fd-primary" onClick={importText}>导入工程</button></div></dialog>}
  </div>;
}
