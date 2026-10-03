import { blankProject, customDesignLens, parseDesignProject, type DesignProject } from './design-engine';
import catalog from '../training/thorlabs-catalog.json';

export type DesignGoal = { kind: 'focus' | 'diameter' | 'collimation'; value: number };
export type DesignFile = { format: 'pcsel-optics-design'; formatVersion: 1; project: DesignProject; goal: DesignGoal; variableIds: string[]; constraints?: { minGap: number; maxOutputAngle: number } };
export const DRAFT_KEY = 'pcsel-optics-designer-draft-v2';
export const LIBRARY_KEY = 'pcsel-optics-designer-library-v2';
export const presets = [
  { id: 'kepler', name: '两倍开普勒扩束', description: '50 / 100 mm · 平行输入' },
  { id: 'galilean', name: '两倍伽利略扩束', description: '−50 / 100 mm · 无内部焦点' },
  { id: 'relay', name: '4f 中继', description: '50 / 100 mm · 倒像倍率 −2' },
  { id: 'pump', name: '扩束后聚焦', description: '三片理想透镜 · 光泵设计起点' },
  { id: 'gaussian', name: 'Gaussian 聚焦', description: '532 nm · 理想单透镜' },
  { id: 'blank', name: '空白光路', description: '从光源与目标面开始' },
];
export function presetProject(id: string): DesignProject {
  const p = blankProject();
  p.name = presets.find(p => p.id === id)?.name ?? '未命名光路';
  const lens = (z: number, focal: number) => ({ ...customDesignLens(crypto.randomUUID(), z), focal, name: `自定义 f${focal} 透镜` });
  if (id === 'kepler') p.elements = [lens(100, 50), lens(250, 100)];
  if (id === 'galilean') p.elements = [lens(100, -50), lens(150, 100)];
  if (id === 'relay') { p.source.model = 'extended'; p.source.fullAngle = 30; p.source.diameter = 2; p.elements = [lens(50, 50), lens(200, 100)]; p.screen = 300; }
  if (id === 'pump') { p.source.diameter = 2; p.elements = [lens(60, 50), lens(210, 100), lens(330, 75)]; p.screen = 405; }
  if (id === 'gaussian') { p.source.mode = 'gaussian'; p.source.wavelength = 532; p.source.w0 = 1; p.source.waistZ = 100; p.source.m2 = 1; p.elements = [lens(100, 100)]; p.screen = 200; }
  return p;
}
export function parseDesignFile(input: unknown): DesignFile {
  if (!input || typeof input !== 'object') throw new Error('文件内容应为光路工程 JSON。');
  const raw = input as Partial<DesignFile>;
  const project = parseDesignProject(raw.project ?? input, catalog);
  const kind = raw.goal?.kind;
  const goal: DesignGoal = { kind: kind && ['focus', 'diameter', 'collimation'].includes(kind) ? kind : 'focus', value: typeof raw.goal?.value === 'number' && Number.isFinite(raw.goal.value) && raw.goal.value >= .001 && raw.goal.value <= 100 ? raw.goal.value : 8 };
  const minGap = raw.constraints?.minGap;
  const maxOutputAngle = raw.constraints?.maxOutputAngle;
  return { format: 'pcsel-optics-design', formatVersion: 1, project, goal, variableIds: Array.isArray(raw.variableIds) ? [...new Set(raw.variableIds.filter(id => typeof id === 'string' && project.elements.some(e => e.id === id)))].slice(0, 24) : project.elements.filter(e => e.kind === 'lens').map(e => e.id), constraints: { minGap: typeof minGap === 'number' && Number.isFinite(minGap) && minGap >= .1 && minGap <= 500 ? minGap : 5, maxOutputAngle: typeof maxOutputAngle === 'number' && Number.isFinite(maxOutputAngle) && maxOutputAngle >= 0 && maxOutputAngle <= 200 ? maxOutputAngle : goal.kind === 'diameter' ? 1 : 0 } };
}
export function loadDraft(): DesignFile {
  try { const text = localStorage.getItem(DRAFT_KEY); if (text) return parseDesignFile(JSON.parse(text)); } catch { /* Keep corrupt storage isolated. */ }
  const project = presetProject('kepler');
  return { format: 'pcsel-optics-design', formatVersion: 1, project, goal: { kind: 'diameter', value: 8 }, variableIds: project.elements.map(e => e.id) };
}
export type SavedDesign = { id: string; savedAt: string; file: DesignFile };
export function loadLibrary(): SavedDesign[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 20).flatMap(item => { try { return typeof item.id === 'string' && typeof item.savedAt === 'string' ? [{ id: item.id, savedAt: item.savedAt, file: parseDesignFile(item.file) }] : []; } catch { return []; } });
  } catch { return []; }
}
