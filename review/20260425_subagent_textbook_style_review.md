# PCSELbook 全书教科书语体审阅与修订报告（Subagent）

- 日期：2026-04-25
- 目标：降低正文中的模板化、讲稿化和口语化表达，使行文更接近正式中文教科书。
- 范围：前言、`notation.tex` 检查、全部 28 个正文/附录章节，以及 `ch14` 方法比较表。
- 方法：4 个 subagent 按章节组并行审阅并直接修订，主线程统一复核残留高风险表达、补修建议阅读模板与口语比喻，并进行编译验证。

## 分工

- Kant：前言、记号页、Ch01--Ch07。
- Archimedes：Ch08、Ch08b、Ch09--Ch11。
- Hypatia：Ch12--Ch15、Ch22--Ch24、`comparison_table.tex`。
- Kepler：Ch16--Ch21、Ch21b、Ch25--Ch28。

## 修订原则

- 保留物理含义、公式、引用、label、章节结构和图表接口。
- 不进行与语体无关的大规模重写。
- 优先处理以下问题：
  - “这条阅读的重点是……”等重复模板尾句；
  - “漂亮图、跑通、翻车、背锅、神秘脚本、舞台”等口语或比喻；
  - “真正关键、最强工具、革命性、历史必然性”等过强判断；
  - “不是……而是……”过密使用造成的讲稿腔；
  - 软件宣传式表述，改为控制方程、适用边界、误差来源和验证路径。

## 已落地修改

- 全书 33 个文本文件发生语体修订：
  - `frontmatter/preface.tex`
  - `chapters/ch01_introduction.tex` -- `chapters/ch28_glossary_symbols.tex`
  - `chapters/ch14_fdtd_fem_for_pcsel/comparison_table.tex`
- `notation.tex` 已检查，未发现需要语体修订的内容。
- 主线程补修了 CWT/TCMT 章节中残留的建议阅读模板，并收紧了数值方法和器件章节中的“黑箱”“舞台”等表达。
- `comparison_table.tex` 中原有乱码式中文被替换为正常中文表述，表格结构和 `\label{tab:ch14_method_comparison}` 保持不变。

## 典型改法

- “历史必然性/生态位/革命性进步”改为“技术背景/器件定位/重要改进”。
- “把脚本跑通/漂亮图/黑箱软件吐出的曲线”改为“脚本完成运行/场图或谱图/求解器输出与通道定义”。
- “纵向舞台”改为“纵向模式背景”。
- “这条阅读的重点是……”类尾句改为直接列出建议阅读对象或需要核对的模型接口。
- “最强工具/万能模型”改为“适用范围/模型基底/失效条件”。

## 回归检查

- `git diff --check -- chapters frontmatter notation.tex` 通过；仅有 Git 的 LF/CRLF 提示。
- 残留高风险词 grep 已复查：仅保留少量物理语境中合理的“真正可靠”“最关键”等限定表达。
- 已执行全书 `latexmk -g -xelatex -interaction=nonstopmode -halt-on-error main.tex` 编译验证，结果通过。
- `main.log` 中未检出 `Overfull/Underfull/Undefined reference/Citation undefined/LaTeX Warning` 条目。
