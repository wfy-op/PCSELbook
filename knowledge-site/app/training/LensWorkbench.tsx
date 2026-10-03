import { useId, useState } from 'react';
import { getLensPreset, lensPresets, traceLensSystem, type LensPreset, type LensSystem } from './lens-system';
import './lens-workbench.css';

const number = (n: number, digits = 2) => Math.abs(n) < 1e-8 ? '0' : n.toFixed(digits);
const signed = (n: number, digits = 1) => Math.abs(n) < 1e-8 ? '0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;

function WorkbenchControl({ label, value, min, max, step = 1, unit = 'mm', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onChange(Number(Math.max(min, Math.min(max, Math.round(Number(draft) / step) * step)).toFixed(4)));
    setDraft(null);
  };
  return <div className="lb-control"><div><label htmlFor={id}>{label}</label><span><input aria-label={`${label}数值`} type="number" value={draft ?? value} min={min} max={max} step={step} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit(); }} />{unit}</span></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => { setDraft(null); onChange(Number(event.target.value)); }} /><div className="lb-scale"><span>{min}</span><span>{max}</span></div></div>;
}

export function LensWorkbench({ initialPreset = 'kepler' }: { initialPreset?: LensPreset }) {
  const [preset, setPreset] = useState<LensPreset>(initialPreset);
  const [config, setConfig] = useState<LensSystem>(() => getLensPreset(initialPreset));
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [notice, setNotice] = useState('点击光路中的镜片，试着改变焦距与间距。');
  const result = traceLensSystem(config)!;
  const uid = `lb-${useId().replaceAll(':', '')}`;
  const selectPreset = (next: LensPreset) => { setPreset(next); setConfig(getLensPreset(next)); setSelected(0); setNotice('已载入理想预设。先观察光线，再改变一个参数。'); };
  const updateFocal = (focalLength: number) => setConfig(current => ({ ...current, focalLengths: current.focalLengths.map((f, index) => index === selected ? focalLength : f) }));
  const updateGap = (value: number) => setConfig(current => selected === 0 ? { ...current, sourceDistance: value } : { ...current, gaps: current.gaps.map((gap, index) => index === selected - 1 ? value : gap) });
  const addOrRemove = () => {
    if (config.focalLengths.length === 2) { setConfig(current => ({ ...current, focalLengths: [...current.focalLengths, 75], gaps: [...current.gaps, 120], targetDistance: 75 })); setSelected(2); setNotice('已加入 f = 75 mm 的第三片，目标面位于其后 75 mm。'); }
    else { setConfig(current => ({ ...current, focalLengths: current.focalLengths.slice(0, 2), gaps: current.gaps.slice(0, 1) })); setSelected(Math.min(selected, 1)); setNotice('已移除第三片；请重新检查目标面。'); }
  };
  const challenge = (kind: 'spacing' | 'target') => {
    const next = getLensPreset(preset);
    if (kind === 'spacing') { next.gaps[0] += 20; setNotice('挑战：预设的 L₁–L₂ 间距增加了 20 mm。观察出射方向，尝试恢复原来的功能。'); setSelected(1); }
    else { next.targetDistance += 35; setNotice(next.source === 'object' ? '挑战：目标面向后偏移了 35 mm。哪一个参数能找回同一物点的交会位置？' : preset === 'pump' ? '挑战：目标面向后偏移了 35 mm。试着把目标面移回平行入射光线的交会位置。' : '观察挑战：目标面后移了 35 mm。理想平行输出的光线范围会变化吗？'); }
    setConfig(next);
  };
  const x = (z: number) => 58 + 810 * z / result.targetZ;
  const amplitude = Math.max(4, ...result.rays.flatMap(ray => ray.points.map(point => Math.abs(point.y)))) * 1.28;
  const y = (height: number) => 174 - height / amplitude * 104;
  const yscale = (104 / amplitude).toFixed(1);
  const focusMarkers = result.lensPositions.flatMap((position, index) => [-1, 1].map(direction => ({ z: position + direction * Math.abs(config.focalLengths[index]), index, direction })).filter(marker => marker.z >= 0 && marker.z <= result.targetZ));
  const exactFunction = config.source === 'object' ? result.imagesOnTarget : result.afocal || result.collimatedFocusOnTarget;
  const heading = config.source === 'object'
    ? result.imagesOnTarget ? '两个物点，重新汇聚成两个像点' : '同一物点的光线还没有在目标面重合'
    : result.afocal ? `平行光输出 · ${number(Math.abs(result.afocalMagnification!), 2)} 倍几何扩束` : result.collimatedFocusOnTarget ? '平行入射光线在目标面交会' : '输出已不再平行，观察会聚与发散';
  const explanation = config.source === 'object'
    ? `每个物点在目标面的最大光线散布为 ${number(result.maxFamilySpread)} mm。${result.imagesOnTarget ? `成像倍率为 ${signed(result.imagingMagnification!, 2)}；负号表示倒像。` : '先区分镜组间距与像面位置，避免同时改变所有参数。'}`
    : result.afocal ? '此时系统 C = 0。移动目标面不会改变理想平行光束的几何范围；镜间距失配则会改变出射方向。'
      : result.collimatedFocusOnTarget ? '几何光线范围趋于零，是近轴模型的交点。它不代表真实光斑为零，也不能用来计算峰值功率或损伤。'
        : '镜片决定方向变化，传播距离决定高度变化。目标面上的范围随距离改变，不应直接当成扩束倍率。';
  const selectedFocal = config.focalLengths[selected];
  const magnitude = Math.abs(selectedFocal);
  const multiplier = config.source === 'object' ? result.imagingMagnification : result.afocalMagnification;
  return <section className="lb-workbench" aria-labelledby={`${uid}-title`}>
    <header className="lb-header"><div><span className="lb-kicker">LENS COMBINATION STUDIO</span><h3 id={`${uid}-title`}>从一束光，搭出一套系统</h3><p>选择一个任务，调整镜片与间距，让每一次变化都有可解释的结果。</p></div><span className="lb-badge"><i />实时近轴计算</span></header>
    <div className="lb-preset-tabs" role="group" aria-label="透镜组合预设">{(Object.keys(lensPresets) as LensPreset[]).map(key => <button key={key} className={preset === key ? 'lb-active' : ''} onClick={() => selectPreset(key)} aria-pressed={preset === key}><span>{lensPresets[key].name}</span><small>{lensPresets[key].subtitle}</small></button>)}</div>
    <div className="lb-body"><div className="lb-main">
      <div className="lb-diagram-head"><span><i className="lb-ray-key" />{config.source === 'collimated' ? '5 条平行入射光线' : '2 个物点，各 3 条光线'}</span><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(current => !current)}>{zoomed ? "还原全图" : "放大光路图"} <span aria-hidden="true">{zoomed ? "−" : "+"}</span></button></div>
      <div className={`lb-diagram-wrap ${zoomed ? "lb-zoomed" : ""}`} tabIndex={zoomed ? 0 : undefined} role={zoomed ? "region" : undefined} aria-label={zoomed ? "放大的光路图，可横向滚动" : undefined}>
        <svg viewBox="0 0 928 342" className="lb-diagram" role="img" aria-label={`${lensPresets[preset].name}可编辑光路，包含 ${config.focalLengths.length} 片透镜。所有光线完整展示，坐标自动缩放。`}>
          <defs><pattern id={`${uid}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#c6d3c4" /></pattern><linearGradient id={`${uid}-glass`}><stop offset="0" stopColor="#b8d3c5" stopOpacity=".6" /><stop offset=".5" stopColor="#f9fffa" stopOpacity=".7" /><stop offset="1" stopColor="#90b7a5" stopOpacity=".7" /></linearGradient></defs>
          <rect x="20" y="42" width="888" height="243" rx="12" fill="#f2f5ef" /><rect x="20" y="42" width="888" height="243" rx="12" fill={`url(#${uid}-grid)`} />
          <path d="M30 174H904" stroke="#a9baaa" strokeDasharray="5 5" />
          <text x="32" y="164" fill="#879a86" fontSize="10">y = 0</text>
          {focusMarkers.map(marker => <g key={`${marker.index}-${marker.direction}`}><path d={`M${x(marker.z)} 170v8`} stroke="#afc2b0" /><text x={x(marker.z)} y={198 + (marker.index % 2) * 12} textAnchor="middle" fontSize="9" fill="#8b9f88">F{marker.index + 1}{marker.direction < 0 ? '−' : '+'}</text></g>)}
          <path d={`M58 66V269`} stroke="#9aae98" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="58" y="27" fontSize="11" textAnchor="middle" fill="#526f4e">{config.source === 'collimated' ? '入射面' : '物面'}</text>
          {result.rays.map(ray => <polyline key={ray.id} points={ray.points.map(point => `${x(point.z)},${y(point.y)}`).join(' ')} fill="none" stroke={ray.family === -1 ? '#b69c4b' : '#dc7d46'} strokeWidth={ray.family === 0 && ray.id === 2 ? 1.3 : 1.7} opacity={ray.family === 0 && ray.id === 2 ? .4 : .82} />)}
          {config.source === 'object' && [-1, 1].map(family => <circle key={family} cx="58" cy={y(family * config.objectHeight)} r="4" fill={family === -1 ? '#b69c4b' : '#dc7d46'} />)}
          {result.lensPositions.map((position, index) => {
            const px = x(position);
            const positive = config.focalLengths[index] > 0;
            return <g key={index} role="button" tabIndex={0} aria-label={`编辑 L${index + 1}，焦距 ${config.focalLengths[index]} 毫米`} aria-pressed={selected === index} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }} className="lb-lens-button">
              <rect x={px - 17} y="66" width="34" height="202" rx="12" fill={selected === index ? '#dde9d766' : 'transparent'} stroke={selected === index ? '#80a076' : 'transparent'} strokeDasharray="3 4" />
              <path d={positive ? `M${px} 80Q${px - 22} 174 ${px} 257Q${px + 22} 174 ${px} 80Z` : `M${px - 10} 80Q${px + 3} 174 ${px - 10} 257L${px + 10} 257Q${px - 3} 174 ${px + 10} 80Z`} fill={`url(#${uid}-glass)`} stroke={selected === index ? '#3e694d' : '#70977c'} strokeWidth="1.8" />
              <text x={px} y={index % 2 === 0 ? 22 : 36} textAnchor="middle" fontSize="12" fill="#31533d">L{index + 1} · {signed(config.focalLengths[index], 0)} mm</text>
            </g>;
          })}
          <path d={`M868 61V271`} stroke="#526957" strokeWidth="3" />
          <text x="868" y="27" textAnchor="middle" fontSize="11" fill="#486245">目标面</text>
          {result.rays.map(ray => <circle key={ray.id} cx="868" cy={y(ray.points.at(-1)!.y)} r="3" fill={ray.family === -1 ? '#b69c4b' : '#dc7d46'} />)}
          {[0, ...result.lensPositions].map((position, index) => {
            const end = index < result.lensPositions.length ? result.lensPositions[index] : result.targetZ;
            return <g key={index}><path d={`M${x(position)} 297V305M${x(position)} 301H${x(end)}M${x(end)} 297V305`} stroke="#a8bca4" /><text x={(x(position) + x(end)) / 2} y={index % 2 ? 328 : 318} textAnchor="middle" fontSize="10" fill="#74896c">{number(end - position, 0)} mm</text></g>;
          })}
        </svg>
      </div>
      <div className="lb-diagram-note"><span>{zoomed ? "已放大 · 横向滚动查看，点击镜片可编辑" : "横纵坐标独立缩放 · 全部光线均显示"}</span><span>纵向范围 ±{number(amplitude, 1)} mm <span className="lb-screen-reader">；每毫米对应 {yscale} 个图像单位</span></span></div>
      <div className="lb-metrics"><div><span>目标面光线范围</span><strong>{number(result.targetSpan)}<small> mm</small></strong><em>最高 − 最低交点</em></div><div><span>输出倾角范围</span><strong>{signed(result.outputAngleMin * 1000)}<small> 至 </small>{signed(result.outputAngleMax * 1000)}</strong><em>mrad，相对光轴</em></div><div><span>入射面 → 目标面</span><strong>{number(result.targetZ, 0)}<small> mm</small></strong><em>沿光轴的总长度</em></div><div><span>{config.source === 'object' ? '成像倍率' : '无焦扩束倍率'}</span><strong>{multiplier === null ? '—' : `${config.source === 'object' ? signed(multiplier, 2) : number(Math.abs(multiplier), 2)}×`}</strong><em>{multiplier === null ? '当前不满足条件' : config.source === 'object' ? '目标面 B = 0' : '系统 C = 0'}</em></div></div>
      <div className={`lb-conclusion ${exactFunction ? 'lb-function-met' : ''}`} aria-live="polite"><span className="lb-conclusion-icon" aria-hidden="true">{exactFunction ? '✓' : '↗'}</span><div><strong>{heading}</strong><p>{explanation}</p></div></div>
      {result.maxAbsAngle > .1 && <p className="lb-angle-note">当前最大光线倾角为 {number(result.maxAbsAngle * 1000, 0)} mrad，已偏离本练习建议的小角范围；结果只保留线性模型含义，请减小光束/物点高度或增大焦距。</p>}
    </div><aside className="lb-editor" aria-label="透镜与目标面参数">
      <div className="lb-editor-title"><span>OPTICAL ELEMENT</span><button onClick={addOrRemove}>{config.focalLengths.length === 2 ? '+ 加一片' : '移除 L₃'}</button></div>
      <div className="lb-element-tabs" role="group" aria-label="选择透镜">{config.focalLengths.map((focalLength, index) => <button key={index} className={selected === index ? 'lb-selected' : ''} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>L{index + 1}</span><small>{focalLength > 0 ? '会聚' : '发散'}</small></button>)}</div>
      <div className="lb-lens-type" role="group" aria-label="透镜类型"><button aria-pressed={selectedFocal > 0} className={selectedFocal > 0 ? 'lb-type-active' : ''} onClick={() => updateFocal(magnitude)}>正透镜 ＋</button><button aria-pressed={selectedFocal < 0} className={selectedFocal < 0 ? 'lb-type-active' : ''} onClick={() => updateFocal(-magnitude)}>负透镜 −</button></div>
      <WorkbenchControl key={`focal-${selected}`} label={`L${selected + 1} 焦距绝对值`} value={magnitude} min={20} max={200} onChange={value => updateFocal(Math.sign(selectedFocal) * value)} />
      <WorkbenchControl key={`gap-${selected}`} label={selected === 0 ? '入射/物面 → L₁' : `L${selected} → L${selected + 1} 间距`} value={selected === 0 ? config.sourceDistance : config.gaps[selected - 1]} min={10} max={400} onChange={updateGap} />
      <div className="lb-editor-divider" /><WorkbenchControl label="末片 → 目标面" value={config.targetDistance} min={10} max={400} onChange={value => setConfig(current => ({ ...current, targetDistance: value }))} />
      <details className="lb-source-settings"><summary>入射条件 · {config.source === 'collimated' ? '平行光束' : '两个物点'}</summary><label>光源模型<select value={config.source} onChange={event => setConfig(current => ({ ...current, source: event.target.value as LensSystem['source'] }))}><option value="collimated">平行入射光束</option><option value="object">轴上物面的两个物点</option></select></label><WorkbenchControl label={config.source === 'collimated' ? '入射光束半宽' : '物点高度 ±h'} value={config.source === 'collimated' ? config.beamRadius : config.objectHeight} min={.5} max={4} step={.1} onChange={value => setConfig(current => config.source === 'collimated' ? { ...current, beamRadius: value } : { ...current, objectHeight: value })} /><p>{config.source === 'collimated' ? '5 条光线的入射倾角均为 0。' : '每个物点取 −20、0、+20 mrad 三条入射光线；目标面应按同一物点的光线是否重合来判断。'}</p></details>
      <button className="lb-reset" onClick={() => selectPreset(preset)}>↺ 恢复当前预设</button>
    </aside></div>
    <div className="lb-challenges"><div><strong>给光路一点扰动</strong><span>从当前预设重新载入一次变化</span></div><button onClick={() => challenge('spacing')}>镜距失配 +20 mm</button><button onClick={() => challenge('target')}>目标面后移 +35 mm</button></div>
    <p className="lb-notice" aria-live="polite">{notice}</p>
    <details className="lb-model"><summary>这套模型算了什么，以及没有算什么</summary><div className="lb-model-columns"><div><h4>两条规则，逐段追迹</h4><p>传播 d：y′ = y + dθ，θ′ = θ。通过薄透镜 f：y′ = y，θ′ = θ − y/f。长度单位 mm、角度单位 rad；正焦距会聚，负焦距发散。</p><p>系统矩阵 [A B; C D] 把入射面的 (y, θ) 映射到目标面。无焦条件 C = 0；点到点成像条件 B = 0。两片无焦镜组满足 d = f₁ + f₂，横向倍率 −f₂/f₁。4f 中继还需要物距 f₁、像距 f₂。</p></div><div><h4>几何教学，不是光斑预测软件</h4><p>图中每条线是一条计算光线。目标面的“范围”只统计这些光线的交点；没有计算高斯束腰、衍射、像差、透过率、功率或损伤阈值。</p><p>采用空气中无限口径、共轴薄透镜、小角模型，未计算截光。焦点 F 标记是单片的 ±|f| 参考位置，不是整个镜组的焦点。扩束后聚焦预设的所有参数均为教学设定，不对应真实泵浦平台。</p></div></div></details>
  </section>;
}
