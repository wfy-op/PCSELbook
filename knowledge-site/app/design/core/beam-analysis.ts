/** Independent geometric phase-space samples and detector statistics in air.
 * Gaussian diameters/divergences are full 1/e² values (sigma = full / 4).
 * Uniform diameters/divergences are full ellipse boundaries. No diffraction,
 * coherent field or measured beam radiometry is inferred from these samples.
 */
export type BeamDefinition = {
  profile: 'gaussian' | 'uniform'; diameterMinor: number; fullAngleMinor: number; rotationDeg: number;
};
export type BeamSample = { u: number; v: number; slopeU: number; slopeV: number };
export type BeamHit = BeamSample & { power: number };
export type SpotGrid = {
  size: number;
  /** Grid spans [-extentU,+extentU] × [-extentV,+extentV], in mm. */
  extentU: number; extentV: number;
  /** Row-major bin powers (a.u.) and power / bin area (a.u./mm²). */
  power: number[]; irradiance: number[]; integratedPower: number; outsidePower: number;
};
export type BeamSpot = {
  hits: BeamHit[]; centroidU: number | null; centroidV: number | null;
  rmsU: number | null; rmsV: number | null; rms2D: number | null; covarianceUV: number | null;
  principalRmsMajor: number | null; principalRmsMinor: number | null; orientationDeg: number | null;
  grid: SpotGrid;
};

function halton(index: number, base: number): number {
  let fraction = 1, value = 0;
  while (index > 0) { fraction /= base; value += fraction * (index % base); index = Math.floor(index / base); }
  return value;
}
const rotate = (u: number, v: number, angle: number) => ({ u: Math.cos(angle) * u - Math.sin(angle) * v, v: Math.sin(angle) * u + Math.cos(angle) * v });

/** Bounded 4D Halton quadrature with antithetic partners for a centered source.
 * Four independent dimensions sample position and angle; `rayCount` controls
 * sqrt(sample budget), capped at 4096. A final centered sample handles odd N.
 */
export function sampleBeam(majorDiameter: number, majorFullAngle: number, rayCount: number, beam: BeamDefinition): BeamSample[] {
  const count = Math.min(4096, Math.max(64, rayCount ** 2));
  const pairs = Math.floor(count / 2), angle = beam.rotationDeg * Math.PI / 180;
  const result: BeamSample[] = [];
  for (let i = 1; i <= pairs; i++) {
    const radialPosition = beam.profile === 'gaussian' ? Math.sqrt(-2 * Math.log(halton(i, 2))) : Math.sqrt(halton(i, 2));
    const radialAngle = beam.profile === 'gaussian' ? Math.sqrt(-2 * Math.log(halton(i, 5))) : Math.sqrt(halton(i, 5));
    const positionFactor = beam.profile === 'gaussian' ? .25 : .5;
    const angleFactor = beam.profile === 'gaussian' ? .00025 : .0005;
    const p = rotate(radialPosition * Math.cos(2 * Math.PI * halton(i, 3)) * majorDiameter * positionFactor,
      radialPosition * Math.sin(2 * Math.PI * halton(i, 3)) * beam.diameterMinor * positionFactor, angle);
    const a = rotate(radialAngle * Math.cos(2 * Math.PI * halton(i, 7)) * majorFullAngle * angleFactor,
      radialAngle * Math.sin(2 * Math.PI * halton(i, 7)) * beam.fullAngleMinor * angleFactor, angle);
    // Divergence is an angle in radians, not an unlabelled direction cosine.
    const sample = { ...p, slopeU: Math.tan(a.u), slopeV: Math.tan(a.v) };
    result.push(sample, { u: -sample.u, v: -sample.v, slopeU: -sample.slopeU, slopeV: -sample.slopeV });
  }
  if (count % 2) result.push({ u: 0, v: 0, slopeU: 0, slopeV: 0 });
  return result;
}

/** Bin actual received samples. Default extents contain every hit; caller
 * extents may crop samples, whose power is explicitly returned as outsidePower.
 */
export function buildSpotGrid(hits: BeamHit[], options: { size?: number; extentU?: number; extentV?: number } = {}): SpotGrid {
  const size = options.size ?? 48;
  if (!Number.isInteger(size) || size < 4 || size > 256) throw new Error('探测网格尺寸必须为 4–256 的整数');
  const extentU = options.extentU ?? hits.reduce((extent, h) => Math.max(extent, Math.abs(h.u)), 1e-6) * 1.02;
  const extentV = options.extentV ?? hits.reduce((extent, h) => Math.max(extent, Math.abs(h.v)), 1e-6) * 1.02;
  if (!(Number.isFinite(extentU) && extentU > 0 && Number.isFinite(extentV) && extentV > 0)) throw new Error('探测网格半宽必须为正数');
  const power = Array<number>(size * size).fill(0);
  let outsidePower = 0;
  for (const hit of hits) {
    if (Math.abs(hit.u) > extentU || Math.abs(hit.v) > extentV) { outsidePower += hit.power; continue; }
    const x = Math.min(size - 1, Math.floor((hit.u / extentU + 1) * size / 2));
    const y = Math.min(size - 1, Math.floor((hit.v / extentV + 1) * size / 2));
    power[y * size + x] += hit.power;
  }
  const area = 4 * extentU * extentV / (size * size);
  return { size, extentU, extentV, power, irradiance: power.map(p => p / area), integratedPower: power.reduce((sum, p) => sum + p, 0), outsidePower };
}

export function analyzeBeamHits(hits: BeamHit[]): BeamSpot {
  const power = hits.reduce((sum, h) => sum + h.power, 0), grid = buildSpotGrid(hits);
  if (!power) return { hits, centroidU: null, centroidV: null, rmsU: null, rmsV: null, rms2D: null, covarianceUV: null, principalRmsMajor: null, principalRmsMinor: null, orientationDeg: null, grid };
  const centroidU = hits.reduce((sum, h) => sum + h.u * h.power, 0) / power;
  const centroidV = hits.reduce((sum, h) => sum + h.v * h.power, 0) / power;
  const uu = hits.reduce((sum, h) => sum + (h.u - centroidU) ** 2 * h.power, 0) / power;
  const vv = hits.reduce((sum, h) => sum + (h.v - centroidV) ** 2 * h.power, 0) / power;
  const uv = hits.reduce((sum, h) => sum + (h.u - centroidU) * (h.v - centroidV) * h.power, 0) / power;
  const discriminant = Math.hypot(uu - vv, 2 * uv);
  return { hits, centroidU, centroidV, rmsU: Math.sqrt(uu), rmsV: Math.sqrt(vv), rms2D: Math.sqrt(uu + vv), covarianceUV: uv,
    principalRmsMajor: Math.sqrt(Math.max(0, (uu + vv + discriminant) / 2)),
    principalRmsMinor: Math.sqrt(Math.max(0, (uu + vv - discriminant) / 2)), orientationDeg: Math.atan2(2 * uv, uu - vv) * 90 / Math.PI, grid };
}

/** Explicit (non-Zernike-normalized) thin pupil OPD polynomial, coefficient µm:
 * W = S ρ⁴ + C ξρ² + A(ξ²−η²); ξ=u/a, η=v/a, a=clear-aperture radius.
 * Return dW/du,dW/dv in air as dimensionless paraxial slope corrections.
 * Coefficients are user-defined wavefront screens, never catalog prescriptions.
 */
export function pupilAberrationSlope(u: number, v: number, apertureRadius: number, aberration: { sphericalUm: number; comaUm: number; astigmatismUm: number }): { u: number; v: number } {
  const x = u / apertureRadius, y = v / apertureRadius, r2 = x * x + y * y;
  const s = aberration.sphericalUm * .001 / apertureRadius, c = aberration.comaUm * .001 / apertureRadius, a = aberration.astigmatismUm * .001 / apertureRadius;
  return { u: 4 * s * x * r2 + c * (3 * x * x + y * y) + 2 * a * x,
    v: 4 * s * y * r2 + 2 * c * x * y - 2 * a * y };
}
