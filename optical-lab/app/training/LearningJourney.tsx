import { useState } from 'react';
import { equipmentCards } from './course';
import { traceBench } from './bench-engine';
import { thinLens } from './optics';
import { OpticsIntroduction } from './OpticsIntroduction';
import { TeachingSpot } from './TeachingSpot';
import { addExpansionLens, challengeScene, challenges, componentResult, evaluateChallenge, teachingTools, type ToolId } from './learning-model';
import './learning.css';
import './introduction.css';

function Range({ label, value, min, max, unit = 'mm', step = 1, onChange }: { label: string; value: number; min: number; max: number; unit?: string; step?: number; onChange: (value: number) => void }) {
  return <label className="lj-range"><span>{label}<output>{value} {unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}
export function ComponentTeaching() {
  const [id, setId] = useState<ToolId>('positive');
  const [x, setX] = useState(280), [y, setY] = useState(0), [parameter, setParameter] = useState(100);
  const [rollDeg, setRollDeg] = useState(0), [screenDistance, setScreenDistance] = useState(100);
  const tool = teachingTools.find(t => t.id === id)!;
  const { scene, result } = componentResult(id, x, y, parameter, { rollDeg, screenDistance });
  const optic = scene.elements[0];
  const screen = result.detectors.find(d => d.elementId === 'teaching-screen');
  const detectors = scene.elements.filter(e => e.kind === 'detector' && e.id !== 'teaching-tool');
  const px = (v: number) => 40 + v, py = (v: number) => 260 - v;
  const maxX = scene.bounds.maxX;
  function select(next: ToolId) {
    setId(next); setX(280); setY(0); setRollDeg(0); setScreenDistance(next === 'objective' ? 18 : 100);
    setParameter(next === 'mirror' ? -45 : next === 'iris' || next === 'sensor' ? 16 : next === 'beamsplitter' ? 50 : next === 'objective' ? 10 : 100);
  }
  function drag(event: React.PointerEvent<SVGCircleElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const svg = event.currentTarget.ownerSVGElement!;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM()!.inverse());
    setX(Math.round(Math.max(100, Math.min(440, local.x - 40))));
    setY(Math.round(Math.max(-35, Math.min(35, 260 - local.y))));
  }
  const positionControls = <><Range label="元件 x" min={100} max={440} value={x} onChange={setX} /><Range label="元件 y" min={-35} max={35} value={y} onChange={setY} /></>;
  return <section className="ob-container lj-section lj-opening" id="ob-equipment" aria-labelledby="lj-tools-title">
    <div className="li-opening-head"><h2 id="lj-tools-title">1. 先动手，再认识元件</h2></div>
    <OpticsIntroduction />
    <div className="ob-section-head li-library-head" id="ob-component-lab"><div><h3>自己换一件器材，再试一次</h3><p>现在选择其他元件，拖动画布上的调节点，或用滑块精确调整。</p></div><a href="#ob-challenges">下一步：计算与闯关</a></div>
    <div className="lj-tool-picker" role="group" aria-label="选择教学元件">{teachingTools.map(t => <button type="button" key={t.id} aria-pressed={id === t.id} onClick={() => select(t.id)}>{t.title}</button>)}</div>
    <div className="lj-teaching"><div className="lj-plot"><svg viewBox={`0 0 ${maxX + 80} 510`} role="img" aria-label={`${tool.title}可调光路，所有线段由几何追迹计算`}>
      <defs><clipPath id="lj-tool-clip"><rect x="40" y="20" width={maxX} height="480" /></clipPath></defs>
      <g className="lj-grid">{Array.from({ length: Math.floor(maxX / 100) + 1 }, (_, i) => <g key={i}><line x1={px(i * 100)} x2={px(i * 100)} y1="20" y2="500" /><text x={px(i * 100)} y="505">{i * 100}</text></g>)}{[-200, -100, 0, 100, 200].map(v => <g key={v}><line x1="40" x2={px(maxX)} y1={py(v)} y2={py(v)} /><text x="34" y={py(v) + 4} textAnchor="end">{v}</text></g>)}</g>
      <g clipPath="url(#lj-tool-clip)">{result.segments.map((s, i) => <line key={i} x1={px(s.start.x)} y1={py(s.start.y)} x2={px(s.end.x)} y2={py(s.end.y)} stroke={s.branchId.includes('R') ? '#3e78a4' : '#bc8125'} strokeWidth={screen ? 1 : 1.6} opacity={screen ? .35 : .8} />)}</g>
      <line x1={px(25)} x2={px(25)} y1={py(-10)} y2={py(10)} stroke="#194c42" strokeWidth="5" /><text x={px(25)} y={py(0) + 36}>平行入射</text>
      <g transform={`translate(${px(x)} ${py(y)}) rotate(${- (optic?.angleDeg ?? 0)})`}><line y1="-30" y2="30" stroke="#194c42" strokeWidth="5" strokeDasharray={id === 'post' || id === 'beamsplitter' ? '4 4' : undefined} />{id === 'iris' && <line y1={-parameter / 2} y2={parameter / 2} stroke="#fafbf8" strokeWidth="6" />}{id === 'cylindrical' && <path d="M-8 -5H8M-8 5H8" stroke="#194c42" strokeWidth="2" />}</g>
      {detectors.map((d, i) => <g key={d.id} className="lj-screen" transform={`translate(${px(d.x)} ${py(d.y)})`}><line y1="-30" y2="30" stroke="#3e78a4" strokeWidth="5" transform={`rotate(${-d.angleDeg})`} /><text y={d.id === 'teaching-r' ? -14 : -40} textAnchor="middle">{id === 'beamsplitter' ? `D${i + 1}` : '接收屏'}</text></g>)}
      <circle cx={px(x)} cy={py(y)} r="20" fill="transparent" stroke="#194c42" strokeWidth="1" strokeDasharray="3 3" tabIndex={0} role="slider" aria-label="拖动元件，方向键微调位置" aria-valuemin={100} aria-valuemax={440} aria-valuenow={x} aria-valuetext={`x ${x} mm，y ${y} mm`} style={{ touchAction: 'none', cursor: 'move' }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={drag} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setX(Math.max(100, Math.min(440, x + (event.key === 'ArrowLeft' ? -5 : 5)))); else setY(Math.max(-35, Math.min(35, y + (event.key === 'ArrowUp' ? 1 : -1)))); } }} />
      <text x={px(x)} y={py(y) + 55} textAnchor="middle">{tool.title}</text><text x={px(maxX) - 30} y="34">mm</text>
    </svg><p>真实 XY 等比例 · 入射{screen ? '圆束直径' : '范围'} {scene.source.diameter} mm · 理想几何光线{screen ? '；二维落点见接收屏图' : ''}</p></div>
    <div className="lj-controls"><h3>{tool.title}</h3><p>{tool.detail}</p>
      {tool.formula && <p className="lj-principle">{tool.formula}</p>}
      {id === 'objective' ? <><label className="lj-objective-select">参考物镜<select aria-label="参考物镜" value={parameter} onChange={event => setParameter(Number(event.target.value))}>{[4, 10, 20, 40].map(m => <option key={m} value={m}>RMS{m}X · {m}×</option>)}</select></label><p className="lj-objective-spec">等效焦距 {optic.focal} mm · NA {optic.objective!.numericalAperture} · WD {optic.objective!.workingDistance} mm</p></> : !['post', 'block'].includes(id) && <Range label={id === 'mirror' ? '镜面法线角' : id === 'beamsplitter' ? '反射比例 R' : id === 'iris' || id === 'sensor' ? '有效口径' : '焦距绝对值'} unit={id === 'mirror' ? '°' : id === 'beamsplitter' ? '%' : 'mm'} min={id === 'mirror' ? -60 : id === 'beamsplitter' ? 0 : id === 'iris' || id === 'sensor' ? 1 : 50} max={id === 'mirror' ? -30 : id === 'beamsplitter' ? 100 : id === 'iris' || id === 'sensor' ? 50 : 250} value={parameter} onChange={setParameter} />}
      {id === 'cylindrical' && <Range label="聚焦方向角（绕光轴）" unit="°" min={0} max={180} value={rollDeg} onChange={setRollDeg} />}
      {screen && <><Range label="元件到屏距离 d" min={id === 'objective' ? 1 : 20} max={id === 'objective' ? 60 : 250} step={.5} value={screenDistance} onChange={setScreenDistance} /><TeachingSpot detector={screen} diameter={scene.source.diameter} /></>}
      <p className="lj-observe">{tool.tryThis}</p>
      {['cylindrical', 'objective', 'beamsplitter'].includes(id) ? <details className="lj-position"><summary>移动元件位置</summary>{positionControls}</details> : positionControls}
      <p className="lj-readout" aria-live="polite">{id === 'beamsplitter' && <>D1 透射接收 {((result.detectors.find(d => d.elementId === 'teaching-t')?.power ?? 0) * 100).toFixed(1)}% · D2 反射接收 {((result.detectors.find(d => d.elementId === 'teaching-r')?.power ?? 0) * 100).toFixed(1)}%<br /></>}理想接收 {(result.energy.captured * 100).toFixed(1)}% · 截获吸收 {(result.energy.absorbed * 100).toFixed(1)}% · 离开范围 {(result.energy.escaped * 100).toFixed(1)}%</p>
      <small>{id === 'objective' ? '物镜按主平面的近轴模型计算；图中屏距从主平面量起，不代表 WD。不含高 NA、盖玻片或真实镜组结构。' : '消色差镜、安装架用等效薄透镜。'}未模拟衍射、玻璃色散、偏振和真实镀膜损耗；离开范围不等于实际损耗。</small>
      {tool.sourceUrl && <p className="lj-source"><a href={tool.sourceUrl} target="_blank" rel="noreferrer">原理与规格来源 ↗</a>{optic?.objective && <> · <a href={`/training/objectives/${optic.objective.catalogSku}.json`} target="_blank" rel="noreferrer">物镜规格记录 ↗</a></>}</p>}
    </div></div>
    <details className="lj-more"><summary>上台前，逐项检查器材</summary><dl>{equipmentCards.map(card => <div key={card.name}><dt>{card.name}</dt><dd>{card.check}</dd></div>)}</dl></details>
  </section>;
}

function LensCalculation() {
  const [u, setU] = useState(150);
  const result = thinLens(u, 100, 300)!;
  return <details className="lj-more"><summary>薄透镜公式练习：物距、像距与放大率</summary><p>1/f = 1/u + 1/v；这里 f = 100 mm，正实物距 u，正 v 为实像，负 v 为虚像。适用于空气中的近轴薄透镜。</p><Range label="物距 u" value={u} min={50} max={300} onChange={setU} /><p aria-live="polite">{result.v === null ? '物体位于焦平面，出射平行，有限距离内无像面。' : `像距 v = ${result.v.toFixed(1)} mm；${result.kind === 'real' ? '实像' : '虚像'}。`}</p></details>;
}
function Challenge({ index, onComplete }: { index: number; onComplete: () => void }) {
  const item = challenges[index];
  const [scene, setScene] = useState(() => challengeScene(index));
  const [answer, setAnswer] = useState(''), [choice, setChoice] = useState<number | null>(null), [submitted, setSubmitted] = useState(false);
  const [hint, setHint] = useState(false);
  const result = traceBench(scene), grade = evaluateChallenge(index, answer, choice, scene);
  function check() { setSubmitted(true); if (grade.complete) onComplete(); }
  return <div className="lj-challenge">
    <div className="lj-challenge-copy"><h3>{item.title}</h3><p className="lj-formula">{item.formula}</p><label className="lj-answer-label">{item.problem}<span><input aria-label="计算答案" inputMode="decimal" value={answer} onChange={event => { setAnswer(event.target.value); setSubmitted(false); }} />{item.unit}</span></label><fieldset><legend>{item.question}</legend>{item.options.map((option, i) => <label key={option}><input type="radio" name={`lj-question-${index}`} checked={choice === i} onChange={() => { setChoice(i); setSubmitted(false); }} />{option}</label>)}</fieldset><button type="button" onClick={() => setHint(!hint)} aria-expanded={hint}>查看计算与搭建提示</button>{hint && <p>{item.hint}</p>}</div>
    <div className="lj-challenge-build"><h4>把计算用到光路里</h4><svg viewBox="0 0 660 220" role="img" aria-label="闯关光路实时追迹"><line x1="20" x2="640" y1="110" y2="110" stroke="#cfdad4" />{result.rays.map((ray, i) => <polyline key={i} points={ray.points.map(p => `${20 + p.z / 2.5},${110 - p.y * 6}`).join(' ')} fill="none" stroke={ray.blocked ? '#c15738' : '#b7832d'} strokeWidth="1.3" />)}{scene.elements.map((e, i) => <g key={e.id}><line x1={20 + e.z / 2.5} x2={20 + e.z / 2.5} y1="50" y2="170" stroke="#246457" strokeWidth="4" /><text x={20 + e.z / 2.5} y="192" textAnchor="middle">L{i + 1} · f{e.focal}</text></g>)}<line x1={20 + scene.screen / 2.5} x2={20 + scene.screen / 2.5} y1="40" y2="180" stroke="#3f758c" strokeWidth="4" /></svg><small>纵向放大 15 倍以观察光线斜率；计算使用 mm 和 rad。</small>
    {scene.elements.map((e, i) => <Range key={e.id} label={`L${i + 1} 位置 z`} value={e.z} min={5} max={scene.screen - 5} onChange={z => { setScene({ ...scene, elements: scene.elements.map(el => el.id === e.id ? { ...el, z } : el) }); setSubmitted(false); }} />)}{item.id === 'expand' && scene.elements.length < 2 && <button type="button" onClick={() => setScene(addExpansionLens(scene))}>加入第二片 f = 100 mm 正透镜</button>}{item.id === 'focus' && <Range label="目标面 z" min={250} max={600} value={scene.screen} onChange={screen => { setScene({ ...scene, screen }); setSubmitted(false); }} />}
    <p className="lj-readout">目标面范围 {result.span?.toFixed(3)} mm · 输出角度范围 {result.angleSpan?.toFixed(3)} mrad</p><ul className="lj-checks">{grade.checks.map(c => <li key={c.label} data-pass={c.pass}>{c.pass ? '通过' : '待调整'} · {c.label}</li>)}</ul>
    </div><div className="lj-grade"><button className="ob-button ob-button-primary" type="button" onClick={check}>检查本关</button><button type="button" onClick={() => { setScene(challengeScene(index)); setAnswer(''); setChoice(null); setSubmitted(false); }}>重新尝试</button>{submitted && <p role="status">{grade.complete ? '本关通过：计算、判断与搭建都满足要求。' : `还需完成：${[!grade.numeric && '计算答案', !grade.question && '判断题', !grade.checks.every(c => c.pass) && '光路调整'].filter(Boolean).join('、')}。可查看提示后继续。`}</p>}</div>
  </div>;
}
export function LearningChallenges() {
  const [index, setIndex] = useState(0), [completed, setCompleted] = useState<number[]>([]);
  return <section className="ob-container lj-section" id="ob-challenges" aria-labelledby="lj-challenge-title"><div className="ob-section-head"><div><h2 id="lj-challenge-title">2. 算一遍，再搭出来</h2><p>三关都要完成计算、判断和真实追迹检查。可以自由切换练习，进度保留到本次页面关闭。</p></div><span>已通过 {completed.length} / 3</span></div><div className="lj-tool-picker" role="group" aria-label="选择关卡">{challenges.map((c, i) => <button type="button" key={c.id} aria-pressed={i === index} onClick={() => setIndex(i)}>{i + 1}. {c.title}{completed.includes(i) ? ' · 已通过' : ''}</button>)}</div>{challenges.map((c, i) => <div key={c.id} hidden={i !== index}><Challenge index={i} onComplete={() => setCompleted(previous => previous.includes(i) ? previous : [...previous, i])} /></div>)}<LensCalculation /><p><a href="#ob-course">需要更多步骤？继续八节基础实训与实操记录</a> · <a href="#ob-free">已掌握？开始自由搭建</a></p></section>;
}
