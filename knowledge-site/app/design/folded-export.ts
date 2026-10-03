import { traceFoldedScene, type FoldedDetector, type FoldedScene } from './core/folded-engine.ts';
import { foldedLabels } from './folded-labels.ts';
import { objectiveReport } from './objective-report.ts';
import lensCatalog from '../training/thorlabs-catalog.json' with { type: 'json' };
import foldedCatalog from './folded-catalog.json' with { type: 'json' };

const escape = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const number = (value: number | null | undefined, precision = 4) => value === undefined || value === null || !Number.isFinite(value) ? '—' : value.toFixed(precision);
const lensLike = (kind: string) => ['lens', 'objective', 'cylindrical'].includes(kind);
export const foldedEngineeringFile = (scene: FoldedScene) => ({ format: 'pcsel-folded-optics', formatVersion: 1, scene });
export function parseFoldedEngineeringFile(input: unknown, parse: (value: unknown) => FoldedScene): FoldedScene {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('工程必须是 JSON 对象。');
  const file = input as Record<string, unknown>;
  if (file.format !== 'pcsel-folded-optics' || file.formatVersion !== 1) throw new Error('请导入空间折转工程；顺序工程可先使用“转为空间光路”。');
  return parse(file.scene);
}

/** One source row plus the complete prescription retains the phase-space inputs. */
export function foldedCsv(scene: FoldedScene) {
  const cell = (value: unknown) => `"${String(value).replace(/^[=+@-](?!\d)/, "'$&").replaceAll('"', '""')}"`;
  const labels = foldedLabels(scene), beam = scene.source.beam;
  const headers = ['标记', '名称', '类型', 'x_mm', 'y_mm', '法线方向_deg', '模型外径_mm', '模型孔径_mm', '焦距_mm', '反射率R', '透射率T', '参考倍率', 'NA', '工作距离WD_mm', '设计筒镜f_mm', '次轴焦距_mm', '瞳面滚转_deg', '球差OPD系数_um', '彗差OPD系数_um', '像散OPD系数_um', '光源分布', '光源主轴直径_mm', '光源次轴直径_mm', '主轴发散全角_mrad', '次轴发散全角_mrad', '光斑旋转_deg', '请求采样数', '输入相对功率_au', '波长_nm'];
  const source = ['S', '光源', 'source', scene.source.x, scene.source.y, scene.source.directionDeg, '', '', '', '', '', '', '', '', '', '', '', '', '', '', beam?.profile ?? scene.source.model, scene.source.diameter, beam?.diameterMinor ?? '', scene.source.fullAngle, beam?.fullAngleMinor ?? '', beam?.rotationDeg ?? '', scene.source.rayCount, scene.source.intensity, scene.source.wavelength];
  const rows = [headers, source, ...scene.elements.map(e => [labels.get(e.id)!.tag, e.name, e.kind, e.x, e.y, e.angleDeg, e.diameter, e.aperture, lensLike(e.kind) ? e.focal : '', e.reflectance, e.transmittance, e.objective?.magnification ?? '', e.objective?.numericalAperture ?? '', e.objective?.workingDistance ?? '', e.objective?.tubeFocal ?? '', lensLike(e.kind) ? e.focalSagittal === null ? '无光焦度' : e.focalSagittal ?? e.focal : '', lensLike(e.kind) ? e.rollDeg ?? 0 : '', e.aberration?.sphericalUm ?? '', e.aberration?.comaUm ?? '', e.aberration?.astigmatismUm ?? '', ...Array<string>(9).fill('')])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}

function sourceDescription(scene: FoldedScene, actualCount: number): string {
  const source = scene.source, beam = source.beam;
  const shape = beam ? `${beam.profile === 'gaussian' ? 'Gaussian 椭圆分布' : '均匀椭圆分布'}；主轴 / 次轴直径 ${number(source.diameter)} / ${number(beam.diameterMinor)} mm；独立主轴 / 次轴发散全角 ${number(source.fullAngle)} / ${number(beam.fullAngleMinor)} mrad；光斑旋转 ${number(beam.rotationDeg)}°。${beam.profile === 'gaussian' ? '直径与发散全角采用 1/e² 强度定义，单轴 σ = 全宽 / 4。' : '直径与发散全角为均匀椭圆分布的完整边界宽度。'}位置与角度由独立的低差异样本计算，未指定 Gaussian q 或衍射传播。` : `源孔径 ${number(source.diameter)} mm；发散全角 ${number(source.fullAngle)} mrad；${source.model === 'fan' ? '相关扇形' : '扩展源'}原一维采样。该工程没有完整第二横轴输入，一维分箱不能解释为实物二维强度。`;
  return `<p>中心 (${number(source.x)}, ${number(source.y)}) mm；传播方向 ${number(source.directionDeg)}°；${shape}</p><p>请求采样数 ${source.rayCount}；实际采样数 ${actualCount}；输入相对功率 ${number(source.intensity)} a.u.；波长 ${number(source.wavelength)} nm（波长不自动产生镀膜色散或衍射斑）。</p>`;
}

/** The same pixel/mm scale on both axes preserves the physical spot aspect. */
export function foldedSpotSvg(detector: FoldedDetector, label: string): string {
  const grid = detector.spot.grid, n = grid.size;
  const scale = Math.min(320 / (2 * grid.extentU), 240 / (2 * grid.extentV));
  const width = 2 * grid.extentU * scale, height = 2 * grid.extentV * scale;
  const x0 = 70 + (320 - width) / 2, y0 = 20 + (240 - height) / 2;
  const max = Math.max(0, ...grid.irradiance);
  const cells = grid.power.map((power, index) => {
    if (!power) return '';
    const level = max > 0 ? Math.sqrt(grid.irradiance[index] / max) : 0;
    const color = `rgb(${Math.round(8 + level * 245)},${Math.round(22 + level * 194)},${Math.round(30 + level * 62)})`;
    const x = x0 + index % n * width / n, y = y0 + (n - 1 - Math.floor(index / n)) * height / n;
    return `<rect x="${x}" y="${y}" width="${width / n}" height="${height / n}" fill="${color}" data-bin-index="${index}" data-bin-power="${power}" data-bin-density="${grid.irradiance[index]}"><title>格权重 ${power} a.u.；分箱密度 ${grid.irradiance[index]} a.u./mm²</title></rect>`;
  }).join('');
  return `<svg class="beam-heatmap" viewBox="0 0 440 320" role="img" aria-label="${escape(label)} 实际接收光线的等比例分箱密度" data-grid-size="${n}" data-extent-u-mm="${grid.extentU}" data-extent-v-mm="${grid.extentV}" data-px-per-mm-u="${scale}" data-px-per-mm-v="${scale}" data-integrated-power="${grid.integratedPower}"><rect x="70" y="20" width="320" height="240" fill="#edf2ed" /><rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#08161e" />${cells}<path d="M${x0} ${y0 + height + 7}H${x0 + width}M${x0 - 7} ${y0}V${y0 + height}" stroke="#537166" fill="none" /><text x="70" y="287" fill="#3e5e51" font-size="12">u 范围 ±${number(grid.extentU, 6)} mm</text><text x="70" y="306" fill="#3e5e51" font-size="12">v 范围 ±${number(grid.extentV, 6)} mm · 两轴相同 px/mm</text></svg>`;
}

function profileSvg(detector: FoldedDetector, axis: 'u' | 'v', label: string): string {
  const grid = detector.spot.grid, n = grid.size, extent = axis === 'u' ? grid.extentU : grid.extentV;
  const binWidth = 2 * extent / n;
  const values = Array.from({ length: n }, (_, index) => axis === 'u' ? grid.power.reduce((sum, power, i) => i % n === index ? sum + power : sum, 0) / binWidth : grid.power.slice(index * n, (index + 1) * n).reduce((sum, power) => sum + power, 0) / binWidth);
  const max = Math.max(0, ...values), points = values.map((value, i) => `${50 + (i + .5) / n * 350},${125 - (max ? value / max : 0) * 95}`).join(' ');
  return `<svg class="beam-profile" viewBox="0 0 440 170" role="img" aria-label="${escape(label)} ${axis} 轴实际积分强度剖面" data-axis="${axis}" data-extent-mm="${extent}" data-bin-width-mm="${binWidth}" data-density-values="${escape(JSON.stringify(values))}"><path d="M50 25V125H400" stroke="#b5c9bb" fill="none" /><polyline points="${points}" stroke="${axis === 'u' ? '#227557' : '#9b691e'}" stroke-width="2" fill="none" /><text x="50" y="18" fill="#3e5e51" font-size="12">${axis} 积分密度 / a.u./mm · 峰值 ${number(max, 5)}</text><text x="50" y="148" fill="#3e5e51" font-size="11">−${number(extent, 6)}</text><text x="390" y="148" text-anchor="end" fill="#3e5e51" font-size="11">+${number(extent, 6)} mm</text><text x="213" y="165" fill="#3e5e51" font-size="11">${axis} / mm</text></svg>`;
}

function detectorPlots(detector: FoldedDetector, label: string): string {
  const spot = detector.spot, grid = spot.grid;
  const zero = spot.rms2D !== null && spot.rms2D < 1e-9;
  return `<section class="detector-plots"><h3>${escape(label)} · 接收光斑</h3>${detector.power > 0 ? `<div class="spot-layout">${foldedSpotSvg(detector, label)}<div>${profileSvg(detector, 'u', label)}${profileSvg(detector, 'v', label)}</div></div>` : '<p>该探测器没有接收样本，未绘制光斑或强度曲线。</p>'}<p>分箱 ${grid.size} × ${grid.size}；网格内积分 ${number(grid.integratedPower, 8)} a.u.；网格之外 ${number(grid.outsidePower, 8)} a.u.。颜色按本图峰值进行平方根显示映射；数值保持实际样本权重 / 网格面积，剖面为实际单轴积分密度。${zero ? '<strong>几何光斑接近零：有限网格是数值可视化，不是衍射焦斑，也不代表实物具有无限辐照度。</strong>' : '图形为几何采样密度，不是相干衍射 PSF 或实测光束。'}</p></section>`;
}

function sourceRecords(): string {
  const download = (data: unknown) => `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
  return `<h2>元件库来源与参数依据</h2><p>报告保留工程中实际使用的可编辑模型参数；元件名称和目录匹配不构成实物或制造商处方认证。名义焦距、镜片外径、镀膜等目录字段与有效孔径、理想 R/T、瞳面 OPD 等模型设定分别处理。</p><ul><li>球面 / 消色差透镜：本地保存的官方产品标题记录；<a download="thorlabs-lens-catalog.json" href="${download(lensCatalog)}">下载本报告嵌入的目录数据</a>。默认通光孔径为外径 90% 的教学假设；未取得厂家厚度、BFL 或完整 ZMX 处方。</li><li>折转 / 分光元件：<a download="folded-reference-catalog.json" href="${download(foldedCatalog)}">下载本报告嵌入的来源与模型依据</a>；50/50 等 R/T 为可编辑理想系数。</li><li>柱透镜：LJ1695RM-A（50 mm）、LJ1567RM-A（100 mm）、LJ1653RM-B（200 mm）；官方产品标题核对焦距、Ø25.4 mm 和镀膜波段，<a href="https://www.thorlabs.com/catalogpages/V21/764.PDF">官方历史目录</a>记录通光孔径 &gt;21 mm，模型采用保守下界 21 mm。<a href="https://www.thorlabs.com/item/lj1695rm-a">LJ1695RM-A</a> · <a href="https://www.thorlabs.com/item/lj1567rm-a">LJ1567RM-A</a> · <a href="https://www.thorlabs.com/item/lj1653rm-b">LJ1653RM-B</a>；厚度、支架外径和多面玻璃处方未进入追迹。</li><li>物镜规格、筒镜关系与当前等效参数见本报告物镜表；无物镜时该表省略。所有球差、彗差、像散 OPD 系数均为用户模型输入，不能从上述标称焦距反推厂家实测像差。</li></ul>`;
}

export function foldedReport(scene: FoldedScene, diagram: string) {
  const result = traceFoldedScene(scene), labels = foldedLabels(scene);
  const named = (id: string) => labels.get(id)?.label ?? id;
  const prescription = scene.elements.map(e => `<tr><td>${escape(named(e.id))} / ${escape(e.kind)}</td><td>${number(e.x)}</td><td>${number(e.y)}</td><td>${number(e.angleDeg)}</td><td>${number(e.diameter)}</td><td>${number(e.aperture)}</td><td>${lensLike(e.kind) ? number(e.focal) : '—'}</td><td>${lensLike(e.kind) ? e.focalSagittal === null ? '无光焦度' : number(e.focalSagittal ?? e.focal) : '—'}</td><td>${lensLike(e.kind) ? number(e.rollDeg ?? 0) : '—'}</td><td>${number(e.reflectance)}</td><td>${number(e.transmittance)}</td><td>${number(e.aberration?.sphericalUm ?? 0)} / ${number(e.aberration?.comaUm ?? 0)} / ${number(e.aberration?.astigmatismUm ?? 0)}</td></tr>`).join('');
  const detectorRows = result.detectors.map(d => `<tr><td>${escape(named(d.elementId))}</td><td>${number(d.power)}</td><td>${result.energy.input > 0 ? number(d.power / result.energy.input * 100, 2) + '%' : '—'}</td><td>${d.rayCount}</td><td>${number(d.spot.centroidU, 6)} / ${number(d.spot.centroidV, 6)}</td><td>${number(d.spot.rmsU, 6)} / ${number(d.spot.rmsV, 6)}</td><td>${number(d.spot.rms2D, 6)}</td><td>${number(d.spot.principalRmsMajor, 6)} / ${number(d.spot.principalRmsMinor, 6)}</td><td>${number(d.spot.orientationDeg, 3)}</td><td>${number(d.span)}</td><td>${number(d.angleRms)}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(scene.name)} · 空间光路设计记录</title><style>body{margin:0;background:#f4f5ef;color:#29483b;font:15px/1.75 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:32px auto;padding:32px;background:white;border-radius:12px}h1{font-size:28px}h2{font-size:20px;margin-top:30px}h3{font-size:16px}.meta{color:#5d7467}.metrics{display:flex;gap:24px;flex-wrap:wrap}.metrics strong{font-size:22px}svg{width:100%;height:auto;fill:none;stroke:none}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}th,td{padding:9px;text-align:left;border-bottom:1px solid #dbe5dc}.note{background:#eef4ec;padding:16px}a{color:#256d51;text-underline-offset:3px}pre{font:12px/1.6 monospace;white-space:pre-wrap;overflow-wrap:anywhere}.spot-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:16px}.detector-plots{margin:26px 0;border-top:1px solid #dbe5dc;padding-top:10px}.detector-plots p{font-size:12px;line-height:1.7}@media(max-width:650px){main{margin:0;padding:18px}.spot-layout{grid-template-columns:1fr}}@media print{body{background:white}main{margin:0;padding:0}button{display:none}.detector-plots{break-inside:avoid}}</style></head><body><main><p class="meta">PCSELbook · 平面布局与双横轴几何采样 · ${escape(new Date().toISOString())}</p><h1>${escape(scene.name)}</h1><div class="metrics"><p>输入功率<br><strong>${number(result.energy.input)}</strong></p><p>探测器接收<br><strong>${number(result.energy.captured)}</strong></p><p>离开计算范围<br><strong>${number(result.energy.escaped)}</strong></p><p>吸收 / 截光<br><strong>${number(result.energy.absorbed)}</strong></p><p>未完成追迹<br><strong>${number(result.energy.unresolved)}</strong></p></div>${diagram}<h2>光源与采样定义</h2>${sourceDescription(scene, result.sourceRayCount)}<h2>空间元件表</h2><div class="scroll"><table><thead><tr><th>名称 / 类型</th><th>x / mm</th><th>y / mm</th><th>法线 / °</th><th>外径 / mm</th><th>孔径 / mm</th><th>主轴 f / mm</th><th>次轴 f / mm</th><th>瞳面滚转 / °</th><th>R</th><th>T</th><th>球差 / 彗差 / 像散 OPD 系数 / µm</th></tr></thead><tbody>${prescription}</tbody></table></div>${objectiveReport(scene.elements)}<h2>探测器分支结果</h2><div class="scroll"><table><thead><tr><th>探测器</th><th>接收功率 / a.u.</th><th>占输入</th><th>到达采样数</th><th>质心 u / v / mm</th><th>RMS u / v / mm</th><th>二维 RMS / mm</th><th>主轴 RMS 长 / 短 / mm</th><th>长轴方位 / °</th><th>原 u 轴范围 / mm</th><th>布局角度 RMS / mrad</th></tr></thead><tbody>${detectorRows}</tbody></table></div><p>能量闭合残差：${number(result.energy.balanceError, 10)}。未完成追迹功率不归入吸收或接收。</p>${result.detectors.map(d => detectorPlots(d, named(d.elementId))).join('')}<h2>模型范围与像差定义</h2><p class="note">计算采用平面布局中的实际几何反射、分光分支、双横轴自由传播及理想近轴主平面。椭圆源位置与发散角独立采样，Gaussian 密度表示输入采样分布，不包含 Gaussian q、衍射、相干叠加或偏振。柱透镜以两个主方向的光焦度及滚转角建模；次轴焦距为空表示该轴无光焦度。R/T 是非相干功率系数，R+T≤1；镀膜色散、玻璃厚度、多面折射与材料色差未计算。</p><p>用户瞳面 OPD 模型：W = Sρ⁴ + Cξρ² + A(ξ²−η²)，其中 ξ=u/a、η=v/a、a 为通光孔径半径、ρ²=ξ²+η²；S/C/A 单位 µm。传播方向由实际波前斜率校正。这些系数并非 Zernike 标准化 RMS、厂家实测像差或完整实物处方。二维 RMS 为关于实际接收质心的几何径向统计，不是衍射极限斑尺寸。薄平面局部角度过大时请按警告限制使用。</p>${sourceRecords()}${result.warnings.length ? `<h2>本次计算警告</h2><ul>${result.warnings.map(w => `<li>${escape(w)}</li>`).join('')}</ul>` : ''}<details><summary>完整工程 JSON</summary><pre>${escape(JSON.stringify(foldedEngineeringFile(scene), null, 2))}</pre></details><button onclick="window.print()">打印记录</button></main></body></html>`;
}
