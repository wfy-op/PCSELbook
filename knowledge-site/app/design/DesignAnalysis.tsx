import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeDesign, parseDesignProject, type DesignProject } from './design-engine';
import catalog from '../training/thorlabs-catalog.json';

export const formatValue = (v: number | null | undefined, digits = 3) => v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.abs(v) < 1e-10 ? (0).toFixed(digits) : Math.abs(v) < .001 ? v.toExponential(2) : v.toFixed(digits);
type Point = { x: number; y: number };
export function LinePlot({ lines, xlabel = 'z / mm', ylabel = '直径 / mm' }: { lines: { name: string; color: string; points: Point[]; dash?: string }[]; xlabel?: string; ylabel?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const points = lines.flatMap(l => l.points).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!points.length) return <div className="od-plot-empty">当前配置没有可绘制的有效数据。</div>;
  const xmin = Math.min(...points.map(p => p.x)); const xmax = Math.max(...points.map(p => p.x)) || xmin + 1;
  const ymin = Math.min(0, ...points.map(p => p.y)); const ymax = Math.max(...points.map(p => p.y));
  const dy = Math.max(1e-6, ymax - ymin) * 1.1;
  const x = (v: number) => 76 + (v - xmin) / Math.max(1e-8, xmax - xmin) * 658;
  const y = (v: number) => 202 - (v - ymin) / dy * 158;
  const active = cursor === null ? null : lines.map(l => ({ name: l.name, point: l.points.reduce((best, p) => Math.abs(p.x - cursor) < Math.abs(best.x - cursor) ? p : best, l.points[0]) }));
  return <div className="od-plot"><svg ref={ref} viewBox="0 0 810 258" role="img" aria-label={`${lines.map(l => l.name).join('、')}，${xlabel}，${ylabel}`} onPointerMove={e => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ref.current!.getScreenCTM()!.inverse()); setCursor(xmin + Math.max(0, Math.min(1, (p.x - 76) / 658)) * (xmax - xmin)); }} onPointerLeave={() => setCursor(null)}>
    <rect width="810" height="258" fill="#fff" />{Array.from({ length: 5 }, (_, i) => <g key={i}><path d={`M76 ${202 - i * 39.5}H734`} stroke="#e1e8f0" /><text x="66" y={206 - i * 39.5} textAnchor="end" fontSize="13" fill="#678197">{formatValue(ymin + dy * i / 4, 2)}</text><text x={76 + i * 164.5} y="226" textAnchor="middle" fontSize="13" fill="#678197">{formatValue(xmin + (xmax - xmin) * i / 4, 1)}</text></g>)}<text x="78" y="20" fill="#496b88" fontSize="13">{ylabel}</text><text x="734" y="250" textAnchor="end" fill="#496b88" fontSize="13">{xlabel}</text>
    {lines.map(l => <polyline key={l.name} fill="none" points={l.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')} stroke={l.color} strokeWidth="2.4" strokeDasharray={l.dash} />)}{active && active.filter(a => a.point).map((a, i) => <g key={a.name}><circle cx={x(a.point.x)} cy={y(a.point.y)} r="4" fill={lines[i].color} /><path d={`M${x(a.point.x)} 32V202`} stroke={lines[i].color} strokeDasharray="4 5" opacity=".5" /></g>)}
  </svg><div className="od-plot-legend">{lines.map(l => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}{active && active.filter(a => a.point).map(a => <span key={`read-${a.name}`}>{a.name}：{formatValue(a.point.x, 2)} / {formatValue(a.point.y, 4)}</span>)}</div></div>;
}
function geometricProfile(p: DesignProject) {
  const analysis = analyzeDesign(p);
  return Array.from({ length: 121 }, (_, i) => {
    const z = p.screen * i / 120;
    const values = analysis.rays.filter(r => !r.blocked || r.points.at(-1)!.z >= z).flatMap(r => {
      const next = r.points.findIndex(pt => pt.z >= z);
      if (next < 0) return [];
      if (next === 0) return [r.points[0].y];
      const left = r.points[next - 1], right = r.points[next];
      return [left.y + (right.y - left.y) * (z - left.z) / Math.max(1e-9, right.z - left.z)];
    });
    return { x: z, y: values.length ? Math.max(...values) - Math.min(...values) : NaN };
  }).filter(point => Number.isFinite(point.y));
}
export function DesignAnalysis({ project, selected, commit, setScreen }: { project: DesignProject; selected: string; commit: (p: DesignProject) => void; setScreen: (n: number) => void }) {
  const [tab, setTab] = useState('envelope');
  const [scanParameter, setScanParameter] = useState<'z' | 'focal'>('z');
  const [scanMin, setScanMin] = useState(20); const [scanMax, setScanMax] = useState(500);
  const [scanValue, setScanValue] = useState<number | null>(null);
  useEffect(() => setScanValue(null), [project, selected, scanParameter, scanMin, scanMax]);
  useEffect(() => setScanParameter('z'), [selected]);
  const a = analyzeDesign(project);
  const element = project.elements.find(e => e.id === selected);
  const gaussian = a.gaussian;
  const lines = gaussian ? [{ name: 'Gaussian 1/e² 直径', color: '#2667bf', points: gaussian.samples.map(s => ({ x: s.z, y: s.diameter })) }, { name: '2w 边界直径', color: '#8eafcd', dash: '5 5', points: gaussian.samples.map(s => ({ x: s.z, y: 2 * s.diameter })) }] : [{ name: '存活采样光线范围', color: '#bb7a20', points: geometricProfile(project) }];
  const sweep = useMemo(() => {
    if (!element || scanMax <= scanMin) return [];
    return Array.from({ length: 31 }, (_, i) => {
      const value = scanMin + (scanMax - scanMin) * i / 30;
      try {
        const p = parseDesignProject({ ...project, elements: project.elements.map(e => e.id === element.id ? { ...e, [scanParameter]: value, sku: scanParameter === 'focal' ? undefined : e.sku } : e) }, catalog);
        const r = analyzeDesign(p);
        const gaussianClipped = !!r.gaussian && (!r.gaussian.valid || r.gaussian.elements.some(e => e.clearanceMargin < 0) || (r.gaussian.screen.clearanceMargin !== null && r.gaussian.screen.clearanceMargin < 0));
        return { value, metric: project.source.mode === 'gaussian' ? r.gaussian?.screen.diameter ?? null : r.span, passed: r.passed, total: r.total, gaussianClipped };
      } catch { return { value, metric: null, passed: 0, total: 0, gaussianClipped: false }; }
    });
  }, [project, element, scanParameter, scanMin, scanMax]);
  const tabs = [['envelope', '光束包络'], ['target', '目标面分析'], ['system', '一阶系统'], ['scan', '参数扫描']];
  return <section className="od-analysis"><div className="od-analysis-tabs" role="tablist" aria-label="光路分析">{tabs.map(([id, title]) => <button key={id} role="tab" aria-selected={tab === id} aria-controls={`od-analysis-${id}`} onClick={() => setTab(id)}>{title}</button>)}</div><div id={`od-analysis-${tab}`} role="tabpanel" className="od-analysis-body">
    {tab === 'envelope' && <><LinePlot lines={lines} /><div className="od-analysis-note">{gaussian ? <>实线为强度降到轴上值 1/e² 的直径。虚线为 2w 边界，仅用于孔径裕量检查。{!gaussian.valid && <strong> 当前存在孔径不足，后续包络是未截断的理想参考。</strong>}</> : '这里显示一维几何范围；截光后的范围缩小不表示聚焦改善。'}移动指针可读取采样点。</div><div className="od-data-scroll"><table><caption>逐面光束与通光孔径</caption><thead><tr><th>元件</th><th>z / mm</th><th>{gaussian ? '1/e² 直径' : '入射光线范围'}</th><th>{gaussian ? '2w 径向裕量' : '几何孔径裕量'}</th><th>通过 / 入射采样</th></tr></thead><tbody>{a.footprints.map(row => { const g = gaussian?.elements.find(e => e.elementId === row.elementId); return <tr key={row.elementId}><td>{project.elements.find(e => e.id === row.elementId)?.name}</td><td>{formatValue(row.z, 1)}</td><td>{formatValue(g?.diameter ?? row.span)} mm</td><td className={(g?.clearanceMargin ?? row.apertureMargin ?? 0) < 0 ? 'od-negative' : ''}>{formatValue(g?.clearanceMargin ?? row.apertureMargin)} mm</td><td>{row.passedCount} / {row.incomingCount}</td></tr>; })}</tbody></table></div></>}
    {tab === 'target' && <><div className="od-analysis-kpis"><div><span>{gaussian ? 'Gaussian 1/e² 直径' : '几何横向范围'}</span><strong>{formatValue(gaussian?.screen.diameter ?? a.span)}<small> mm</small></strong></div><div><span>几何 y-RMS</span><strong>{formatValue(a.rms)}<small> mm</small></strong></div><div><span>光束中心 y</span><strong>{formatValue(gaussian?.screen.center ?? a.centroid)}<small> mm</small></strong></div></div>
      <LinePlot lines={gaussian ? [{ name: '理想相对强度', color: '#2667bf', points: Array.from({ length: 101 }, (_, i) => { const y = gaussian.screen.center + (i / 100 * 6 - 3) * gaussian.screen.w; return { x: y, y: Math.exp(-2 * ((y - gaussian.screen.center) / gaussian.screen.w) ** 2) }; }) }] : [{ name: '光线落点 y', color: '#bb7a20', points: a.rays.filter(r => !r.blocked).map((r, i) => ({ x: i + 1, y: r.points.at(-1)!.y })) }]} xlabel={gaussian ? '目标面 y / mm' : '存活光线编号'} ylabel={gaussian ? 'I / I₀' : 'y / mm'} />
      <div className="od-focus-cards"><div><h3>几何最佳交会</h3><p>z = {formatValue(a.bestFocus?.z, 2)} mm<br />y-RMS = {formatValue(a.bestFocus?.rms)} mm</p><button disabled={!a.bestFocus?.afterLastElement || a.bestFocus.z <= 1 || a.bestFocus.z > 5000} onClick={() => a.bestFocus && setScreen(a.bestFocus.z)}>将目标面移到交会位置</button></div><div><h3>Gaussian 束腰</h3><p>z = {formatValue(gaussian?.waist.z, 2)} mm<br />1/e² 直径 = {formatValue(gaussian?.waist.diameter)} mm</p><button disabled={!gaussian?.waist.afterLastElement || gaussian.waist.z <= 1 || gaussian.waist.z > 5000} onClick={() => gaussian && setScreen(gaussian.waist.z)}>将目标面移到束腰</button></div></div><p className="od-analysis-note">几何 y-RMS 是子午截面采样高度相对中心的均方根，不能代表二维光斑、PSF 或耦合效率。Gaussian 强度图为未截断参考束。</p></>}
    {tab === 'system' && <><div className="od-system"><div><h3>源面 → 目标面</h3><div className="od-matrix"><span>{formatValue(a.matrix.A)}</span><span>{formatValue(a.matrix.B)} mm</span><span>{formatValue(a.matrix.C)} mm⁻¹</span><span>{formatValue(a.matrix.D)}</span></div><p>偏心引起的仿射项：E = {formatValue(a.matrix.E)} mm，F = {formatValue(a.matrix.F * 1000)} mrad。</p></div><div><h3>镜组一阶参数</h3><dl><dt>等效焦距 EFL</dt><dd>{formatValue(a.cardinal.efl)} mm</dd><dt>理想模型后焦距</dt><dd>{formatValue(a.cardinal.bfl)} mm</dd><dt>平行入射焦点 z</dt><dd>{formatValue(a.cardinal.backFocusZ)} mm</dd><dt>无焦状态 C ≈ 0</dt><dd>{a.cardinal.afocal ? '是' : '否'}</dd></dl></div></div><p className="od-analysis-note">镜组矩阵从第一片理想透镜前到最后一片后计算。模型后焦距从最后镜平面量起；厂家实际 BFL 仍未核验。C = 0 表示无焦系统，B = 0 表示源面到目标面的一阶成像条件。</p><div className="od-formulas"><code>y′ = y + dθ</code><code>θ′ = θ − (y − y镜) / f</code><code>q′ = (Aq + B) / (Cq + D)</code></div></>}
    {tab === 'scan' && <><p className="od-analysis-note">选中一个元件，扫描位置或自定义焦距。每个点单独计算；扫描选项标注几何截光或 Gaussian 包络孔径不足。扫描位置可以改变光学顺序，应用前请检查处方表。</p>{element ? <><div className="od-scan-controls"><label>扫描 {element.name}<select aria-label="扫描参数" value={scanParameter} onChange={e => { setScanParameter(e.target.value as 'z' | 'focal'); setScanValue(null); }}><option value="z">位置 z / mm</option>{element.kind === 'lens' && <option value="focal">焦距 f / mm</option>}</select></label><label>起始值<input aria-label="扫描起始值" type="number" value={scanMin} onChange={e => setScanMin(Number(e.target.value))} /></label><label>结束值<input aria-label="扫描结束值" type="number" value={scanMax} onChange={e => setScanMax(Number(e.target.value))} /></label></div><LinePlot lines={[{ name: project.source.mode === 'gaussian' ? '目标面 1/e² 直径' : '目标面几何范围', color: '#2667bf', points: sweep.filter(s => s.metric !== null).map(s => ({ x: s.value, y: s.metric! })) }]} xlabel={`${scanParameter === 'z' ? '位置 z' : '焦距 f'} / mm`} /><div className="od-sweep-values"><label>应用一个扫描点<select aria-label="选择扫描点" value={scanValue ?? ''} onChange={e => setScanValue(e.target.value ? Number(e.target.value) : null)}><option value="">选择数值</option>{sweep.filter(s => s.metric !== null).map(s => <option key={s.value} value={s.value}>{formatValue(s.value, 2)} mm · {formatValue(s.metric)} mm{s.gaussianClipped ? ' · 包络孔径不足' : s.passed < s.total ? ' · 几何截光' : ''}</option>)}</select></label><button disabled={scanValue === null || !sweep.some(s => s.value === scanValue && s.metric !== null)} onClick={() => { if (scanValue !== null && sweep.some(s => s.value === scanValue && s.metric !== null)) { const next = parseDesignProject({ ...project, elements: project.elements.map(e => e.id === element.id ? { ...e, [scanParameter]: scanValue, ...(scanParameter === 'focal' ? { sku: undefined, apertureBasis: 'custom', name: '自定义透镜' } : {}) } : e) }, catalog); commit(next); } }}>应用到元件</button></div></> : <div className="od-plot-empty">先在布局图或元件表中选择一片透镜。</div>}</>}
  </div></section>;
}
