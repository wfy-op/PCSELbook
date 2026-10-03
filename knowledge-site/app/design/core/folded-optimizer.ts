import { parseFoldedScene, traceFoldedScene, type FoldedAnalysis, type FoldedScene } from './folded-engine.ts';

export type FoldedOptimizationParameter = 'x' | 'y' | 'angleDeg' | 'focal';
export type FoldedOptimizationVariable = { elementId: string; parameter: FoldedOptimizationParameter; min: number; max: number };
export type FoldedOptimizationOptions = {
  detectorId: string; goal: 'rms' | 'centroid' | 'capture'; minCaptureFraction: number;
  variables: FoldedOptimizationVariable[]; maxEvaluations: number; relativeTolerance?: number;
};
export type FoldedOptimizationMetrics = {
  captureFraction: number; rms: number | null; centroidError: number | null;
  unresolvedFraction: number; balanceErrorFraction: number; feasible: boolean; reason: string;
};
export type FoldedOptimizationProgress = {
  evaluations: number; maxEvaluations: number; best: FoldedOptimizationMetrics;
};
export type FoldedOptimizationResult = {
  baselineSignature: string; optionsSignature: string;
  baseline: FoldedOptimizationMetrics; best: FoldedOptimizationMetrics;
  candidate: FoldedScene | null; evaluations: number; improved: boolean;
  status: 'converged' | 'budget' | 'cancelled';
  values: { variable: FoldedOptimizationVariable; before: number; after: number }[];
};
type Runtime = { signal?: AbortSignal; onProgress?: (progress: FoldedOptimizationProgress) => void; yieldEvery?: number };
type Sample = { scene: FoldedScene; metrics: FoldedOptimizationMetrics; vector: number[] };

const parameters: FoldedOptimizationParameter[] = ['x', 'y', 'angleDeg', 'focal'];
const opticalKinds = ['lens', 'objective', 'cylindrical'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sceneSignature = (scene: FoldedScene) => JSON.stringify(parseFoldedScene(scene));
const optionsSignature = (options: FoldedOptimizationOptions) => JSON.stringify(options);

/** Constraints are validated once; every candidate is then a canonical engineering scene. */
export function validateFoldedOptimizationOptions(scene: FoldedScene, options: FoldedOptimizationOptions): void {
  if (!scene.elements.some(e => e.id === options.detectorId && e.kind === 'detector')) throw new Error('请选择存在的目标探测器。');
  if (!['rms', 'centroid', 'capture'].includes(options.goal)) throw new Error('优化目标无效。');
  if (!finite(options.minCaptureFraction) || options.minCaptureFraction < 0 || options.minCaptureFraction > 1) throw new Error('最小接收份额必须在 0–100% 之间。');
  if (!Number.isInteger(options.maxEvaluations) || options.maxEvaluations < 10 || options.maxEvaluations > 2000) throw new Error('计算预算必须为 10–2000 次追迹。');
  if (options.relativeTolerance !== undefined && (!finite(options.relativeTolerance) || options.relativeTolerance < 1e-6 || options.relativeTolerance > .05)) throw new Error('相对步长阈值必须在 0.000001–0.05 之间。');
  if (!Array.isArray(options.variables) || !options.variables.length || options.variables.length > 8) throw new Error('请选择 1–8 个优化变量。');
  const keys = new Set<string>();
  for (const variable of options.variables) {
    const element = scene.elements.find(e => e.id === variable.elementId);
    if (!element) throw new Error('优化变量所对应的元件已不存在。');
    if (!parameters.includes(variable.parameter)) throw new Error('优化变量必须是 X、Y、法线或焦距。');
    const key = `${variable.elementId}:${variable.parameter}`;
    if (keys.has(key)) throw new Error('同一元件参数不能重复优化。');
    keys.add(key);
    if (!finite(variable.min) || !finite(variable.max) || variable.max <= variable.min) throw new Error('每个变量的上限必须大于下限。');
    if (element[variable.parameter] < variable.min || element[variable.parameter] > variable.max) throw new Error('变量范围必须包含当前值，请重新设置上下限。');
    const { parameter, min, max } = variable;
    if (parameter === 'x' && (min < scene.bounds.minX || max > scene.bounds.maxX) || parameter === 'y' && (min < scene.bounds.minY || max > scene.bounds.maxY)) throw new Error('位置范围必须位于当前计算区域内。');
    if (parameter === 'angleDeg' && (min < -3600 || max > 3600)) throw new Error('法线范围必须位于 −3600° 至 3600° 内。');
    if (parameter === 'focal') {
      if (!opticalKinds.includes(element.kind)) throw new Error('焦距变量只适用于透镜、物镜或柱透镜。');
      if (min < -10000 || max > 10000 || min < 1 && max > -1 || element.kind === 'objective' && min < 1) throw new Error('焦距范围不能穿过 |f| < 1 mm；物镜焦距必须为正。');
    }
  }
}

/** A 2D engine supplies radial RMS and U/V centroid; old meridional projects still work. */
export function foldedOptimizationMetrics(result: FoldedAnalysis, options: FoldedOptimizationOptions): FoldedOptimizationMetrics {
  const detector = result.detectors.find(d => d.elementId === options.detectorId);
  const spot = (detector as typeof detector & { spot?: { rms2D: number | null; centroidU: number | null; centroidV: number | null } })?.spot;
  const captureFraction = result.energy.input > 0 ? (detector?.power ?? 0) / result.energy.input : 0;
  const rms = spot?.rms2D ?? detector?.rms ?? null;
  const centroidError = spot && spot.centroidU !== null && spot.centroidV !== null ? Math.hypot(spot.centroidU, spot.centroidV) : detector?.centroid === null || detector?.centroid === undefined ? null : Math.abs(detector.centroid);
  const unresolvedFraction = result.energy.input > 0 ? result.energy.unresolved / result.energy.input : 0;
  const balanceErrorFraction = result.energy.input > 0 ? Math.abs(result.energy.balanceError) / result.energy.input : 0;
  const feasible = captureFraction > 0 && captureFraction + 1e-12 >= options.minCaptureFraction && finite(rms) && finite(centroidError) && unresolvedFraction <= 1e-10 && balanceErrorFraction <= 1e-8;
  const reason = unresolvedFraction > 1e-10 ? '追迹存在未完成份额' : balanceErrorFraction > 1e-8 ? '功率核算超出容差' : captureFraction <= 0 ? '目标无接收' : captureFraction + 1e-12 < options.minCaptureFraction ? '接收份额低于约束' : !finite(rms) || !finite(centroidError) ? '目标统计不可用' : '通过接收与功率核算约束';
  return { captureFraction, rms, centroidError, unresolvedFraction, balanceErrorFraction, feasible, reason };
}

function merit(metrics: FoldedOptimizationMetrics, goal: FoldedOptimizationOptions['goal']): number[] {
  if (!metrics.feasible) return [1, metrics.unresolvedFraction > 1e-10 || metrics.balanceErrorFraction > 1e-8 ? 1 : 0, -metrics.captureFraction, metrics.rms ?? Infinity, metrics.centroidError ?? Infinity];
  if (goal === 'capture') return [0, -metrics.captureFraction, metrics.rms!, metrics.centroidError!];
  if (goal === 'centroid') return [0, metrics.centroidError!, metrics.rms!, -metrics.captureFraction];
  return [0, metrics.rms!, metrics.centroidError!, -metrics.captureFraction];
}
function better(a: FoldedOptimizationMetrics, b: FoldedOptimizationMetrics, goal: FoldedOptimizationOptions['goal']): boolean {
  const ma = merit(a, goal), mb = merit(b, goal);
  for (let i = 0; i < ma.length; i++) {
    const tolerance = i === 0 ? 0 : 1e-10 * Math.max(1, Math.abs(ma[i]), Math.abs(mb[i]));
    if (ma[i] < mb[i] - tolerance) return true;
    if (ma[i] > mb[i] + tolerance) return false;
  }
  return false;
}

function sceneAtVector(scene: FoldedScene, variables: FoldedOptimizationVariable[], vector: number[]): FoldedScene {
  const elements = scene.elements.map(e => ({ ...e }));
  variables.forEach((variable, i) => {
    const element = elements.find(e => e.id === variable.elementId)!;
    const value = variable.min + vector[i] * (variable.max - variable.min);
    element[variable.parameter] = value;
    if (variable.parameter === 'focal' && element.objective && Math.abs(value - scene.elements.find(e => e.id === element.id)!.focal) > 1e-12) element.objective = { ...element.objective, catalogSku: undefined };
  });
  return parseFoldedScene({ ...scene, elements });
}

/** Deterministic bounded coordinate/pattern search, never a global-optimum claim.
 * Every distinct trial runs the current trace at the current source sampling.
 * No ray subsampling or analytical replacement of detector metrics is used.
 */
function* search(input: FoldedScene, options: FoldedOptimizationOptions, runtime: Runtime): Generator<FoldedOptimizationProgress, FoldedOptimizationResult> {
  const scene = parseFoldedScene(input);
  validateFoldedOptimizationOptions(scene, options);
  const variables = options.variables.map(v => ({ ...v }));
  let evaluations = 0, step = .25, converged = false;
  const cache = new Map<string, Sample>();
  const evaluate = (vector: number[]): Sample => {
    const key = vector.map(v => v.toFixed(12)).join(',');
    const cached = cache.get(key);
    if (cached) return cached;
    const candidate = sceneAtVector(scene, variables, vector);
    // Large split loops remain explicit failures rather than blocking indefinitely.
    const metrics = foldedOptimizationMetrics(traceFoldedScene(candidate, { maxEvents: 64, maxSegments: 20000 }), options);
    const sample = { scene: candidate, metrics, vector: [...vector] };
    evaluations++; cache.set(key, sample);
    return sample;
  };
  const initialVector = variables.map(v => (scene.elements.find(e => e.id === v.elementId)![v.parameter] - v.min) / (v.max - v.min));
  const initial = evaluate(initialVector);
  let best = initial;
  const progress = (): FoldedOptimizationProgress => ({ evaluations, maxEvaluations: options.maxEvaluations, best: { ...best.metrics } });
  yield progress();
  // If the baseline misses the target, broad coordinate probes can recover capture.
  if (!initial.metrics.feasible) for (let axis = 0; axis < variables.length && evaluations < options.maxEvaluations && !runtime.signal?.aborted; axis++) {
    for (const value of [0, .25, .5, .75, 1]) {
      if (evaluations >= options.maxEvaluations || runtime.signal?.aborted) break;
      const vector = [...best.vector]; vector[axis] = value;
      const candidate = evaluate(vector);
      if (better(candidate.metrics, best.metrics, options.goal)) best = candidate;
      yield progress();
    }
  }
  while (evaluations < options.maxEvaluations && !runtime.signal?.aborted) {
    const previous = best;
    for (let axis = 0; axis < variables.length && evaluations < options.maxEvaluations && !runtime.signal?.aborted; axis++) {
      const center = best;
      for (const sign of [-1, 1]) {
        if (evaluations >= options.maxEvaluations || runtime.signal?.aborted) break;
        const vector = [...center.vector]; vector[axis] = clamp(center.vector[axis] + sign * step, 0, 1);
        const candidate = evaluate(vector);
        if (better(candidate.metrics, best.metrics, options.goal)) best = candidate;
        yield progress();
      }
    }
    if (best !== previous) {
      if (evaluations < options.maxEvaluations && !runtime.signal?.aborted) {
        const candidate = evaluate(best.vector.map((v, i) => clamp(2 * v - previous.vector[i], 0, 1)));
        if (better(candidate.metrics, best.metrics, options.goal)) best = candidate;
        yield progress();
      }
    } else {
      step /= 2;
      if (step < (options.relativeTolerance ?? 1e-4)) { converged = true; break; }
    }
  }
  const cancelled = !!runtime.signal?.aborted;
  const improved = !cancelled && best.metrics.feasible && better(best.metrics, initial.metrics, options.goal);
  return {
    baselineSignature: sceneSignature(scene), optionsSignature: optionsSignature(options),
    baseline: initial.metrics, best: best.metrics, candidate: improved ? best.scene : null,
    evaluations, improved, status: cancelled ? 'cancelled' : converged ? 'converged' : 'budget',
    values: variables.map(v => ({ variable: v, before: scene.elements.find(e => e.id === v.elementId)![v.parameter], after: best.scene.elements.find(e => e.id === v.elementId)![v.parameter] })),
  };
}

/** Synchronous runner is used by analytic verification and non-UI consumers. */
export function optimizeFoldedSceneSync(scene: FoldedScene, options: FoldedOptimizationOptions): FoldedOptimizationResult {
  const iterator = search(scene, options, {});
  let item = iterator.next();
  while (!item.done) item = iterator.next();
  return item.value;
}

/** Cooperative browser runner yields between traces, with cancellation and progress. */
export async function optimizeFoldedScene(scene: FoldedScene, options: FoldedOptimizationOptions, runtime: Runtime = {}): Promise<FoldedOptimizationResult> {
  const iterator = search(scene, options, runtime);
  const yieldEvery = Math.max(1, Math.min(20, runtime.yieldEvery ?? 3));
  let count = 0, sliceStart = Date.now();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  let item = iterator.next();
  while (!item.done) {
    runtime.onProgress?.(item.value);
    if (++count % yieldEvery === 0 || Date.now() - sliceStart >= 12) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      sliceStart = Date.now();
    }
    item = iterator.next();
  }
  return item.value;
}

export function canApplyFoldedOptimization(scene: FoldedScene, options: FoldedOptimizationOptions, result: FoldedOptimizationResult): boolean {
  return result.improved && result.best.feasible && result.status !== 'cancelled' && result.candidate !== null && isFoldedOptimizationCurrent(scene, options, result);
}

export function isFoldedOptimizationCurrent(scene: FoldedScene, options: FoldedOptimizationOptions, result: FoldedOptimizationResult): boolean {
  return result.baselineSignature === sceneSignature(scene) && result.optionsSignature === optionsSignature(options);
}

/** Reject stale candidates after any engineering or constraint change. */
export function applyFoldedOptimization(scene: FoldedScene, options: FoldedOptimizationOptions, result: FoldedOptimizationResult): FoldedScene {
  if (!canApplyFoldedOptimization(scene, options, result)) throw new Error('工程或优化条件已改变，请重新计算后再应用。');
  return parseFoldedScene(result.candidate);
}
