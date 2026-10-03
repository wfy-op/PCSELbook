import { useEffect, useId, useRef, useState } from 'react';
import type { FoldedAnalysis, FoldedScene } from './core/folded-engine';
import { foldedLabels } from './folded-labels';
import {
  applyFoldedOptimization, canApplyFoldedOptimization, isFoldedOptimizationCurrent, optimizeFoldedScene,
  type FoldedOptimizationMetrics, type FoldedOptimizationOptions, type FoldedOptimizationParameter,
  type FoldedOptimizationProgress, type FoldedOptimizationResult, type FoldedOptimizationVariable,
} from './core/folded-optimizer';
import './folded-optimizer.css';

const parameterLabels: Record<FoldedOptimizationParameter, string> = { x: 'X / mm', y: 'Y / mm', angleDeg: '法线 / °', focal: '焦距 / mm' };
const opticalKinds = ['lens', 'objective', 'cylindrical'];
const fmt = (value: number | null, digits = 4) => value === null ? '—' : (Math.abs(value) < 1e-10 ? 0 : value).toFixed(digits);
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
function defaultVariable(scene: FoldedScene, elementId: string, parameter: FoldedOptimizationParameter): FoldedOptimizationVariable {
  const element = scene.elements.find(e => e.id === elementId)!;
  const value = element[parameter], gap = parameter === 'angleDeg' ? 5 : parameter === 'focal' ? Math.max(2, Math.abs(value) * .2) : 30;
  let min = value - gap, max = value + gap;
  if (parameter === 'x') { min = Math.max(min, scene.bounds.minX); max = Math.min(max, scene.bounds.maxX); }
  if (parameter === 'y') { min = Math.max(min, scene.bounds.minY); max = Math.min(max, scene.bounds.maxY); }
  if (parameter === 'angleDeg') { min = Math.max(-3600, min); max = Math.min(3600, max); }
  if (parameter === 'focal') { min = Math.max(-10000, min); max = Math.min(10000, max); if (value > 0) min = Math.max(1, min); else max = Math.min(-1, max); }
  return { elementId, parameter, min, max };
}
function NumericInput({ id, label, value, onChange, min, max, step = 'any' }: { id?: string; label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number | 'any' }) {
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft));
    setDraft(null);
  };
  return <input id={id} type="number" aria-label={label} value={draft ?? value} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDraft(null); }} />;
}
function MetricsRow({ label, metrics }: { label: string; metrics: FoldedOptimizationMetrics }) {
  return <tr><th scope="row">{label}</th><td>{fmt(metrics.rms)}</td><td>{fmt(metrics.centroidError)}</td><td>{percent(metrics.captureFraction)}</td><td>{metrics.feasible ? '满足约束' : metrics.reason}</td></tr>;
}

/** The solver previews a candidate; applying is a separate, undoable engineering edit. */
export function FoldedOptimizer({ scene, result, onApply }: { scene: FoldedScene; result: FoldedAnalysis; onApply: (candidate: FoldedScene) => void }) {
  const titleId = useId();
  const detectors = scene.elements.filter(e => e.kind === 'detector');
  const labels = foldedLabels(scene);
  const initialDetector = detectors[0];
  const [detectorId, setDetectorId] = useState(initialDetector?.id ?? '');
  const activeDetector = detectors.find(e => e.id === detectorId) ?? initialDetector;
  const [goal, setGoal] = useState<FoldedOptimizationOptions['goal']>('rms');
  const [minCapture, setMinCapture] = useState(() => {
    const capture = result.energy.input > 0 ? (result.detectors.find(d => d.elementId === initialDetector?.id)?.power ?? 0) / result.energy.input : 0;
    return capture > 0 ? Math.min(95, Math.round(capture * 95 * 100) / 100) : 95;
  });
  const [budget, setBudget] = useState(120);
  const [variables, setVariables] = useState<FoldedOptimizationVariable[]>(() => initialDetector ? [defaultVariable(scene, initialDetector.id, 'x'), defaultVariable(scene, initialDetector.id, 'y')] : []);
  const [addElementId, setAddElementId] = useState(scene.elements.find(e => e.kind !== 'detector')?.id ?? scene.elements[0]?.id ?? '');
  const addElement = scene.elements.find(e => e.id === addElementId) ?? scene.elements[0];
  const [addParameter, setAddParameter] = useState<FoldedOptimizationParameter>('x');
  const activeParameter = addParameter === 'focal' && !opticalKinds.includes(addElement?.kind ?? '') ? 'x' : addParameter;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<FoldedOptimizationProgress | null>(null);
  const [outcome, setOutcome] = useState<FoldedOptimizationResult | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null), requestRef = useRef(0);
  useEffect(() => () => { requestRef.current++; abortRef.current?.abort(); }, []);
  const options: FoldedOptimizationOptions = { detectorId: activeDetector?.id ?? '', goal, minCaptureFraction: minCapture / 100, variables, maxEvaluations: budget };
  const validOutcome = !!outcome && canApplyFoldedOptimization(scene, options, outcome);
  const stale = !!outcome && !isFoldedOptimizationCurrent(scene, options, outcome);
  const selectedDetector = result.detectors.find(d => d.elementId === activeDetector?.id);
  const currentCapture = result.energy.input > 0 ? (selectedDetector?.power ?? 0) / result.energy.input : 0;
  const canAdd = !!addElement && variables.length < 8 && !variables.some(v => v.elementId === addElement.id && v.parameter === activeParameter);
  const updateVariable = (index: number, patch: Partial<FoldedOptimizationVariable>) => setVariables(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const run = async () => {
    const requestId = ++requestRef.current;
    const controller = new AbortController(); abortRef.current = controller;
    setRunning(true); setError(''); setOutcome(null); setProgress(null);
    try {
      const computed = await optimizeFoldedScene(scene, options, { signal: controller.signal, onProgress: next => { if (requestId === requestRef.current) setProgress(next); } });
      if (requestId === requestRef.current) setOutcome(computed);
    } catch (failure) {
      if (requestId === requestRef.current) setError(failure instanceof Error ? failure.message : '优化未完成，请检查变量和约束。');
    } finally {
      if (requestId === requestRef.current) { setRunning(false); abortRef.current = null; }
    }
  };
  const apply = () => {
    if (!outcome) return;
    try { onApply(applyFoldedOptimization(scene, options, outcome)); setOutcome(null); setProgress(null); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '候选工程已失效，请重新计算。'); }
  };
  return <details className="od-prescription fd-optimizer">
    <summary id={titleId}><svg className="fd-optimizer-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg><span>多变量约束优化</span><small>选择变量 · 比较结果 · 应用候选</small></summary>
    <div className="fd-optimizer-content" aria-labelledby={titleId}>
      <p>在明确的上下限内进行实际追迹与局部模式搜索。位置、法线、焦距可以联合调整；接收不足、无接收或追迹未完成的候选不会应用。</p>
      <fieldset disabled={running}>
        <legend className="fd-sr-only">空间优化条件</legend>
        <div className="fd-optimizer-controls">
          <label className="od-select-field">目标探测器<select aria-label="优化目标探测器" value={activeDetector?.id ?? ''} onChange={e => setDetectorId(e.target.value)}>{detectors.map(e => <option key={e.id} value={e.id}>{labels.get(e.id)?.label}</option>)}</select></label>
          <label className="od-select-field">优先目标<select aria-label="空间优化目标" value={goal} onChange={e => setGoal(e.target.value as FoldedOptimizationOptions['goal'])}><option value="rms">最小光斑 RMS</option><option value="centroid">光斑中心对准探测器</option><option value="capture">最大接收份额</option></select></label>
          <label className="od-number" htmlFor={`${titleId}-capture`}><span>最低接收份额<small>%</small></span><NumericInput id={`${titleId}-capture`} label="优化最低接收份额" value={minCapture} min={0} max={100} onChange={setMinCapture} /></label>
          <label className="od-number" htmlFor={`${titleId}-budget`}><span>追迹计算预算<small>次</small></span><NumericInput id={`${titleId}-budget`} label="优化追迹预算" value={budget} min={10} max={2000} step={1} onChange={setBudget} /></label>
        </div>
        <p className="od-field-help">当前目标接收 {percent(currentCapture)}。RMS 使用已计算的二维光斑径向统计；旧一维工程保留其线光斑统计。相同主目标下再比较居中误差和接收份额。</p>
        <div className="fd-optimizer-variable-add">
          <label className="od-select-field">可调元件<select aria-label="添加优化元件" value={addElement?.id ?? ''} onChange={e => setAddElementId(e.target.value)}>{scene.elements.map(e => <option key={e.id} value={e.id}>{labels.get(e.id)?.label}</option>)}</select></label>
          <label className="od-select-field">参数<select aria-label="添加优化参数" value={activeParameter} onChange={e => setAddParameter(e.target.value as FoldedOptimizationParameter)}>{Object.entries(parameterLabels).filter(([p]) => p !== 'focal' || opticalKinds.includes(addElement?.kind ?? '')).map(([p, label]) => <option key={p} value={p}>{label}</option>)}</select></label>
          <button disabled={!canAdd} onClick={() => addElement && setVariables(rows => [...rows, defaultVariable(scene, addElement.id, activeParameter)])}>加入变量</button>
        </div>
        <div className="fd-optimizer-table-wrap"><table className="fd-optimizer-variables"><thead><tr><th>元件 / 参数</th><th>当前值</th><th>下限</th><th>上限</th><th><span className="fd-sr-only">操作</span></th></tr></thead><tbody>{variables.map((variable, i) => {
          const element = scene.elements.find(e => e.id === variable.elementId), name = `${labels.get(variable.elementId)?.label ?? '已移除元件'} ${parameterLabels[variable.parameter]}`;
          return <tr key={`${variable.elementId}-${variable.parameter}`}><th scope="row">{name}</th><td>{fmt(element?.[variable.parameter] ?? null, 3)}</td><td><NumericInput label={`${name} 优化下限`} value={variable.min} onChange={min => updateVariable(i, { min })} /></td><td><NumericInput label={`${name} 优化上限`} value={variable.max} onChange={max => updateVariable(i, { max })} /></td><td><button aria-label={`移除 ${name} 优化变量`} onClick={() => setVariables(rows => rows.filter((_, index) => index !== i))}>移除</button></td></tr>;
        })}</tbody></table></div>
        {!variables.length && <p className="od-muted">加入至少一个可调变量，最多 8 个。范围必须包含当前值。</p>}
      </fieldset>
      <div className="fd-optimizer-actions"><button className="od-primary" disabled={running || !activeDetector || !variables.length} onClick={() => void run()}>计算优化候选</button>{running && <button onClick={() => abortRef.current?.abort()}>停止计算</button>}<button disabled={running || !validOutcome} onClick={apply}>应用优化候选</button></div>
      {!activeDetector && <p className="od-muted">先加入探测面，再设置目标和可调变量。</p>}
      {running && progress && <div className="fd-optimizer-progress" role="status"><progress aria-label="优化计算进度" value={progress.evaluations} max={progress.maxEvaluations} /><span>已追迹 {progress.evaluations} / {progress.maxEvaluations} 次 · 当前最佳接收 {percent(progress.best.captureFraction)}</span></div>}
      {error && <p role="alert" className="od-negative">{error}</p>}
      {outcome && <>
        <p role="status">{outcome.status === 'cancelled' ? `已停止，完成 ${outcome.evaluations} 次追迹。` : `完成 ${outcome.evaluations} 次追迹${outcome.status === 'budget' ? '，已达到预算' : '，步长达到收敛阈值'}。`}{stale ? '工程或条件已改变，请重新计算。' : outcome.improved ? '已找到满足约束的改善候选。' : '当前范围内没有可应用的改善候选。'}</p>
        <div className="fd-optimizer-table-wrap"><table className="fd-optimizer-comparison"><thead><tr><th>工程</th><th>RMS / mm</th><th>居中误差 / mm</th><th>接收份额</th><th>约束</th></tr></thead><tbody><MetricsRow label="当前工程" metrics={outcome.baseline} /><MetricsRow label="最佳候选" metrics={outcome.best} /></tbody></table></div>
        {outcome.improved && !stale && <ul className="fd-optimizer-changes">{outcome.values.filter(v => Math.abs(v.after - v.before) > 1e-8).map(v => <li key={`${v.variable.elementId}-${v.variable.parameter}`}>{labels.get(v.variable.elementId)?.label} · {parameterLabels[v.variable.parameter]}：{fmt(v.before, 3)} → {fmt(v.after, 3)}</li>)}</ul>}
      </>}
      <p className="od-field-help">计算保留原光源采样、孔径和损耗。有限范围的局部搜索不保证全局最优；实际器件的处方、材料、加工与装调误差仍需专业光学软件和实测校验。</p>
    </div>
  </details>;
}
