/**
 * 2D geometric layout in air, mm and degrees. Source full divergence is mrad.
 * Mirrors use exact planar specular reflection. Lenses are ideal, locally
 * paraxial thin planes (u_out=u_in-h/f), even when the overall path folds.
 * Splitters are zero-thickness planes with user-supplied power R/T. These are
 * NOT amplitude coefficients or manufacturer coating measurements. No glass
 * lateral shift, polarization, interference, diffraction, Gaussian q or
 * aberration calculation is implied. Power is a uniform discrete 1D sampling
 * of the supplied source; it is not a measured beam or a 2D irradiance integral.
 * Finite physical segments are bypassed when missed; the annulus between clear
 * aperture and physical diameter is absorbing. Rays can revisit components;
 * iteration / segment / low-power limits remain explicitly unresolved energy.
 * Primary model references checked 2026-10-02:
 * https://www.edmundoptics.com/knowledge-center/application-notes/optics/geometrical-optics-101-paraxial-ray-tracing-calculations/
 * https://www.thorlabs.com/NewGroupPage9_PF.cfm?ObjectGroup_ID=4808
 */
import { objectiveDefaults, objectiveParts, objectiveWarnings, parseObjectiveModel, type ObjectiveModel } from './objective-model.ts';

export type FoldedPoint = { x: number; y: number };
export type FoldedKind = 'lens' | 'objective' | 'iris' | 'mirror' | 'beamsplitter' | 'detector';
export type FoldedSource = FoldedPoint & {
  directionDeg: number; diameter: number; fullAngle: number; rayCount: number;
  intensity: number; wavelength: number; model: 'fan' | 'extended';
};
export type FoldedElement = FoldedPoint & {
  id: string; kind: FoldedKind; name: string; angleDeg: number;
  diameter: number; aperture: number; focal: number; reflectance: number; transmittance: number;
  objective?: ObjectiveModel;
};
export type FoldedScene = {
  version: 1; name: string; source: FoldedSource;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  elements: FoldedElement[];
};
export type FoldedSegment = {
  start: FoldedPoint; end: FoldedPoint; power: number; rootId: string; branchId: string;
  event: FoldedKind | 'blocked' | 'escape' | 'limit'; elementId?: string;
};
export type FoldedFootprint = {
  elementId: string; incomingPower: number; transmittedPower: number; reflectedPower: number;
  capturedPower: number; absorbedPower: number; hits: number;
  minCoordinate: number | null; maxCoordinate: number | null;
};
export type FoldedDetector = {
  elementId: string; power: number; rayCount: number;
  centroid: number | null; rms: number | null; span: number | null; angleRms: number | null;
};
export type FoldedAnalysis = {
  segments: FoldedSegment[]; detectors: FoldedDetector[]; footprints: FoldedFootprint[];
  energy: { input: number; captured: number; escaped: number; absorbed: number; unresolved: number; balanceError: number };
  sourceRayCount: number; warnings: string[];
};
export type FoldedTraceOptions = { maxEvents?: number; maxSegments?: number; minPowerFraction?: number };

const EPS = 1e-8;
const DEG = Math.PI / 180;
const kinds: FoldedKind[] = ['lens', 'objective', 'iris', 'mirror', 'beamsplitter', 'detector'];
const dot = (a: FoldedPoint, b: FoldedPoint) => a.x * b.x + a.y * b.y;
const add = (a: FoldedPoint, b: FoldedPoint): FoldedPoint => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: FoldedPoint, k: number): FoldedPoint => ({ x: a.x * k, y: a.y * k });
const sub = (a: FoldedPoint, b: FoldedPoint): FoldedPoint => ({ x: a.x - b.x, y: a.y - b.y });
const direction = (deg: number): FoldedPoint => ({ x: Math.cos(deg * DEG), y: Math.sin(deg * DEG) });
const tangent = (n: FoldedPoint): FoldedPoint => ({ x: -n.y, y: n.x });
const unit = (a: FoldedPoint): FoldedPoint => scale(a, 1 / Math.hypot(a.x, a.y));
const wrapAngle = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));

export function foldedElement(kind: FoldedKind, id: string, x = 250, y = 250): FoldedElement {
  const names: Record<FoldedKind, string> = { lens: '薄透镜', objective: '等效物镜', iris: '光阑', mirror: '反射镜', beamsplitter: '半透半反镜', detector: '探测面' };
  const diameter = kind === 'detector' ? 40 : kind === 'lens' || kind === 'iris' ? 25.4 : 36;
  const objective = kind === 'objective' ? parseObjectiveModel(objectiveParts[1]) : undefined;
  return {
    id, kind, name: names[kind], x, y, angleDeg: kind === 'mirror' || kind === 'beamsplitter' ? -45 : 0,
    diameter, aperture: kind === 'detector' ? diameter : kind === 'lens' || kind === 'iris' ? 22.86 : 32,
    focal: 100, reflectance: kind === 'beamsplitter' ? .5 : kind === 'mirror' ? 1 : 0,
    transmittance: kind === 'beamsplitter' ? .5 : kind === 'lens' || kind === 'iris' ? 1 : 0,
    ...(objective ? { ...objectiveDefaults(objective), objective, transmittance: 1 } : {}),
  };
}
export function blankFoldedScene(): FoldedScene {
  return {
    version: 1, name: '自由空间光路', bounds: { minX: 0, maxX: 800, minY: 0, maxY: 550 },
    source: { x: 60, y: 150, directionDeg: 0, diameter: 4, fullAngle: 0, rayCount: 25, intensity: 1, wavelength: 532, model: 'fan' },
    elements: [],
  };
}
export function foldedPresets(): Record<'mirror' | 'split' | 'focus' | 'objective' | 'blank', FoldedScene> {
  const blank = blankFoldedScene();
  const mirror: FoldedScene = { ...blankFoldedScene(), name: '90° 折转光路', elements: [
    foldedElement('mirror', 'mirror-1', 320, 150),
    { ...foldedElement('detector', 'detector-1', 320, 440), angleDeg: 90 },
  ] };
  const split: FoldedScene = { ...blankFoldedScene(), name: '半透半反 · 两路聚焦', elements: [
    foldedElement('beamsplitter', 'splitter-1', 320, 150),
    foldedElement('lens', 'lens-t', 520, 150),
    foldedElement('detector', 'detector-t', 620, 150),
    { ...foldedElement('lens', 'lens-r', 320, 310), angleDeg: 90 },
    { ...foldedElement('detector', 'detector-r', 320, 410), angleDeg: 90 },
  ] };
  const focus: FoldedScene = { ...blankFoldedScene(), name: '先聚焦再折转', elements: [
    foldedElement('lens', 'lens-1', 250, 150),
    foldedElement('mirror', 'mirror-1', 300, 150),
    { ...foldedElement('detector', 'detector-1', 300, 200), angleDeg: 90 },
  ] };
  const objective: FoldedScene = { ...blankFoldedScene(), name: '10× 物镜与筒镜成像',
    source: { ...blank.source, diameter: .1, fullAngle: 40, model: 'extended' },
    elements: [foldedElement('objective', 'objective-1', 78, 150),
      { ...foldedElement('lens', 'tube-lens', 320, 150), name: '理想筒镜 f180', focal: 180 },
      foldedElement('detector', 'image-1', 500, 150)],
  };
  return { mirror, split, focus, objective, blank };
}

function record(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} 必须是对象`);
  return input as Record<string, unknown>;
}
function number(input: unknown, label: string, min: number, max: number, fallback?: number): number {
  const value = input === undefined && fallback !== undefined ? fallback : input;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} 必须在 ${min} 至 ${max} 之间`);
  return value;
}
function name(input: unknown, label: string, fallback: string): string {
  if (input === undefined) return fallback;
  if (typeof input !== 'string' || !input.trim() || input.length > 120) throw new Error(`${label} 必须是 1–120 字符文本`);
  return input.trim();
}
/** Strict canonical import: unknown keys are discarded; invalid data is never clamped. */
export function parseFoldedScene(input: unknown): FoldedScene {
  const raw = record(input, '工程');
  if (raw.version !== 1) throw new Error('折转工程版本必须为 1');
  const b = record(raw.bounds, '画布边界');
  const bounds = {
    minX: number(b.minX, '最小 X', -10000, 10000), maxX: number(b.maxX, '最大 X', -10000, 10000),
    minY: number(b.minY, '最小 Y', -10000, 10000), maxY: number(b.maxY, '最大 Y', -10000, 10000),
  };
  if (bounds.maxX - bounds.minX < 1 || bounds.maxX - bounds.minX > 10000 || bounds.maxY - bounds.minY < 1 || bounds.maxY - bounds.minY > 10000) throw new Error('画布宽高必须在 1 至 10000 mm 之间');
  const s = record(raw.source, '光源');
  const source: FoldedSource = {
    x: number(s.x, '光源 X', bounds.minX, bounds.maxX), y: number(s.y, '光源 Y', bounds.minY, bounds.maxY),
    directionDeg: number(s.directionDeg, '光源方向', -3600, 3600),
    diameter: number(s.diameter, '光源孔径', .01, 100), fullAngle: number(s.fullAngle, '全发散角', 0, 200),
    rayCount: number(s.rayCount, '采样数', 3, 101, 25), intensity: number(s.intensity, '输入相对功率', 0, 1e6, 1),
    wavelength: number(s.wavelength, '波长', 200, 20000, 532), model: s.model === undefined || s.model === 'fan' ? 'fan' : 'extended',
  };
  if (s.model !== undefined && s.model !== 'fan' && s.model !== 'extended') throw new Error('光源模型必须是 fan 或 extended');
  if (!Number.isInteger(source.rayCount)) throw new Error('采样数必须是整数');
  if (!Array.isArray(raw.elements) || raw.elements.length > 48) throw new Error('元件表必须是数组，最多 48 个元件');
  const ids = new Set<string>();
  const elements: FoldedElement[] = raw.elements.map((value, index) => {
    const e = record(value, `元件 ${index + 1}`);
    if (typeof e.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(e.id) || ids.has(e.id)) throw new Error('元件 ID 必须唯一，且仅含字母、数字、横线、下划线');
    ids.add(e.id);
    if (!kinds.includes(e.kind as FoldedKind)) throw new Error(`元件 ${index + 1} 类型无效`);
    const kind = e.kind as FoldedKind;
    const defaults = foldedElement(kind, e.id);
    const diameter = number(e.diameter, '元件物理直径', .01, 500);
    const focal = number(e.focal, '焦距', -10000, 10000, defaults.focal);
    if ((kind === 'lens' || kind === 'objective') && (Math.abs(focal) < 1 || kind === 'objective' && focal < 0)) throw new Error('透镜 |f| ≥ 1 mm；物镜焦距须为正。');
    const objective = kind === 'objective' ? parseObjectiveModel(e.objective) : undefined;
    const reflectance = number(e.reflectance, '反射率', 0, 1, defaults.reflectance);
    const transmittance = number(e.transmittance, '透射率', 0, 1, defaults.transmittance);
    if (kind === 'beamsplitter' && reflectance + transmittance > 1 + 1e-12) throw new Error('分光镜反射率与透射率之和不能大于 1');
    return {
      id: e.id, kind, name: name(e.name, '元件名称', defaults.name),
      x: number(e.x, '元件 X', bounds.minX, bounds.maxX), y: number(e.y, '元件 Y', bounds.minY, bounds.maxY),
      angleDeg: number(e.angleDeg, '法线角度', -3600, 3600), diameter,
      aperture: number(e.aperture, '有效孔径', .001, diameter), focal, reflectance, transmittance,
      ...(objective ? { objective } : {}),
    };
  });
  return { version: 1, name: name(raw.name, '工程名称', '自由空间光路'), bounds, source, elements };
}

type LiveRay = { p: FoldedPoint; d: FoldedPoint; power: number; rootId: string; branchId: string; events: number };
type Intersection = { element: FoldedElement; distance: number; point: FoldedPoint; coordinate: number; n: FoldedPoint; t: FoldedPoint; coincident: boolean };
function outside(p: FoldedPoint, b: FoldedScene['bounds']) {
  return p.x < b.minX - EPS || p.x > b.maxX + EPS || p.y < b.minY - EPS || p.y > b.maxY + EPS;
}
function boundaryDistance(p: FoldedPoint, d: FoldedPoint, b: FoldedScene['bounds']) {
  if (outside(p, b)) return 0;
  const tx = d.x > EPS ? (b.maxX - p.x) / d.x : d.x < -EPS ? (b.minX - p.x) / d.x : Infinity;
  const ty = d.y > EPS ? (b.maxY - p.y) / d.y : d.y < -EPS ? (b.minY - p.y) / d.y : Infinity;
  return Math.max(0, Math.min(tx, ty));
}
function intersection(ray: LiveRay, elements: FoldedElement[], maxDistance: number): Intersection | null {
  let hit: Intersection | null = null;
  for (const element of elements) {
    const n = direction(element.angleDeg), t = tangent(n), denominator = dot(ray.d, n);
    if (Math.abs(denominator) < EPS) continue;
    const distance = dot(sub(element, ray.p), n) / denominator;
    if (distance < EPS || distance > maxDistance + EPS) continue;
    const point = add(ray.p, scale(ray.d, distance));
    const coordinate = dot(sub(point, element), t);
    if (Math.abs(coordinate) > element.diameter / 2 + EPS) continue;
    if (!hit || distance < hit.distance - EPS) hit = { element, distance, point, coordinate, n, t, coincident: false };
    else if (Math.abs(distance - hit.distance) <= EPS) {
      if (element.id.localeCompare(hit.element.id) < 0) hit = { element, distance, point, coordinate, n, t, coincident: true };
      else hit.coincident = true;
    }
  }
  return hit;
}
function sourceRays(source: FoldedSource): LiveRay[] {
  const d = direction(source.directionDeg), t = tangent(d), rays: LiveRay[] = [];
  const count = source.model === 'extended' ? Math.max(2, Math.ceil(Math.sqrt(source.rayCount))) : source.rayCount;
  for (let i = 0; i < count; i++) {
    const h = 2 * i / (count - 1) - 1;
    const angles = source.model === 'extended' ? Array.from({ length: count }, (_, j) => 2 * j / (count - 1) - 1) : [h];
    for (const a of angles) {
      const id = `ray-${rays.length}`;
      rays.push({ p: add(source, scale(t, h * source.diameter / 2)), d: direction(source.directionDeg + a * source.fullAngle / 2000 / DEG), power: 0, rootId: id, branchId: id, events: 0 });
    }
  }
  for (const ray of rays) ray.power = source.intensity / rays.length;
  return rays;
}

/** Returns actual computed paths and conservative energy accounting. */
export function traceFoldedScene(input: FoldedScene, options: FoldedTraceOptions = {}): FoldedAnalysis {
  const scene = parseFoldedScene(input);
  const maxEvents = Math.round(number(options.maxEvents, '追迹事件上限', 1, 256, 64));
  const maxSegments = Math.round(number(options.maxSegments, '追迹线段上限', 1, 200000, 50000));
  const minPower = scene.source.intensity * number(options.minPowerFraction, '最小功率比例', 0, .1, 1e-8);
  const initial = scene.source.intensity > 0 ? sourceRays(scene.source) : [], queue = [...initial];
  const segments: FoldedSegment[] = [];
  const energy = { input: scene.source.intensity, captured: 0, escaped: 0, absorbed: 0, unresolved: 0, balanceError: 0 };
  const footprints: FoldedFootprint[] = scene.elements.map(e => ({ elementId: e.id, incomingPower: 0, transmittedPower: 0, reflectedPower: 0, capturedPower: 0, absorbedPower: 0, hits: 0, minCoordinate: null, maxCoordinate: null }));
  const footprintMap = new Map(footprints.map(f => [f.elementId, f]));
  const detectorHits = new Map<string, { coordinate: number; direction: number; power: number }[]>();
  for (const e of scene.elements.filter(e => e.kind === 'detector')) detectorHits.set(e.id, []);
  const warnings = new Set<string>();
  if (!scene.source.intensity) warnings.add('输入相对功率为 0，未生成光线，探测面指标为空。');
  for (let i = 0; i < scene.elements.length; i++) for (let j = i + 1; j < scene.elements.length; j++) {
    const a = scene.elements[i], b = scene.elements[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < EPS) warnings.add('存在中心重合的元件：零间隔交点无法确定物理先后，请分开放置。');
  }
  while (queue.length) {
    if (segments.length >= maxSegments) {
      energy.unresolved += queue.reduce((sum, r) => sum + r.power, 0);
      warnings.add('达到线段数量上限，剩余功率记为未完成追迹。');
      break;
    }
    const ray = queue.pop()!;
    if (ray.events >= maxEvents || ray.power < minPower) {
      energy.unresolved += ray.power;
      segments.push({ start: ray.p, end: ray.p, power: ray.power, rootId: ray.rootId, branchId: ray.branchId, event: 'limit' });
      warnings.add(ray.events >= maxEvents ? '达到反射 / 分光追迹次数上限，剩余功率记为未完成追迹。' : '低功率分支停止追迹，其功率仍计入未完成项。');
      continue;
    }
    const edge = boundaryDistance(ray.p, ray.d, scene.bounds);
    const hit = intersection(ray, scene.elements, edge);
    if (!hit || outside(ray.p, scene.bounds)) {
      energy.escaped += ray.power;
      segments.push({ start: ray.p, end: add(ray.p, scale(ray.d, edge)), power: ray.power, rootId: ray.rootId, branchId: ray.branchId, event: 'escape' });
      continue;
    }
    const { element: e, point, coordinate, n, t } = hit;
    if (hit.coincident) warnings.add('同一命中点存在多个交叉或重合元件，物理先后不确定；本次按 ID 选取首个元件，请分开放置后再设计。');
    const f = footprintMap.get(e.id)!;
    f.hits++; f.incomingPower += ray.power;
    f.minCoordinate = Math.min(f.minCoordinate ?? coordinate, coordinate);
    f.maxCoordinate = Math.max(f.maxCoordinate ?? coordinate, coordinate);
    const blocked = Math.abs(coordinate) > e.aperture / 2 + EPS;
    segments.push({ start: ray.p, end: point, power: ray.power, rootId: ray.rootId, branchId: ray.branchId, event: blocked ? 'blocked' : e.kind, elementId: e.id });
    const absorb = (power: number) => { energy.absorbed += power; f.absorbedPower += power; };
    const emit = (d: FoldedPoint, power: number, suffix = '') => {
      if (power > 0) queue.push({ p: point, d, power, rootId: ray.rootId, branchId: ray.branchId + suffix, events: ray.events + 1 });
    };
    if (blocked) { absorb(ray.power); continue; }
    if (e.kind === 'detector') {
      f.capturedPower += ray.power; energy.captured += ray.power;
      detectorHits.get(e.id)!.push({ coordinate, direction: Math.atan2(ray.d.y, ray.d.x), power: ray.power });
    } else if (e.kind === 'mirror' || e.kind === 'beamsplitter') {
      const reflected = Math.min(1, e.reflectance), transmitted = e.kind === 'beamsplitter' ? Math.min(1 - reflected, e.transmittance) : 0;
      const rp = ray.power * reflected, tp = ray.power * transmitted;
      f.reflectedPower += rp; f.transmittedPower += tp;
      absorb(Math.max(0, ray.power - rp - tp));
      emit(sub(ray.d, scale(n, 2 * dot(ray.d, n))), rp, '.R');
      emit(ray.d, tp, '.T');
    } else if (e.kind === 'iris') {
      f.transmittedPower += ray.power; emit(ray.d, ray.power);
    } else {
      const travelNormal = scale(n, dot(ray.d, n) >= 0 ? 1 : -1);
      const slope = dot(ray.d, t) / dot(ray.d, travelNormal), outputSlope = slope - coordinate / e.focal;
      if (Math.abs(slope) > .1 || Math.abs(outputSlope) > .1 || Math.abs(coordinate / e.focal) > .1) warnings.add(`${e.name} 的局部光线超出约 0.1 rad 近轴范围，薄透镜结果仅供定性参考。`);
      f.transmittedPower += ray.power; emit(unit(add(travelNormal, scale(t, outputSlope))), ray.power);
    }
  }
  const detectors: FoldedDetector[] = [...detectorHits].map(([elementId, hits]) => {
    const power = hits.reduce((sum, h) => sum + h.power, 0);
    if (!power) return { elementId, power: 0, rayCount: 0, centroid: null, rms: null, span: null, angleRms: null };
    const centroid = hits.reduce((sum, h) => sum + h.coordinate * h.power, 0) / power;
    const rms = Math.sqrt(hits.reduce((sum, h) => sum + (h.coordinate - centroid) ** 2 * h.power, 0) / power);
    const angle = Math.atan2(hits.reduce((sum, h) => sum + Math.sin(h.direction) * h.power, 0), hits.reduce((sum, h) => sum + Math.cos(h.direction) * h.power, 0));
    const angleRms = 1000 * Math.sqrt(hits.reduce((sum, h) => sum + wrapAngle(h.direction - angle) ** 2 * h.power, 0) / power);
    const coordinates = hits.map(h => h.coordinate);
    return { elementId, power, rayCount: hits.length, centroid, rms, span: Math.max(...coordinates) - Math.min(...coordinates), angleRms };
  });
  energy.balanceError = energy.input - energy.captured - energy.escaped - energy.absorbed - energy.unresolved;
  if (energy.escaped > scene.source.intensity * 1e-6) warnings.add('有光线离开画布；有限物理元件之外的光线会绕过元件，离开画布不等于被吸收。');
  if (energy.absorbed > scene.source.intensity * 1e-6) warnings.add('孔径遮挡或设定的 R + T 损耗吸收了部分采样功率。');
  for (const e of scene.elements) if (e.objective) for (const warning of objectiveWarnings(e.objective, scene.source.wavelength)) warnings.add(warning);
  return { segments, detectors, footprints, energy, sourceRayCount: initial.length, warnings: [...warnings] };
}
