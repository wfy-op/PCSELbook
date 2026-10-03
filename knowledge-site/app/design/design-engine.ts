/**
 * Sequential first-order design in air. Lengths are mm, ray slopes are radians;
 * source/UI angles are mrad, wavelength is nm. Lens z is its ideal principal
 * plane, never a manufacturer's front surface. No aberration, glass dispersion,
 * coating efficiency, aperture diffraction, polarization or power calculation.
 *
 * Gaussian convention: q=(z-z_waist)+i*z_R, 1/q=1/R-i*lambda_eff/(pi*w^2),
 * q'=(Aq+B)/(Cq+D). w is the intensity 1/e² radius. For M²>1 lambda_eff=M²*lambda
 * is an envelope approximation, not a computed transverse field or mode profile.
 * Sources checked 2026-10-02:
 * https://www.edmundoptics.com/knowledge-center/application-notes/lasers/gaussian-beam-propagation/
 * https://www.rp-photonics.com/abcd_matrix.html
 * https://www.rp-photonics.com/m2_factor.html
 */

export type DesignSource = {
  mode: 'geometric' | 'gaussian'; model: 'fan' | 'extended';
  diameter: number; fullAngle: number; offset: number; tilt: number;
  wavelength: number; w0: number; waistZ: number; m2: number;
};
export type DesignElement = {
  id: string; kind: 'lens' | 'iris'; name: string; sku?: string;
  z: number; y: number; focal: number; diameter: number; aperture: number;
  apertureBasis?: 'assumed-90-percent' | 'custom';
};
export type DesignCatalogPart = {
  sku: string; focal: number; diameter: number; aperture: number;
  title?: string; kind?: string; coating?: string; source?: string;
};
export type DesignProject = { version: 2; name: string; source: DesignSource; screen: number; screenAperture: number; elements: DesignElement[] };
export type AffineMatrix = { A: number; B: number; C: number; D: number; E: number; F: number };
export type DesignPoint = { z: number; y: number };
export type DesignRay = { points: DesignPoint[]; initial: { y: number; angle: number }; angle: number; blocked?: string };
export type DesignFootprint = {
  elementId: string; z: number; minY: number | null; maxY: number | null; span: number | null;
  apertureMargin: number | null; incomingCount: number; passedCount: number; blockedCount: number;
};
export type GaussianSample = { z: number; center: number; w: number; diameter: number };
export type GaussianElement = GaussianSample & {
  elementId: string; curvature: number | null; apertureMargin: number; clearanceMargin: number;
};
export type GaussianAnalysis = {
  samples: GaussianSample[]; elements: GaussianElement[];
  screen: GaussianSample & { curvature: number | null; apertureMargin: number | null; clearanceMargin: number | null };
  waist: { z: number; w0: number; diameter: number; rayleigh: number; fullAngle: number; afterLastLens: boolean; afterLastElement: boolean };
  sourceDiameter: number; sourceFullAngle: number; effectiveWavelength: number; valid: boolean;
};
export type DesignAnalysis = {
  rays: DesignRay[]; passed: number; total: number; span: number | null; angleSpan: number | null;
  rms: number | null; centroid: number | null; angleRms: number | null; maxSlope: number;
  footprints: DesignFootprint[]; matrix: AffineMatrix;
  cardinal: { matrix: AffineMatrix; firstZ: number; lastZ: number; efl: number | null; bfl: number | null; backFocusZ: number | null; afocal: boolean };
  bestFocus: { z: number; distance: number; rms: number; span: number; centroid: number; afterLastElement: boolean } | null;
  gaussian: GaussianAnalysis | null; warnings: string[];
};
export type PositionTarget = { kind: 'focus' | 'diameter' | 'collimation'; value?: number };
export type OptimizeOptions = {
  target: PositionTarget; selectedIds?: string[]; minGap?: number; minZ?: number; maxZ?: number;
  maxIterations?: number; gaussianClearanceFactor?: number;
  maxOutputAngle?: number;
};
export type OptimizeResult = {
  project: DesignProject; before: number; after: number; improved: boolean;
  evaluations: number; iterations: number; feasible: boolean; reason: string;
};

const EPS = 1e-10;
const identity = (): AffineMatrix => ({ A: 1, B: 0, C: 0, D: 1, E: 0, F: 0 });
const translation = (d: number): AffineMatrix => ({ A: 1, B: d, C: 0, D: 1, E: 0, F: 0 });
const lensMatrix = (e: DesignElement): AffineMatrix => ({ A: 1, B: 0, C: -1 / e.focal, D: 1, E: 0, F: e.y / e.focal });
/** left is applied after right, including affine offsets. */
export function multiplyMatrices(left: AffineMatrix, right: AffineMatrix): AffineMatrix {
  return {
    A: left.A * right.A + left.B * right.C, B: left.A * right.B + left.B * right.D,
    C: left.C * right.A + left.D * right.C, D: left.C * right.B + left.D * right.D,
    E: left.A * right.E + left.B * right.F + left.E,
    F: left.C * right.E + left.D * right.F + left.F,
  };
}
export const blankProject = (): DesignProject => ({
  version: 2, name: '未命名光路', screen: 600, screenAperture: 0, elements: [],
  source: { mode: 'geometric', model: 'fan', diameter: 4, fullAngle: 0, offset: 0, tilt: 0, wavelength: 532, w0: 1, waistZ: 0, m2: 1 },
});
export const customDesignLens = (id: string, z = 150): DesignElement => ({
  id, kind: 'lens', name: '自定义正透镜', z, y: 0, focal: 50, diameter: 25.4, aperture: 22.86, apertureBasis: 'custom',
});
export const catalogDesignLens = (part: DesignCatalogPart, id: string, z = 150): DesignElement => ({
  ...customDesignLens(id, z), name: part.sku, sku: part.sku, focal: part.focal,
  diameter: part.diameter, aperture: part.aperture, apertureBasis: 'assumed-90-percent',
});
const sortedElements = (p: DesignProject) => [...p.elements].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
const spread = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : null;
const variance = (values: number[], average = mean(values)) => mean(values.map(n => (n - average) ** 2));

type Complex = { re: number; im: number };
const wavelengthMm = (s: DesignSource) => s.wavelength * 1e-6 * s.m2;
const sourceQ = (s: DesignSource): Complex => ({ re: -s.waistZ, im: Math.PI * s.w0 ** 2 / wavelengthMm(s) });
function transformQ(q: Complex, m: AffineMatrix): Complex {
  const nr = m.A * q.re + m.B;
  const ni = m.A * q.im;
  const dr = m.C * q.re + m.D;
  const di = m.C * q.im;
  const den = dr * dr + di * di;
  return { re: (nr * dr + ni * di) / den, im: q.im * (m.A * m.D - m.B * m.C) / den };
}
function qWidth(q: Complex, lambda: number): number {
  return Math.sqrt(lambda * (q.re * q.re + q.im * q.im) / (Math.PI * q.im));
}
function curvature(q: Complex): number | null {
  return Math.abs(q.re) < EPS ? null : (q.re * q.re + q.im * q.im) / q.re;
}

function initialRays(source: DesignSource): { y: number; angle: number }[] {
  const rays: { y: number; angle: number }[] = [];
  const q = sourceQ(source);
  // In Gaussian mode these are wavefront-normal reference rays, not a sampled
  // Gaussian intensity or diffraction model. The q envelope is authoritative.
  const radius = source.mode === 'gaussian' ? qWidth(q, wavelengthMm(source)) : source.diameter / 2;
  const halfAngle = source.fullAngle / 2000;
  const count = source.mode === 'geometric' && source.model === 'extended' ? 9 : 25;
  for (let i = 0; i < count; i++) {
    const h = 2 * i / (count - 1) - 1;
    const offset = h * radius;
    const angles = source.mode === 'gaussian'
      ? [offset * q.re / (q.re * q.re + q.im * q.im)]
      : source.model === 'extended'
        ? Array.from({ length: 9 }, (_, j) => (j / 4 - 1) * halfAngle)
        : [h * halfAngle];
    for (const slope of angles) rays.push({ y: source.offset + offset, angle: source.tilt / 1000 + slope });
  }
  return rays;
}

function traceRays(project: DesignProject, elements: DesignElement[]) {
  const footprints: DesignFootprint[] = elements.map(e => ({
    elementId: e.id, z: e.z, minY: null, maxY: null, span: null, apertureMargin: null,
    incomingCount: 0, passedCount: 0, blockedCount: 0,
  }));
  const rays: DesignRay[] = [];
  let maxSlope = 0;
  const afterLast: { y: number; angle: number }[] = [];
  const lastZ = elements.at(-1)?.z ?? 0;
  for (const initial of initialRays(project.source)) {
    let { y, angle } = initial;
    let z = 0;
    maxSlope = Math.max(maxSlope, Math.abs(angle));
    const ray: DesignRay = { points: [{ z, y }], initial, angle };
    for (const [i, e] of elements.entries()) {
      y += (e.z - z) * angle;
      z = e.z;
      ray.points.push({ z, y });
      const footprint = footprints[i];
      footprint.incomingCount++;
      footprint.minY = Math.min(footprint.minY ?? y, y);
      footprint.maxY = Math.max(footprint.maxY ?? y, y);
      footprint.span = footprint.maxY - footprint.minY;
      const margin = e.aperture / 2 - Math.abs(y - e.y);
      footprint.apertureMargin = Math.min(footprint.apertureMargin ?? margin, margin);
      if (margin < -EPS) {
        footprint.blockedCount++;
        ray.blocked = e.id;
        break;
      }
      footprint.passedCount++;
      if (e.kind === 'lens') angle -= (y - e.y) / e.focal;
      maxSlope = Math.max(maxSlope, Math.abs(angle));
    }
    ray.angle = angle;
    if (!ray.blocked) {
      afterLast.push({ y, angle });
      const targetY = y + (project.screen - z) * angle;
      ray.points.push({ z: project.screen, y: targetY });
      if (project.screenAperture > 0 && Math.abs(targetY) > project.screenAperture / 2 + EPS) ray.blocked = 'target';
    }
    rays.push(ray);
  }
  const passed = rays.filter(ray => !ray.blocked);
  const heights = passed.map(ray => ray.points.at(-1)!.y);
  const anglesMrad = passed.map(ray => ray.angle * 1000);
  let bestFocus: DesignAnalysis['bestFocus'] = null;
  if (afterLast.length >= 2) {
    const ym = mean(afterLast.map(r => r.y));
    const am = mean(afterLast.map(r => r.angle));
    const va = mean(afterLast.map(r => (r.angle - am) ** 2));
    if (va > 1e-24) {
      const cov = mean(afterLast.map(r => (r.y - ym) * (r.angle - am)));
      const distance = -cov / va;
      const focused = afterLast.map(r => r.y + distance * r.angle);
      const centroid = mean(focused);
      bestFocus = { z: lastZ + distance, distance, rms: Math.sqrt(variance(focused, centroid)), span: spread(focused)!, centroid, afterLastElement: distance >= -EPS };
    }
  }
  return {
    rays, passed: passed.length, total: rays.length, span: spread(heights), angleSpan: spread(anglesMrad),
    rms: heights.length ? Math.sqrt(variance(heights)) : null,
    centroid: heights.length ? mean(heights) : null,
    angleRms: anglesMrad.length ? Math.sqrt(variance(anglesMrad)) : null,
    maxSlope, footprints, bestFocus,
  };
}

function matrixBetween(elements: DesignElement[], start: number, end: number): AffineMatrix {
  let matrix = identity();
  let z = start;
  for (const e of elements) {
    matrix = multiplyMatrices(translation(e.z - z), matrix);
    if (e.kind === 'lens') matrix = multiplyMatrices(lensMatrix(e), matrix);
    z = e.z;
  }
  return multiplyMatrices(translation(end - z), matrix);
}

function gaussianAnalysis(project: DesignProject, elements: DesignElement[]): GaussianAnalysis {
  const lambda = wavelengthMm(project.source);
  let q = sourceQ(project.source);
  let center = project.source.offset;
  let angle = project.source.tilt / 1000;
  let z = 0;
  const samples: GaussianSample[] = [{ z, center, w: qWidth(q, lambda), diameter: 2 * qWidth(q, lambda) }];
  const planes: GaussianElement[] = [];
  const sampleGap = (end: number) => {
    const distance = end - z;
    const count = Math.max(1, Math.ceil(distance / Math.max(1, project.screen / 180)));
    for (let i = 1; i <= count; i++) {
      const d = distance * i / count;
      const w = qWidth({ re: q.re + d, im: q.im }, lambda);
      samples.push({ z: z + d, center: center + d * angle, w, diameter: 2 * w });
    }
    q = { re: q.re + distance, im: q.im };
    center += distance * angle;
    z = end;
  };
  for (const e of elements) {
    sampleGap(e.z);
    const w = qWidth(q, lambda);
    const centerDistance = Math.abs(center - e.y);
    planes.push({ elementId: e.id, z, center, w, diameter: 2 * w, curvature: curvature(q),
      apertureMargin: e.aperture / 2 - centerDistance - w,
      clearanceMargin: e.aperture / 2 - centerDistance - 2 * w });
    if (e.kind === 'lens') {
      q = transformQ(q, lensMatrix(e));
      angle -= (center - e.y) / e.focal;
    }
  }
  // The final-segment waist can lie outside the shown bench. It is never used
  // to invent a waist inside an earlier segment containing another lens.
  const lastElementZ = z;
  const waistZ = z - q.re;
  const waistW0 = Math.sqrt(lambda * q.im / Math.PI);
  const lastLensZ = elements.filter(e => e.kind === 'lens').at(-1)?.z ?? 0;
  const waist = { z: waistZ, w0: waistW0, diameter: 2 * waistW0, rayleigh: q.im,
    fullAngle: 2000 * lambda / (Math.PI * waistW0),
    afterLastLens: waistZ >= lastLensZ - EPS, afterLastElement: waistZ >= lastElementZ - EPS };
  sampleGap(project.screen);
  const w = qWidth(q, lambda);
  const apertureMargin = project.screenAperture > 0 ? project.screenAperture / 2 - Math.abs(center) - w : null;
  const clearanceMargin = project.screenAperture > 0 ? project.screenAperture / 2 - Math.abs(center) - 2 * w : null;
  return {
    samples, elements: planes, screen: { z, center, w, diameter: 2 * w, curvature: curvature(q), apertureMargin, clearanceMargin }, waist,
    sourceDiameter: samples[0].diameter, sourceFullAngle: 2000 * lambda / (Math.PI * project.source.w0),
    effectiveWavelength: lambda,
    valid: planes.every(e => e.apertureMargin >= 0) && (apertureMargin === null || apertureMargin >= 0),
  };
}

export function analyzeDesign(project: DesignProject): DesignAnalysis {
  const elements = sortedElements(project);
  const trace = traceRays(project, elements);
  const matrix = matrixBetween(elements, 0, project.screen);
  const lenses = elements.filter(e => e.kind === 'lens');
  const firstZ = lenses[0]?.z ?? 0;
  const lastZ = lenses.at(-1)?.z ?? 0;
  const systemMatrix = matrixBetween(lenses, firstZ, lastZ);
  const afocal = Math.abs(systemMatrix.C) < 1e-12;
  const efl = afocal ? null : -1 / systemMatrix.C;
  const bfl = afocal ? null : -systemMatrix.A / systemMatrix.C;
  const gaussian = project.source.mode === 'gaussian' ? gaussianAnalysis(project, elements) : null;
  const warnings: string[] = [];
  if (trace.maxSlope > .1) warnings.push('光线斜率超过 0.1 rad，近轴结果仅作粗略参考。');
  if (elements.some((e, i) => i > 0 && e.z - elements[i - 1].z < 1)) warnings.push('元件主平面间距小于 1 mm；本模型不验证镜片厚度及机械干涉。');
  if (trace.passed !== trace.total && !gaussian) warnings.push('部分几何采样光线被孔径截断；采样通过数不代表功率透过率。');
  if (project.source.mode === 'geometric' && trace.span !== null && trace.span < 1e-8) warnings.push('几何范围接近零，不是可实现的衍射光斑尺寸；可切换高斯模型。');
  if (gaussian) {
    if (!gaussian.valid) warnings.push('1/e² 包络触及孔径，高斯输出仅为未截光的理想外推；未计算截光后的衍射。');
    else if (gaussian.elements.some(e => e.clearanceMargin < 0) || (gaussian.screen.clearanceMargin !== null && gaussian.screen.clearanceMargin < 0)) warnings.push('孔径未留足 2w 半径余量，仍可能截断高斯尾部；未计算截光功率。');
    if (project.source.m2 > 1) warnings.push('M² 使用有效波长近似传播包络，未计算真实横向模式。');
    if (gaussian.waist.fullAngle / 2000 > .1) warnings.push('高斯远场半角超过 0.1 rad，近轴包络可能失准。');
    if (!gaussian.waist.afterLastElement) warnings.push('最终传播段的外推束腰位于最后元件上游；它不代表该处真实的历史束腰。');
  }
  return { ...trace, matrix, cardinal: { matrix: systemMatrix, firstZ, lastZ, efl, bfl, backFocusZ: bfl === null ? null : lastZ + bfl, afocal }, gaussian, warnings };
}

/** Validate and reconstruct; ignore unrecognized fields/URLs and never trust a
 * file's manufacturer claim. A SKU survives only when the supplied authoritative
 * catalog matches its nominal focal length AND outer diameter. */
export function parseDesignProject(input: unknown, catalog: readonly DesignCatalogPart[] = []): DesignProject {
  const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!object(input)) throw new Error('需要光路项目 JSON 对象。');
  let raw = input;
  if (raw.version === 1) {
    raw = { version: 2, name: '导入的自由搭建光路', screen: raw.screen, screenAperture: 0, elements: raw.elements,
      source: { ...blankProject().source, diameter: raw.diameter, fullAngle: raw.fullAngle, model: raw.sourceModel } };
  }
  if (raw.version !== 2 || !finite(raw.screen, 10, 5000) || typeof raw.name !== 'string' || raw.name.length > 120 || !object(raw.source) || !Array.isArray(raw.elements) || raw.elements.length > 24) throw new Error('项目版本、目标面或元件数无效（最多 24 个元件）。');
  const s = raw.source;
  if (!['geometric', 'gaussian'].includes(String(s.mode)) || !['fan', 'extended'].includes(String(s.model)) || !finite(s.diameter, .01, 100) || !finite(s.fullAngle, 0, 200) || !finite(s.offset, -100, 100) || !finite(s.tilt, -100, 100) || !finite(s.wavelength, 200, 20000) || !finite(s.w0, .001, 50) || !finite(s.waistZ, -10000, 10000) || !finite(s.m2, 1, 20)) throw new Error('光源参数无效：检查口径、全角、波长、束腰和 M²。');
  const screen = raw.screen;
  const screenAperture = raw.screenAperture ?? 0;
  if (!finite(screenAperture, 0, 100)) throw new Error('目标面孔径无效（0 表示不限制，最大 100 mm）。');
  const ids = new Set<string>();
  const elements: DesignElement[] = raw.elements.map(e => {
    if (!object(e) || !['lens', 'iris'].includes(String(e.kind)) || typeof e.id !== 'string' || !e.id.trim() || e.id.length > 80 || ids.has(e.id) || typeof e.name !== 'string' || e.name.length > 120 || !finite(e.z, .1, screen - .1) || !finite(e.y, -100, 100) || !finite(e.focal, -5000, 5000) || Math.abs(e.focal) < 5 || !finite(e.diameter, .1, 100) || !finite(e.aperture, .01, e.diameter)) throw new Error('元件 ID、位置、孔径或焦距无效（|f| 至少 5 mm）。');
    ids.add(e.id);
    const part = e.kind === 'lens' && typeof e.sku === 'string' ? catalog.find(p => p.sku === e.sku && Math.abs(p.focal - Number(e.focal)) < 1e-8 && Math.abs(p.diameter - Number(e.diameter)) < 1e-8) : undefined;
    return { id: e.id, kind: e.kind as DesignElement['kind'], name: e.name, z: e.z, y: e.y, focal: e.focal, diameter: e.diameter, aperture: e.aperture,
      ...(part ? { sku: part.sku } : {}), apertureBasis: part && Math.abs(part.aperture - e.aperture) < 1e-8 ? 'assumed-90-percent' : 'custom' };
  });
  return { version: 2, name: raw.name, screen, screenAperture, elements,
    source: { mode: s.mode as DesignSource['mode'], model: s.model as DesignSource['model'], diameter: s.diameter, fullAngle: s.fullAngle, offset: s.offset, tilt: s.tilt, wavelength: s.wavelength, w0: s.w0, waistZ: s.waistZ, m2: s.m2 } };
}

function targetScore(result: DesignAnalysis, target: PositionTarget): number {
  if (target.kind === 'focus') return result.gaussian?.screen.diameter ?? result.rms ?? Infinity;
  if (target.kind === 'collimation') return result.gaussian?.waist.fullAngle ?? result.angleRms ?? Infinity;
  const diameter = result.gaussian?.screen.diameter ?? result.span;
  return diameter === null ? Infinity : Math.abs(diameter - target.value!) / target.value!;
}

/** Deterministic bounded coordinate search. Varies selected z positions only,
 * preserves original sequential order, source, lens specs and screen. Reports
 * improvement over the starting design, never a global-optimum guarantee. */
export function optimizePositions(input: DesignProject, options: OptimizeOptions): OptimizeResult {
  const project: DesignProject = { ...input, source: { ...input.source }, elements: input.elements.map(e => ({ ...e })) };
  const order = sortedElements(project).map(e => e.id);
  const selected = options.selectedIds ?? project.elements.filter(e => e.kind === 'lens').map(e => e.id);
  const ids = order.filter(id => selected.includes(id));
  const finiteOr = (value: number | undefined, fallback: number, min: number, max: number) => value === undefined ? fallback : Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const minGap = finiteOr(options.minGap, 5, .1, 500);
  const minZ = finiteOr(options.minZ, 5, .1, project.screen - .1);
  const maxZ = finiteOr(options.maxZ, project.screen - 5, .1, project.screen - .1);
  const maxIterations = Math.round(finiteOr(options.maxIterations, 45, 1, 80));
  const factor = finiteOr(options.gaussianClearanceFactor, 2, 1, 4);
  const maxOutputAngle = options.maxOutputAngle;
  if (maxOutputAngle !== undefined && (!Number.isFinite(maxOutputAngle) || maxOutputAngle <= 0)) throw new Error('输出角度上限必须大于零。');
  const initialResult = analyzeDesign(project);
  const before = targetScore(initialResult, options.target);
  if (!['focus', 'diameter', 'collimation'].includes(options.target.kind) || (options.target.kind === 'diameter' && (!Number.isFinite(options.target.value) || options.target.value! <= 0))) throw new Error('优化目标无效；目标直径必须大于零。');
  if (!ids.length || minZ >= maxZ) return { project, before, after: before, improved: false, evaluations: 0, iterations: 0, feasible: false, reason: '未选择可移动元件，或位置边界无效。' };
  let evaluations = 0;
  const getElement = (id: string) => project.elements.find(e => e.id === id)!;
  const ordered = () => order.map(getElement);
  const positionValid = () => ordered().every((e, i, es) => (!ids.includes(e.id) || (e.z >= minZ - EPS && e.z <= maxZ + EPS)) && (i === 0 || e.z - es[i - 1].z >= minGap - EPS));
  const evaluate = () => {
    if (!positionValid()) return { cost: Infinity, score: Infinity, feasible: false };
    evaluations++;
    const result = analyzeDesign(project);
    const score = targetScore(result, options.target);
    let violation: number;
    if (result.gaussian) {
      violation = result.gaussian.elements.reduce((sum, e) => {
        const element = getElement(e.elementId);
        const margin = element.aperture / 2 - Math.abs(e.center - element.y) - factor * e.w;
        return sum + Math.max(0, -margin) / Math.max(.01, element.aperture / 2);
      }, 0);
      if (project.screenAperture > 0) violation += Math.max(0, -(project.screenAperture / 2 - Math.abs(result.gaussian.screen.center) - factor * result.gaussian.screen.w)) / (project.screenAperture / 2);
    } else violation = (result.total - result.passed) / result.total;
    const outputAngle = result.gaussian?.waist.fullAngle ?? result.angleSpan ?? Infinity;
    if (maxOutputAngle !== undefined) violation += Math.max(0, outputAngle / maxOutputAngle - 1);
    const feasible = violation < 1e-12 && Number.isFinite(score);
    return { cost: Number.isFinite(score) ? score + (feasible ? 0 : 1e6 * (1 + violation)) : Infinity, score, feasible };
  };
  let current = evaluate();
  let best = current.feasible ? { score: current.score, elements: project.elements.map(e => ({ ...e })) } : null;
  const remember = (candidate: ReturnType<typeof evaluate>) => {
    if (candidate.feasible && (!best || candidate.score < best.score)) best = { score: candidate.score, elements: project.elements.map(e => ({ ...e })) };
  };
  const bounds = (id: string) => {
    const index = order.indexOf(id);
    return { low: Math.max(minZ, index > 0 ? getElement(order[index - 1]).z + minGap : minZ),
      high: Math.min(maxZ, index < order.length - 1 ? getElement(order[index + 1]).z - minGap : maxZ) };
  };
  // A coarse one-dimensional scan before local refinement avoids relying on
  // the starting step alone; all candidates obey the same aperture constraints.
  for (const id of ids) {
    const e = getElement(id);
    const original = e.z;
    const { low, high } = bounds(id);
    let candidateZ = original;
    let candidateBest = current;
    if (low <= high) for (let i = 0; i <= 16; i++) {
      e.z = low + (high - low) * i / 16;
      const candidate = evaluate();
      remember(candidate);
      if (candidate.cost < candidateBest.cost) { candidateBest = candidate; candidateZ = e.z; }
    }
    e.z = candidateZ;
    current = candidateBest;
  }
  let step = (maxZ - minZ) / 8;
  let iterations = 0;
  for (; iterations < maxIterations && step > 1e-5; iterations++) {
    let changed = false;
    for (const id of ids) {
      const e = getElement(id);
      const original = e.z;
      const { low, high } = bounds(id);
      let candidateZ = original;
      let candidateBest = current;
      for (const candidatePosition of [original - step, original + step]) {
        if (candidatePosition < low || candidatePosition > high) continue;
        e.z = candidatePosition;
        const candidate = evaluate();
        remember(candidate);
        if (candidate.cost < candidateBest.cost - 1e-14) { candidateBest = candidate; candidateZ = e.z; }
      }
      e.z = candidateZ;
      if (e.z !== original) changed = true;
      current = candidateBest;
    }
    if (!changed) step *= .5;
  }
  const bestFound = best as { score: number; elements: DesignElement[] } | null;
  if (!bestFound) return { project: { ...input, source: { ...input.source }, elements: input.elements.map(e => ({ ...e })) }, before, after: before, improved: false, evaluations, iterations, feasible: false, reason: '在当前位置范围和孔径约束下未找到可行解；原设计已保留。' };
  const improved = !Number.isFinite(before) || bestFound.score < before - Math.max(1e-9, Math.abs(before) * 1e-7);
  // An initially clipped design may have a deceptively small spot. Retain a
  // feasible candidate even when its honest spot is larger; report that fact.
  const initialAngle = initialResult.gaussian?.waist.fullAngle ?? initialResult.angleSpan ?? Infinity;
  const initialBounds = input.elements.every(e => !ids.includes(e.id) || (e.z >= minZ - EPS && e.z <= maxZ + EPS));
  const initiallyFeasible = initialBounds && (maxOutputAngle === undefined || initialAngle <= maxOutputAngle) && (initialResult.gaussian
    ? initialResult.gaussian.elements.every(e => { const el = input.elements.find(p => p.id === e.elementId)!; return el.aperture / 2 - Math.abs(e.center - el.y) - factor * e.w >= -EPS; }) && (input.screenAperture <= 0 || input.screenAperture / 2 - Math.abs(initialResult.gaussian.screen.center) - factor * initialResult.gaussian.screen.w >= -EPS) && positionValidForInput(input, order, minGap)
    : initialResult.passed === initialResult.total && positionValidForInput(input, order, minGap));
  return { project: { ...project, elements: bestFound.elements }, before, after: bestFound.score, improved,
    evaluations, iterations, feasible: true,
    reason: !initiallyFeasible ? '找到满足孔径及间距约束的候选；起始截光设计的光斑不能直接用于公平比较。'
      : improved ? '已得到较好的局部候选；仅调整所选元件位置，源参数和器件规格保持固定。'
        : '当前边界内未找到更好的可行位置；返回原可行设计。' };
}

function positionValidForInput(input: DesignProject, order: string[], minGap: number) {
  return order.every((id, i) => i === 0 || input.elements.find(e => e.id === id)!.z - input.elements.find(e => e.id === order[i - 1])!.z >= minGap - EPS);
}
