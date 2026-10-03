/** Air, paraxial thin lenses. All lengths mm; slopes are radians. No power model. */
export type BenchElement = { id: string; kind: 'lens' | 'iris'; name: string; sku?: string; z: number; y: number; focal: number; diameter: number; aperture: number };
export type BenchScene = { version: 1; diameter: number; fullAngle: number; sourceModel: 'fan' | 'extended'; screen: number; elements: BenchElement[] };
export type BenchRay = { points: { z: number; y: number }[]; angle: number; blocked?: string };
export const blankScene = (): BenchScene => ({ version: 1, diameter: 4, fullAngle: 0, sourceModel: 'fan', screen: 600, elements: [] });
export const customLens = (id: string, z = 150): BenchElement => ({ id, kind: 'lens', name: '自定义正透镜', z, y: 0, focal: 50, diameter: 25.4, aperture: 22.86 });

export function traceBench(scene: BenchScene) {
  const elements = [...scene.elements].sort((a, b) => a.z - b.z);
  const rays: BenchRay[] = [];
  const halfAngle = scene.fullAngle / 2000;
  // A fan correlates height with angle; an extended source samples both independently.
  const samples = scene.sourceModel === 'extended' ? 7 : 17;
  for (let i = 0; i < samples; i++) {
    const h = 2 * i / (samples - 1) - 1;
    const angles = scene.sourceModel === 'extended' ? Array.from({ length: 7 }, (_, j) => (j / 3 - 1) * halfAngle) : [h * halfAngle];
    for (const initialAngle of angles) {
      let y = h * scene.diameter / 2;
      let z = 0;
      let angle = initialAngle;
      const ray: BenchRay = { points: [{ z, y }], angle };
      for (const element of elements) {
        y += (element.z - z) * angle;
        z = element.z;
        ray.points.push({ z, y });
        if (Math.abs(y - element.y) > element.aperture / 2 + 1e-9) { ray.blocked = element.id; break; }
        if (element.kind === 'lens') angle -= (y - element.y) / element.focal;
      }
      ray.angle = angle;
      if (!ray.blocked) ray.points.push({ z: scene.screen, y: y + (scene.screen - z) * angle });
      rays.push(ray);
    }
  }
  const passed = rays.filter(ray => !ray.blocked);
  const heights = passed.map(ray => ray.points.at(-1)!.y);
  const spread = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : null;
  return { rays, passed: passed.length, total: rays.length, span: spread(heights), angleSpan: spread(passed.map(ray => ray.angle * 1000)),
    maxSlope: Math.max(...rays.flatMap(ray => [Math.abs(ray.angle), ...ray.points.slice(1).map((p, i) => p.z === ray.points[i].z ? 0 : Math.abs((p.y - ray.points[i].y) / (p.z - ray.points[i].z)))])),
    coincidences: elements.filter((e, i) => i > 0 && e.z - elements[i - 1].z < 1).length };
}

export function parseScene(input: unknown): BenchScene {
  const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!input || typeof input !== 'object') throw new Error('需要版本 1 的光路 JSON。');
  const s = input as BenchScene;
  if (s.version !== 1 || !finite(s.diameter, .1, 30) || !finite(s.fullAngle, 0, 100) || !finite(s.screen, 100, 1500) || !['fan', 'extended'].includes(s.sourceModel) || !Array.isArray(s.elements) || s.elements.length > 16) throw new Error('光源或目标面参数超出范围，或元件数超过 16。');
  const ids = new Set<string>();
  const elements = s.elements.map(e => {
    if (!e || !['lens', 'iris'].includes(e.kind) || typeof e.id !== 'string' || e.id.length > 80 || ids.has(e.id) || typeof e.name !== 'string' || e.name.length > 80 || !finite(e.z, 5, s.screen - 5) || !finite(e.y, -30, 30) || !finite(e.focal, -1000, 1000) || Math.abs(e.focal) < 5 || !finite(e.diameter, 1, 60) || !finite(e.aperture, .1, e.diameter)) throw new Error('元件位置、孔径或焦距无效（|f| 至少 5 mm），或 ID 重复。');
    ids.add(e.id);
    // Imported optical values are custom: a user file cannot certify manufacturer data.
    return { id: e.id, kind: e.kind, name: e.name, z: e.z, y: e.y, focal: e.focal, diameter: e.diameter, aperture: e.aperture };
  });
  return { version: 1, diameter: s.diameter, fullAngle: s.fullAngle, sourceModel: s.sourceModel, screen: s.screen, elements };
}

export type Mission = 'free' | 'collimate' | 'expand' | 'focus';
export function missionStart(mission: Mission): BenchScene {
  const s = blankScene();
  if (mission === 'collimate') { s.diameter = 2; s.fullAngle = 40; s.elements = [customLens('starter', 100)]; s.elements[0].focal = 100; }
  if (mission === 'expand') s.elements = [customLens('starter', 100)];
  if (mission === 'focus') { s.screen = 400; s.elements = [customLens('starter', 200)]; s.elements[0].focal = 100; }
  return s;
}
export function missionChecks(mission: Mission, scene: BenchScene, result = traceBench(scene)) {
  if (mission === 'free') return [];
  const fixedSource = scene.sourceModel === 'fan' && scene.diameter === (mission === 'collimate' ? 2 : 4) && scene.fullAngle === (mission === 'collimate' ? 40 : 0);
  return [
    { label: mission === 'collimate' ? '入射口径 2 mm、全角 40 mrad、关联光束' : '入射口径 4 mm、全角 0 mrad、关联光束', pass: fixedSource },
    { label: '所有采样光线通过，镜片无重合', pass: result.passed === result.total && result.coincidences === 0 },
    { label: mission === 'focus' ? '目标面几何范围 ≤ 0.10 mm' : '输出角度范围 ≤ 0.10 mrad', pass: (mission === 'focus' ? result.span : result.angleSpan) !== null && (mission === 'focus' ? result.span! : result.angleSpan!) <= .1 },
    ...(mission === 'expand' ? [{ label: '目标面范围 8 ± 0.1 mm，至少两片透镜', pass: result.span !== null && Math.abs(result.span - 8) <= .1 && scene.elements.filter(e => e.kind === 'lens').length >= 2 }] : []),
  ];
}
