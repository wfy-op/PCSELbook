import { blankFoldedScene, foldedElement, traceFoldedScene, type FoldedScene } from '../design/core/folded-engine.ts';
import { customLens, missionChecks, missionStart, traceBench, type BenchScene, type Mission } from './bench-engine.ts';

export type ToolId = 'mirror' | 'iris' | 'positive' | 'negative' | 'achromat' | 'block' | 'sensor' | 'post' | 'mount';
export const teachingTools: { id: ToolId; title: string; detail: string; tryThis: string }[] = [
  { id: 'positive', title: '正透镜', detail: '平行光经过正焦距薄透镜会聚。光线在焦点后重新展开，不能只凭一处小光斑判断准直。', tryThis: '移动镜片，观察焦点随镜片移动；增大焦距，观察会聚变慢。' },
  { id: 'negative', title: '负透镜', detail: '负焦距透镜使平行光发散，反向延长线相交于入射侧的虚焦点。', tryThis: '改变负焦距的绝对值，比较输出发散程度。' },
  { id: 'mirror', title: '反射镜', detail: '反射角等于入射角。镜面转动 Δθ，反射方向改变约 2Δθ。', tryThis: '改变镜面法线角，观察反射方向，而不是只看一个参考点。' },
  { id: 'iris', title: '光阑', detail: '孔内光线通过，孔外被挡。缩小光阑会截光，但不会把原来的光束变成理想准直光。', tryThis: '缩小孔径，再横移光阑，观察哪些光线被截断。' },
  { id: 'achromat', title: '消色差透镜', detail: '多片玻璃组合用于减小选定波段的色差。此处只演示等效焦距，不模拟材料色散或实际色差。', tryThis: '先观察它的会聚作用，再到器件库核对波段、共轭和规格。' },
  { id: 'sensor', title: '功率探头', detail: '只有落入有效接收面的光被接收。这里显示理想几何接收比例，不含探头响应、校准或实测功率。', tryThis: '横移探头或缩小接收口径，观察漏收光线。' },
  { id: 'block', title: '挡光器', detail: '在预定位置终止光束。演示采用完全吸收的理想平面；实际器件需要确认波长、功率和反射风险。', tryThis: '横移挡光器，观察漏过的光线仍会继续传播。' },
  { id: 'post', title: '支杆与底座', detail: '机械支撑本身没有光学功率。移动支撑标记不会让光线偏折，安装光学元件后才会影响光路。', tryThis: '移动参考支撑，区分机械定位与光学作用。' },
  { id: 'mount', title: '透镜架与位移台', detail: '位移台使已安装透镜的轴向距离和横向位置可调。演示安装了 f = 100 mm 的理想薄透镜。', tryThis: '先轴向移动找焦面，再横向移动观察偏心。' },
];
export function componentScene(id: ToolId, x: number, y: number, parameter: number): FoldedScene {
  const scene = blankFoldedScene();
  scene.bounds = { minX: 0, maxX: 640, minY: -240, maxY: 240 };
  scene.source = { ...scene.source, x: 25, y: 0, diameter: 16, rayCount: 17 };
  const kind = id === 'mirror' || id === 'block' ? 'mirror' : id === 'iris' ? 'iris' : id === 'sensor' ? 'detector' : 'lens';
  const optic = { ...foldedElement(kind, 'teaching-tool', x, y), diameter: 60, aperture: 50 };
  if (kind === 'lens') optic.focal = id === 'negative' ? -parameter : parameter;
  if (id === 'mirror') optic.angleDeg = parameter;
  if (id === 'iris' || id === 'sensor') optic.aperture = parameter;
  if (id === 'block') { optic.angleDeg = 0; optic.reflectance = 0; optic.transmittance = 0; }
  scene.elements = id === 'post' ? [] : [optic];
  return scene;
}
export function componentResult(id: ToolId, x: number, y: number, parameter: number) {
  const scene = componentScene(id, x, y, parameter);
  return { scene, result: traceFoldedScene(scene) };
}

/** Intro experiments share the production tracers; display magnification is UI-only. */
export function focusExperiment(distance: number, lensEnabled = true) {
  const lens = { ...customLens('intro-lens', 200), focal: 100 };
  const scene: BenchScene = { version: 1, diameter: 16, fullAngle: 0, sourceModel: 'fan', screen: lens.z + distance, elements: lensEnabled ? [lens] : [] };
  return { scene, result: traceBench(scene), focalDistance: lens.focal };
}
export function apertureExperiment(aperture: number) {
  const scene = componentScene('iris', 280, 0, aperture);
  scene.source.fullAngle = 40;
  return { scene, result: traceFoldedScene(scene) };
}

export const challenges: { id: Exclude<Mission, 'free'>; title: string; formula: string; problem: string; answer: number; unit: string; hint: string; question: string; options: string[]; correct: number }[] = [
  { id: 'focus', title: '平行光聚焦', formula: '平行入射：焦面距薄透镜 f；一般成像：1/f = 1/u + 1/v，m = −v/u。', problem: '平行光通过 f = 100 mm 的正透镜，焦面应距镜片多少 mm？', answer: 100, unit: 'mm', hint: '平行光相当于 u → ∞，所以 v = f。镜片放在 z = 200 mm，目标面应在 z = 300 mm。', question: '在一个位置看到小光斑，能说明已经准直吗？', options: ['能，只要光斑小', '不能，那也可能是焦点'], correct: 1 },
  { id: 'expand', title: '两倍正正扩束', formula: '平行输入、平行输出：d = f₁ + f₂，束径倍率 |M| = |f₂/f₁|。', problem: '两片正透镜 f₁ = 50 mm、f₂ = 100 mm，需要多大镜间距？', answer: 150, unit: 'mm', hint: '第一片放 z = 100 mm，第二片放 z = 250 mm。输入范围 4 mm，输出应为 8 mm，且仍然平行。', question: '缩小光阑直到只剩一根光线，算完成扩束吗？', options: ['不算，需要全部光线通过且满足束径与角度目标', '算，最后一根光线没有发散'], correct: 0 },
  { id: 'collimate', title: '发散光准直', formula: '关联扇形光束的虚拟起点距离：D/Θ；源点到透镜的距离等于 f 时输出平行。Θ 用 rad。', problem: '入口范围 2 mm，全角 40 mrad，虚拟源点在 z = −50 mm。f = 100 mm 透镜应放在什么 z？', answer: 50, unit: 'mm', hint: '40 mrad = 0.040 rad；2/0.040 = 50 mm。透镜距离虚拟源点 100 mm，所以 z = 50 mm。此规则只适用于位置与角度关联的点源扇形。', question: '这里的点源扇形规则能让任何扩展光源完美准直吗？', options: ['能，只要焦距足够长', '不能，扩展源的位置和角度独立分布'], correct: 1 },
];
export function challengeScene(index: number): BenchScene { return missionStart(challenges[index].id); }
export function addExpansionLens(scene: BenchScene): BenchScene {
  if (scene.elements.length >= 2) return scene;
  return { ...scene, elements: [...scene.elements, { ...customLens('second', 300), focal: 100 }] };
}
export function evaluateChallenge(index: number, answer: string, choice: number | null, scene: BenchScene) {
  const challenge = challenges[index];
  const numeric = answer.trim() !== '' && Number.isFinite(Number(answer)) && Math.abs(Number(answer) - challenge.answer) <= .01;
  const question = choice === challenge.correct;
  const checks = missionChecks(challenge.id, scene, traceBench(scene));
  return { numeric, question, checks, complete: numeric && question && checks.every(c => c.pass) };
}
