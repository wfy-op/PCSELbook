import { blankFoldedScene, foldedElement, traceFoldedScene, type FoldedScene } from '../design/core/folded-engine.ts';
import { objectiveDefaults, objectiveParts } from '../design/core/objective-model.ts';
import { customLens, missionChecks, missionStart, traceBench, type BenchScene, type Mission } from './bench-engine.ts';

export type ToolId = 'mirror' | 'iris' | 'positive' | 'negative' | 'achromat' | 'cylindrical' | 'beamsplitter' | 'objective' | 'block' | 'sensor' | 'post' | 'mount';
export const teachingTools: { id: ToolId; title: string; detail: string; tryThis: string; formula?: string; sourceUrl?: string }[] = [
  { id: 'positive', title: '正透镜', detail: '平行光经过正焦距薄透镜会聚。光线在焦点后重新展开，不能只凭一处小光斑判断准直。', tryThis: '移动镜片，观察焦点随镜片移动；增大焦距，观察会聚变慢。' },
  { id: 'negative', title: '负透镜', detail: '负焦距透镜使平行光发散，反向延长线相交于入射侧的虚焦点。', tryThis: '改变负焦距的绝对值，比较输出发散程度。' },
  { id: 'cylindrical', title: '柱透镜', detail: '只在一个方向会聚光线，另一个方向保持展开，因此在焦面形成线焦。常用于线照明、单轴扩束和椭圆光束整形。', formula: '平行入射时 d = f；绕光轴转动聚焦方向，线焦随之转动。', tryThis: '先把屏距设为焦距，再转动聚焦方向角：观察接收屏上的细线转向。移开焦面后，光束又有了宽度。', sourceUrl: 'https://www.thorlabs.com/plano-convex-cylindrical-lenses-n-bk7-ar-coated-650-1050-nm' },
  { id: 'objective', title: '物镜', detail: '无限远校正物镜可把平行入射光会聚到焦面；反向使用时，焦面上的点发出的光可被准直。标示倍率需要配套筒镜，工作距离 WD 不等于焦距。', formula: '等效焦距 f = 筒镜焦距 / 倍率；这里采用 180 mm 筒镜。', tryThis: '切换物镜倍率，把屏距移到新的等效焦距；比较离焦与聚焦时的二维落点。', sourceUrl: 'https://evidentscientific.com/en/learn/microscope/terms/focal-length' },
  { id: 'mirror', title: '反射镜', detail: '反射角等于入射角。镜面转动 Δθ，反射方向改变约 2Δθ。', tryThis: '改变镜面法线角，观察反射方向，而不是只看一个参考点。' },
  { id: 'beamsplitter', title: '分光镜', detail: '把光分成透射与反射两支，可用于分束和光功率监测。这里采用无损的理想平面，R 与 T 表示功率比例。', formula: '无损模型 R + T = 1；D1 接收透射支，D2 接收反射支。', tryThis: '改变反射比例，观察两支光路和探测器读数。横移元件后，检查两支光是否仍落在接收面上。' },
  { id: 'iris', title: '光阑', detail: '孔内光线通过，孔外被挡。缩小光阑会截光，但不会把原来的光束变成理想准直光。', tryThis: '缩小孔径，再横移光阑，观察哪些光线被截断。' },
  { id: 'achromat', title: '消色差透镜', detail: '多片玻璃组合用于减小选定波段的色差。此处只演示等效焦距，不模拟材料色散或实际色差。', tryThis: '先观察它的会聚作用，再到器件库核对波段、共轭和规格。' },
  { id: 'sensor', title: '功率探头', detail: '只有落入有效接收面的光被接收。这里显示理想几何接收比例，不含探头响应、校准或实测功率。', tryThis: '横移探头或缩小接收口径，观察漏收光线。' },
  { id: 'block', title: '挡光器', detail: '在预定位置终止光束。演示采用完全吸收的理想平面；实际器件需要确认波长、功率和反射风险。', tryThis: '横移挡光器，观察漏过的光线仍会继续传播。' },
  { id: 'post', title: '支杆与底座', detail: '机械支撑本身没有光学功率。移动支撑标记不会让光线偏折，安装光学元件后才会影响光路。', tryThis: '移动参考支撑，区分机械定位与光学作用。' },
  { id: 'mount', title: '透镜架与位移台', detail: '位移台使已安装透镜的轴向距离和横向位置可调。演示安装了 f = 100 mm 的理想薄透镜。', tryThis: '先轴向移动找焦面，再横向移动观察偏心。' },
];
export type ComponentSettings = { rollDeg?: number; screenDistance?: number };
export function componentScene(id: ToolId, x: number, y: number, parameter: number, settings: ComponentSettings = {}): FoldedScene {
  const scene = blankFoldedScene();
  scene.bounds = { minX: 0, maxX: 640, minY: -240, maxY: 240 };
  scene.source = { ...scene.source, x: 25, y: 0, diameter: 16, rayCount: 17 };
  const kind = id === 'mirror' || id === 'block' ? 'mirror' : id === 'iris' ? 'iris' : id === 'sensor' ? 'detector' : id === 'cylindrical' || id === 'objective' || id === 'beamsplitter' ? id : 'lens';
  const optic = { ...foldedElement(kind, 'teaching-tool', x, y), diameter: 60, aperture: 50 };
  if (kind === 'lens') optic.focal = id === 'negative' ? -parameter : parameter;
  if (id === 'cylindrical') { optic.focal = parameter; optic.rollDeg = settings.rollDeg ?? 0; }
  if (id === 'objective') {
    const part = objectiveParts.find(p => p.manufacturer === 'Evident' && p.magnification === parameter) ?? objectiveParts[1];
    optic.objective = { ...part }; Object.assign(optic, objectiveDefaults(part));
  }
  if (id === 'mirror') optic.angleDeg = parameter;
  if (id === 'iris' || id === 'sensor') optic.aperture = parameter;
  if (id === 'block') { optic.angleDeg = 0; optic.reflectance = 0; optic.transmittance = 0; }
  scene.elements = id === 'post' ? [] : [optic];
  if (id === 'cylindrical' || id === 'objective') {
    const diameter = id === 'objective' ? 1 : 16;
    scene.source.diameter = diameter;
    scene.source.beam = { profile: 'uniform', diameterMinor: diameter, fullAngleMinor: 0, rotationDeg: 0 };
    const screenX = x + (settings.screenDistance ?? optic.focal);
    scene.bounds.maxX = Math.max(640, screenX + 40);
    scene.elements.push({ ...foldedElement('detector', 'teaching-screen', screenX, 0), diameter: 60, aperture: 50 });
  }
  if (id === 'beamsplitter') {
    optic.angleDeg = -45; optic.reflectance = parameter / 100; optic.transmittance = 1 - optic.reflectance;
    scene.elements.push({ ...foldedElement('detector', 'teaching-t', 600, 0), diameter: 60, aperture: 50 }, { ...foldedElement('detector', 'teaching-r', x, 200), angleDeg: 90, diameter: 60, aperture: 50 });
  }
  return scene;
}
export function componentResult(id: ToolId, x: number, y: number, parameter: number, settings: ComponentSettings = {}) {
  const scene = componentScene(id, x, y, parameter, settings);
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
