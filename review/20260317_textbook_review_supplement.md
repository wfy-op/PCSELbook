# 审稿报告补充部分：Ch08b–Ch28

本文件补充主报告（`textbook_review.md`）中缺失的章节审稿。

---

## Ch08b　BIC 与准 BIC（束缚态连续谱）

### 问题 8b-1：BIC 的数学定义（辐射损耗为零但频率在连续谱内）未给出

**位置：** `ch08b_bic_quasibic.tex` 开头定义节。

**问题性质：** 核心概念定义不清。BIC 与普通束缚态的本质区别（前者频率在连续谱内，后者在带隙内）未说明，导致读者混淆"为何频率在光锥内却不辐射"。

**建议：** 在章节开头补充：

> **BIC（Bound state In the Continuum）的严格定义：**
>
> BIC 与普通束缚态的根本区别：
> - **普通束缚态**：本征频率 $\omega$ 落在带隙内（$\omega < \omega_\mathrm{light\ cone}$），场在无穷远指数衰减，$\gamma_\mathrm{rad}=0$ 因为频率本身不允许辐射。
> - **BIC**：本征频率 $\omega$ 落在**连续谱内**（$\omega > \omega_\mathrm{light\ cone}$），理论上可向自由空间辐射，但因**对称性保护**使所有辐射通道的贡献完全相消，$\gamma_\mathrm{rad}=0$。
> - **准 BIC（quasi-BIC）**：对称性被微弱破缺（几何扰动、材料不对称、有限尺寸）后，$\gamma_\mathrm{rad}$ 从零变为极小值，$Q$ 仍可达 $10^4$–$10^6$。
>
> **数学表达：**
> - BIC 条件：$\omega \in [\omega_\mathrm{light\ cone}, +\infty)$，且 $\lim_{r\to\infty}|\mathbf{E}(\mathbf{r})| = 0$（场仍局域）。
> - 对称性保护机制：辐射耦合矩阵元 $\langle\psi_\mathrm{BIC}|\hat{T}_\mathrm{rad}|\psi_\mathrm{free}\rangle = 0$，其中 $\hat{T}_\mathrm{rad}$ 为辐射跃迁算符。
> - 准 BIC：$\gamma_\mathrm{rad} \propto \epsilon^2$，$\epsilon$ 为对称性破缺参数（例如双晶格位移量）。
>
> **PCSEL 中的意义：**
> BIC 候选模理论上 $Q\to\infty$，但实际器件中：① 有限尺寸破缺对称性；② 外延层上下不对称；③ 工艺误差。因此真实 PCSEL 只能接近准 BIC，$Q\sim 10^4$–$10^5$。设计目标是最大化准 BIC 的 $Q$，同时保持足够的辐射提取效率（$Q$ 不能过高，否则阈值虽低但输出功率也低）。

---

### 问题 8b-2：对称性破缺参数 $\epsilon$ 与 $Q$ 的定量关系未给出

**位置：** `ch08b_bic_quasibic.tex`，准 BIC 相关节。

**建议：** 补充：

> 对方格晶格双晶格扰动，准 BIC 的 $Q$ 值与位移量 $\delta$ 的关系：
> $$Q \propto \frac{1}{\delta^2},$$
> 其中 $\delta$ 为归一化位移（$\delta = d/a$，$d$ 为实际位移，$a$ 为晶格常数）。
>
> 典型数值：$\delta=0.01$（即 $d=2.8\ \mathrm{nm}$ 对 $a=280\ \mathrm{nm}$）时，$Q\sim 10^4$；$\delta=0.001$ 时，$Q\sim 10^6$。但 $\delta<0.005$ 时工艺实现困难，且 $Q$ 过高会导致阈值电流虽低但斜率效率也低。

---

## Ch10　更高阶或三维 CWT 观点

### 问题 10-1：纵向多模展开的截断判据未给出

**位置：** `ch10_cwt_higher_order_3d.tex`，§10.3"升级思路"段落。

**建议：** 补充：

> **纵向模截断判据：**
> - 保留前 $N_z$ 个纵向本征模，直到第 $N_z+1$ 模满足以下任一条件：
>   1. 频率失谐超过目标模频率的 10%；
>   2. 与有源区重叠因子 $\Gamma_{N_z+1} < 0.01\times\Gamma_1$（即小于主模的 1%）；
>   3. 对目标模频率的微扰修正 $<0.1\%$。
> - 对典型 PCSEL 外延层（波导层厚度 200–300 nm），通常保留 2–3 个纵向模即可收敛。
> - 验证：将 $N_z$ 加倍，目标模频率变化应 $<0.5\%$。

---

## Ch20b　鲁棒性与工艺容差

### 问题 20b-1：工艺容差的定量标准（多少偏差算"鲁棒"）未给出

**位置：** `ch20b_robustness_tolerance.tex`。

**建议：** 补充：

> **工艺容差定量判据（PCSEL 设计鲁棒性标准）：**
>
> | 参数 | 容差范围 | 允许变化 | 判据 |
> |---|---|---|---|
> | 晶格常数 $a$ | $\pm2\%$ | 频率偏移 $<0.5\%$ | 模式排序不变 |
> | 孔径 $r$ | $\pm5\%$ | 辐射损耗变化 $<20\%$ | $Q$ 值变化 $<30\%$ |
> | 刻蚀深度 | $\pm10\ \mathrm{nm}$ | 阈值增益变化 $<10\%$ | 目标模仍最低阈值 |
> | 波导层厚度 | $\pm5\%$ | 有效折射率变化 $<1\%$ | 频率偏移 $<1\%$ |
> | 量子阱位置 | $\pm20\ \mathrm{nm}$ | $\Gamma_\mathrm{opt}$ 变化 $<15\%$ | 阈值增益变化 $<20\%$ |
>
> **鲁棒性判据：**
> - 若任一参数超出上述容差范围导致目标模与竞争模的净裕量 $\Delta G$ 反转（从正变负），该设计**不具备工艺鲁棒性**。
> - 推荐设计裕量：名义设计点下 $\Delta G > 5\ \mathrm{cm}^{-1}$，容差边界处 $\Delta G > 1\ \mathrm{cm}^{-1}$。
>
> **提升鲁棒性的策略：**
> 1. 增大目标模与竞争模的频率间隔（调整双晶格参数）；
> 2. 增大损耗差异（利用偏振选择性或外延层设计）；
> 3. 选择对参数不敏感的工作点（例如：能带平坦区而非陡峭区）。

---

## Ch21b　动态、调制与噪声

### 问题 21b-1：速率方程中的非线性增益饱和项从未给出

**位置：** `ch21b_dynamics_modulation_noise.tex`，速率方程节。

**建议：** 补充完整速率方程：

> **PCSEL 最小速率方程组（单模近似）：**
>
> 载流子速率方程：
> $$\frac{dN}{dt} = \frac{I}{qV_\mathrm{act}} - \frac{N}{\tau_n} - v_g g(N) S,$$
>
> 光子速率方程：
> $$\frac{dS}{dt} = \Gamma v_g g(N) S - \frac{S}{\tau_p} + \Gamma\beta_\mathrm{sp}\frac{N}{\tau_n},$$
>
> 其中：
> - $I$：注入电流
> - $V_\mathrm{act}$：有源区体积
> - $\tau_n$：载流子寿命（包含所有复合机制）
> - $g(N) = \frac{g_0(N-N_\mathrm{tr})}{1+\epsilon S}$：包含增益饱和的材料增益
> - $\epsilon$：增益压缩系数，典型 $10^{-17}$–$10^{-16}\ \mathrm{cm}^3$
> - $\tau_p = Q/\omega_0$：光子寿命
> - $\beta_\mathrm{sp}$：自发辐射因子，典型 $10^{-4}$–$10^{-3}$
>
> **稳态解（$dN/dt=dS/dt=0$）：**
> - 阈值条件：$\Gamma v_g g(N_\mathrm{th}) = 1/\tau_p$
> - 阈值载流子密度：$N_\mathrm{th} = N_\mathrm{tr} + \frac{1}{\Gamma v_g g_0 \tau_p}$
> - 阈值电流：$I_\mathrm{th} = \frac{qV_\mathrm{act}N_\mathrm{th}}{\tau_n}$
>
> **小信号调制响应：**
> - 弛豫振荡频率：$f_R = \frac{1}{2\pi}\sqrt{\frac{v_g g_0 S_0}{\tau_p}}$，其中 $S_0$ 为稳态光子数
> - 3 dB 带宽：$f_{3\mathrm{dB}} \approx \sqrt{3}f_R$（无阻尼近似）
> - 对 PCSEL，高 $Q$（长 $\tau_p$）会降低 $f_R$，调制带宽通常 $<10\ \mathrm{GHz}$

---

## Ch24　PCSEL 建模常见失败模式（补充）

### 问题 24-3：有限阵列"多少个周期才够"的定量标准

**位置：** `ch24_failure_modes.tex`，§24.4"有限尺寸不足"段落。

**建议：** 补充：

> **有限阵列尺寸收敛判据：**
>
> 理论判据：阵列半径应满足 $R_\mathrm{array} \gtrsim 3L_\mathrm{rad}$，其中 $L_\mathrm{rad} = 1/(2\alpha_\mathrm{rad})$ 是辐射衰减长度。
>
> 定量示例：
> - 对 $\alpha_\mathrm{rad}\sim 10\ \mathrm{cm}^{-1}$：$L_\mathrm{rad}\sim 500\ \mu\mathrm{m}$，需直径约 $3\ \mathrm{mm}$（约 $10^4$ 个周期）——**超出 3D FDTD 可行范围**。
> - 对 $\alpha_\mathrm{rad}\sim 50\ \mathrm{cm}^{-1}$（亮模）：$L_\mathrm{rad}\sim 100\ \mu\mathrm{m}$，需直径约 600 μm（约 2000 个周期）——**FDTD 勉强可行但极耗时**。
> - 对高-$Q$ BIC 候选模（$\alpha_\mathrm{rad}<1\ \mathrm{cm}^{-1}$）：所需阵列尺寸 $>1\ \mathrm{cm}$——**必须改用 RCWA 单胞 + CWT 横向包络混合策略**。
>
> 实用判据（FDTD 可行性）：
> - 若器件直径 $<100\ \mu\mathrm{m}$（约 350 个周期）：边缘损耗主导，单胞结论失效。
> - 若器件直径 100–300 μm：FDTD 可行，但需验证边缘损耗 $<$ 辐射损耗。
> - 若器件直径 $>500\ \mu\mathrm{m}$：FDTD 不可行，应用 RCWA + 解析边缘修正。

---

## Ch25　数学附录

### 问题 25-1：傅里叶变换约定与主文 $e^{-i\omega t}$ 的一致性未检查

**位置：** `ch25_math_appendix.tex` 开头。

**建议：** 在附录开头明确约定：

> **本附录的傅里叶变换约定（与主文一致）：**
>
> 时间傅里叶变换：
> $$f(t) = \int_{-\infty}^{\infty} \tilde{f}(\omega) e^{-i\omega t}\, \frac{d\omega}{2\pi},$$
> $$\tilde{f}(\omega) = \int_{-\infty}^{\infty} f(t) e^{+i\omega t}\, dt.$$
>
> 空间傅里叶变换：
> $$f(\mathbf{r}) = \int \tilde{f}(\mathbf{k}) e^{+i\mathbf{k}\cdot\mathbf{r}}\, \frac{d^3k}{(2\pi)^3},$$
> $$\tilde{f}(\mathbf{k}) = \int f(\mathbf{r}) e^{-i\mathbf{k}\cdot\mathbf{r}}\, d^3r.$$
>
> **注意：** 时间因子 $e^{-i\omega t}$ 与空间因子 $e^{+i\mathbf{k}\cdot\mathbf{r}}$ 的符号相反，这是本书（及大多数电磁学教材）的标准约定。若查阅其他文献遇到符号差异（例如 $e^{+i\omega t}$），需注意所有含 $\omega$ 的公式符号会同时翻转。

---

## Ch26　器件建模附录

### 问题 26-1：材料参数数据库来源未注明

**位置：** `ch26_device_modeling_appendix.tex`，材料参数表。

**建议：** 在每个参数表下方注明：

> **数据来源与适用条件：**
> - 折射率数据：[Adachi 1985, J. Appl. Phys.]，适用于 300 K、低掺杂（$<10^{18}\ \mathrm{cm}^{-3}$）。
> - 增益参数：[Coldren 2012, Diode Lasers and Photonic Integrated Circuits]，基于 8 nm InGaAs/GaAs 量子阱。
> - 热导率：[Adachi 2009, Properties of Semiconductor Alloys]，适用于 300 K。
>
> **重要提示：** 表中数值为室温、低掺杂条件下的参考值。实际建模中应根据工作点查阅完整数据库或实验标定：
> - 折射率：温度系数 $dn/dT \approx 2\times10^{-4}\ \mathrm{K}^{-1}$（GaAs）。
> - 增益：强烈依赖载流子密度、温度和应变，表中值仅供量级参考。
> - 热导率：随温度和掺杂浓度变化，高掺杂（$>10^{19}\ \mathrm{cm}^{-3}$）时可降低 30–50%。

---

## Ch28　术语表与符号表

### 问题 28-1：符号表中同一符号的多重含义未区分上下文

**位置：** `ch28_glossary_symbols.tex`。

**建议：** 对多义符号增加上下文标注：

| 符号 | 含义 | 上下文 | 章节 |
|---|---|---|---|
| $Q$ | 品质因子 | 被动共振 | Ch03, Ch13 |
| $Q_c$ | 导带偏移系数 | 异质结能带 | Ch16 |
| $\gamma$ | 衰减率（复频率虚部） | 开放系统本征值 | Ch03 |
| $\gamma$ | 约束因子（有时记作 $\Gamma$） | 模增益 | Ch07 |
| $\Gamma$ | 约束因子 $\Gamma_\mathrm{opt}$ | 模增益 | Ch07, Ch17 |
| $\Gamma$ | 布里渊区中心点 | 能带理论 | Ch05 |
| $\Gamma$ | 损耗矩阵 | CWT | Ch09 |
| $n$ | 折射率 | 光学 | 全书 |
| $n$ | 载流子密度（有时记作 $N$） | 电学 | Ch18, Ch21b |
| $\omega$ | 角频率 | 频域 Maxwell | 全书 |
| $\Omega$ | 归一化频率 $\omega a/(2\pi c)$ | 能带图 | Ch05, Ch12 |

> **使用建议：** 遇到多义符号时，优先根据章节上下文判断；若仍不确定，查看该符号首次出现处的定义。

---

## 总结：补充章节覆盖情况

本补充文件新增审稿章节：
- Ch08b（BIC）：2 个问题
- Ch10（高阶 CWT）：1 个问题
- Ch20b（鲁棒性）：1 个问题
- Ch21b（动态）：1 个问题
- Ch24（失败模式补充）：1 个问题
- Ch25（数学附录）：1 个问题
- Ch26（器件附录）：1 个问题
- Ch28（符号表）：1 个问题

**合计新增：9 个问题**

**主报告 + 补充文件总计：**
- 覆盖章节：30/31 章（97%，仅缺 Ch24 部分内容）
- 总问题数：33（主报告）+ 5（Ch14）+ 3（Ch15）+ 2（Ch27）+ 9（本补充）= **52 个问题**
- 优先级分布：P0（阻塞性）3 个，P1（理解断层）5 个，P2（可读性）6 个，P3（实用性）38 个

**仍需补充：** Ch24 的完整失败模式诊断流程（当前仅补充了有限阵列判据）。
