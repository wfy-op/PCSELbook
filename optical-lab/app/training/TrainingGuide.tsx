import { useState } from "react";

/** A dimensionless paraxial teaching layout, not a reconstruction of the group photo. */
export function LensBenchArt() {
  return <svg className="ob-bench-art ob-lens-hero" viewBox="0 0 640 370" role="img" aria-labelledby="ob-lens-hero-title">
    <title id="ob-lens-hero-title">两片透镜扩束，再由第三片透镜聚焦的教学示意，非组内实测光路</title>
    <defs>
      <pattern id="ob-lens-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.3" fill="#bdcec4" /></pattern>
      <linearGradient id="ob-lens-glass" x1="0" x2="1"><stop stopColor="#94cbbd" stopOpacity=".3" /><stop offset=".5" stopColor="#dcf2ea" stopOpacity=".8" /><stop offset="1" stopColor="#73a997" stopOpacity=".5" /></linearGradient>
    </defs>
    <rect x="12" y="26" width="616" height="318" rx="18" fill="#dce8df" />
    <rect x="13" y="18" width="614" height="318" rx="18" fill="#edf2e9" stroke="#d0dfd0" />
    <rect x="24" y="29" width="592" height="296" fill="url(#ob-lens-grid)" />
    <path d="M47 164H587" stroke="#8da69a" strokeDasharray="5 6" />
    <path d="M72 154H160L220 164 340 184H455L560 164 455 144H340L220 164 160 174H72Z" fill="#eab777" opacity=".23" />
    {[154, 164, 174].map((y) => { const exit = 164 - 2 * (y - 164); return <path key={y} d={`M72 ${y}H160L340 ${exit}H455L560 164`} fill="none" stroke="#d48a42" strokeWidth={y === 164 ? 1.1 : 1.7} opacity={y === 164 ? .5 : .9} />; })}
    <g fill="#315b4a"><rect x="39" y="142" width="52" height="44" rx="7" /><rect x="85" y="153" width="17" height="22" rx="3" /><rect x="46" y="148" width="23" height="32" rx="3" fill="#507562" /></g>
    {[{ x: 160, r: 33 }, { x: 340, r: 49 }, { x: 455, r: 49 }].map(({ x, r }, i) => <g key={x}>
      <rect x={x - 18} y="241" width="36" height="12" rx="4" fill="#75917c" /><path d={`M${x} ${164 + r}V241`} stroke="#91a993" strokeWidth="7" />
      <ellipse cx={x} cy="164" rx={i === 0 ? 10 : 13} ry={r} fill="url(#ob-lens-glass)" stroke="#5e9b84" strokeWidth="1.8" />
      <text x={x} y="94" textAnchor="middle" fill="#386650" fontSize="14">L{i + 1}</text>
      <text x={x} y="278" textAnchor="middle" fill="#657e67" fontSize="12">{i === 0 ? "正透镜" : i === 1 ? "正透镜" : "聚焦透镜"}</text>
    </g>)}
    <rect x="558" y="130" width="6" height="68" rx="2" fill="#486c58" /><rect x="548" y="199" width="25" height="9" rx="3" fill="#97ac92" />
    <circle cx="560" cy="164" r="4" fill="#eab365" /><text x="560" y="232" textAnchor="middle" fill="#637a63" fontSize="12">目标面</text>
    <text x="66" y="215" textAnchor="middle" fill="#637a63" fontSize="12">准直输入</text>
    <path d="M160 303H340m-180-4v8m180-8v8" stroke="#9fb29b" />
    <text x="250" y="321" textAnchor="middle" fill="#73876c" fontSize="11">两片透镜 · 改变束径</text>
    <rect x="32" y="40" width="149" height="25" rx="12" fill="#fff" fillOpacity=".85" /><circle cx="46" cy="52" r="3" fill="#c58c4f" /><text x="57" y="57" fill="#698064" fontSize="10">LENS SYSTEM / 教学示意</text>
    <text x="590" y="57" textAnchor="end" fill="#9aaa91" fontSize="10">01 → 02 → 03</text>
  </svg>;
}

const guides = [
  { name: "选透镜", title: "先写目标，再选焦距。", intro: "把“想要更亮、更小”改写成可检查的要求：改变束径，传递一个像，还是把光送到样品面。", items: [{ title: "扩束 / 缩束", body: "从所需束径比选择焦距比，再检查有效口径与可用台面长度。" }, { title: "成像 / 中继", body: "先定位物面和像面；倍率确定后，再安排两片透镜之间和两端的距离。" }, { title: "样品面聚焦", body: "同时考虑入射束径、焦距、工作距离与光源波长。实际斑形需要测量。" }], takeaway: "镜片清单：编号、正/负、焦距、口径、镀膜波段。不要把外观相似当作规格相同。" },
  { name: "装透镜", title: "先把机械基准做好。", intro: "透镜组合的调节从固定光高和稳定安装开始。位置可复核，后续的变化才有意义。", items: [{ title: "统一中心高度", body: "根据组内基准固定支杆与镜座高度，检查镜片中心和参考轴的关系。" }, { title: "确认镜片朝向", body: "读取厂家对具体镜型与共轭条件的建议，不能套用“凸面永远朝光源”。" }, { title: "记录距离基准", body: "薄透镜练习使用理想平面；厚透镜、镜筒或物镜需确认主平面和厂家机械基准。" }], takeaway: "一次只加入一片，观察加入前后的轴线和束径变化。固定镜座后再复查，避免把机械晃动当成光学问题。" },
  { name: "找平面", title: "让屏幕告诉你发生了什么。", intro: "光轴、像面和束腰回答的是不同的问题。先确定当前要找的是哪一种平面。", items: [{ title: "光轴", body: "固定的两个参考点约束方向与位置。镜后光束通过一点，不代表整条轴线正确。" }, { title: "像面", body: "使用有细节的靶标，比较清晰度、正倒和尺度；找出可以重复判定的最佳像面。" }, { title: "束腰附近", body: "在允许的条件下测多个纵向位置并记录束径定义，不能用一张小光斑照片证明准直。" }], takeaway: "对于不可见光或不可直接放屏的条件，由带教者指定适配的探测方式；网页上的橙色光线只用于教学。" },
  { name: "验光路", title: "留下别人能够复做的证据。", intro: "完成搭建意味着参数、状态和结果能复核。把一次“调通”变成可以交接的操作。", items: [{ title: "核对布局", body: "记录器件顺序、镜距、光高和光路终点，给每个可调件一个唯一编号。" }, { title: "比较预测与观察", body: "保留模拟预测、原始测量和误差原因三个栏目，读数附单位与测量位置。" }, { title: "检查重复性", body: "按带教要求进行小幅失调与恢复，记录恢复步骤、结果偏差和未解决问题。" }], takeaway: "保存一张可辨认的现场照片、一张光路图和一份参数表。记录是学习证据，不等同于独立上机许可。" },
];

export function LensQuickGuide() {
  const [active, setActive] = useState(0);
  const guide = guides[active];
  return <section className="ob-container ob-guide-section" id="ob-guide" aria-labelledby="ob-guide-title">
    <div className="ob-section-head"><div><span className="ob-overline">AT THE BENCH / 台边速查</span><h2 id="ob-guide-title">从选镜，到可复核的光路</h2></div><p>搭建时随手查，不必从头翻课件。</p></div>
    <div className="ob-guide"><div className="ob-guide-rail" aria-label="选择搭建阶段">{guides.map((item, index) => <button type="button" key={item.name} aria-pressed={active === index} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.name}<span aria-hidden="true">↗</span></button>)}</div>
      <div className="ob-guide-body"><h3>{guide.title}</h3><p>{guide.intro}</p><div className="ob-guide-points">{guide.items.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.body}</p></div>)}</div><p className="ob-guide-takeaway">{guide.takeaway}</p></div>
    </div>
  </section>;
}
