import { useId, useMemo, useState } from 'react';
import { equipmentCategories, searchEquipment, type EquipmentCategory, type EquipmentItem } from './equipment-catalog';
import { OpticsIcon } from './OpticsIcon';
import './equipment-library.css';

function EquipmentDetails({ part, onPick }: { part: EquipmentItem; onPick: (id: string) => void }) {
  return <div className="eq-details">
    <span className="eq-badge">{part.badge}</span>
    <dl>{part.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>
    <p>{part.note}</p>
    <div className="eq-reference-links">
      {part.sourceUrl && <a href={part.sourceUrl} target="_blank" rel="noreferrer">官方规格</a>}
      {part.recordUrl && <a href={part.recordUrl} target="_blank" rel="noreferrer">原始记录</a>}
      {part.evidenceUrl && <a href={part.evidenceUrl} target="_blank" rel="noreferrer">参数依据</a>}
    </div>
    <button className="eq-add" aria-label={`加入 ${part.id}`} onClick={() => onPick(part.id)}><OpticsIcon name="arrowRight" size={16} />加入光路</button>
  </div>;
}

export function EquipmentLibrary({ onPick, prefix = 'folded', compact = false }: {
  onPick: (identifier: string) => void; prefix?: 'folded' | 'optics'; compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | null>('ideal');
  const [selected, setSelected] = useState<string | null>(null);
  const uid = `eq-${useId().replaceAll(':', '')}`;
  const matches = useMemo(() => searchEquipment(query), [query]);
  const searching = query.trim().length > 0;
  return <section className={`eq-library${compact ? ' eq-compact' : ''}`} aria-label="光学装备库">
    <div className="eq-heading"><h3>光学装备库</h3><span>{matches.length} 件</span></div>
    <label className="eq-search"><OpticsIcon name="search" size={16} /><input type="search" aria-label="搜索光学装备" placeholder="型号、焦距、波段" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} /></label>
    <p className="eq-hint">展开分类，查看参数后加入。也可直接拖入画布。</p>
    <div className="eq-groups">
      {equipmentCategories.map(group => {
        const parts = matches.filter(p => p.category === group.id);
        if (searching && !parts.length) return null;
        const open = searching || category === group.id;
        const groupId = `${uid}-${group.id}`;
        return <div className="eq-group" key={group.id}>
          <button className="eq-group-toggle" aria-expanded={open} aria-controls={groupId} onClick={() => { setCategory(open ? null : group.id); setSelected(null); }} disabled={searching}>
            <OpticsIcon name={group.icon} size={19} /><strong>{group.title}</strong><span>{parts.length}</span><OpticsIcon name="chevronDown" size={15} />
          </button>
          <div id={groupId} className="eq-group-items" hidden={!open}>
            {parts.map(part => {
              const chosen = selected === part.id;
              const itemId = `${uid}-item-${part.id}`;
              return <div className="eq-item" key={part.id}>
                <button className="eq-item-toggle" aria-expanded={chosen} aria-controls={itemId} draggable onDragStart={e => e.dataTransfer.setData('text/plain', `${prefix}:${part.id}`)} onClick={() => setSelected(chosen ? null : part.id)}>
                  <span><strong>{part.title}</strong><small>{part.subtitle}</small></span><OpticsIcon name="chevronDown" size={14} />
                </button>
                <div id={itemId} hidden={!chosen}><EquipmentDetails part={part} onPick={onPick} /></div>
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
    {!matches.length && <p className="eq-empty" role="status">没有匹配元件。请尝试型号片段、焦距或波段。</p>}
  </section>;
}
