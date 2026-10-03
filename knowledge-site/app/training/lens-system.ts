export type LensPreset = 'kepler' | 'galilean' | 'relay' | 'pump';
export type LensSource = 'collimated' | 'object';
export type Matrix = { a: number; b: number; c: number; d: number };
export type LensSystem = {
  source: LensSource;
  sourceDistance: number;
  focalLengths: number[];
  gaps: number[];
  targetDistance: number;
  beamRadius: number;
  objectHeight: number;
};
export type RayPoint = { z: number; y: number };
export type SystemRay = { id: number; family: number; points: RayPoint[]; outputAngle: number };

export const lensPresets: Record<LensPreset, { name: string; subtitle: string; config: LensSystem }> = {
  kepler: { name: '开普勒扩束', subtitle: '正透镜 + 正透镜', config: { source: 'collimated', sourceDistance: 40, focalLengths: [50, 100], gaps: [150], targetDistance: 100, beamRadius: 2.5, objectHeight: 1.5 } },
  galilean: { name: '伽利略扩束', subtitle: '负透镜 + 正透镜', config: { source: 'collimated', sourceDistance: 40, focalLengths: [-50, 100], gaps: [50], targetDistance: 100, beamRadius: 2.5, objectHeight: 1.5 } },
  relay: { name: '4f 成像中继', subtitle: '两个物点 → 两个像点', config: { source: 'object', sourceDistance: 50, focalLengths: [50, 100], gaps: [150], targetDistance: 100, beamRadius: 2.5, objectHeight: 1.5 } },
  pump: { name: '扩束后聚焦', subtitle: '泵浦光路的教学模型', config: { source: 'collimated', sourceDistance: 40, focalLengths: [50, 100, 75], gaps: [150, 120], targetDistance: 75, beamRadius: 1, objectHeight: 1.5 } },
};

export function getLensPreset(preset: LensPreset): LensSystem {
  const config = lensPresets[preset].config;
  return { ...config, focalLengths: [...config.focalLengths], gaps: [...config.gaps] };
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return { a: left.a * right.a + left.b * right.c, b: left.a * right.b + left.b * right.d, c: left.c * right.a + left.d * right.c, d: left.c * right.b + left.d * right.d };
}

/** Air-space, single-plane paraxial model. mm for lengths, radians for ray angles. */
export function traceLensSystem(config: LensSystem) {
  const { source, sourceDistance, focalLengths, gaps, targetDistance, beamRadius, objectHeight } = config;
  if (!['collimated', 'object'].includes(source) || focalLengths.length < 2 || focalLengths.length > 3 || gaps.length !== focalLengths.length - 1) return null;
  if (![sourceDistance, targetDistance, beamRadius, objectHeight, ...gaps].every(n => Number.isFinite(n) && n > 0)) return null;
  if (!focalLengths.every(n => Number.isFinite(n) && Math.abs(n) >= 1e-6)) return null;
  const positions: number[] = [];
  let z = sourceDistance;
  let matrix: Matrix = { a: 1, b: 0, c: 0, d: 1 };
  for (let i = 0; i < focalLengths.length; i++) {
    const distance = i === 0 ? sourceDistance : gaps[i - 1];
    if (i > 0) z += distance;
    positions.push(z);
    matrix = multiply({ a: 1, b: distance, c: 0, d: 1 }, matrix);
    matrix = multiply({ a: 1, b: 0, c: -1 / focalLengths[i], d: 1 }, matrix);
  }
  const outputMatrix = matrix;
  const targetMatrix = multiply({ a: 1, b: targetDistance, c: 0, d: 1 }, matrix);
  const targetZ = z + targetDistance;
  const initial = source === 'collimated'
    ? [-1, -.5, 0, .5, 1].map(n => ({ y: n * beamRadius, angle: 0, family: 0 }))
    : [-1, 1].flatMap(family => [-.02, 0, .02].map(angle => ({ y: family * objectHeight, angle, family })));
  let maxAbsAngle = 0;
  const rays: SystemRay[] = initial.map((input, id) => {
    let y = input.y;
    let angle = input.angle;
    let previousZ = 0;
    const points = [{ z: 0, y }];
    maxAbsAngle = Math.max(maxAbsAngle, Math.abs(angle));
    positions.forEach((position, i) => {
      y += (position - previousZ) * angle;
      points.push({ z: position, y });
      angle -= y / focalLengths[i];
      maxAbsAngle = Math.max(maxAbsAngle, Math.abs(angle));
      previousZ = position;
    });
    y += targetDistance * angle;
    points.push({ z: targetZ, y });
    return { id, family: input.family, points, outputAngle: angle };
  });
  const ends = rays.map(ray => ray.points.at(-1)!.y);
  const angles = rays.map(ray => ray.outputAngle);
  const familySpreads = [...new Set(rays.map(ray => ray.family))].map(family => {
    const values = rays.filter(ray => ray.family === family).map(ray => ray.points.at(-1)!.y);
    return Math.max(...values) - Math.min(...values);
  });
  const afocal = Math.abs(outputMatrix.c) < 1e-10;
  const imagesOnTarget = source === 'object' && Math.abs(targetMatrix.b) < 1e-7;
  const collimatedFocusOnTarget = source === 'collimated' && Math.abs(targetMatrix.a) < 1e-9;
  const result = {
    rays, lensPositions: positions, targetZ, outputMatrix, targetMatrix, maxAbsAngle,
    targetMin: Math.min(...ends), targetMax: Math.max(...ends), targetSpan: Math.max(...ends) - Math.min(...ends),
    outputAngleMin: Math.min(...angles), outputAngleMax: Math.max(...angles), maxFamilySpread: Math.max(...familySpreads),
    afocal, afocalMagnification: afocal ? outputMatrix.a : null,
    imagesOnTarget, imagingMagnification: imagesOnTarget ? targetMatrix.a : null,
    collimatedFocusOnTarget,
  };
  if (![targetZ, ...Object.values(targetMatrix), ...rays.flatMap(ray => [...ray.points.map(point => point.y), ray.outputAngle])].every(Number.isFinite)) return null;
  return result;
}
