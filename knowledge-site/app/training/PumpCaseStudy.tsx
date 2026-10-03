import { useEffect, useRef, useState } from "react";
import "./pump-case.css";

type CasePanel = "observe" | "tasks" | "quiz";
type Parameters = { wavelength: string; lenses: string; height: string; sample: string; collection: string };
const PARAMETER_KEY = "pcsel-optical-pump-case-draft-v1";
const emptyParameters = (): Parameters => ({ wavelength: "", lenses: "", height: "", sample: "", collection: "" });

const locations = [
  {
    id: "input", number: "01", title: "泵光入口 · 蓝色光纤", subtitle: "已由用户确认：光从这里输入", x: 35.1, y: 43.8,
    visible: "蓝色光纤通过红色护套接入左中区域的支撑组件。用户已确认，光由这条光纤输入。",
    confirm: "输入路径已确认；输出波长、数值孔径及准直器参数，还需查光源与器件标签。",
    inspect: "登记接头与光纤编号；检查固定和弯曲状态。由带教者确认光源状态后，再按本组流程检查接入端。",
  },
  {
    id: "cage", number: "02", title: "中央笼式组件", subtitle: "看清机械轴，不先猜光学功能", x: 43.4, y: 44.8,
    visible: "多根平行导杆连接数个黑色安装板，组件由立柱支撑。照片显示的是外部机械结构。",
    confirm: "安装板内是否有透镜、各片的焦距和朝向、有效间距，以及是否共用同一光轴，均待核对。",
    inspect: "先画安装板顺序、量取可见间距，并记录测量基准；不要把镜架边缘直接当作透镜主平面。",
  },
  {
    id: "upper", number: "03", title: "上方镜筒组件", subtitle: "区分外壳位置与光学位置", x: 70.7, y: 18.6,
    visible: "上方横向导杆支承多个安装件，右侧连接银色圆筒，整体位于较高的支撑位置。",
    confirm: "圆筒中的元件类型、该支路的作用，以及它与下方组件的关系，无法仅由这张照片确定。",
    inspect: "核对元件标签、调节自由度和支撑稳定性；将每一处尚未确认的连接写在拓扑图旁。",
  },
  {
    id: "stage", number: "04", title: "右侧调节台", subtitle: "先登记自由度，再决定怎么调", x: 81.2, y: 42.4,
    visible: "右侧有叠放的机械调节组件、旋钮和立式安装件，可辨认独立的底座与支撑。",
    confirm: "是否承载样品、各调节轴的方向和行程，以及哪一个旋钮控制哪个对象，需要现场确认。",
    inspect: "记录轴向、零位与可用行程；得到带教者确认后逐个辨认旋钮，避免同时改变多个自由度。",
  },
  {
    id: "front", number: "05", title: "前方镜筒组件", subtitle: "用器件清单补上照片看不到的部分", x: 58.5, y: 73.1,
    visible: "前方可见一段较长的圆筒光学组件，装在导杆与安装板之间；筒身标识在照片中不够清晰。",
    confirm: "内部镜片组合、焦距、输入与输出侧，以及它承担泵浦还是收集功能，均不能凭外观判定。",
    inspect: "抄录清晰可见的型号，再查询器件资料；记录实际安装方向，不用照片中的朝向代替传播方向。",
  },
] as const;

const steps = [
  { title: "先画拓扑，给未知处留空", body: "从光源标识和组内原理图出发，写出已确认的连接关系、每段用途和终端。照片中无法确认的连接用“待确认”标注，不自行连线。", evidence: "一张带器件编号、已确认连接与待确认项的拓扑草图。" },
  { title: "登记镜片与机械基准", body: "逐件记录型号、焦距或设计用途、安装朝向、光高和间距。标明距离从何处量起；组合透镜的计算位置需要与实际机械坐标对应。", evidence: "器件清单、间距表，以及参考光轴和固定点。" },
  { title: "按已确认的拓扑逐段建立参考", body: "由带教者划定允许操作的段，先确认挡光与接收位置，再用已认可的参考点检查位置和方向。每次只改变一个调节量，随时复查上游。", evidence: "每段的两个参考位置、调整前后观察和旋钮变化。" },
  { title: "在批准的低功率条件下复核", body: "采用本组批准的对准条件，依次检查通光、接收范围和锁紧后的变化。泵浦聚焦与收集支路分别核对；不要把网页里的理想像面直接视为样品面。", evidence: "源设置、观测方式、接收条件，以及锁紧前后的复核结果。" },
  { title: "留下下一位同学能接手的记录", body: "保存最后布局、实测距离、观测位置和剩余疑问。结合组内 SOP 记录关机、遮光与设备交接状态，请带教者现场复核。", evidence: "有日期和单位的原始记录、完成后的布局图与待办项。" },
] as const;

const quizItems = [
  { question: "看见右侧调节台，能直接把它标成“样品台”吗？", options: ["能，带旋钮的调节台一定承载样品", "不能，要结合实物、原理图或带教者确认", "能，只要它靠近镜筒"], answer: 1, explanation: "照片能支持“有可调机械组件”，但不能确认其承载物。把可见结构和功能判断分开，拓扑才可复核。" },
  { question: "准备计算两片透镜组合，首先还需要什么？", options: ["照片里两个镜架看起来差不多远就够了", "只需要两片透镜的外径", "各片参数、先后顺序、距离基准和输入光束条件"], answer: 2, explanation: "组合行为取决于焦距、间隔和输入条件。机械外壳的位置不能直接替代光学主平面，也不能从照片可靠量取轴向间隔。" },
  { question: "重新搭建后，单个屏上的光斑最小，可以结束吗？", options: ["还需按目标复核光轴、相关平面与接收情况，并保存记录", "可以，最小光斑证明整套系统已对准", "把源功率调大再看一次就行"], answer: 0, explanation: "一个截面的光斑不能证明整条光路正确。先确认目标是准直、成像还是聚焦，再按已批准的流程复核多个参考位置。" },
] as const;

const parameterFields: { id: keyof Parameters; label: string; placeholder: string }[] = [
  { id: "wavelength", label: "光源 / 波长", placeholder: "例如：型号、波长、经确认的工作条件" },
  { id: "lenses", label: "透镜 / 焦距 / 间距", placeholder: "依次记录型号、焦距和距离基准" },
  { id: "height", label: "参考光高", placeholder: "记录高度、单位与基准面" },
  { id: "sample", label: "样品位置", placeholder: "待确认；注明定位与判断依据" },
  { id: "collection", label: "收集 / 探测支路", placeholder: "待确认；注明器件、连接与功能" },
];

// These are explicitly teaching assumptions, not measurements of the photographed platform.
const teachingExample = {
  wavelengthNm: 532,
  inputDiameterMm: 2,
  f1Mm: 50,
  f2Mm: 100,
  focusFMm: 75,
};
const beamMagnification = teachingExample.f2Mm / teachingExample.f1Mm;
const lensSeparationMm = teachingExample.f1Mm + teachingExample.f2Mm;
const outputDiameterMm = teachingExample.inputDiameterMm * beamMagnification;
const focusRadiusUm = (teachingExample.wavelengthNm / 1000) * teachingExample.focusFMm / (Math.PI * outputDiameterMm / 2);

function readParameters(): Parameters {
  try {
    const stored = JSON.parse(localStorage.getItem(PARAMETER_KEY) ?? "null");
    if (stored?.version !== 1 || !stored.parameters || typeof stored.parameters !== "object") return emptyParameters();
    return Object.fromEntries(parameterFields.map(({ id }) => [id, typeof stored.parameters[id] === "string" ? stored.parameters[id] : ""])) as Parameters;
  } catch { return emptyParameters(); }
}

export function PumpCaseStudy({ onOpenWorkbench }: { onOpenWorkbench?: () => void }) {
  const [panel, setPanel] = useState<CasePanel>("observe");
  const [activeLocation, setActiveLocation] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [parameters, setParameters] = useState<Parameters>(readParameters);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const observationRef = useRef<HTMLDivElement>(null);
  const location = locations[activeLocation];
  const filled = parameterFields.filter(({ id }) => parameters[id].trim()).length;
  useEffect(() => {
    try { localStorage.setItem(PARAMETER_KEY, JSON.stringify({ version: 1, parameters })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [parameters]);

  function chooseLocation(index: number) {
    setActiveLocation(index);
    if (window.matchMedia("(max-width: 780px)").matches) {
      observationRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
    }
  }

  return <section className="pc-case" aria-labelledby="pc-case-title">
    <div className="pc-case-heading"><div><span className="pc-case-eyebrow">IN OUR LAB · 本组现场案例</span><h2 id="pc-case-title">从这张台面照片，读懂一套光泵实验。</h2><p>蓝色光纤输入已经确认。沿着这个起点，用公式补全一条教学光路，再回到实物核对。</p></div><span className="pc-case-photo-badge"><span aria-hidden="true">●</span> 用户提供 · 真实平台</span></div>
    <div className="pc-case-tabs" role="tablist" aria-label="光泵案例学习方式">{([{ id: "observe", label: "读懂现场", number: "01" }, { id: "tasks", label: "拆解搭建任务", number: "02" }, { id: "quiz", label: "案例自测", number: "03" }] as const).map((tab) => <button type="button" role="tab" id={`pc-case-tab-${tab.id}`} aria-controls={`pc-case-panel-${tab.id}`} aria-selected={panel === tab.id} tabIndex={panel === tab.id ? 0 : -1} key={tab.id} onClick={() => setPanel(tab.id)} onKeyDown={(event) => {
      const panels: CasePanel[] = ["observe", "tasks", "quiz"];
      let next: CasePanel | undefined;
      if (event.key === "ArrowRight") next = panels[(panels.indexOf(panel) + 1) % panels.length];
      if (event.key === "ArrowLeft") next = panels[(panels.indexOf(panel) + panels.length - 1) % panels.length];
      if (event.key === "Home") next = "observe";
      if (event.key === "End") next = "quiz";
      if (next) { event.preventDefault(); setPanel(next); document.getElementById(`pc-case-tab-${next}`)?.focus(); }
    }}><span>{tab.number}</span>{tab.label}</button>)}</div>

    <div className="pc-case-panel" id={`pc-case-panel-${panel}`} role="tabpanel" aria-labelledby={`pc-case-tab-${panel}`} tabIndex={0}>
      {panel === "observe" && <>
        <div className="pc-case-observation-grid">
          <figure className="pc-case-photo"><div className="pc-case-image-wrap"><img src="/training/group-optical-pump.png" width="1374" height="834" alt="本组光泵测试平台现场照片，可见光纤接入、笼式结构、镜筒及多处可调机械组件；具体光路与样品位置尚待确认。" loading="lazy" />{locations.map((item, i) => <button type="button" className={`pc-case-hotspot ${activeLocation === i ? "is-active" : ""}`} key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={`观察点 ${item.number}：${item.title}`} aria-pressed={activeLocation === i} aria-controls="pc-case-observation" onClick={() => chooseLocation(i)}>{item.number}</button>)}</div><figcaption><span>点击编号，逐件读图</span><span>仅标识可见结构 · 未标传播方向</span></figcaption></figure>
          <div className="pc-case-observation" id="pc-case-observation" ref={observationRef} aria-live="polite"><div className="pc-case-observation-title"><span className="pc-case-observation-number">{location.number}</span><div><span className="pc-case-eyebrow">OBSERVATION POINT</span><h3>{location.title}</h3></div></div><p className="pc-case-observation-subtitle">{location.subtitle}</p><dl><div><dt><span className="pc-case-dot is-visible" />看得到</dt><dd>{location.visible}</dd></div><div><dt><span className="pc-case-dot is-unknown" />需确认</dt><dd>{location.confirm}</dd></div><div><dt><span className="pc-case-dot is-action" />学生要检查</dt><dd>{location.inspect}</dd></div></dl><div className="pc-case-point-nav"><button type="button" onClick={() => chooseLocation((activeLocation + locations.length - 1) % locations.length)}>← 上一个</button><span>{activeLocation + 1} / {locations.length}</span><button type="button" onClick={() => chooseLocation((activeLocation + 1) % locations.length)}>下一个 →</button></div></div>
        </div>
        <div className="pc-case-evidence-note"><span aria-hidden="true">i</span><p><strong>已确认：蓝色光纤输入。</strong> 其余器件先按可见结构编号。下面给出可计算的教学补全；它不把示例参数或功能强加给照片中的某个镜筒。</p></div>
      </>}

      {panel === "tasks" && <div className="pc-case-task-layout"><div><div className="pc-case-mini-heading"><span className="pc-case-eyebrow">FROM PHOTO TO PROCEDURE</span><h3>每一步，都留下一份可复核的证据。</h3><p>按组内已确认的拓扑执行；现场操作由带教者指导。</p></div><ol className="pc-case-task-list">{steps.map((step, index) => <li key={step.title}><span className="pc-case-step-number">{String(index + 1).padStart(2, "0")}</span><div><h4>{step.title}</h4><p>{step.body}</p><div className="pc-case-evidence"><strong>留下什么</strong><span>{step.evidence}</span></div></div></li>)}</ol></div><aside className="pc-case-task-note"><span className="pc-case-eyebrow">BEFORE YOU ADJUST</span><h3>先说清这次要调什么</h3><p>“让光通过”只是起点。对准轴线、改变光斑尺寸、把光聚焦到目标平面、提高收集效率，需要各自的观察位置与判据。</p><ul><li>哪个量保持不变？</li><li>准备调哪一个自由度？</li><li>在哪个平面观察什么？</li><li>什么证据支持调整有效？</li></ul><p className="pc-case-task-note-foot">网页给出学习顺序；实际源设置、挡光、防护和允差以本组 SOP 与带教者确认结果为准。</p></aside></div>}

      {panel === "quiz" && <div className="pc-case-quiz"><div className="pc-case-mini-heading"><span className="pc-case-eyebrow">CHECK YOUR REASONING</span><h3>你能分清“看到”和“推断”吗？</h3><p>每题可重新选择。反馈帮助你检查思路，不计入现场技能验收。</p></div>{quizItems.map((item, index) => <fieldset key={item.question}><legend><span>{String(index + 1).padStart(2, "0")}</span>{item.question}</legend><div className="pc-case-quiz-options">{item.options.map((option, optionIndex) => <button type="button" key={option} aria-pressed={answers[index] === optionIndex} className={answers[index] === optionIndex ? "is-selected" : ""} onClick={() => setAnswers((previous) => ({ ...previous, [index]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>{answers[index] !== undefined && <p className={`pc-case-quiz-feedback ${answers[index] === item.answer ? "is-correct" : "is-retry"}`} role="status"><strong>{answers[index] === item.answer ? "判断正确。" : "再核对一下。"}</strong>{item.explanation}</p>}</fieldset>)}</div>}
    </div>

    <div className="pc-case-topology"><div><span className="pc-case-eyebrow">FROM A CONFIRMED INPUT TO A TEACHING MODEL</span><h3>从光纤输入，到一个可计算的泵浦焦面</h3><p><strong>教学补全：</strong>准直 → 双透镜扩束 → 聚焦到样品，是本页采用的功能假设。它不是照片的光路复原，收集 / 探测支路仍待确认。</p></div><ol aria-label="光纤输入已确认，其余为教学假设的功能流程">{["光纤输入", "准直", "双透镜扩束", "聚焦", "样品"].map((item, index) => <li key={item}><span>{index === 0 ? "已确认" : "教学假设"}</span><strong>{item}</strong>{index < 4 && <span className="pc-case-topology-arrow" aria-hidden="true">→</span>}</li>)}</ol>{onOpenWorkbench && <button type="button" className="pc-case-workbench-link" onClick={onOpenWorkbench}>打开透镜组合练习 <span aria-hidden="true">↗</span></button>}</div>

    <section className="pc-case-calculation" aria-labelledby="pc-case-calculation-title"><div className="pc-case-mini-heading"><span className="pc-case-eyebrow">CALCULATED EXAMPLE · 教学参数</span><h3 id="pc-case-calculation-title">先算一遍：扩束 2 倍，焦斑会怎样？</h3><p>以下数字全部用于教学，非实物测量。假定准直器后为近准直理想高斯光束；准直器焦距不从照片识别。</p></div><div className="pc-case-assumptions"><span>λ = {teachingExample.wavelengthNm} nm · 假设</span><span>入射 1/e² 直径 = {teachingExample.inputDiameterMm} mm</span><span>f₁ = {teachingExample.f1Mm} mm</span><span>f₂ = {teachingExample.f2Mm} mm</span><span>f₃ = {teachingExample.focusFMm} mm</span><span>M² = 1</span></div><div className="pc-case-result-grid"><div><span>两片正透镜的无焦间隔</span><strong>{lensSeparationMm}<small> mm</small></strong><code>d = f₁ + f₂</code><p>准直入、近准直出；两镜之间有中间焦点。</p></div><div><span>扩束后 1/e² 直径</span><strong>{outputDiameterMm.toFixed(1)}<small> mm</small></strong><code>D₂ / D₁ = |f₂ / f₁| = {beamMagnification}</code><p>在这一理想模型中，光束直径变为原来的 {beamMagnification} 倍。</p></div><div><span>理想几何焦面</span><strong>{teachingExample.focusFMm}<small> mm</small></strong><code>z ≈ f₃</code><p>从聚焦薄透镜向下游量起；仅适用于这里的近准直输入假设。</p></div><div><span>理想焦腰 1/e² 半径</span><strong>{focusRadiusUm.toFixed(2)}<small> μm</small></strong><code>w₀ ≈ λf₃ / (πwL)</code><p>wL = {outputDiameterMm / 2} mm，取聚焦透镜上的光束半径。</p></div></div><p className="pc-case-calculation-limit">焦腰结果来自近轴、近准直的理想高斯束近似，忽略像差、孔径截光及透镜厚度；不是照片平台的真实焦斑。实际光源若为多模或光纤输出未准直，须重新给定光束参数，不能套用此数值。</p></section>

    <details className="pc-case-parameters"><summary><span><span className="pc-case-eyebrow">COMPLETE THE PICTURE</span><strong>把待确认的参数，带回现场核对</strong></span><span className="pc-case-parameter-count">{filled} / 5 项已写草稿 <span aria-hidden="true">＋</span></span></summary><p>这里先写问题或已核实的信息，并注明来源。填写不代表参数已验证；草稿只保存在当前浏览器。</p><div className="pc-case-parameter-fields">{parameterFields.map((field) => <label key={field.id}><span>{field.label}</span><textarea rows={2} value={parameters[field.id]} placeholder={field.placeholder} onChange={(event) => setParameters((previous) => ({ ...previous, [field.id]: event.target.value }))} /></label>)}</div><p className="pc-case-draft-status" role="status">{storageAvailable ? "参数草稿已在本机保存。正式实操结果请记入课程的实操记录。" : "浏览器存储不可用。离开前请自行复制参数草稿，避免丢失。"}</p></details>
  </section>;
}
