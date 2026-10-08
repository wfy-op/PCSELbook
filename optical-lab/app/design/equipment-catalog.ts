import lensCatalog from '../training/thorlabs-catalog.json';
import foldedCatalog from './folded-catalog.json';
import { objectiveDefaults, objectiveFocal, objectiveParts } from './core/objective-model';
import type { OpticsIconName } from './OpticsIcon';

export type CylindricalPart = {
  sku: string; focal: number; diameter: number; aperture: number;
  coating: string; wavelengthMin: number; wavelengthMax: number;
  sourceUrl: string; recordUrl: string; evidenceUrl: string; apertureBasis: string;
};
/** f / optic diameter / coating: current official Title in each saved record.
 * 21 mm is a conservative model aperture from the historical >21 mm limit.
 * Diameter is the optical element, not the cell exterior; no housing inferred.
 */
export const cylindricalParts: readonly CylindricalPart[] = [
  { sku: 'LJ1695RM-A', focal: 50, coating: '350–700 nm', wavelengthMin: 350, wavelengthMax: 700 },
  { sku: 'LJ1567RM-A', focal: 100, coating: '350–700 nm', wavelengthMin: 350, wavelengthMax: 700 },
  { sku: 'LJ1653RM-B', focal: 200, coating: '650–1050 nm', wavelengthMin: 650, wavelengthMax: 1050 },
].map(p => ({ ...p, diameter: 25.4, aperture: 21,
  sourceUrl: `https://www.thorlabs.com/item/${p.sku.toLowerCase()}`,
  recordUrl: `/training/cylindrical/${p.sku}.json`,
  evidenceUrl: 'https://www.thorlabs.com/catalogpages/V21/764.PDF',
  apertureBasis: '模型取 21 mm；官方历史目录标示通光孔径 >21 mm，采用其保守下界。',
}));

export type EquipmentCategory = 'ideal' | 'spherical' | 'cylindrical' | 'objective' | 'splitting';
export type EquipmentItem = {
  id: string; category: EquipmentCategory; icon: OpticsIconName;
  title: string; subtitle: string; badge: string; note: string;
  stats: { label: string; value: string }[];
  sourceUrl?: string; recordUrl?: string; evidenceUrl?: string;
};
export const equipmentCategories: readonly { id: EquipmentCategory; title: string; icon: OpticsIconName }[] = [
  { id: 'ideal', title: '理想元件', icon: 'optics' },
  { id: 'spherical', title: '球面 / 消色差透镜', icon: 'lens' },
  { id: 'cylindrical', title: '柱透镜', icon: 'lens' },
  { id: 'objective', title: '物镜', icon: 'objective' },
  { id: 'splitting', title: '折转 / 分光', icon: 'splitter' },
];

const genericItems: EquipmentItem[] = [
  { id: 'lens', category: 'ideal', icon: 'lens', title: '完美薄透镜', subtitle: '双轴聚焦 · 正 / 负焦距', badge: '理想模型', stats: [{ label: '默认焦距', value: '100 mm' }, { label: '默认孔径', value: '22.86 mm' }], note: '无厚度、无色散，两个横向轴具有相同光焦度。默认像差为零，可在参数中设置等效像差。' },
  { id: 'cylindrical', category: 'cylindrical', icon: 'lens', title: '理想柱透镜', subtitle: '单轴聚焦 · 可旋转', badge: '理想模型', stats: [{ label: '有光焦度轴', value: 'f = 100 mm' }, { label: '另一轴', value: '无光焦度' }], note: '默认仅改变一个横向轴的光线角度；旋转柱轴可调节长短轴。没有厂家处方或默认实物像差。' },
  { id: 'objective', category: 'objective', icon: 'objective', title: '等效物镜', subtitle: '无限远校正 · 可编辑', badge: '理想模型', stats: [{ label: '起始倍率', value: '10×' }, { label: '筒镜焦距', value: '180 mm' }], note: '起始值取 RMS10X。采用等效主平面，倍率需配套筒镜；工作距离与等效焦距不同。' },
  { id: 'iris', category: 'ideal', icon: 'iris', title: '可调光阑', subtitle: '限制通光孔径', badge: '理想模型', stats: [{ label: '默认通光孔径', value: '22.86 mm' }], note: '孔径内透射，孔径外吸收；可用来检查截光与接收效率。' },
  { id: 'detector', category: 'ideal', icon: 'detector', title: '探测面', subtitle: '接收光斑与强度', badge: '理想模型', stats: [{ label: '默认有效直径', value: '40 mm' }], note: '理想接收面，统计抵达该面的采样光线权重；不会自动加入量子效率或电子读出噪声。' },
  { id: 'mirror', category: 'splitting', icon: 'mirror', title: '理想平面反射镜', subtitle: '反射定律 · 法线可调', badge: '理想模型', stats: [{ label: '默认反射率', value: '100%' }], note: '平面几何反射；默认无损耗、无偏振与镀膜相位响应。' },
  { id: 'beamsplitter', category: 'splitting', icon: 'splitter', title: '理想半透半反镜', subtitle: '反射 / 透射独立分支', badge: '理想模型', stats: [{ label: '默认功率 R / T', value: '50% / 50%' }], note: 'R 与 T 表示功率比例。薄面模型不包含立方内光程、平板折射位移、偏振或干涉。' },
];

export const equipmentItems: readonly EquipmentItem[] = [
  ...genericItems,
  ...lensCatalog.map(p => ({ id: p.sku, category: 'spherical' as const, icon: 'lens' as const,
    title: p.sku, subtitle: `f ${p.focal} mm · Ø${p.diameter} mm`, badge: p.kind === 'doublet' ? '消色差双胶合' : p.kind === 'concave' ? '平凹' : '平凸',
    stats: [{ label: '标称焦距', value: `${p.focal} mm` }, { label: '镜片外径', value: `${p.diameter} mm` }, { label: '镀膜波段', value: p.coating }, { label: '模型通光孔径', value: `${p.aperture} mm` }],
    note: `${p.apertureBasis}。此处默认使用等效薄透镜；没有从名义焦距推算实物球差。`, sourceUrl: p.source, recordUrl: p.engineeringRecord,
  })),
  ...cylindricalParts.map(p => ({ id: p.sku, category: 'cylindrical' as const, icon: 'lens' as const,
    title: p.sku, subtitle: `单轴 f ${p.focal} mm · Ø${p.diameter} mm`, badge: '索雷博 · 柱透镜',
    stats: [{ label: '标称焦距', value: `${p.focal} mm` }, { label: '镜片外径', value: `${p.diameter} mm` }, { label: '镀膜波段', value: p.coating }, { label: '模型通光孔径', value: `${p.aperture} mm` }],
    note: `${p.apertureBasis} 当前以单轴薄透镜计算，支架外径、厚度与 Zemax 处方未用于追迹。`, sourceUrl: p.sourceUrl, recordUrl: p.recordUrl, evidenceUrl: p.evidenceUrl,
  })),
  ...objectiveParts.map(p => ({ id: p.sku, category: 'objective' as const, icon: 'objective' as const,
    title: `${p.sku} · ${p.magnification}×`, subtitle: `NA ${p.numericalAperture.toFixed(2)} · WD ${p.workingDistance} mm`, badge: p.manufacturer,
    stats: [{ label: '等效焦距', value: `${objectiveFocal(p)} mm` }, { label: '筒镜焦距', value: `${p.tubeFocal} mm` }, { label: '估算入瞳直径', value: `${objectiveDefaults(p).aperture.toFixed(2)} mm` }, { label: '设计波段', value: p.spectralLabel }],
    note: '等效焦距 = 筒镜焦距 / 倍率；工作距离是机械距离。入瞳直径采用 2 NA f 估计。当前不计算高 NA 矢量场、盖玻片或多片镜组像差。', sourceUrl: p.sourceUrl, recordUrl: p.recordUrl, evidenceUrl: p.tubeSourceUrl,
  })),
  ...foldedCatalog.parts.map(p => ({ id: p.sku, category: 'splitting' as const, icon: p.kind === 'splitter' ? 'splitter' as const : 'mirror' as const,
    title: p.sku, subtitle: p.kind === 'splitter' ? `${p.construction === 'cube' ? '立方' : '平板'} · 名义 50:50` : '平面反射镜 · Ø25.4 mm', badge: '索雷博 · 标称参数',
    stats: [{ label: '尺寸', value: p.dimensionsMm ? `${p.dimensionsMm.join(' × ')} mm` : `Ø${p.diameterMm} mm` }, { label: '设计波段', value: `${p.wavelengthBandNm.join('–')} nm` }, { label: '模型 R / T', value: `${p.modelDefaults.reflectance * 100}% / ${p.modelDefaults.transmittance * 100}%` }],
    note: p.notes.join(' '), sourceUrl: p.sourceUrl, evidenceUrl: p.evidenceUrl,
  })),
];

export function searchEquipment(query: string): readonly EquipmentItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return equipmentItems;
  const terms = normalized.split(/\s+/);
  return equipmentItems.filter(p => {
    const content = `${p.id} ${p.title} ${p.subtitle} ${p.badge} ${equipmentCategories.find(c => c.id === p.category)?.title} ${p.stats.map(s => s.value).join(' ')}`.toLowerCase();
    return terms.every(term => content.includes(term));
  });
}
