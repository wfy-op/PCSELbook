import { useId, useState } from 'react';
import { thinLens, traceAlignment } from './optics';
import './interactives.css';

const signed = (n: number, digits = 2) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;

function Control({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(Number(Math.min(max, Math.max(min, Math.round(Number(draft) / step) * step)).toFixed(6)));
    setDraft(null);
  };
  return <div className="ob-control">
    <div className="ob-control-heading"><label htmlFor={`${id}-range`}>{label}</label><span><input aria-label={`${label}数值`} type="number" value={draft ?? value} min={min} max={max} step={step} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /><span>{unit}</span></span></div>
    <input id={`${id}-range`} type="range" value={value} min={min} max={max} step={step} onChange={e => { setDraft(null); onChange(Number(e.target.value)); }} />
    <div className="ob-control-scale"><span>{min}</span><span>{max} {unit}</span></div>
  </div>;
}

function Target({ title, value, illuminated }: { title: string; value: number; illuminated: boolean }) {
  const id = useId().replaceAll(':', '');
  const cy = 61 - Math.max(-1.25, Math.min(1.25, value)) * 35;
  return <div className="ob-target">
    <div><span>{title}</span><strong>{signed(value)} <small>mm</small></strong></div>
    <svg viewBox="0 0 132 122" role="img" aria-label={`${title}：几何偏心 ${signed(value)} 毫米，${illuminated ? '有光到达' : '上游截光，无光到达'}`}>
      <defs><pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e8ecea" strokeWidth=".7" /></pattern></defs>
      <rect x="6" y="6" width="120" height="110" rx="8" fill={`url(#${id})`} />
      <circle cx="66" cy="61" r="35" fill="#f9faf7" stroke="#b6c7c2" /><circle cx="66" cy="61" r="17.5" fill="#fff" stroke="#597b71" />
      <path d="M21 61H111M66 16V106" stroke="#a3b8b1" strokeDasharray="3 3" />
      <circle cx="66" cy={cy} r="5" fill={illuminated ? '#dd6837' : 'none'} stroke="#dd6837" strokeWidth="2" strokeDasharray={illuminated ? undefined : '3 2'} />
      {Math.abs(value) > 1.25 && <text x="80" y={value > 0 ? 22 : 105} fontSize="10" fill="#b2552b">超出图框</text>}
    </svg>
    <p>{illuminated ? Math.abs(value) <= .5 ? '穿过孔径' : '照在光阑上' : '上游截光 · 虚线为几何预测'}</p>
  </div>;
}

const challenges = [
  { name: '起步挑战', offset: 1.4, angle: 1 },
  { name: '反向偏移', offset: -1.1, angle: 1.2 },
  { name: '位置与角度', offset: 0.8, angle: -2.4 },
];

export function AlignmentLab() {
  const [challenge, setChallenge] = useState(0);
  const [mirror1, setMirror1] = useState(0);
  const [mirror2, setMirror2] = useState(0);
  const [hint, setHint] = useState(false);
  const [mode, setMode] = useState<'guided' | 'challenge'>('guided');
  const scene = challenges[challenge];
  const ray = traceAlignment(scene.offset, scene.angle, mirror1, mirror2)!;
  const clipId = `align-${useId().replaceAll(':', '')}`;
  const x = (s: number) => 48 + s * .73;
  const y = (p: number) => 110 - p * 14;
  const endS = !ray.mirror1Hit ? 0 : !ray.mirror2Hit ? 250 : !ray.nearPass ? 350 : 850;
  const points = [[0, scene.offset], ...(endS >= 250 ? [[250, ray.mirror2]] : []), ...(endS >= 350 ? [[350, ray.near]] : []), ...(endS >= 850 ? [[850, ray.far]] : [])];
  const reset = () => { setMirror1(0); setMirror2(0); setHint(false); };
  return <section className="ob-lab" aria-labelledby={`${clipId}-title`}>
    <div className="ob-lab-heading"><div><span className="ob-eyebrow">INTERACTIVE 01 / 光轴对准</span><h3 id={`${clipId}-title`}>让光束，穿过两个参考点</h3><p>只看一个光斑还不够。试着调节两面镜子，让近点和远点同时居中。</p></div><span className="ob-model-badge">计算练习</span></div>
    <div className="ob-lab-tabs" role="group" aria-label="练习模式"><button className={mode === 'guided' ? 'ob-selected' : ''} onClick={() => setMode('guided')} aria-pressed={mode === 'guided'}>引导练习</button><button className={mode === 'challenge' ? 'ob-selected' : ''} onClick={() => { setMode('challenge'); setHint(false); }} aria-pressed={mode === 'challenge'}>独立挑战</button></div>
    <div className="ob-alignment-layout">
      <div className="ob-lab-visual">
        <div className="ob-plot-caption"><span>展开光路 · 单平面</span><span>橙色：光线 · 虚线：目标光轴</span></div>
        <svg className="ob-beam-chart" viewBox="0 0 720 208" role="img" aria-label="两面镜与两个光阑的展开光路。实际光线在首个截光位置停止。纵向偏差已放大。">
          <defs><clipPath id={clipId}><rect x="25" y="27" width="677" height="143" /></clipPath></defs>
          <rect x="25" y="27" width="677" height="143" rx="10" fill="#f1f5f1" /><path d="M25 110H702" stroke="#89a79a" strokeDasharray="5 5" />
          {[0, 250, 350, 850].map((s, i) => <g key={s}><path d={`M${x(s)} 35V167`} stroke="#d6e1da" /><text x={x(s)} y="20" textAnchor="middle" fontSize="12" fill="#284f45">{['M₁', 'M₂', '近光阑', '远光阑'][i]}</text><text x={x(s)} y="192" textAnchor="middle" fontSize="11" fill="#64776e">{s} mm</text></g>)}
          <g clipPath={`url(#${clipId})`}>
            {[0, 250].map(s => <path key={s} d={`M${x(s) - 5} 46L${x(s) + 5} 46V169H${x(s) - 5}Z`} fill="#648c7c" opacity=".45" />)}
            {[350, 850].map(s => <g key={s}><path d={`M${x(s)} 38V103M${x(s)} 117V170`} stroke="#2f594b" strokeWidth="7" /><circle cx={x(s)} cy="110" r="9" fill="none" stroke="#8cb3a1" /></g>)}
            <polyline points={points.map(([s, p]) => `${x(s)},${y(p)}`).join(' ')} fill="none" stroke="#e47a43" strokeWidth="3" strokeLinejoin="round" />
            <circle cx={x(endS)} cy={y(endS === 0 ? scene.offset : endS === 250 ? ray.mirror2 : endS === 350 ? ray.near : ray.far)} r="4.5" fill="#e47a43" />
          </g>
        </svg>
        <div className="ob-target-grid"><Target title="近点 · 350 mm" value={ray.near} illuminated={ray.mirror2Hit} /><Target title="远点 · 850 mm" value={ray.far} illuminated={ray.nearPass} /></div>
        <p className="ob-plot-note">纵向偏差放大；孔径半径 0.50 mm，光斑按无宽度光线处理。靶图圆孔与坐标按比例绘制。</p>
      </div>
      <div className="ob-lab-controls">
        <div className="ob-control-intro"><span className="ob-small-label">当前场景</span><strong>{scene.name}</strong><p>入射位置 {signed(scene.offset)} mm；入射角 {signed(scene.angle)} mrad。</p></div>
        <Control label="M₁ 镜面转角" value={mirror1} min={-8} max={8} step={.01} unit="mrad" onChange={setMirror1} />
        <Control label="M₂ 镜面转角" value={mirror2} min={-8} max={8} step={.01} unit="mrad" onChange={setMirror2} />
        <div className={`ob-lab-status ${ray.aligned ? 'ob-status-success' : ''}`} aria-live="polite"><strong>{ray.aligned ? '✓ 两点都已居中' : !ray.mirror2Hit ? '光线未落在第二面镜上' : !ray.nearPass ? '先找回近点的透射光' : !ray.farPass ? '近点有光，继续检查远点' : '已穿过双孔，再向中心靠近'}</strong><p>{ray.aligned ? '两点偏心均 ≤ 0.10 mm。试着解释：为什么一个参考点无法确定一条光轴？' : '居中判据：近点、远点偏心均 ≤ 0.10 mm。这是本练习设定，不是实验平台验收值。'}</p></div>
        <div className="ob-lab-actions"><button onClick={reset}>重置旋钮</button><button onClick={() => { setChallenge((challenge + 1) % challenges.length); reset(); }}>换个挑战 ↗</button></div>
      </div>
    </div>
    {mode === 'guided' && <div className="ob-guidance"><strong>试一试这个顺序</strong><p>① 调 M₁，让近点更靠近中心；② 调 M₂，让远点更靠近中心；③ 返回近点复查，小幅交替调整。旋钮有耦合，一次通常无法完成。</p></div>}
    <details className="ob-model-details"><summary>为什么会这样？查看计算与边界</summary><p>令沿展开光路的距离为 s，向上为正。仅讨论同一入射平面内的小角变化，正镜转角定义为使展开光线斜率增加。M₁ 后斜率 a₁ = (α₀ + 2δ₁) / 1000；M₂ 后 a₂ = a₁ + 2δ₂ / 1000。镜角以 mrad 输入，位置 y(s) = y₀ + a₁s + 2δ₂(s − 250) / 1000（s ≥ 250）。</p><p>这里的 2δ 只用于上述单平面模型；真实镜架的两轴方向和耦合须在现场确认。假设镜面半口径 8 mm、零宽光线，未包含衍射、光斑大小、像差、机械回差或真实三维折转。</p><button className="ob-text-button" onClick={() => setHint(!hint)}>{hint ? '收起解题提示' : '查看几何解题提示'}</button>{hint && <p className="ob-answer">让 M₂ 处的光线位置为零，再让出射斜率为零：本场景 δ₁ = {signed((-scene.offset / 250 * 1000 - scene.angle) / 2)} mrad，δ₂ = {signed(scene.offset / 250 * 1000 / 2)} mrad。</p>}</details>
  </section>;
}

export function LensLab() {
  const [u, setU] = useState(180);
  const [f, setF] = useState(75);
  const [screen, setScreen] = useState(220);
  const lens = thinLens(u, f, screen)!;
  const clipId = `lens-${useId().replaceAll(':', '')}`;
  const origin = 340;
  const scale = .68;
  const x = (distance: number) => origin + distance * scale;
  const baseline = 158;
  const height = 44;
  const endX = 660;
  const inFrame = lens.v !== null && x(lens.v) >= 24 && x(lens.v) <= 790 && Math.abs(lens.magnification! * height) <= 114;
  const lineEndY = baseline - height + height * endX / f;
  const centralEndY = baseline + height * endX / u;
  const reachable = lens.kind === 'real' && lens.v! >= 60 && lens.v! <= 600;
  const focused = reachable && lens.focused;
  const focusText = lens.kind === 'infinite' ? '物体位于焦平面 · 出射光平行' : lens.kind === 'virtual' ? '正立虚像 · 无法用右侧屏幕承接' : focused ? '✓ 屏幕已接近理想像面' : '移动屏幕，寻找理想像面';
  return <section className="ob-lab" aria-labelledby={`${clipId}-title`}>
    <div className="ob-lab-heading"><div><span className="ob-eyebrow">INTERACTIVE 02 / 单透镜成像</span><h3 id={`${clipId}-title`}>先预测，再移动屏幕</h3><p>改变物距与焦距，观察像的位置和方向。你能把屏幕放到清晰成像的位置吗？</p></div><span className="ob-model-badge">理想薄透镜</span></div>
    <div className="ob-lens-layout"><div className="ob-lab-visual">
      <div className="ob-plot-caption"><span>光线追迹 · 非等比例示意</span><span>实线：光线 · 虚线：反向延长</span></div>
      <svg className="ob-lens-chart" viewBox="0 0 812 298" role="img" aria-label={`薄透镜光路。物距 ${u} 毫米，焦距 ${f} 毫米。${lens.v === null ? '像在无穷远' : `像距 ${lens.v.toFixed(1)} 毫米`}`}>
        <defs><clipPath id={clipId}><rect x="24" y="34" width="766" height="235" /></clipPath></defs>
        <rect x="24" y="34" width="766" height="235" rx="12" fill="#f1f5f1" /><path d={`M24 ${baseline}H790`} stroke="#a2b5a8" strokeDasharray="5 5" />
        <g clipPath={`url(#${clipId})`}>
          <path d={`M${x(-u)} ${baseline - height}H${origin}L${x(endX)} ${lineEndY}`} stroke="#e17a42" strokeWidth="2" fill="none" />
          <path d={`M${x(-u)} ${baseline - height}L${x(endX)} ${centralEndY}`} stroke="#bd9e4b" strokeWidth="2" fill="none" />
          {lens.kind === 'virtual' && <g strokeDasharray="5 4" fill="none"><path d={`M${origin} ${baseline - height}L${x(Math.max(-660, lens.v!))} ${baseline - height + height * Math.max(-660, lens.v!) / f}`} stroke="#e17a42" /><path d={`M${origin} ${baseline}L${x(Math.max(-660, lens.v!))} ${baseline + height * Math.max(-660, lens.v!) / u}`} stroke="#bd9e4b" /></g>}
          <path d={`M${origin} 55Q${origin - 24} ${baseline} ${origin} 252Q${origin + 24} ${baseline} ${origin} 55Z`} fill="#d1e5df" fillOpacity=".7" stroke="#628e7e" strokeWidth="2" />
          <path d={`M${x(-u)} ${baseline}V${baseline - height}m-6 8 6-8 6 8`} stroke="#244d40" strokeWidth="3" fill="none" />
          <path d={`M${x(screen)} 52V250`} stroke="#667976" strokeWidth="5" />
          {inFrame && <path d={`M${x(lens.v!)} ${baseline}V${baseline - lens.magnification! * height}m-6 ${lens.magnification! > 0 ? 8 : -8} 6 ${lens.magnification! > 0 ? -8 : 8} 6 ${lens.magnification! > 0 ? 8 : -8}`} stroke="#d26536" strokeWidth="3" strokeDasharray={lens.kind === 'virtual' ? '4 3' : undefined} fill="none" />}
          {[-f, f].map(distance => <g key={distance}><circle cx={x(distance)} cy={baseline} r="3.5" fill="#658d7a" /><text x={x(distance)} y={baseline + 18} textAnchor="middle" fontSize="12" fill="#456555">F</text></g>)}
        </g>
        <text x={x(-u)} y="23" textAnchor="middle" fontSize="12" fill="#294e41">物体</text><text x={origin} y="23" textAnchor="middle" fontSize="12" fill="#294e41">透镜</text><text x={x(screen)} y="23" textAnchor="middle" fontSize="12" fill="#596c65">屏幕</text>
        <text x="30" y="289" fontSize="11" fill="#657c70">{lens.kind === 'infinite' ? '焦点物体的两条出射光线互相平行；有限距离无清晰像面。' : inFrame ? `橙色箭头：${lens.kind === 'real' ? '倒立实像' : '正立虚像'}。` : '像位于图框之外；以下方计算数值为准。'}</text>
      </svg>
      <div className="ob-lens-results"><div><span>理想像距 v</span><strong>{lens.v === null ? '∞' : Math.abs(lens.v) > 99999 ? lens.v.toExponential(2) : lens.v.toFixed(1)} <small>mm</small></strong></div><div><span>放大率 m</span><strong>{lens.magnification === null ? '—' : signed(lens.magnification)} <small>倍</small></strong></div><div><span>屏幕 − 像距</span><strong>{lens.screenError === null ? '不适用' : signed(lens.screenError, 1)} <small>{lens.screenError === null ? '' : 'mm'}</small></strong></div></div>
      <p className="ob-plot-note">示意图只画两条近轴光线；边界外光线裁切。屏幕是位置参考，橙色箭头标记几何像，不表示实测清晰度。</p>
    </div><div className="ob-lab-controls">
      <Control label="物距 u" value={u} min={40} max={400} step={1} unit="mm" onChange={setU} />
      <Control label="焦距 f" value={f} min={40} max={140} step={1} unit="mm" onChange={setF} />
      <Control label="屏幕位置" value={screen} min={60} max={600} step={1} unit="mm" onChange={setScreen} />
      <div className={`ob-lab-status ${focused ? 'ob-status-success' : ''}`} aria-live="polite"><strong>{focusText}</strong><p>{lens.kind !== 'real' ? '观察 u 与 f 的关系，再把物体移到焦点外试试。' : !reachable ? '理想像面超出本练习屏幕行程（60–600 mm）；请改变物距或焦距。' : '本练习以屏幕距理想像面 ≤ 2 mm 为对焦判据；真实景深与像质不由此给出。'}</p></div>
      <div className="ob-lab-actions"><button onClick={() => { setU(180); setF(75); setScreen(220); }}>重置</button><button onClick={() => { setU(150); setF(75); setScreen(220); }}>试试 u = 2f</button></div>
    </div></div>
    <details className="ob-model-details"><summary>从光线图到公式</summary><p>空气中的理想会聚薄透镜：1/f = 1/u + 1/v，因此 v = fu/(u − f)，横向放大率 m = −v/u。u &gt; f 时形成倒立实像；0 &lt; u &lt; f 时 v 为负，形成正立虚像；u = f 时像在无穷远。</p><p>物距与像距从薄透镜平面起算；近轴模型未计入透镜厚度、孔径截光、球差、衍射和光源的空间相干性。真实实验应使用适合的扩展物体和照明，并记录实际距离与不确定度。</p></details>
  </section>;
}
