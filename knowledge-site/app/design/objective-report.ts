import { objectiveReference, type ObjectiveModel } from './core/objective-model.ts';

const escape = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function objectiveReport(elements: readonly { name: string; focal: number; aperture: number; diameter: number; objective?: ObjectiveModel }[]) {
  const objectives = elements.filter(e => e.objective);
  if (!objectives.length) return '';
  return `<h2>物镜参考规格与等效模型</h2><div class="scroll"><table><thead><tr><th>名称</th><th>参考倍率</th><th>NA</th><th>WD / mm</th><th>设计筒镜 f / mm</th><th>当前等效 f / mm</th><th>当前模型孔径 / mm</th><th>规格来源</th></tr></thead><tbody>${objectives.map(e => {
    const m = e.objective!;
    const part = objectiveReference(m, e.focal, e.aperture, e.diameter);
    return `<tr><td>${escape(e.name)}</td><td>${m.magnification}×</td><td>${m.numericalAperture}</td><td>${m.workingDistance}</td><td>${m.tubeFocal}</td><td>${e.focal}</td><td>${e.aperture}</td><td>${part ? `<a href="${part.sourceUrl}">${part.sku}</a> · <a href="${part.tubeSourceUrl}">筒镜依据</a>` : '自定义等效参数'}</td></tr>`;
  }).join('')}</tbody></table></div><p>无限远校正、空气中的近轴等效主面：u′=u−h/f，标称 f=f筒镜/M，估算瞳径 D=2NAf。WD 是机械工作距离，不能代替焦距；模型外径为 25.4 mm（或更大瞳径）的遮挡范围假设，未还原镜筒和真实主面。未根据真实物镜处方计算高 NA 矢量场、盖玻片效应、物镜像差或材料色差。空间模式可另施加用户定义的瞳面 OPD 多项式，属于等效模型输入；顺序模式仍采用理想近轴主面。自定义后的参考倍率不表示当前组合的实际倍率。型号匹配不是实物认证。</p>`;
}
