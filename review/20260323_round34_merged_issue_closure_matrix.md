# Round3+Round4 合并闭环台账（已完成）

**日期**：2026-03-23  
**执行规则**：`C-xx` 优先作为 canonical；Round3 旧 ID 挂到 `source_ids`。  
**编译命令**：`latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex`

## A. Canonical 问题池（C-01 ~ C-22）

| canonical_id | source_ids | priority | file_scope | action_type | evidence | compile_check | status |
|---|---|---|---|---|---|---|---|
| C-01 | P0-1,B-08,C-01,C-12 | P0 | refs.bib, ch21b, ch21 | 修 DOI + 条件化重写 | DOI 10.1364/OE.385277 | pass | Resolved |
| C-02 | C-02 | P0 | refs.bib, ch01 | 修 DOI/元数据 | DOI 10.1038/s41377-024-01387-4 | pass | Resolved |
| C-03 | C-03 | P0 | refs.bib, ch01 | 修 DOI/元数据 | DOI 10.1364/OL.575630 | pass | Resolved |
| C-04 | P2-2,A-06,C-04,C-10 | P0 | ch08b, refs.bib | 补 2025 直接证据 + 重排引用 | DOI 10.1038/s41467-025-65860-3 | pass | Resolved |
| C-05 | A-13,B-09,C-05 | P0 | ch22 | 阈值改条件化示例 | DOI 10.1364/OE.521265, 10.1063/5.0199361 | pass | Resolved |
| C-06 | P0-4,C-06,C-07,C-08 | P0 | ch15, fig_ch15 | 降级为教学示意 + 口径声明 | DOI 10.1364/JOSAA.13.001870 | pass | Resolved |
| C-07 | P0-4,C-06,C-07,C-08 | P1 | ch15 | benchmark 元信息补齐 | DOI 10.1364/JOSAA.12.001068 | pass | Resolved |
| C-08 | P0-4,C-06,C-07,C-08 | P1 | ch15 | 分层门槛（探索/发布/本书算例） | 方法学文献 + 本书口径 | pass | Resolved |
| C-09 | C-09 | P1 | ch20, refs.bib | 前沿补证（2024-2025） | DOI 10.1063/5.0205483, 10.1364/OE.580979 | pass | Resolved |
| C-10 | P2-2,A-06,C-04,C-10 | P1 | ch20b | quasi-BFIC + 有限尺寸边界 | DOI 10.1038/s41467-025-65860-3, 10.1364/OE.580979 | pass | Resolved |
| C-11 | P1-4,A-12,C-11 | P1 | ch21, refs.bib | 公式链引文 + 适用条件 | DOI 10.1109/JQE.1982.1071522 等 | pass | Resolved |
| C-12 | P0-1,B-08,C-01,C-12 | P1 | ch21b | ε_g 平台条件化 + PCSEL 高速文献 | DOI 10.1364/OE.385277 | pass | Resolved |
| C-13 | C-13 | P1 | ch16 | Q_c 改平台分表 + 来源列 | DOI 10.1038/s44287-024-00113-x, 10.1002/lpor.202500271 | pass | Resolved |
| C-14 | B-01,B-02,C-14 | P1 | ch17 | 增益谱窗口波段绑定 | DOI 10.1038/s41377-024-01387-4, 10.1364/OE.521265 | pass | Resolved |
| C-15 | P1-5,B-10,C-15 | P1 | ch23 | 例题 provenance 元数据补齐 | 脚本路径/版本/参数文件 | pass | Resolved |
| C-16 | A-14,C-16 | P1 | ch24 | 启发式降级 + 文献锚点 | DOI 10.1364/OE.580979, 10.1038/s41586-023-06059-8 | pass | Resolved |
| C-17 | A-15,C-17 | P1 | ch27 | 发布级容差改“本书建议门槛” | DOI 10.1364/JOSAA.13.001870 | pass | Resolved |
| C-18 | C-18 | P1 | ch01 | 器件对照新增“不可直接比较项” | 多文献并表边界说明 | pass | Resolved |
| C-19 | B-11,C-19 | P2 | notation / 跨章 | 新增[预印本补充]规范 | 写作规范项 | pass | Resolved |
| C-20 | C-20 | P2 | ch01,ch08b,ch20,ch21 | 外推边界三元注释模板 | DOI 10.1038/s44287-024-00113-x 等 | pass | Resolved |
| C-21 | P2-1,C-21 | P2 | ch01,ch20,ch21 | 2024-2026 前沿对照表 | DOI 10.1038/s41566-025-01782-2 等 | pass | Resolved |
| C-22 | P2-3,C-22 | P2 | ch08b,ch20b,ch23 | 有限尺寸最小报告模板四要素 | DOI 10.1364/OE.580979 | pass | Resolved |

## B. Round3 回归核验清单（不重复立 canonical）

| round3_id | mapped_to_canonical | file_scope | verify_rule | compile_check | status |
|---|---|---|---|---|---|
| P0-2 | - | ch07 | 数值三元写法仍在 | pass | Verified |
| P0-3 | - | ch19 | 条件化+标签仍在 | pass | Verified |
| P1-1 | - | ch03 | 弱磁近似+引文仍在 | pass | Verified |
| P1-2 | - | ch09 | “数量级一致”口径仍在 | pass | Verified |
| P1-3 | - | ch13 | RCWA 经验边界仍在 | pass | Verified |
| A-01 | - | ch01 | 边发散角条件化仍在 | pass | Verified |
| A-02 | - | ch01 | VCSEL 平台边界仍在 | pass | Verified |
| A-03 | - | ch02 | 量纲来源标签仍在 | pass | Verified |
| A-04 | - | ch05 | 45° 示意角口径仍在 | pass | Verified |
| A-05 | - | ch08 | 群论锚点引文仍在 | pass | Verified |
| A-07 | - | ch10 | 5-10% 工程阈值标签仍在 | pass | Verified |
| A-08 | - | ch14 | PML/网格经验初值口径仍在 | pass | Verified |
| A-09 | - | ch17 | QW 厚度平台条件化仍在 | pass | Verified |
| A-10 | - | ch18 | 接触/拥挤标签分层仍在 | pass | Verified |
| A-11 | - | ch20b | ΔG 为本书设计规则仍在 | pass | Verified |
| B-03 | - | ch03 | 复杂度 benchmark 依赖仍在 | pass | Verified |
| B-04 | - | ch05 | 误差口径为本书算例仍在 | pass | Verified |
| B-05 | - | ch09 | 数值来源类型标签仍在 | pass | Verified |
| B-06 | - | ch12 | 收敛结论引文仍在 | pass | Verified |
| B-07 | - | ch19 | R_th 工程经验边界仍在 | pass | Verified |

## C. 编译记录

| stage | command | result | note |
|---|---|---|---|
| baseline | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | up-to-date |
| C-01 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | bibtex + xelatex + xdvipdfmx 完成（命令超时返回但构建成功） |
| C-02 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | refs.bib 变更后重跑 bibtex 通过 |
| C-03 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | 增量检查（Nothing to do） |
| C-04 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch08b 前沿论断重写后通过 |
| C-05 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch22 阈值口径改为条件化示例并保留适用边界 |
| C-06 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch15 雷达图口径降级为教学示意 |
| C-07 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch15 补 benchmark 元信息与方法学引文 |
| C-08 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch15 新增探索/本书算例/发布级三层门槛表 |
| C-09 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch20 补 2024--2025 规模化与有限尺寸证据 |
| C-10 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch20b 增加 quasi-BFIC 与有限尺寸联动边界 |
| C-11 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch21 线宽公式链补源并加适用条件 |
| C-12 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch21b ε_g 改平台条件化与 PCSEL 高速证据 |
| C-13 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch16 Q_c 平台分表 + 来源类型列 |
| C-14 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch17 增益谱窗口改波段绑定并补文献 |
| C-15 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch23 新增脚本/参数/哈希 provenance |
| C-16 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch24 启发式阈值降级并补有限尺寸文献锚点 |
| C-17 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch27 “发布级”改“本书建议门槛”并可重定义 |
| C-18 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch01 对照表新增“不可直接比较项”列 |
| C-19 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | notation 新增证据标签规范（含预印本补充） |
| C-20 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | preamble/章节统一三元外推注释模板 |
| C-21 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch01 新增 2024--2026 前沿对照表并跨章引用 |
| C-22 | latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | ch08b/ch20b/ch23 统一“四要素”最小报告模板 |
| final-check | latexmk -g -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex | pass | 终验通过；无 undefined citation/reference/fatal 错误 |
