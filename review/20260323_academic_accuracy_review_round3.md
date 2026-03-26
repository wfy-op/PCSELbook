# PCSEL 教材学术准确性审阅（Round 3）

**日期**：2026-03-23  
**目标**：提升全书理论与数据表述的学术准确性、可追溯性、前沿性。  
**方法**：  
1. 对全书进行“定量语句 + 无引文”自动筛查。  
2. 对高风险章节（ch03/ch07/ch09/ch13/ch15/ch19/ch21）逐段人工核查。  
3. 用互联网学术文献交叉核验关键结论与前沿进展。  

---

## 本轮新增待修改问题（按优先级）

## P0（优先立即修）

### P0-1：小信号调制“典型 GHz 数值”和“最优偏置点”表述过于绝对
- 位置：`chapters/ch21b_dynamics_modulation_noise.tex:7`
- 问题：文中把 `f_R` 从 2 GHz 到 4 GHz、最优 `I/I_th=2~3` 写成通用结论，但未给实验条件或数据来源。
- 风险：不同孔径、热阻、寄生电容和封装可使带宽与最优偏置发生数量级变化，易误导读者把教学曲线当作普适规律。
- 建议修改：
  - 明确标注该图为“教学示意”或“某组参数下的仿真曲线”。
  - 新增一句：`f_R` 与 `I-I_th` 的关系仅在特定小信号模型和热稳定窗口内成立。
  - 增补 1-2 篇 PCSEL/VCSEL 调制实验文献作为条件化对照。

### P0-2：阈值损耗分解中的数值范围缺少可追溯出处
- 位置：`chapters/ch07_threshold_gain_loss.tex:164`
- 问题：`α_FCA/α_abs/α_metal/α_scatt/α_rad` 的范围直接给出，但未绑定波长、掺杂、场重叠和测试方法。
- 风险：这些参数跨平台差异很大，若无边界条件，读者可能将其误认为“标准值”。
- 建议修改：
  - 将当前数值改为“示例区间（GaAs, ~0.9–1.0 µm, 代表外延）”。
  - 在表格中增加“适用条件列”（波段、掺杂量级、模式重叠定义）。
  - 每个损耗分量至少附 1 个来源（理论或实验）。

### P0-3：热参数中 `dn/dT` 与 `dg/dT` 的量级缺少平台与波段约束
- 位置：`chapters/ch19_thermal_electro_optic_coupling.tex:157`
- 问题：给出 `dn/dT ~ 2e-4 K^-1` 与 `dg/dT ~ -(0.1~0.2) cm^-1 K^-1`，但没有声明材料体系、波段、注入区间。
- 风险：该参数高度依赖材料与工作点，未经条件限定会降低学术严谨性。
- 建议修改：
  - 改为“在 GaAs/InGaAs 近红外常见区间的代表值”。
  - 用“范围 + 条件 + 引文”三元组写法替代单句常数。
  - 增补热时间常数段的“参数来源表”。

### P0-4：复杂度与耗时表给出固定数量级但无硬件/实现前提
- 位置：`chapters/ch15_method_comparison_workflow.tex:48-52`
- 问题：`10^2~10^8` 自由度及“秒级/小时级/天级”表述未说明 CPU/GPU、并行策略、网格策略。
- 风险：该表目前更像经验口径，复现实验性较差。
- 建议修改：
  - 改成“benchmark 机型 + benchmark 结构 + benchmark 精度”的三维表。
  - 标注“数量级仅用于排程，不用于跨软件直接比较”。

---

## P1（本轮建议修）

### P1-1：`μ_r≈1` 与 `χ_m~1e-5` 的断言缺少引文
- 位置：`chapters/ch03_maxwell_periodic_media.tex:37`
- 问题：结论方向正确，但数值级别未给来源。
- 建议修改：
  - 增加材料手册/综述引用；
  - 若保留 `10^-5`，建议写“通常远小于 1，教材中取 0 阶近似”并弱化精确数值语气。

### P1-2：CWT 章节“与实验吻合”的语句缺少对应实验点
- 位置：`chapters/ch09_cwt_minimal_model.tex:326`
- 问题：文中称“与实验测量带隙宽度吻合”，但未给具体图号/文献。
- 建议修改：
  - 追加“对应文献 + 对应参数区间 + 偏差范围（如 <x%）”。
  - 若仅为教学估算，应改写为“与已报道数量级一致”。

### P1-3：RCWA 分层经验规则需要更明确来源和适用边界
- 位置：`chapters/ch13_rcwa_open_periodic_threshold.tex:47`
- 问题：`倾角<30° 时 20-50 层可收敛` 为经验规则，缺少基准来源。
- 建议修改：
  - 改成“示例经验值”，并要求配套“层数收敛曲线”。
  - 增加 RCWA 经典稳定实现与 Fourier factorization 文献并建立对应关系。

### P1-4：线宽章节虽已提 Henry/Petermann，但缺“PCSEL 专用修正语境”的近期文献
- 位置：`chapters/ch21_linewidth_coherence_brightness.tex:62-109`
- 问题：理论链路完整，但与 PCSEL 多波耦合、开放腔非正交的最新工作关联不足。
- 建议修改：
  - 补充“PCSEL 线宽-功率乘积理论”与“非正交模式噪声放大”近期文献。
  - 增加一段“何时必须从单模 Henry 模型升级到多模/非厄米模型”的判据。

### P1-5：worked example 参数组缺“来源/目的”注记
- 位置：`chapters/ch23_worked_example.tex:259-297`
- 问题：几何参数完整，但未说明是“文献复现参数”还是“教学合成参数”。
- 建议修改：
  - 为参数表新增“来源列”（文献/教材设定/拟合设定）。
  - 对非文献参数标注“教学构造，不代表最优器件”。

---

## P2（前沿性增强，建议补充）

### P2-1：缺少 2024–2025 PCSEL 前沿方向的集中更新
- 涉及章节：`ch01/ch20/ch21`
- 建议补充：
  - 2025 高频相干通信场景（高功率频率调制 PCSEL）；
  - 2024 谐振腔嵌入式 PCSEL（阈值与相位噪声工程）；
  - 将“高功率 + 高相干 + 系统级应用”从并列叙述升级为专门小节。

### P2-2：BIC 章节需加入“宽角高 Q”新范式（quasi-BFIC）
- 涉及章节：`ch08b/ch20b`
- 建议补充：
  - 2025 quasi-bound flat bands in the continuum（quasi-BFIC）；
  - 解释其对“角容差、无序鲁棒性、宽角保持高 Q”的意义；
  - 对照本书现有“Γ 点局域高 Q”框架，给出适用边界比较。

### P2-3：有限尺寸效应应上升为统一方法学警示
- 涉及章节：`ch08b/ch09/ch20b`
- 建议补充：
  - 增加“无限周期结果不可直接外推有限阵列”的专门框；
  - 给出最小报告规范：阵列尺寸、边界截断方式、边缘粗糙模型、Q 与远场随尺寸收敛曲线。

---

## 建议新增引用（互联网学术来源）

- [S1] Nature Photonics 2014：Watt-class high-power, high-beam-quality PCSEL  
  https://www.nature.com/articles/nphoton.2014.75
- [S2] Nature 2023：50 W continuous-wave single-mode PCSEL  
  https://www.nature.com/articles/s41586-023-06059-8
- [S3] Nature Communications 2024：AR-VCSEL for LiDAR（用于对照面发射路线）  
  https://www.nature.com/articles/s41467-024-44754-w
- [S4] Nature Reviews Materials 2016：BIC in photonics 基础综述  
  https://www.nature.com/articles/natrevmats201648
- [S5] Nature Reviews Physics 2023：BIC applications 前沿综述  
  https://www.nature.com/articles/s42254-023-00642-8
- [S6] Nature Photonics 2025：high-power frequency-modulated PCSEL（相干系统前沿）  
  https://www.nature.com/articles/s41566-025-01782-2
- [S7] npj Nanophotonics 2024：resonator-embedded PCSEL  
  https://www.nature.com/articles/s44310-024-00014-9
- [S8] Nature Communications 2025：quasi-bound flat bands in the continuum  
  https://www.nature.com/articles/s41467-025-65860-3
- [S9] Li 1996（Fourier factorization）  
  https://opg.optica.org/abstract.cfm?uri=josaa-13-9-1870
- [S10] Moharam et al. 1995（stable RCWA）  
  https://opg.optica.org/abstract.cfm?uri=josaa-12-5-1068
- [S11] Esman & Rode 1986（semiconductor-laser thermal time constant）  
  https://www.osti.gov/biblio/6306050
- [S12] Garcia & Farzaneh 2016（VCSEL thermoreflectance transient）  
  https://www3.uwsp.edu/physastr/Farzaneh/Documents/VCSEL-TTR-JAP-2016.pdf
- [S13] Henry 1982（linewidth theory）  
  https://ieeexplore.ieee.org/document/1071522/
- [S14] Finite-size effects in PCSEL（2026，预印本/全文）  
  https://research.chalmers.se/publication/549940/file/549940_Fulltext.pdf
- [S15] PRL 2018：asymmetry-induced quasi-BIC 高 Q 标度（用于 `Q\propto\delta^{-2}` 类语句）  
  https://doi.org/10.1103/PhysRevLett.121.193903
- [S16] Applied Physics Letters 2000：InP/GaAs/SiC thermo-optic coefficient（用于 `dn/dT` 条件化）  
  https://doi.org/10.1063/1.1308529
- [S17] APL 1995：GaAs/AlAs 近 1 μm 热致折射率系数（VCSEL 腔测法）  
  https://doi.org/10.1063/1.114313

---

## 本轮结论

本轮新增问题以 **“定量断言缺条件/缺引用”** 和 **“前沿进展尚未体系化接入主线”** 为主。  
建议下一轮优先处理 P0（4 项），可显著提升全书的可复核性与学术可信度。

---

## 补充版：全书逐章完整复核（新增）

### 覆盖说明
- 本轮新增执行了全章节扫描（`31` 个章节文件，合计约 `12700+` 行文本）。
- 使用“定量语句且无引用”筛查得到 `913` 条候选断言，再逐章人工复核并去除明显非问题项。
- 输出了章节覆盖统计文件：`build/chapter_coverage_stats.csv`（已生成）。

### 逐章状态（补充）

| 章节 | 结论 | 说明 |
|---|---|---|
| ch01 | 需修订 | 历史与器件对比中仍有多个经典数值未给出处（见 A-01, A-02） |
| ch02 | 建议补充 | 量纲表中的“常见范围”建议加来源注记（A-03） |
| ch03 | 需修订 | `\mu_r\approx1` 的数值化表述需文献支撑（与 P1-1 同类） |
| ch04 | 基本通过 | 以概念阐释为主，未发现新增高风险定量断言 |
| ch05 | 建议补充 | 图注中“典型角度/物理结论”建议绑定来源或改为示意（A-04） |
| ch06 | 基本通过 | Bragg 机理叙述清晰，建议后续补一条经典文献增强可追溯性 |
| ch07 | 需修订 | 损耗分解量级需条件化+引用（与 P0-2 同类） |
| ch08 | 建议补充 | 群论到辐射选择规则建议补标准教材/综述引用（A-05） |
| ch08b | 需修订 | `Q\propto\delta^{-2}` 与设计结论需加权威来源（A-06） |
| ch09 | 需修订 | “与实验吻合”类语句缺对应实验点（与 P1-2 同类） |
| ch10 | 建议补充 | 多模截断和“5%-10%”经验阈值需注明经验来源（A-07） |
| ch11 | 基本通过 | 方法对接逻辑清楚，新增问题不突出 |
| ch12 | 基本通过 | 收敛图与脚本一致，建议保留“教学例”边界说明 |
| ch13 | 需修订 | 分层层数经验规则仍缺明确来源（与 P1-3 同类） |
| ch14 | 需修订 | PML 层数、网格经验值需附出处/benchmark 条件（A-08） |
| ch15 | 需修订 | 复杂度与耗时表需给硬件和精度前提（与 P0-4 同类） |
| ch16 | 基本通过 | 已修正工艺对比绝对化表述；灵敏度表建议标注“教学代理” |
| ch17 | 建议补充 | QW 尺寸和偏振主导叙述可加材料体系来源（A-09） |
| ch18 | 需修订 | 接触电阻、电流扩展、拥挤倍数等数值缺引用（A-10） |
| ch19 | 需修订 | 热参数范围需材料/波段/工况绑定（与 P0-3 同类） |
| ch20 | 基本通过 | 概念导向章节，新增定量风险较低 |
| ch20b | 建议补充 | 鲁棒性阈值（如 5 cm^-1）应标为设计准则而非通用常数（A-11） |
| ch21 | 需修订 | `\alpha_H` 典型范围与线宽放大量化需引文（A-12） |
| ch21b | 需修订 | GHz 带宽与最优偏置需“条件化”表达（与 P0-1 同类） |
| ch22 | 需修订 | `d\lambda/dT` 典型范围无引文（A-13） |
| ch23 | 需修订 | 核心参数组缺来源类型标注（与 P1-5 同类） |
| ch24 | 需修订 | 有限尺寸经验阈值需标来源或标注为启发式（A-14） |
| ch25 | 基本通过 | 数学附录逻辑完整，新增问题主要是引用增强而非改写 |
| ch26 | 基本通过 | 以方法论为主，未发现新增高风险定量断言 |
| ch27 | 建议补充 | checklist 阈值建议区分“发布级”与“教学级”来源（A-15） |
| ch28 | 基本通过 | 术语符号表，学术准确性风险低 |

---

## 新增问题（补充 ID）

### P0 级（补充）

### A-01（P0）
- 位置：`chapters/ch01_introduction.tex:43-64`
- 问题：边发射发散角、条宽阈值、VCSEL 纵模间隔等数值无引文。
- 动作：为每组数值补 1 条综述/教材引用；若仅为教学经验值，明确写“典型教学量级”。

### A-02（P0）
- 位置：`chapters/ch01_introduction.tex:53,62,64`
- 问题：VCSEL 阈值电流、DBR 对数与应力后果写成普适结论。
- 动作：改为“在 XXX 平台与孔径条件下常见”，并加来源。

### A-10（P0）
- 位置：`chapters/ch18_electrical_injection_transport.tex:34,116,215`
- 问题：`rho_c`、`R_sheet`、`L_s`、电流拥挤“3-5 倍”缺引用。
- 动作：补 GaAs/GaN 平台文献；给出“温度、掺杂、结构依赖”的边界说明。

### A-13（P0）
- 位置：`chapters/ch22_practical_simulation_workflow.tex:382`
- 问题：InGaAsP `d\lambda/dT = 0.05–0.1 nm/K` 无来源。
- 动作：补实验文献或厂商数据；注明适用温区与注入区间。

### A-14（P0）
- 位置：`chapters/ch24_failure_modes.tex:83-86`
- 问题：`R_array \gtrsim 3L_rad` 与 `100–300 um` 窗口为经验规则，未标来源。
- 动作：改为“启发式规则”，并提供数值验证图（尺寸扫描）。

### A-15（P0）
- 位置：`chapters/ch27_simulation_checklists.tex:258,268`
- 问题：`Q` 偏差阈值等 checklist 指标缺分级来源。
- 动作：新增“教学级/工程级/发表级”阈值来源和适用场景。

### P1 级（补充）

### A-03（P1）
- 位置：`chapters/ch02_mathematical_roadmap.tex:68-73`
- 问题：观测量“常见量级”缺出处。
- 动作：在表注中统一声明来源类型（教材统计/本书 benchmark）。

### A-04（P1）
- 位置：`chapters/ch05_band_gamma_mode_selection.tex:237`
- 问题：图注“非 Γ 点典型倾斜角约 45°”易被读成通用结论。
- 动作：改成“示意角度（与参数相关）”并给例证来源。

### A-05（P1）
- 位置：`chapters/ch08_polarization_symmetry_farfield.tex:232,332`
- 问题：群表示到辐射通道兼容判据未显式挂钩标准文献。
- 动作：补 Sakoda/Joannopoulos + BIC 综述引用。

### A-06（P1）
- 位置：`chapters/ch08b_bic_quasibic.tex:219`
- 问题：`Q\propto\delta^{-2}` 缺直接文献锚点。
- 动作：补 PRL 2018 等对称破缺标度文献。

### A-07（P1）
- 位置：`chapters/ch10_cwt_higher_order_3d.tex:129-131`
- 问题：“5%-10% 失谐阈值”无来源。
- 动作：标注“工程筛选阈值”并配误差曲线示例。

### A-08（P1）
- 位置：`chapters/ch14_fdtd_fem_for_pcsel.tex:49,54,137`
- 问题：PML 层数、`a/10` 网格规则缺来源。
- 动作：补 Yee 网格经验文献或软件官方指南来源。

### A-09（P1）
- 位置：`chapters/ch17_qw_active_gain_models.tex:34`
- 问题：QW 厚度“6-10 nm”等数值缺平台限定。
- 动作：补 InGaAs/GaAs 与 InGaN/GaN 分平台参考。

### A-11（P1）
- 位置：`chapters/ch20b_robustness_tolerance.tex:229`
- 问题：`ΔG>5 cm^-1` 等门槛缺依据。
- 动作：标为“本书设计规则”，避免伪装成统一标准。

### A-12（P1）
- 位置：`chapters/ch21_linewidth_coherence_brightness.tex:67-68`
- 问题：`alpha_H=2-5` 与“线宽约放大10倍”无引用。
- 动作：补 Henry 1982 + 量子阱实验范围文献。

---

## 前沿补充建议（新增）

1. 在 `ch20/ch21` 增设“2024–2026 前沿进展速览”：
- 高频调制与通信化 PCSEL（Nat. Photonics 2025）。  
- Resonator-embedded PCSEL（npj Nanophotonics 2024）。  
- finite-size 机制的系统建模（2026 预印本）。

2. 在 `ch08b/ch20b` 增补 quasi-BFIC 新范式：
- 解释“宽角高 Q + 抗无序”相对传统 Γ 点 quasi-BIC 的优势与限制。  

3. 在 `ch13/ch14/ch15` 增补“可复现报告模板”：
- 硬件、网格、收敛标准、耗时统计四元组，避免方法比较失真。  

---

## 问题与证据映射（补充）

- A-06（`Q\propto\delta^{-2}`）→ [S15]  
- P0-3 / A-13（热光系数与热漂移量级）→ [S16], [S17]  
- P1-3（RCWA factorization 与稳定实现）→ [S9], [S10]  
- P1-4 / A-12（线宽模型边界）→ [S13] + 章节内已引文 `henry1982` 扩展  
- P2-2（BIC 前沿）→ [S4], [S5], [S8], [S15]

---

## Round 3 深化补充（全书二次精读）

### 本次补充范围
- 已对 `31` 个章节文件再做一轮逐章精读，并复核了 `120` 条“含定量信息且缺引文”的候选句。
- 新增提炼问题 `10` 项（P0: 2 项；P1: 7 项；P2: 1 项），重点放在“事实准确性”和“可追溯性”。

### 新增问题（本轮补充）

### B-01（P0）
- 位置：`chapters/ch17_qw_active_gain_models.tex:34-40`
- 问题：将“压应变 InGaAs/GaAs 量子阱导致 TM 偏振优势”作为主结论，存在方向性错误风险。
- 说明：对 (001) 体系，压应变通常抬升 HH 带并增强平面内偶极跃迁，主导应为 TE；“TM 增强”更常见于张应变设计。
- 动作：把“TM 优势”改为“TE 优势（以平台与应变符号为条件）”，并补“压应变/张应变对 TE/TM 的对照表”。

### B-02（P0）
- 位置：`chapters/ch17_qw_active_gain_models.tex:39`
- 问题：图注内部逻辑冲突：文中写“偶极矩主要平行量子阱平面，因此产生 TM 优势”，与偏振选择规则不一致。
- 动作：图注改为“平行于量子阱平面的偶极跃迁对应 TE 主导”；并同步修订后文“压制 TE”描述，避免自相矛盾。

### B-03（P1）
- 位置：`chapters/ch03_maxwell_periodic_media.tex:412`
- 问题：`Q` 值“可能差 3–5 个数量级”缺数据或算例支撑。
- 动作：改为“可出现数量级级别偏差（需以边界条件 benchmark 佐证）”，并补一组 PEC vs PML 对照数据。

### B-04（P1）
- 位置：`chapters/ch05_band_gamma_mode_selection.tex:325`
- 问题：“二维 PWEM 与三维 FDTD 差 `1–3%`”属于特定参数结论，缺样本范围和引用。
- 动作：改成“在本书示例参数下约 `1–3%`”，并在句尾补示例来源（脚本/图号/文献）。

### B-05（P1）
- 位置：`chapters/ch09_cwt_minimal_model.tex:326,577,1247`
- 问题：`10–20%` 纵向能量占比、`C_rad` 的 `5%` 修正阈值、`三倍`耦合增强等数值仍偏经验口径。
- 动作：每个数值后补“来源类型标签”（文献复现/本书算例/工程经验），并给出适用区间。

### B-06（P1）
- 位置：`chapters/ch12_pwe_eigen_methods.tex:85`
- 问题：`H_z` 比 `E_z` 更易收敛的陈述正确方向但缺直接引用。
- 动作：在该段补 Fourier factorization 与高对比度收敛文献锚点（可指向 [S9], [S10] 与 PWEM 经典文献）。

### B-07（P1）
- 位置：`chapters/ch19_thermal_electro_optic_coupling.tex:98`
- 问题：`R_th = 10–100 K/W` 的范围缺封装边界和热路径条件。
- 动作：增加条件化括注（芯片尺寸、键合、散热方式、热源定义），并附至少 1 条实验来源。

### B-08（P1）
- 位置：`chapters/ch21b_dynamics_modulation_noise.tex:57`
- 问题：增益压缩系数 `\varepsilon_g=10^{-17}–10^{-16} cm^3` 缺平台限定与文献来源。
- 动作：按材料平台（GaAs/InGaAs、InP、GaN）拆分“典型区间”，并给出处。

### B-09（P1）
- 位置：`chapters/ch22_practical_simulation_workflow.tex:348`
- 问题：`k=2 对应 95% 置信区间` 表述过于近似。
- 动作：改为“正态双侧近似常用 `k≈2`（严格 95% 为 `1.96`）”，避免统计语义误差。

### B-10（P1）
- 位置：`chapters/ch23_worked_example.tex:371,428-429`
- 问题：`31×31` 阵列与 `\Gamma_QW/\Gamma_loss` 的窗口值缺“来自何处”的注记。
- 动作：在参数表新增“来源列”（文献/脚本拟合/教学代理），把“教学代理窗口”与“可发表定量值”分开。

### B-11（P2）
- 位置：跨章节（`ch19/ch21/ch22/ch27`）
- 问题：统计、热、电、光的“经验阈值”写法不统一，读者难区分“规则”与“事实”。
- 动作：新增统一图例标签：`[文献值] [本书算例] [工程经验] [教学示意]`，并在全书表格中执行。

---

## 新增互联网学术证据（本轮）

- [S18] IEEE Photonics Technology Letters 2008：strained QW 的偏振规律（压应变更偏 TE，张应变可引向 TM）  
  https://doi.org/10.1109/LPT.2008.926545
- [S19] Applied Physics Letters 1995：应变量子阱偏振相关增益实验（压应变增强 TE，张应变增强 TM）  
  https://doi.org/10.1063/1.114035
- [S20] Journal of Lightwave Technology 1999：InGaAsP/InP MQW VCSEL 温漂量级（约 `0.1 nm/K`）  
  https://www.nusod.net/www.nusod.org/piprek/zhang99jlt.pdf

---

## 新增问题与证据映射（本轮补充）

- B-01 / B-02（压应变 QW 偏振方向）→ [S18], [S19]  
- B-09（统计覆盖因子写法）→ 统计标准写法（`k=1.96` 对应双侧 95%）  
- B-07（热漂移量级校核）→ [S20] + 既有 [S16], [S17]
