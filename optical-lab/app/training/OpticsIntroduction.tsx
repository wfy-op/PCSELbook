import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apertureExperiment, componentResult, focusExperiment } from './learning-model';

const incoming = '#a16c16';
const outgoing = '#356f91';
type RayPath = { d: string; color: string; strong?: boolean };

function Diagram({ label, viewBox = '0 0 720 300', paths, children, caption }: { label: string; viewBox?: string; paths: RayPath[]; children: ReactNode; caption: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(media.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    updateMotion(); updateVisibility();
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);
  const moving = playing && inView && pageVisible && !reduced;
  return <figure className="li-figure">
    <svg ref={ref} viewBox={viewBox} role="group" aria-label={label} className={moving ? 'li-diagram is-playing' : 'li-diagram'}>
      <g className="li-rays">{paths.map((path, i) => <path key={i} d={path.d} fill="none" stroke={path.color} strokeWidth={path.strong ? 2.5 : 1.3} opacity={path.strong ? .95 : .35} />)}</g>
      {children}
      <g className="li-flow" aria-hidden="true">{paths.filter(path => path.strong).map((path, i) => <path key={i} d={path.d} pathLength={100} fill="none" stroke={path.color} strokeWidth="4" strokeLinecap="round" strokeDasharray=".5 12" />)}</g>
    </svg>
    <figcaption><span>{caption}</span><button type="button" className="li-motion-button" aria-pressed={playing} disabled={reduced} onClick={() => setPlaying(!playing)}>
      <svg viewBox="0 0 20 20" aria-hidden="true">{playing ? <path d="M7 4v12M13 4v12" /> : <path d="m6 4 10 6-10 6Z" />}</svg>
      {reduced ? '静态演示' : playing ? '暂停光线方向演示' : '播放光线方向演示'}
    </button></figcaption>
  </figure>;
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return <label className="li-slider"><span>{label}<output>{value} {unit}</output></span><input aria-label={label} type="range" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function FocusLesson() {
  const [distance, setDistance] = useState(160);
  const [lensEnabled, setLensEnabled] = useState(true);
  const { scene, result, focalDistance } = focusExperiment(distance, lensEnabled);
  const px = (z: number) => 56 + z * 1.35;
  const py = (y: number) => 140 - y * 5;
  const lensX = px(200), screenX = px(scene.screen), focusX = px(200 + focalDistance);
  const atFocus = lensEnabled && result.span !== null && result.span < 1e-8;
  const paths: RayPath[] = result.rays.flatMap((ray, i) => ray.points.slice(1).map((point, j) => ({
    d: `M${px(ray.points[j].z)} ${py(ray.points[j].y)}L${px(point.z)} ${py(point.y)}`,
    color: lensEnabled && j > 0 ? outgoing : incoming,
    strong: i === 0 || i === 8 || i === 16,
  })));
  function moveScreen(event: React.PointerEvent<SVGGElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const svg = event.currentTarget.ownerSVGElement!;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM()!.inverse());
    setDistance(Math.max(40, Math.min(220, Math.round((local.x - 56) / 1.35 - 200))));
  }
  return <article className="li-experiment" id="li-focus" aria-labelledby="li-focus-title">
    <h3 id="li-focus-title">把接收屏移过焦点</h3>
    <p>一束<span className="li-incoming">平行光</span>遇到正透镜，会往一起靠。可屏放在哪里，才会接到最小的范围？拖动<span className="li-outgoing">接收屏</span>，从焦点前移到焦点后。</p>
    <Diagram label="正透镜聚焦实验，接收屏可拖动" paths={paths} caption="近轴薄透镜 · 束宽方向放大约 3.7 倍">
      <line x1="40" x2="692" y1="140" y2="140" className="li-axis" />
      <line x1="56" x2="56" y1="94" y2="186" className="li-source" /><text x="56" y="218" textAnchor="middle">平行光</text>
      {lensEnabled && <><ellipse cx={lensX} cy="140" rx="10" ry="60" className="li-lens" /><text x={lensX} y="46" textAnchor="middle">正透镜</text><text x={lensX} y="66" textAnchor="middle" className="li-small-label">f = 100 mm</text>
        <line x1={focusX} x2={focusX} y1="86" y2="220" className="li-focus-guide" /><text x={focusX} y="240" textAnchor="middle" className="li-outgoing-label">焦点 F</text></>}
      <g tabIndex={0} role="slider" aria-label="拖动接收屏，方向键微调距离" aria-valuemin={40} aria-valuemax={220} aria-valuenow={distance} aria-valuetext={`距透镜 ${distance} mm`} className="li-screen" style={{touchAction:'none'}} onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={moveScreen} onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setDistance(Math.max(40, Math.min(220, distance + (e.key === 'ArrowLeft' ? -1 : 1)))); } }}>
        <rect x={screenX - 18} y="72" width="36" height="136" fill="transparent" stroke="transparent" strokeWidth="28" vectorEffect="non-scaling-stroke" />
        <line x1={screenX} x2={screenX} y1="80" y2="200" stroke={outgoing} strokeWidth="5" />
        <path d={`M${screenX - 10} 207h20m-20 0 4-4m-4 4 4 4m16-4-4-4m4 4-4 4`} fill="none" stroke={outgoing} strokeWidth="1.5" />
        <text x={screenX} y="28" textAnchor="middle" className="li-outgoing-label">接收屏</text>
        {result.rays.filter(ray => !ray.blocked).map((ray, i) => <circle key={i} cx={screenX} cy={py(ray.points.at(-1)!.y)} r={atFocus ? 4 : 2.3} fill={outgoing} />)}
      </g>
      <path d={`M${lensX} 252v8H${screenX}v-8`} className="li-distance" /><text x={(lensX + screenX) / 2} y="285" textAnchor="middle">d = {distance} mm</text>
    </Diagram>
    <div className="li-controls"><Slider label="屏到透镜的距离 d" min={40} max={220} value={distance} unit="mm" onChange={setDistance} /><div className="li-presets" role="group" aria-label="比较焦点前后">{[{label:'焦点前',value:60},{label:'焦点处',value:100},{label:'焦点后',value:160}].map(p => <button type="button" key={p.label} aria-pressed={distance === p.value} onClick={() => setDistance(p.value)}>{p.label}</button>)}<button type="button" onClick={() => setLensEnabled(!lensEnabled)}>{lensEnabled ? '取走透镜' : '放回透镜'}</button></div></div>
    <p className="li-observation" aria-live="polite" data-span={result.span?.toFixed(6)}><strong>{!lensEnabled ? '光线又平行了。' : atFocus ? '找到了：屏就在焦点上。' : distance < focalDistance ? '还在会聚，屏放早了。' : '已经越过焦点，光线重新展开。'}</strong>屏上光线落点范围 <b>{result.span?.toFixed(2)} mm</b>。</p>
    <p className="li-takeaway">回到“焦点处”，再点“焦点后”。光线穿过焦点会继续传播，所以<strong>一处小光斑，并不代表光束已经准直</strong>。试着取走透镜，比较同一束入射光。</p>
  </article>;
}

function MirrorLesson() {
  const [turn, setTurn] = useState(0);
  const { result } = componentResult('mirror', 280, 0, -45 + turn);
  const px = (x: number) => 50 + x * .95, py = (y: number) => 268 - y * .95;
  const center = result.segments.find(s => s.event === 'escape' && Math.abs(s.start.y) < 1e-7)!;
  const direction = Math.atan2(center.end.y - center.start.y, center.end.x - center.start.x) * 180 / Math.PI;
  const delta = direction - 90;
  const paths = result.segments.map(s => ({d:`M${px(s.start.x)} ${py(s.start.y)}L${px(s.end.x)} ${py(s.end.y)}`, color:s.event === 'escape' ? outgoing : incoming, strong:Math.abs(s.start.y) < 1e-7}));
  return <article className="li-experiment" id="li-mirror" aria-labelledby="li-mirror-title">
    <h3 id="li-mirror-title">镜子只转一点，光会转多少？</h3>
    <p>我们已经能让光会聚。现在，换一面镜子，让它转弯。虚线保留初始的出射方向；只转动镜面，比较<span className="li-outgoing">反射光</span>偏离了多少。</p>
    <Diagram label="反射镜转动实验，虚线为初始出射方向" viewBox="0 0 720 350" paths={paths} caption="XY 等比例 · 虚线为镜面转角 0° 时的参考光路">
      <line x1="60" x2={px(280)} y1={py(0)} y2={py(0)} className="li-axis" />
      <line x1={px(280)} x2={px(280)} y1={py(0)} y2="32" className="li-focus-guide" /><text x={px(280) + 12} y="26" className="li-small-label">初始方向</text>
      <g transform={`translate(${px(280)} ${py(0)}) rotate(${45 - turn})`}><line y1="-30" y2="30" stroke="#194c42" strokeWidth="5" /><line x1="-8" x2="-8" y1="-30" y2="30" stroke="#879c8b" strokeWidth="2" /></g>
      <circle cx={px(280)} cy={py(0)} r="4" fill="#194c42" /><text x={px(280)} y="326" textAnchor="middle">反射镜</text><text x="84" y="302" textAnchor="middle">入射光</text>
      <text x="540" y="124" textAnchor="middle" className="li-outgoing-label">出射方向变化</text><text x="540" y="158" textAnchor="middle" className="li-angle-label">{delta >= 0 ? '+' : ''}{delta.toFixed(0)}°</text>
    </Diagram>
    <div className="li-controls"><Slider label="镜面转角 Δθ" min={-10} max={10} value={turn} unit="°" onChange={setTurn} /><button type="button" onClick={() => setTurn(0)}>回到初始方向</button></div>
    <p className="li-observation" aria-live="polite" data-deflection={delta.toFixed(6)}>镜面转动 <b>{turn}°</b>，反射光方向改变 <b>{Math.abs(delta).toFixed(0)}°</b>。<strong>方向变化是镜面转角的两倍。</strong></p>
    <p className="li-takeaway">把滑块从 0° 移到 5°。这就是调镜架时需要“小步走”的原因；远处的光斑对角度尤其敏感。</p>
  </article>;
}

function ApertureLesson() {
  const [aperture, setAperture] = useState(32);
  const { result } = apertureExperiment(aperture);
  const px = (x: number) => 35 + x, py = (y: number) => 134 - y * 3;
  const escaped = result.segments.filter(s => s.event === 'escape');
  const passed = new Set(escaped.map(s => s.rootId)).size;
  const paths = result.segments.map(s => ({d:`M${px(s.start.x)} ${py(s.start.y)}L${px(s.end.x)} ${py(s.end.y)}`,color:s.event === 'escape' ? outgoing : incoming,strong:s.event === 'escape' || Math.abs(s.start.y) < 1e-7 || Math.abs(s.start.y) === 8}));
  return <article className="li-experiment" id="li-aperture" aria-labelledby="li-aperture-title">
    <h3 id="li-aperture-title">把孔收小，光线就会平行吗？</h3>
    <p>这次换成一束<span className="li-incoming">向外发散的光</span>，在路上放一个光阑。慢慢收小孔径，看看哪些光线消失，以及留下的光线有没有改变方向。</p>
    <Diagram label="发散光经过可调光阑的真实截光实验" viewBox="0 0 720 270" paths={paths} caption="入射全角 40 mrad · 横向放大 3 倍以看清截光">
      <line x1="48" x2="680" y1="134" y2="134" className="li-axis" />
      <line x1={px(280)} x2={px(280)} y1="34" y2={py(aperture / 2)} className="li-iris" /><line x1={px(280)} x2={px(280)} y1={py(-aperture / 2)} y2="234" className="li-iris" />
      <path d={`M${px(280) - 14} ${py(aperture / 2)}h28M${px(280) - 14} ${py(-aperture / 2)}h28`} stroke="#194c42" strokeWidth="2" fill="none" />
      <text x={px(280)} y="23" textAnchor="middle">光阑</text><text x="84" y="242" textAnchor="middle">发散入射</text><text x="576" y="242" textAnchor="middle" className="li-outgoing-label">通过的光继续走</text>
      {result.segments.filter(s => s.event === 'blocked').map((s, i) => <path key={i} d={`M${px(s.end.x) - 3} ${py(s.end.y) - 3}l6 6m-6 0 6-6`} stroke="#9b533d" strokeWidth="1.5" />)}
    </Diagram>
    <div className="li-controls"><Slider label="光阑孔径" min={2} max={32} value={aperture} unit="mm" onChange={setAperture} /><button type="button" onClick={() => setAperture(32)}>重新开满</button></div>
    <p className="li-observation" aria-live="polite" data-passed={passed}>通过 <b>{passed} / {result.sourceRayCount}</b> 条采样光线，截获吸收 <b>{(result.energy.absorbed * 100).toFixed(1)}%</b>。<strong>{passed === result.sourceRayCount ? '孔足够大，光线全部通过。' : '孔外被挡住，孔内光线没有被折转。'}</strong></p>
    <p className="li-takeaway">光阑挑选能通过的光，透镜改变光线的方向。收小光阑会减少通光，不能把剩余的发散光线变成理想平行束。</p>
  </article>;
}

export function OpticsIntroduction() {
  return <div className="li-introduction">
    <FocusLesson /><MirrorLesson /><ApertureLesson />
    <details className="li-model-note"><summary>这些演示怎么算？</summary><p>三个实验调用实验室现有的光线追迹引擎。透镜采用空气中的近轴、零厚度模型；镜面执行平面反射；光阑按实际交点截光。每束使用 17 条一维采样光线，吸收比例是离散模拟份额。屏上显示的是光线落点范围，没有计算衍射光斑或真实功率。透镜轮廓只是元件符号。播放动点仅示意传播方向，不表示光速；减少动态效果时保持静态。</p><p>图文交替、一次调一个变量的教学组织参考 <a href="https://ciechanow.ski/cameras-and-lenses/" target="_blank" rel="noreferrer">Bartosz Ciechanowski 的 Cameras and Lenses</a>。演示与代码由本实验室独立实现。</p></details>
  </div>;
}
