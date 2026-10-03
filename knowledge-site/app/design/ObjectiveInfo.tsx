import { objectiveFocal, objectiveHalfAngle, objectiveParts, objectivePupil, objectiveReference, objectiveWarnings, type ObjectiveModel } from './objective-model';
import './objective-ui.css';

export function ObjectiveInfo({ model, focal, aperture, diameter, wavelength }: { model: ObjectiveModel; focal: number; aperture: number; diameter: number; wavelength: number }) {
  const reference = objectiveReference(model, focal, aperture, diameter);
  const template = objectiveParts.find(p => p.sku === model.catalogSku);
  return <section className="obj-info" aria-label="物镜规格与输入输出">
    <h3>{reference ? `${reference.sku} · 官方规格模板` : '自定义等效物镜'}</h3>
    <dl><div><dt>参考倍率</dt><dd>{model.magnification}×</dd></div><div><dt>数值孔径 NA</dt><dd>{model.numericalAperture}</dd></div><div><dt>工作距离 WD</dt><dd>{model.workingDistance} mm</dd></div><div><dt>配套筒镜焦距</dt><dd>{model.tubeFocal} mm</dd></div><div><dt>当前等效焦距</dt><dd>{focal} mm</dd></div><div><dt>估算后瞳直径</dt><dd>{objectivePupil(model).toFixed(2)} mm</dd></div><div><dt>空气中 NA 半角</dt><dd>{objectiveHalfAngle(model).toFixed(1)}°</dd></div></dl>
    <p>{template?.spectralLabel ?? '自定义规格，波段未核验'}。NA 用于估算瞳径；追迹仍按近轴关系计算。</p>
    {!reference && <p>当前 f 或孔径已自定义；参考倍率不再代表当前组合的成像倍率。</p>}
    {objectiveWarnings(model, wavelength).map(w => <p className="obj-warning" key={w}>{w}</p>)}
    <details><summary>物镜怎样改变光束</summary>
      <p>物方焦平面的点发出的光，经物镜变成准直束；平行光反向入射，可聚焦到样品侧。要把样品成像在相机上，还需加入筒镜并把探测面放在其像面。</p>
      <p>一阶关系：u′ = u − h/f；标称 f = f筒镜 / M = {model.tubeFocal} / {model.magnification} = {objectiveFocal(model)} mm。实际成像倍率为 −f筒镜 / f物镜。</p>
      <p>图上位置是等效主面，WD 是前端至样品的机械工作距离，不能用 WD 代替 f。外径默认 25.4 mm 是遮挡范围假设，未还原真实镜筒或主面位置。空间模式法线从样品侧指向筒镜侧。</p>
      <p>无限远校正物镜的多片结构、高 NA 全孔径成像、盖玻片、像差与色差未计算。小角度束可用于一阶搭建与对准；大角度请查看模型提示。</p>
    </details>
    {template && <p className="obj-source-links"><a href={template.sourceUrl} target="_blank" rel="noreferrer">官方产品页</a><a href={template.recordUrl} download>原始规格 JSON</a><a href={template.tubeSourceUrl} target="_blank" rel="noreferrer">倍率与筒镜依据</a></p>}
  </section>;
}
