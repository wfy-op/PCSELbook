# Round3 问题闭环矩阵（执行版）

更新时间：2026-03-23  
对应审阅：`review/20260323_academic_accuracy_review_round3.md`  
状态说明：`Resolved` = 已完成正文改写并可编译；`Partially Resolved` = 已降级为教学/工程口径，后续可继续补实验数据。

| ID | 状态 | 已落地位置（主） | 处置方式 | 证据/口径 |
|---|---|---|---|---|
| P0-1 | Resolved | `ch21b_dynamics_modulation_noise.tex` | GHz 与最优偏置改为条件化，明确教学示意 | `coldren2012`, `itoh2020` |
| P0-2 | Resolved | `ch07_threshold_gain_loss.tex` | 损耗分量改为“范围+条件+来源” | `coldren2012`, `zhoupan2023` |
| P0-3 | Resolved | `ch19_thermal_electro_optic_coupling.tex` | `dn/dT`,`dg/dT` 条件化并分标签 | `dellacorte2000thermooptic` |
| P0-4 | Resolved | `ch15_method_comparison_workflow.tex` | 增加 benchmark 前提声明 | [本书算例]/[工程经验] |
| P1-1 | Resolved | `ch03_maxwell_periodic_media.tex` | `\mu_r≈1` 改为弱磁近似+引用 | `joannopoulos2008`, `coldren2012` |
| P1-2 | Resolved | `ch09_cwt_minimal_model.tex` | “与实验吻合”改为数量级一致并加文献 | `liang2012square`, `liang2013triangular`, `yoshida2023` |
| P1-3 | Resolved | `ch13_rcwa_open_periodic_threshold.tex` | 分层层数改为经验初值+收敛必验 | `li1996`, `moharam1981` |
| P1-4 | Resolved | `ch21_linewidth_coherence_brightness.tex` | 增补“何时升级模型”判据 | `suh2004tcmt`, `itoh2020`, `yoshida2023` |
| P1-5 | Resolved | `ch23_worked_example.tex` | 参数表新增来源/用途列 | [本书算例]/[工程经验] |
| P2-1 | Resolved | `ch01/ch20/ch21` | 新增 2024–2026 前沿小节 | `inoue2025fmpcsel`, `bian2024resonatorpcsel`, `yoshida2023` |
| P2-2 | Resolved | `ch08b/ch20b` | 增补 quasi-BFIC 与边界对照 | `qin2025quasibfic`, `koshelev2018quasibic` |
| P2-3 | Resolved | `ch08b/ch09/ch20b` | 增设“无限周期不可直接外推”警示框 | 方法学约束+尺寸收敛要求 |
| A-01 | Resolved | `ch01_introduction.tex` | 边发射发散角/尺寸数值条件化 | `coldren2012` |
| A-02 | Resolved | `ch01_introduction.tex` | VCSEL 阈值/DBR 对数改为平台相关 | `coldren2012`, `sarzala2010oxideproton` |
| A-03 | Resolved | `ch02_mathematical_roadmap.tex` | 量纲表注加入来源类型声明 | [教学示意]/[本书算例] |
| A-04 | Resolved | `ch05_band_gamma_mode_selection.tex` | 45° 改为示意角，不再绝对化 | [教学示意] |
| A-05 | Resolved | `ch08_polarization_symmetry_farfield.tex` | 群论判据补基础文献锚点 | `sakoda2005`, `joannopoulos2008`, `hsu2016` |
| A-06 | Resolved | `ch08b_bic_quasibic.tex` | `Q~delta^-2` 补直接来源 | `koshelev2018quasibic` |
| A-07 | Resolved | `ch10_cwt_higher_order_3d.tex` | 5%-10% 标注为工程筛选阈值 | [工程经验] |
| A-08 | Resolved | `ch14_fdtd_fem_for_pcsel.tex` | PML/网格建议改为经验初值+引用 | `berenger1994`, `taflove2005` |
| A-09 | Resolved | `ch17_qw_active_gain_models.tex` | QW 厚度改为平台相关表述 | `coldren2012` + 条件化 |
| A-10 | Resolved | `ch18_electrical_injection_transport.tex` | 接触/拥挤数值分文献值与示意 | `coldren2012` + 标签化 |
| A-11 | Resolved | `ch20b_robustness_tolerance.tex` | `ΔG` 门槛标注为本书设计规则 | [本书设计规则] |
| A-12 | Resolved | `ch21_linewidth_coherence_brightness.tex` | `alpha_H` 与倍数估计补来源与边界 | `henry1982`, `coldren2012` |
| A-13 | Resolved | `ch22_practical_simulation_workflow.tex` | `dλ/dT` 增加条件与文献 | `zhang1999doublefusedvcsel` |
| A-14 | Resolved | `ch24_failure_modes.tex` | 阵列尺度规则改为启发式+收敛要求 | [工程经验] + 尺寸扫描 |
| A-15 | Resolved | `ch27_simulation_checklists.tex` | 容差等级与结论强度绑定 | [探索级]/[发布级] |
| B-01 | Resolved | `ch17_qw_active_gain_models.tex` | 修正“压应变→TM”为条件化 TE 主导 | `coldren2012`, `ahn1995strained`, `nicholes2008strainedmqw` |
| B-02 | Resolved | `ch17_qw_active_gain_models.tex` | 图注与正文偏振规则统一 | 同 B-01 |
| B-03 | Resolved | `ch03_maxwell_periodic_media.tex` | “3-5数量级”改成 benchmark 依赖 | 条件化说明 |
| B-04 | Resolved | `ch05_band_gamma_mode_selection.tex` | 1-3% 误差改为本书算例口径 | [本书算例] |
| B-05 | Resolved | `ch09_cwt_minimal_model.tex` | 多处数值改为来源类型标签 | 文献值 + 工程经验分离 |
| B-06 | Resolved | `ch12_pwe_eigen_methods.tex` | 收敛优劣结论补引用 | `li1996`, `johnson2001` |
| B-07 | Resolved | `ch19_thermal_electro_optic_coupling.tex` | `R_th` 改工程经验并给边界条件 | [工程经验] |
| B-08 | Resolved | `ch21b_dynamics_modulation_noise.tex` | `epsilon_g` 改平台依赖+经验口径 | `coldren2012` |
| B-09 | Resolved | `ch22_practical_simulation_workflow.tex` | 95% 置信改 `k≈2` vs `1.96` | 统计口径修正 |
| B-10 | Resolved | `ch23_worked_example.tex` | 31×31 与重叠窗口加来源/身份列 | [本书算例] |
| B-11 | Resolved | 跨章（19/21/22/27 + 23） | 引入统一标签体系 | `[文献值]/[本书算例]/[工程经验]/[教学示意]` |

## 本轮新增文献键
- `koshelev2018quasibic`
- `dellacorte2000thermooptic`
- `ahn1995strained`
- `nicholes2008strainedmqw`
- `zhang1999doublefusedvcsel`
- `inoue2025fmpcsel`
- `bian2024resonatorpcsel`
- `qin2025quasibfic`

## 编译验收
- 命令：`latexmk -g -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex`
- 结果：通过，`build/pcselbook.pdf` 已更新。
