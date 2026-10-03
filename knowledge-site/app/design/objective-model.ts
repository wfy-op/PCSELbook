/** Infinity-corrected dry objectives, represented by an ideal principal plane.
 * Current M/NA/WD titles: public/training/objectives/*.json (2026-10-04).
 * f = f_tube / M, not WD; estimated back pupil D = 2 NA f in air.
 * Neither pupil estimate nor the 25.4 mm blocking segment is housing geometry.
 * No high-NA/vector field, lens prescription, coverslip or aberration model.
 */
export type ObjectiveModel = {
  magnification: number; numericalAperture: number; workingDistance: number;
  tubeFocal: number; catalogSku?: string;
};
export type ObjectivePart = ObjectiveModel & {
  sku: string; manufacturer: string; spectralLabel: string;
  wavelengthMin?: number; wavelengthMax?: number;
  sourceUrl: string; recordUrl: string; tubeSourceUrl: string;
};
const evidentTube = 'https://evidentscientific.com/en/learn/microscope/terms/focal-length';
const thorlabsTube = 'https://www.thorlabs.com/infinity-corrected-tube-lenses';
export const objectiveParts: readonly ObjectivePart[] = [
  { sku: 'RMS4X', manufacturer: 'Evident', magnification: 4, numericalAperture: .10, workingDistance: 18.5, tubeFocal: 180 },
  { sku: 'RMS10X', manufacturer: 'Evident', magnification: 10, numericalAperture: .25, workingDistance: 10.6, tubeFocal: 180 },
  { sku: 'RMS20X', manufacturer: 'Evident', magnification: 20, numericalAperture: .40, workingDistance: 1.2, tubeFocal: 180 },
  { sku: 'RMS40X', manufacturer: 'Evident', magnification: 40, numericalAperture: .65, workingDistance: .6, tubeFocal: 180 },
  { sku: 'MY10X-803', manufacturer: 'Mitutoyo', magnification: 10, numericalAperture: .28, workingDistance: 34, tubeFocal: 200, wavelengthMin: 436, wavelengthMax: 656 },
  { sku: 'MY20X-804', manufacturer: 'Mitutoyo', magnification: 20, numericalAperture: .42, workingDistance: 20, tubeFocal: 200, wavelengthMin: 436, wavelengthMax: 656 },
].map(p => ({ ...p, catalogSku: p.sku,
  spectralLabel: p.manufacturer === 'Mitutoyo' ? '436–656 nm' : '可见光 · 数值边界未核验',
  sourceUrl: `https://www.thorlabs.com/item/${p.sku.toLowerCase()}`,
  recordUrl: `/training/objectives/${p.sku}.json`,
  tubeSourceUrl: p.manufacturer === 'Mitutoyo' ? thorlabsTube : evidentTube,
}));
export const objectiveFocal = (p: ObjectiveModel) => p.tubeFocal / p.magnification;
export const objectivePupil = (p: ObjectiveModel) => 2 * p.numericalAperture * objectiveFocal(p);
export const objectiveHalfAngle = (p: ObjectiveModel) => Math.asin(p.numericalAperture) * 180 / Math.PI;
export function objectiveDefaults(p: ObjectiveModel) {
  return { focal: objectiveFocal(p), aperture: objectivePupil(p), diameter: Math.max(25.4, objectivePupil(p)) };
}
export function parseObjectiveModel(value: unknown): ObjectiveModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('物镜规格必须是对象。');
  const raw = value as Record<string, unknown>;
  const read = (key: string, min: number, max: number) => {
    const v = raw[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`物镜 ${key} 必须在 ${min}–${max} 之间。`);
    return v;
  };
  const model: ObjectiveModel = { magnification: read('magnification', 1, 100), numericalAperture: read('numericalAperture', .01, .95), workingDistance: read('workingDistance', .01, 100), tubeFocal: read('tubeFocal', 50, 500) };
  const part = objectiveParts.find(p => p.sku === raw.catalogSku && (['magnification', 'numericalAperture', 'workingDistance', 'tubeFocal'] as const).every(k => Math.abs(model[k] - p[k]) < 1e-8));
  if (part) model.catalogSku = part.sku;
  return model;
}
/** Matching template parameters never certify a physical device. */
export function objectiveReference(model: ObjectiveModel, focal: number, aperture: number, diameter: number) {
  return objectiveParts.find(p => p.sku === model.catalogSku && Math.abs(focal - objectiveFocal(p)) < 1e-8 && Math.abs(aperture - objectivePupil(p)) < 1e-8 && Math.abs(diameter - objectiveDefaults(p).diameter) < 1e-8);
}
export function objectiveWarnings(model: ObjectiveModel, wavelength: number): string[] {
  const part = objectiveParts.find(p => p.sku === model.catalogSku);
  if (!part) return [];
  if (part.wavelengthMin !== undefined && part.wavelengthMax !== undefined && (wavelength < part.wavelengthMin || wavelength > part.wavelengthMax)) return [`${part.sku} 的厂家标示波段为 ${part.spectralLabel}；${wavelength} nm 超出该波段，当前等效计算不验证实物性能。`];
  if (part.manufacturer === 'Evident' && (wavelength < 380 || wavelength > 780)) return [`${part.sku} 是可见光物镜；资料未确认 ${wavelength} nm 的性能，当前等效计算不能作为选型依据。`];
  return [];
}
