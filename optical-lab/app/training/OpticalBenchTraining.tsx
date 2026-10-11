import { useEffect, useRef, useState } from "react";
import { lessons, sources } from "./course";
import { AlignmentLab, LensLab } from "./TrainingInteractives";
import { LensWorkbench } from "./LensWorkbench";
import { PumpCaseStudy } from "./PumpCaseStudy";
import { LensQuickGuide } from "./TrainingGuide";
import { OpticalPlayground } from "./OpticalPlayground";
import { ComponentTeaching, LearningChallenges } from "./LearningJourney";
import { StorageMigration } from "../optics/StorageMigration";
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
  const [selectedId, setSelectedId] = useState("setup");
  const [panel, setPanel] = useState<Panel>("learn");
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
    <a className="ob-skip" href="#ob-equipment">跳到元件教学</a>
    <div className="ob-topbar"><div className="ob-container ob-topbar-inner"><span className="ob-top-label">教程目录</span><nav className="ob-top-links" aria-label="教程页内目录"><a href="#ob-equipment">1 元件认识</a><a href="#ob-challenges">2 计算与闯关</a><a href="#ob-free">3 自由搭建</a><a href="#ob-pump-case">4 真实光路</a></nav><button className="ob-print-button" type="button" onClick={() => window.print()}>打印</button></div></div>
    <main>
      <section className="ob-container lj-journey-hero" aria-labelledby="ob-title"><h1 id="ob-title">从一束光，认识光路。</h1><p>移动一块屏、转一面镜、收小一个孔。先看见光线的变化，再用公式搭起自己的光路。</p><a className="li-skip-intro" href="#ob-challenges">已经熟悉元件？直接开始计算与闯关</a></section>
      <ComponentTeaching />
      <LearningChallenges />
      <div className="ob-container"><aside className="ob-safety-note"><span className="ob-note-icon" aria-hidden="true">i</span><p><strong>上台之前</strong> · 先完成本组现场培训。光源、挡光与防护条件由带教者确认；网页练习用于理解操作，不替代现场验收。</p><a href="https://ehs.stanford.edu/manual/laser-safety-manual/laser-alignment-guidelines" target="_blank" rel="noreferrer">对准原则 <span aria-hidden="true">↗</span></a></aside></div>

      <section className="ob-container ob-course-section" id="ob-course" aria-labelledby="ob-course-title"><div className="ob-section-head"><div><h2 id="ob-course-title">继续练习：八节基础实训与记录</h2></div><p>先预测 → 再操作 → 留下证据</p></div><div className="ob-course-layout">
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

      <section className="ob-container lj-free-head" id="ob-free"><h2>3. 自由搭建，把所学连成光路</h2><p>基础练习台用于单轴组合；设计工作台支持空间折转、分光、物镜和探测器光斑分析。</p><a className="ob-button ob-button-primary" href="/designer/">进入设计工作台 <Arrow /></a></section>
      <OpticalPlayground />
      <section className="ob-container lj-free-head"><h2>4. 对照真实实验台</h2><p>从现场照片确认入口、器件与观察位置，再留下自己的原始记录。案例中的模拟参数明确标为教学假设。</p></section>
      <section className="ob-container ob-case-section" id="ob-pump-case"><PumpCaseStudy onOpenWorkbench={() => begin("pump-focus", "practice")} /></section>
      <LensQuickGuide />

      <section className="ob-container ob-sources" aria-labelledby="ob-sources-title"><details><summary><span><span className="ob-overline">READ FURTHER</span><strong id="ob-sources-title">这套训练参考了什么？</strong></span><span aria-hidden="true">＋</span></summary><div className="ob-source-grid">{sources.map((source) => <a href={source.url} key={source.id} target="_blank" rel="noreferrer"><strong>{source.title} <span aria-hidden="true">↗</span></strong><p>{source.note}</p></a>)}</div></details></section>
      <StorageMigration />
      <dialog className="ob-export-dialog" ref={exportDialogRef} aria-labelledby="ob-export-title" aria-describedby="ob-export-description">
        <div className="ob-export-heading"><div><span className="ob-overline">YOUR LAB NOTEBOOK</span><h2 id="ob-export-title">导出实操记录</h2></div><button type="button" className="ob-export-close" onClick={() => exportDialogRef.current?.close()} aria-label="关闭导出窗口">×</button></div>
        <p id="ob-export-description">包含全部 {lessons.length} 节的当前记录。下载由浏览器处理；如果没有出现文件，可复制下方 JSON 自行保存。</p>
        <label className="ob-export-label" htmlFor="ob-export-json">记录预览（只读）</label>
        <textarea id="ob-export-json" ref={exportTextRef} value={exportJson} readOnly rows={12} spellCheck={false} />
        <div className="ob-export-actions"><a className="ob-button ob-button-primary" href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`} download="optical-bench-practice.json" onClick={() => setExportMessage("已请求浏览器下载。请检查下载列表；如没有文件，可使用“复制 JSON”。")}>下载 JSON 文件 <span aria-hidden="true">↓</span></a><button type="button" className="ob-button ob-button-secondary" onClick={copyExport}>复制 JSON</button><button type="button" className="ob-text-button" onClick={() => exportDialogRef.current?.close()}>关闭</button></div>
        <p className="ob-export-status" role="status">{exportMessage}</p>
      </dialog>
    </main><footer className="ob-bottom"><div className="ob-container"><a href="https://pcsel-knowledge-site.pages.dev/"><Arrow back /> 返回 PCSELbook</a><span>从会看光路，到会搭、会查、会记录。</span><small>Optical Lab · 独立光学实验室</small></div></footer>
  </div>;
}
