import { parseFoldedScene, traceFoldedScene, type FoldedScene } from './folded-engine.ts';

export type FoldedScanParameter = 'x' | 'y' | 'angleDeg' | 'focal';
export type FoldedScanOptions = { elementId: string; detectorId: string; parameter: FoldedScanParameter; min: number; max: number; count?: number; minCaptureFraction: number };
export type FoldedScanPoint = { value: number; captureFraction: number; rms: number | null; feasible: boolean; reason: string };

export function sceneAtScanValue(scene: FoldedScene, options: FoldedScanOptions, value: number): FoldedScene {
  const element = scene.elements.find(e => e.id === options.elementId);
  if (!element) throw new Error('扫描元件不存在。');
  if (!['x', 'y', 'angleDeg', 'focal'].includes(options.parameter)) throw new Error('不支持此扫描变量。');
  if (options.parameter === 'focal' && !['lens', 'objective', 'cylindrical'].includes(element.kind)) throw new Error('焦距只适用于透镜、物镜或柱透镜。');
  return parseFoldedScene({ ...scene, elements: scene.elements.map(e => e.id === element.id ? { ...e, [options.parameter]: value, ...(options.parameter === 'focal' && e.objective ? { objective: { ...e.objective, catalogSku: undefined } } : {}) } : e) });
}

/** Every sample is an independent geometric trace. Missing/zero-power targets are never optima. */
export function scanFoldedParameter(scene: FoldedScene, options: FoldedScanOptions): FoldedScanPoint[] {
  if (!Number.isFinite(options.min) || !Number.isFinite(options.max) || options.max <= options.min) throw new Error('扫描结束值必须大于起始值。');
  if (!Number.isFinite(options.minCaptureFraction) || options.minCaptureFraction < 0 || options.minCaptureFraction > 1) throw new Error('接收份额要求应在 0–100% 之间。');
  if (!scene.elements.some(e => e.id === options.detectorId && e.kind === 'detector')) throw new Error('请选择目标探测器。');
  const count = Math.min(51, Math.max(3, Math.round(options.count ?? 21)));
  if (!Number.isFinite(count)) throw new Error('扫描点数无效。');
  return Array.from({ length: count }, (_, i) => {
    const value = options.min + (options.max - options.min) * i / (count - 1);
    try {
      const result = traceFoldedScene(sceneAtScanValue(scene, options, value));
      const target = result.detectors.find(d => d.elementId === options.detectorId);
      const captureFraction = result.energy.input > 0 ? (target?.power ?? 0) / result.energy.input : 0;
      const rms = scene.source.beam ? target?.spot.rms2D ?? null : target?.rms ?? null;
      const feasible = captureFraction > 0 && captureFraction + 1e-12 >= options.minCaptureFraction && rms !== null && Number.isFinite(rms) && result.energy.unresolved <= result.energy.input * 1e-10;
      return { value, captureFraction, rms, feasible, reason: feasible ? '通过接收份额与追迹完成检查' : result.energy.unresolved > result.energy.input * 1e-10 ? '追迹存在未完成份额' : captureFraction <= 0 ? '目标无接收' : captureFraction < options.minCaptureFraction ? '接收份额低于要求' : '目标统计不可用' };
    } catch (error) { return { value, captureFraction: 0, rms: null, feasible: false, reason: error instanceof Error ? error.message : '参数无效' }; }
  });
}

export function bestFoldedScanPoint(points: FoldedScanPoint[]): FoldedScanPoint | null {
  return points.filter(p => p.feasible && p.rms !== null).reduce<FoldedScanPoint | null>((best, p) => !best || p.rms! < best.rms! - 1e-10 || Math.abs(p.rms! - best.rms!) <= 1e-10 && p.captureFraction > best.captureFraction ? p : best, null);
}
