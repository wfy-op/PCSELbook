import type { DesignProject } from './core/design-engine';
import { parseFoldedScene, type FoldedScene } from './core/folded-engine.ts';

/** Copy a geometric prescription into a spatial scene; never pretend q rays carry power. */
export function convertSequentialProject(p: DesignProject): FoldedScene {
  if (p.source.mode !== 'geometric') throw new Error('空间追迹目前使用几何光线。请先在顺序模式中切换为几何光源，再复制光路。');
  const halfHeight = Math.max(150, Math.abs(p.source.offset) + p.source.diameter / 2 + 20, ...p.elements.map(e => Math.abs(e.y) + e.diameter / 2 + 20));
  const aperture = p.screenAperture > 0 ? p.screenAperture : halfHeight * 2;
  return parseFoldedScene({
    version: 1,
    name: `${p.name.trim() || '未命名光路'} · 空间副本`.slice(0, 120),
    source: { x: 0, y: p.source.offset, directionDeg: p.source.tilt * 180 / (1000 * Math.PI), diameter: p.source.diameter, fullAngle: p.source.fullAngle, rayCount: 25, intensity: 1, wavelength: p.source.wavelength, model: p.source.model },
    bounds: { minX: -100, maxX: p.screen + 100, minY: -halfHeight, maxY: halfHeight },
    elements: [
      ...p.elements.map(e => ({ id: /^[a-zA-Z0-9_-]{1,64}$/.test(e.id) ? e.id : crypto.randomUUID(), kind: e.objective ? 'objective' : e.kind, name: e.name.trim() || (e.kind === 'lens' ? '薄透镜' : '光阑'), x: e.z, y: e.y, angleDeg: 0, diameter: e.diameter, aperture: e.aperture, focal: e.focal, reflectance: 0, transmittance: 1, ...(e.objective ? { objective: e.objective } : {}) })),
      { id: crypto.randomUUID(), kind: 'detector' as const, name: p.screenAperture > 0 ? '原目标面' : '原目标面（有限视场）', x: p.screen, y: 0, angleDeg: 0, diameter: Math.max(25.4, aperture), aperture, focal: 100, reflectance: 0, transmittance: 0 },
    ],
  });
}
