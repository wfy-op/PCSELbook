import { useState } from 'react';
import { foldedLabels } from './folded-labels';
import type { FoldedScene } from './core/folded-engine';
import { bestFoldedScanPoint, scanFoldedParameter, sceneAtScanValue, type FoldedScanOptions, type FoldedScanParameter, type FoldedScanPoint } from './core/folded-scan';

const labels: Record<FoldedScanParameter, string> = { x: '位置 X / mm', y: '位置 Y / mm', angleDeg: '法线角度 / °', focal: '焦距 / mm' };
const fmt = (value: number | null, digits = 4) => value === null ? '—' : (Math.abs(value) < 1e-10 ? 0 : value).toFixed(digits);
function Field({ label, value, change, min, max, unit }: { label: string; value: number; change: (v: number) => void; min: number; max: number; unit?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => { if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) change(Math.max(min, Math.min(max, Number(draft)))); setDraft(null); };
  return <label className="od-number"><span>{label}<small>{unit}</small></span><input type="number" aria-label={label} value={draft ?? value} min={min} max={max} step="any" onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} /></label>;
}

export function FoldedScan({ scene, commit }: { scene: FoldedScene; commit: (next: FoldedScene) => void }) {
  const fallback = scene.elements.find(e => ['lens', 'objective', 'cylindrical'].includes(e.kind)) ?? scene.elements[0];
  const [elementId, setElementId] = useState(fallback?.id ?? '');
  const [detectorId, setDetectorId] = useState(scene.elements.find(e => e.kind === 'detector')?.id ?? '');
  const [parameter, setParameter] = useState<FoldedScanParameter>('x');
  const element = scene.elements.find(e => e.id === elementId) ?? fallback;
  const detector = scene.elements.find(e => e.id === detectorId && e.kind === 'detector') ?? scene.elements.find(e => e.kind === 'detector');
  const lensLike = !!element && ['lens', 'objective', 'cylindrical'].includes(element.kind);
  const rmsLabel = scene.source.beam ? '几何 RMS 2D' : '子午一维 RMS';
  const labelsById = foldedLabels(scene);
  const activeParameter = parameter === 'focal' && !lensLike ? 'x' : parameter;
  const [min, setMin] = useState((fallback?.x ?? 250) - 30);
  const [max, setMax] = useState((fallback?.x ?? 250) + 30);
  const [minCapture, setMinCapture] = useState(10);
  const [scan, setScan] = useState<{ hash: string; points: FoldedScanPoint[] } | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState('');
  const options: FoldedScanOptions = { elementId: element?.id ?? '', detectorId: detector?.id ?? '', parameter: activeParameter, min, max, minCaptureFraction: minCapture / 100 };
  const hash = JSON.stringify({ scene, options });
  const points = scan?.hash === hash ? scan.points : [];
  const best = bestFoldedScanPoint(points);
  const selected = points.find(p => p.value === choice) ?? null;
  const centerRange = (id: string, param: FoldedScanParameter) => {
    const e = scene.elements.find(e => e.id === id);
    if (e) { const gap = param === 'angleDeg' ? 10 : 30; setMin(e[param] - gap); setMax(e[param] + gap); }
  };
  const compute = () => {
    try { const result = scanFoldedParameter(scene, options); setScan({ hash, points: result }); setChoice(null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '扫描未完成。'); setScan(null); }
  };
  const apply = (point: FoldedScanPoint | null) => {
    if (!point?.feasible || !points.includes(point)) return;
    try { commit(sceneAtScanValue(scene, options, point.value)); setScan(null); setChoice(null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '参数无效。'); }
  };
  const valid = points.filter(p => p.rms !== null && Number.isFinite(p.rms));
  const top = Math.max(.001, ...valid.map(p => p.rms!));
  const x = (v: number) => 50 + (v - min) / (max - min || 1) * 610;
  const y = (v: number) => 155 - v / top * 125;
  return <section className="od-prescription fd-scan" aria-labelledby="fd-scan-title">
    <div className="od-section-title"><h2 id="fd-scan-title">按需求扫描空间光路</h2><span>21 点实际追迹 · 先预览再应用</span></div>
    <p>选择变量和目标探测器，比较{rmsLabel}；同时要求探测器接收足够的输入份额。无接收与追迹未完成的点不会被选为最优。</p>
    <div className="fd-scan-controls">
      <label className="od-select-field">扫描元件<select aria-label="空间扫描元件" value={element?.id ?? ''} onChange={e => { setElementId(e.target.value); centerRange(e.target.value, activeParameter); }}>{scene.elements.map(e => <option key={e.id} value={e.id}>{labelsById.get(e.id)!.label}</option>)}</select></label>
      <label className="od-select-field">变量<select aria-label="空间扫描变量" value={activeParameter} onChange={e => { const param = e.target.value as FoldedScanParameter; setParameter(param); centerRange(element?.id ?? '', param); }}>{Object.entries(labels).filter(([p]) => p !== 'focal' || lensLike).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="od-select-field">目标探测器<select aria-label="空间扫描目标探测器" value={detector?.id ?? ''} onChange={e => setDetectorId(e.target.value)}>{scene.elements.filter(e => e.kind === 'detector').map(e => <option key={e.id} value={e.id}>{labelsById.get(e.id)!.label}</option>)}</select></label>
      <Field label="空间扫描起始值" value={min} min={-10000} max={10000} change={setMin} /><Field label="空间扫描结束值" value={max} min={-10000} max={10000} change={setMax} />
      <Field label="最小接收份额" value={minCapture} min={0} max={100} unit="%" change={setMinCapture} />
    </div>
    <div className="fd-scan-actions"><button disabled={!element} onClick={() => element && centerRange(element.id, activeParameter)}>以当前参数设范围</button><button className="od-primary" disabled={!element || !detector} onClick={compute}>计算空间参数扫描</button><button disabled={!best} onClick={() => apply(best)}>应用最小 RMS 可行点</button></div>
    {element && <p className="od-field-help">当前{labels[activeParameter]}：{fmt(element[activeParameter])}。</p>}
    {!element || !detector ? <p className="od-muted">先加入一个可调元件和目标探测器。</p> : null}
    {scan && !points.length && <p className="od-muted">工程或扫描条件已改变，请重新计算。</p>}{error && <p role="alert" className="od-negative">{error}</p>}
    {!!points.length && <>
      <svg className="fd-scan-plot" viewBox="0 0 710 200" role="img" aria-label={`扫描变量与探测器${rmsLabel}曲线`}>
        <path d="M50 25V155H660" stroke="#93a9bd" fill="none" /><text x="8" y="20" fill="#456580" fontSize="11">{rmsLabel} / mm</text><text x="45" y="178" fill="#456580" fontSize="11">{fmt(min, 2)}</text><text x="615" y="178" fill="#456580" fontSize="11">{fmt(max, 2)}</text><text x="7" y="37" fill="#456580" fontSize="11">{fmt(top, 3)}</text><text x="20" y="158" fill="#456580" fontSize="11">0</text><text x="300" y="196" fill="#456580" fontSize="11">{labels[activeParameter]}</text>
        {points.slice(1).map((p, i) => p.rms !== null && points[i].rms !== null ? <path key={`line-${i}`} d={`M${x(points[i].value)} ${y(points[i].rms!)}L${x(p.value)} ${y(p.rms)}`} stroke="#7795b2" fill="none" /> : null)}
        {valid.map(p => <circle key={p.value} cx={x(p.value)} cy={y(p.rms!)} r={p === best ? 5 : 3} fill={p.feasible ? '#2862a9' : '#b77938'}><title>{fmt(p.value)}：RMS {fmt(p.rms)} mm，接收 {(p.captureFraction * 100).toFixed(2)}% · {p.reason}</title></circle>)}
      </svg>
      <p className="od-field-help">蓝点满足接收约束；棕点未满足约束。此结果是有限范围的单变量离散比较，不保证全局最优，也不代表衍射光斑。</p>
      <div className="fd-scan-actions"><label className="od-select-field">查看扫描点<select aria-label="空间扫描点" value={selected?.value ?? ''} onChange={e => setChoice(e.target.value === '' ? null : Number(e.target.value))}><option value="">选择扫描结果</option>{points.map(p => <option key={p.value} value={p.value}>{fmt(p.value, 3)} · RMS {fmt(p.rms, 4)} mm · 接收 {(p.captureFraction * 100).toFixed(1)}% · {p.feasible ? '可行' : p.reason}</option>)}</select></label><button disabled={!selected?.feasible} onClick={() => apply(selected)}>应用所选空间扫描点</button></div>
      {best ? <p className="fd-scan-best">本次可行最小值：{labels[activeParameter]} = {fmt(best.value)}，RMS = {fmt(best.rms)} mm，接收 {(best.captureFraction * 100).toFixed(2)}%。</p> : <p className="od-muted">当前范围内没有满足约束的扫描点。</p>}
    </>}
  </section>;
}
