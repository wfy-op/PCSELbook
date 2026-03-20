# Plan: 按章节顺序精修 pcselbook

## Context
用户要求依据审稿报告对 pcselbook 内容进行逐段精修，并确认：
- 按章节顺序推进（Ch01 → Ch28）
- 直接修改对应 .tex 文件
- 同时依据 `textbook_review.md` 与 `textbook_review_supplement.md`
目标是把审稿建议落到正文，提升教材可读性、可计算性与方法可操作性。

## Recommended approach
采用“章节顺序 + 清单式落地”的迭代流程，每章完成后再进入下一章，确保局部一致性与上下文连贯。

### 1) 章级执行节奏
对每章执行固定流程：
1. 读取章节 .tex
2. 对照两份审稿报告中该章问题清单
3. 按问题顺序逐段精修（补公式、补定义、补判据、补数值范围）
4. 复查术语首次出现是否中英对照、符号是否首次定义
5. 章节内用 `\cref{}` 统一交叉引用
6. 小范围自校（与前后章约定一致）

### 2) 修改优先级（仍按章节顺序推进）
虽然按章节顺序执行，但每章内部先落地高优先级问题：
- P0（阻塞性）→ P1（理解断层）→ P2（可读性）→ P3（实用性）

### 3) 关键文件与修改范围
**主线章节（按顺序）：**
- `chapters/ch01_introduction.tex`
- `chapters/ch02_mathematical_roadmap.tex`
- `chapters/ch03_maxwell_periodic_media.tex`
- `chapters/ch04_bloch_and_2dpc.tex`
- `chapters/ch05_band_gamma_mode_selection.tex`
- `chapters/ch06_inplane_feedback_surface_emission.tex`
- `chapters/ch07_threshold_gain_loss.tex`
- `chapters/ch08_polarization_symmetry_farfield.tex`
- `chapters/ch08b_bic_quasibic.tex`
- `chapters/ch09_cwt_minimal_model.tex`
- `chapters/ch10_cwt_higher_order_3d.tex`
- `chapters/ch11_cmt_perturbation_splitting.tex`
- `chapters/ch12_pwe_eigen_methods.tex`
- `chapters/ch13_rcwa_open_periodic_threshold.tex`
- `chapters/ch14_fdtd_fem_for_pcsel.tex`
- `chapters/ch15_method_comparison_workflow.tex`
- `chapters/ch16_epitaxial_optical_structure.tex`
- `chapters/ch17_qw_active_gain_models.tex`
- `chapters/ch18_electrical_injection_transport.tex`
- `chapters/ch19_thermal_electro_optic_coupling.tex`
- `chapters/ch20_large_area_single_mode.tex`
- `chapters/ch20b_robustness_tolerance.tex`
- `chapters/ch21b_dynamics_modulation_noise.tex`
- `chapters/ch21_linewidth_coherence_brightness.tex`
- `chapters/ch22_practical_simulation_workflow.tex`
- `chapters/ch23_worked_example.tex`
- `chapters/ch24_failure_modes.tex`
- `chapters/ch25_math_appendix.tex`
- `chapters/ch26_device_modeling_appendix.tex`
- `chapters/ch27_simulation_checklists.tex`
- `chapters/ch28_glossary_symbols.tex`

**审稿清单来源：**
- `review/textbook_review.md`
- `review/textbook_review_supplement.md`

### 4) 章节内的落地方式
- 公式补全：直接插入在原段落附近，保持现有叙述节奏
- 定义补全：优先使用 `definition` 或 `RigorousBox`
- 判据与数量级：用 `RigorousBox` 或短段落给出数值范围
- 方法步骤：列表化（itemize / enumerate）并加 `\cref{}`
- 术语中英首现：在首次出现处补括号英文

### 5) 一致性检查（跨章节）
在关键约定上做轻量一致性核对：
- 时间因子 `e^{-i\omega t}` 与附录傅里叶约定
- $\Gamma$（约束因子/Γ点/矩阵）多义符号
- $Q$（品质因子/导带偏移）多义符号
- 冷腔/阈值/器件结论层级边界是否被打破

## Verification
- 逐章修改完成后快速人工检查：语义连贯、公式编号、`\cref{}` 是否指向有效标签。
- 如需全书编译验证，可后续运行 LaTeX 构建（用户确认后执行）。

## Deliverables
- 直接更新对应章节 `.tex` 文件
- 保留审稿报告文件不变
- 修改完成后按章节输出简短变更摘要（指出新增公式/段落位置）