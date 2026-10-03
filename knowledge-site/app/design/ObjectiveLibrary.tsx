import { objectiveFocal, objectiveParts } from './objective-model';
import { OpticsIcon } from './OpticsIcon';
import './objective-ui.css';

export function ObjectiveLibrary({ add, prefix, query = '' }: { add: (sku: string) => void; prefix: 'folded' | 'optics'; query?: string }) {
  const parts = objectiveParts.filter(p => `${p.sku} ${p.manufacturer} ${p.magnification} ${objectiveFocal(p)} 物镜`.toLowerCase().includes(query.toLowerCase()));
  return <section className="obj-library" aria-label="常用物镜库">
    <h3>常用物镜</h3><p>无限远校正 · 空气中使用</p>
    {parts.map(p => <div className="obj-library-row" key={p.sku}>
      <button aria-label={`加入物镜 ${p.sku}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', `${prefix}:${p.sku}`)} onClick={() => add(p.sku)}>
        <OpticsIcon name="objective" size={22} /><span><strong>{p.sku} <small>{p.magnification}×</small></strong><span>NA {p.numericalAperture.toFixed(2)} · WD {p.workingDistance} mm</span><span>等效 f {objectiveFocal(p)} mm</span></span>
      </button><a href={p.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${p.sku} 官方规格`}>规格</a>
    </div>)}
    {!parts.length && <p>没有匹配物镜，请换一个型号或焦距。</p>}
    <p>标称倍率需配套筒镜。波段与计算范围见选中后的参数说明。</p>
  </section>;
}
