import { useEffect, useRef, useState } from "react";
import { equipmentCards, lessons, sources } from "./course";
import { AlignmentLab, LensLab } from "./TrainingInteractives";
import { LensWorkbench } from "./LensWorkbench";
import { PumpCaseStudy } from "./PumpCaseStudy";
import { LensBenchArt, LensQuickGuide } from "./TrainingGuide";
import { OpticalPlayground } from "./OpticalPlayground";
import "./training.css";

type Note = { station: string; conditions: string; measurements: string; reflection: string; checked: string[] };
type Notes = Record<string, Note>;
type Panel = "learn" | "practice" | "record";
const STORAGE_KEY = "pcsel-training-demo-notes-v1";
const emptyNote = (): Note => ({ station: "", conditions: "", measurements: "", reflection: "", checked: [] });

function readNotes(): Notes {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || stored.version !== 1 || typeof stored.records !== "object" || !stored.records) return {};
    const result: Notes = {};
    for (const lesson of lessons) {
      const item = stored.records[lesson.id];
      if (!item || typeof item !== "object") continue;
      if (!["station", "conditions", "measurements", "reflection"].every((key) => typeof item[key] === "string")) continue;
      result[lesson.id] = { station: item.station, conditions: item.conditions, measurements: item.measurements, reflection: item.reflection, checked: Array.isArray(item.checked) ? item.checked.filter((value: unknown) => typeof value === "string" && lesson.checkpoints.includes(value)) : [] };
    }
    return result;
  } catch { return {}; }
}

function Arrow({ back = false }: { back?: boolean }) {
  return <svg className="ob-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={back ? "M20 12H4m6-6-6 6 6 6" : "M4 12h16m-6-6 6 6-6 6"} /></svg>;
}

function EquipmentIcon({ index }: { index: number }) {
  const shapes = [<g key="mirror"><path d="m12 45 32-32" strokeWidth="5" /><path d="m14 25 13 4 4 13M30 32v16H18" /></g>, <g key="iris"><circle cx="28" cy="25" r="16" /><circle cx="28" cy="25" r="6" /><path d="M28 41v9M16 50h24m1-38 4-4" /></g>, <g key="lens"><path d="M28 8q-17 19 0 38 17-19 0-38ZM6 27h13m18 0h13M23 49h10" /></g>, <g key="post"><path d="M25 8h6v30h-6ZM20 28h16v17H20ZM10 46h36v6H10Zm22-12h10" /></g>, <g key="block"><path d="M35 10v33M29 10h12v33H29ZM18 49h32M7 26h20m-6-5 6 5-6 5" /></g>, <g key="sensor"><rect x="19" y="10" width="28" height="35" rx="5" /><circle cx="33" cy="27" r="9" /><path d="M5 27h14m14 18v8" /></g>, <g key="negative"><path d="M18 8q12 20 0 40h20q-12-20 0-40ZM5 28h15m16 0h15" /></g>, <g key="achromat"><path d="M28 8q-21 20 0 40 21-20 0-40Zm0 0q12 20 0 40M5 28h12m22 0h12" /></g>, <g key="stage"><rect x="8" y="37" width="40" height="13" rx="2" /><circle cx="28" cy="20" r="12" /><circle cx="28" cy="20" r="8" /><path d="M28 32v5M13 44h30m5-7 5-5" /></g>];
  return <svg className="ob-equipment-icon" viewBox="0 0 56 56" aria-hidden="true">{shapes[index] ?? shapes[2]}</svg>;
}

function ScenarioCards() {
  const cases = [
    { title: "近处居中，远处却偏了", prompt: "光源和两个光阑的位置已经固定。下一步怎么做？", options: ["把远光阑挪到光斑处", "交替小步调镜，并回查两个参考点", "只要有光通过就结束"], correct: 1, explanation: "保留参考轴。近点和远点共同约束位置与方向，调节一个镜子后仍要回查另一处。" },
    { title: "一张屏上的光斑特别小", prompt: "这能证明光束已经准直吗？", options: ["能，光斑越小越准直", "不能，那里也可能是焦点", "只要足够亮就可以"], correct: 1, explanation: "轴线对准与束径演化是两个问题。需要在明确的传播区间比较多个位置，而不是仅观察一个截面。" },
    { title: "功率读数突然变小", prompt: "现有信息不足以确定故障，先做哪类检查？", options: ["立即提高光源输出", "同时调镜和量程，直到数值变大", "保持源条件，依次查遮挡、接收范围和仪器设置"], correct: 2, explanation: "一次检查一个变量，保留原始读数。截光、接收不完整、设置错误和源漂移都可能造成变化。" },
  ];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  return <div className="ob-scenarios"><div className="ob-subheading"><span className="ob-overline">THINK BEFORE YOU TURN</span><h3>先判断，再动旋钮</h3><p>选择你的下一步。每道题都可以重新尝试。</p></div>{cases.map((item, i) => <fieldset key={item.title} className="ob-scenario"><legend>{i + 1}. {item.title}</legend><p>{item.prompt}</p><div className="ob-options">{item.options.map((option, j) => <button type="button" key={option} aria-pressed={answers[i] === j} className={answers[i] === j ? "is-selected" : ""} onClick={() => setAnswers((previous) => ({ ...previous, [i]: j }))}>{option}</button>)}</div>{answers[i] !== undefined && <p className={`ob-answer ${answers[i] === item.correct ? "is-correct" : "is-retry"}`} role="status"><strong>{answers[i] === item.correct ? "判断正确。" : "再想一步。"}</strong>{item.explanation}</p>}</fieldset>)}</div>;
}

export function OpticalBenchTraining() {
  const [selectedId, setSelectedId] = useState("lens-pair");
  const [panel, setPanel] = useState<Panel>("practice");
  const [notes, setNotes] = useState<Notes>(readNotes);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [exportJson, setExportJson] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const exportTextRef = useRef<HTMLTextAreaElement>(null);
  const selected = lessons.find((item) => item.id === selectedId) ?? lessons[0];
  const note = notes[selected.id] ?? emptyNote();
  const selectedIndex = lessons.findIndex((item) => item.id === selected.id);
  const recordedCount = lessons.filter((item) => Boolean(notes[item.id]?.measurements.trim())).length;
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: notes })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [notes]);

  function selectLesson(id: string, nextPanel: Panel = "learn") {
    setSelectedId(id); setPanel(nextPanel);
  }
  function begin(id: string, nextPanel: Panel) {
    selectLesson(id, nextPanel);
    document.getElementById("ob-course")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function updateNote(change: Partial<Note>) {
    setNotes((previous) => ({ ...previous, [selected.id]: { ...(previous[selected.id] ?? emptyNote()), ...change } }));
  }
  function exportNotes() {
    setExportJson(JSON.stringify({ schema: "pcsel-training-practice-v1", exportedAt: new Date().toISOString(), description: "学生自行填写的练习记录；不代表导师验收或独立操作授权。空项未记录。", records: lessons.map((lesson) => ({ lesson: lesson.title, lessonId: lesson.id, ...(notes[lesson.id] ?? emptyNote()) })) }, null, 2));
    setExportMessage("记录内容已生成。请选择下载文件或复制 JSON 保存。");
    exportDialogRef.current?.showModal();
  }
  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportJson);
      setExportMessage("JSON 已复制到剪贴板，可粘贴到文本文件中保存。");
    } catch {
      exportTextRef.current?.focus();
      exportTextRef.current?.select();
      setExportMessage("浏览器未允许自动复制。已选中文本，请按 Ctrl+C（Mac 使用 ⌘C）手动复制。");
    }
  }

  return <div className="ob-page">
    <a className="ob-skip" href="#ob-course">跳到实训内容</a>
    <div className="ob-topbar"><div className="ob-container ob-topbar-inner"><span className="ob-top-label">教程目录</span><nav className="ob-top-links" aria-label="教程页内目录"><a href="#optical-playground">基础练习台</a><a href="#ob-course">透镜与光路</a><a href="#ob-pump-case">组内案例</a><a href="#ob-guide">台边速查</a></nav><button className="ob-print-button" type="button" onClick={() => window.print()}>打印</button></div></div>
    <main>
      <section className="ob-hero ob-container" aria-labelledby="ob-title"><div className="ob-hero-copy"><div className="ob-overline"><span className="ob-mini-line" /> THE OPTICS WORKSHOP · 光路搭建实训</div><h1 id="ob-title">先选透镜，<br />再搭一条光路。</h1><p>从一片透镜，到扩束、中继和样品面聚焦。<br />先在交互台上理解组合，再回到真实实验台。</p><div className="ob-hero-actions"><button className="ob-button ob-button-primary" type="button" onClick={() => document.getElementById("optical-playground")?.scrollIntoView({ behavior: "smooth" })}>进入基础练习台 <Arrow /></button><button className="ob-text-button" type="button" onClick={() => document.getElementById("ob-pump-case")?.scrollIntoView({ behavior: "smooth" })}>看组内光泵案例 <span aria-hidden="true">↗</span></button></div><aside className="ob-design-cta" aria-label="继续设计工作台"><div><strong>把所学用到自己的光路</strong><p>完成教程练习后，组合器件、比较方案，保存自己的设计工程。</p></div><a href="/optics/designer/">进入设计工作台 <Arrow /></a></aside><div className="ob-hero-meta"><span><b>{String(lessons.length).padStart(2, "0")}</b> 基础任务</span><span><b>04</b> 透镜组合</span><span><b>01</b> 组内案例</span></div></div><div className="ob-hero-visual"><div className="ob-art-number">BUILD / EXPAND / FOCUS</div><LensBenchArt /><div className="ob-art-caption"><span className="ob-light-dot" /><span>镜片的顺序与间距，决定光线去哪里。</span><span className="ob-art-scale">示意 · 非实测</span></div></div></section>
      <OpticalPlayground />
      <section className="ob-container ob-launchpad" aria-label="选择学习入口">
        <button type="button" onClick={() => begin("lens-pair", "practice")}><span className="ob-launch-number">01 / SIMULATE</span><strong>在透镜组合台上试一试 <span aria-hidden="true">↗</span></strong><p>换焦距、改镜距，看扩束、成像和聚焦如何变化。</p><span className="ob-launch-tag">4 个预设 · 可调参数</span></button>
        <button type="button" onClick={() => begin("setup", "learn")}><span className="ob-launch-number">02 / BUILD</span><strong>沿着任务卡，从零开始 <span aria-hidden="true">↗</span></strong><p>从固定光高到透镜组合，每节都有步骤和自查。</p><span className="ob-launch-tag">{lessons.length} 节课程 · 实操记录</span></button>
        <button type="button" onClick={() => document.getElementById("ob-pump-case")?.scrollIntoView({ behavior: "smooth" })}><span className="ob-launch-number">03 / EXPLORE</span><strong>走进组内光泵实验台 <span aria-hidden="true">↗</span></strong><p>从蓝色光纤入口出发，对照现场拆解搭建任务。</p><span className="ob-launch-tag">现场照片 · 教学案例</span></button>
      </section>
      <div className="ob-container"><aside className="ob-safety-note"><span className="ob-note-icon" aria-hidden="true">i</span><p><strong>上台之前</strong> · 先完成本组现场培训。光源、挡光与防护条件由带教者确认；网页练习用于理解操作，不替代现场验收。</p><a href="https://ehs.stanford.edu/manual/laser-safety-manual/laser-alignment-guidelines" target="_blank" rel="noreferrer">对准原则 <span aria-hidden="true">↗</span></a></aside></div>

      <section className="ob-container ob-course-section" id="ob-course" aria-labelledby="ob-course-title"><div className="ob-section-head"><div><span className="ob-overline">LEARN BY DOING</span><h2 id="ob-course-title">学一点，搭一段，再检查</h2></div><p>先预测 → 再操作 → 留下证据</p></div><div className="ob-course-layout">
        <aside className="ob-curriculum-nav" aria-label="选择实训任务"><div className="ob-nav-kicker">基础实训 / {lessons.length} 个任务</div>{lessons.map((lesson) => <button type="button" key={lesson.id} className={`ob-lesson-link ${selected.id === lesson.id ? "is-active" : ""}`} aria-current={selected.id === lesson.id ? "step" : undefined} onClick={() => selectLesson(lesson.id, ["alignment", "imaging", "lens-pair", "relay", "pump-focus"].includes(lesson.id) ? "practice" : "learn")}><span className="ob-lesson-number">{lesson.number}</span><span><strong>{lesson.title}</strong><small>{lesson.duration}</small></span><span className="ob-lesson-indicator" aria-hidden="true">{notes[lesson.id]?.measurements.trim() ? "✓" : "›"}</span></button>)}<div className="ob-nav-foot"><span className="ob-overline">YOUR LAB NOTEBOOK</span><strong>{recordedCount}<small> / {lessons.length} 节已填写观察</small></strong><p>记录在当前浏览器保存。<br />实际操作后，再填写实测结果。</p><button type="button" className="ob-text-button" onClick={exportNotes}>导出全部记录 <span aria-hidden="true">↓</span></button></div></aside>
        <article className="ob-lesson-main" aria-labelledby="ob-lesson-title"><div className="ob-lesson-heading"><div><span className="ob-overline">LESSON {selected.number} <span className="ob-slash">/</span> 基础实训</span><h2 id="ob-lesson-title">{selected.title}</h2><p>{selected.summary}</p></div><span className="ob-time-label">{selected.duration}</span></div>
          <div className="ob-tabs" role="tablist" aria-label="学习方式">{([{ id: "learn", name: "知识与步骤", label: "01" }, { id: "practice", name: "交互练习", label: "02" }, { id: "record", name: "实操记录", label: "03" }] as const).map((tab) => <button key={tab.id} id={`ob-tab-${tab.id}`} role="tab" type="button" aria-selected={panel === tab.id} aria-controls="ob-tab-panel" tabIndex={panel === tab.id ? 0 : -1} onKeyDown={(event) => { const panels: Panel[] = ["learn", "practice", "record"]; let next: Panel | undefined; if (event.key === "ArrowRight") next = panels[(panels.indexOf(panel) + 1) % 3]; if (event.key === "ArrowLeft") next = panels[(panels.indexOf(panel) + 2) % 3]; if (event.key === "Home") next = "learn"; if (event.key === "End") next = "record"; if (next) { event.preventDefault(); setPanel(next); document.getElementById(`ob-tab-${next}`)?.focus(); } }} onClick={() => setPanel(tab.id)}><span>{tab.label}</span>{tab.name}</button>)}</div>
          <div className="ob-panel" id="ob-tab-panel" role="tabpanel" aria-labelledby={`ob-tab-${panel}`} tabIndex={0}>
            {panel === "learn" && <><div className="ob-concepts">{selected.concepts.map((concept) => <div key={concept.title}><h3>{concept.title}</h3><p>{concept.body}</p></div>)}</div><div className="ob-equipment-list"><strong>准备这些器材</strong>{selected.equipment.map((item) => <span key={item}>{item}</span>)}</div><h3 className="ob-steps-title">按这个顺序做</h3><ol className="ob-steps">{selected.steps.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol><div className="ob-pitfall"><strong>容易忽略的一件事</strong><p>{selected.pitfall}</p></div><button type="button" className="ob-button ob-button-secondary" onClick={() => setPanel("practice")}>先做一个网页练习 <Arrow /></button></>}
            {panel === "practice" && (selected.id === "alignment" ? <AlignmentLab /> : selected.id === "imaging" ? <LensLab /> : ["lens-pair", "relay", "pump-focus"].includes(selected.id) ? <LensWorkbench key={selected.id} initialPreset={selected.id === "relay" ? "relay" : selected.id === "pump-focus" ? "pump" : "kepler"} /> : <ScenarioCards />)}
            {panel === "record" && <div className="ob-record"><div className="ob-record-intro"><span className="ob-tag">由你填写 · 原始观察</span><h3>让下一位同学，也能复核这条光路。</h3><p>{selected.recordPrompt}</p></div><div className="ob-field-grid"><label>训练台 / 器件编号<input value={note.station} onChange={(event) => updateNote({ station: event.target.value })} placeholder="例如：训练台编号，镜架或透镜编号" /></label><label>操作条件<input value={note.conditions} onChange={(event) => updateNote({ conditions: event.target.value })} placeholder="光源条件、光高、仪器设置；未知项注明" /></label></div><label>观察与原始读数<textarea aria-label="观察与原始读数" rows={5} value={note.measurements} onChange={(event) => updateNote({ measurements: event.target.value })} placeholder="操作后填写。保留单位、测量位置和前后变化，不填网页模拟值。" /></label><label>我的判断 / 仍需确认<textarea aria-label="我的判断 / 仍需确认" rows={3} value={note.reflection} onChange={(event) => updateNote({ reflection: event.target.value })} placeholder="发现了什么？依据是什么？下一步准备检查哪里？" /></label><fieldset className="ob-checkpoints"><legend>完成后，逐项自查</legend>{selected.checkpoints.map((checkpoint) => <label key={checkpoint}><input type="checkbox" checked={note.checked.includes(checkpoint)} onChange={(event) => updateNote({ checked: event.target.checked ? [...note.checked, checkpoint] : note.checked.filter((item) => item !== checkpoint) })} /><span>{checkpoint}</span></label>)}</fieldset><div className="ob-record-actions"><button type="button" className="ob-button ob-button-primary" onClick={exportNotes}>导出记录 <span aria-hidden="true">↓</span></button><button type="button" className="ob-button ob-button-secondary" onClick={() => window.print()}>打印本节任务卡</button></div><p className="ob-storage-status" role="status">{storageAvailable ? "已在当前浏览器保存 · 自查勾选不代表导师验收" : "浏览器存储不可用，请导出记录以免丢失。"}</p></div>}
          </div>
          <div className="ob-print-only"><h3>器材</h3><p>{selected.equipment.join("、")}</p><h3>操作步骤</h3><ol>{selected.steps.map((step) => <li key={step}>{step}</li>)}</ol><h3>自查项目</h3>{selected.checkpoints.map((item) => <p key={item}>{note.checked.includes(item) ? "☑" : "□"} {item}</p>)}<h3>原始记录</h3><p>训练台：{note.station || "________________"} 条件：{note.conditions || "________________"}</p><p className="ob-print-notes">{note.measurements || "原始观察与读数：\n\n\n\n"}</p><p className="ob-print-notes">{note.reflection || "判断与待确认事项：\n\n"}</p><p>带教者现场复核：________________ 日期：________________</p><p>来源：{selected.sourceIds.map((id) => sources.find((source) => source.id === id)?.title).filter(Boolean).join("；")}</p></div>
          <div className="ob-lesson-bottom"><span>本节依据 {selected.sourceIds.map((id, i) => { const source = sources.find((item) => item.id === id); return source ? <a href={source.url} target="_blank" rel="noreferrer" key={id}>{i > 0 ? " · " : ""}{source.title}</a> : null; })}</span>{selectedIndex < lessons.length - 1 && <button type="button" onClick={() => selectLesson(lessons[selectedIndex + 1].id, "learn")}>下一课 <Arrow /></button>}</div>
        </article>
      </div></section>

      <section className="ob-container ob-case-section" id="ob-pump-case"><PumpCaseStudy onOpenWorkbench={() => begin("pump-focus", "practice")} /></section>
      <LensQuickGuide />
      <section className="ob-container ob-equipment-section" id="ob-equipment" aria-labelledby="ob-equipment-title"><div className="ob-section-head"><div><span className="ob-overline">MEET YOUR TOOLS</span><h2 id="ob-equipment-title">认清每一件器材，再把它装上台</h2></div><p>知道它做什么，也知道该检查什么。</p></div><div className="ob-equipment-grid">{equipmentCards.map((item, index) => <details className="ob-equipment-card" key={item.name}><summary><EquipmentIcon index={index} /><span className="ob-equipment-en">{item.en}</span><strong>{item.name}</strong><span className="ob-equipment-purpose">{item.purpose}</span><span className="ob-equipment-more">上台前检查 <span aria-hidden="true">＋</span></span></summary><p>{item.check}</p></details>)}</div></section>

      <section className="ob-container ob-sources" aria-labelledby="ob-sources-title"><details><summary><span><span className="ob-overline">READ FURTHER</span><strong id="ob-sources-title">这套训练参考了什么？</strong></span><span aria-hidden="true">＋</span></summary><div className="ob-source-grid">{sources.map((source) => <a href={source.url} key={source.id} target="_blank" rel="noreferrer"><strong>{source.title} <span aria-hidden="true">↗</span></strong><p>{source.note}</p></a>)}</div></details></section>
      <dialog className="ob-export-dialog" ref={exportDialogRef} aria-labelledby="ob-export-title" aria-describedby="ob-export-description">
        <div className="ob-export-heading"><div><span className="ob-overline">YOUR LAB NOTEBOOK</span><h2 id="ob-export-title">导出实操记录</h2></div><button type="button" className="ob-export-close" onClick={() => exportDialogRef.current?.close()} aria-label="关闭导出窗口">×</button></div>
        <p id="ob-export-description">包含全部 {lessons.length} 节的当前记录。下载由浏览器处理；如果没有出现文件，可复制下方 JSON 自行保存。</p>
        <label className="ob-export-label" htmlFor="ob-export-json">记录预览（只读）</label>
        <textarea id="ob-export-json" ref={exportTextRef} value={exportJson} readOnly rows={12} spellCheck={false} />
        <div className="ob-export-actions"><a className="ob-button ob-button-primary" href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`} download="optical-bench-practice.json" onClick={() => setExportMessage("已请求浏览器下载。请检查下载列表；如没有文件，可使用“复制 JSON”。")}>下载 JSON 文件 <span aria-hidden="true">↓</span></a><button type="button" className="ob-button ob-button-secondary" onClick={copyExport}>复制 JSON</button><button type="button" className="ob-text-button" onClick={() => exportDialogRef.current?.close()}>关闭</button></div>
        <p className="ob-export-status" role="status">{exportMessage}</p>
      </dialog>
    </main><footer className="ob-bottom"><div className="ob-container"><a href="/"><Arrow back /> 返回 PCSELbook</a><span>从会看光路，到会搭、会查、会记录。</span><small>光路实训 · 本地预览 v0.3</small></div></footer>
  </div>;
}
