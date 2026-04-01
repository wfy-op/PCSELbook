# PCSELbook 全书物理审阅与修订报告（2026-03-28）

## 1. 审阅方法与覆盖范围
- 审阅方式：6 个 subagent 分章并行审阅 + 主代理逐条复核（行号级别）。
- 覆盖对象：`main.tex` 引入的 28 章正文 + 附录相关章节 + `notation.tex/preamble.tex`。
- 判定标准：仅记录高置信物理问题（符号约定、量纲一致性、方程形式、开放系统/互易性表述边界）；不将纯文风问题计入缺陷。

## 2. 已确认并修复的问题

### Critical
1. `chapters/ch03_maxwell_periodic_media.tex`
   - 复 Poynting 定理符号方向错误，导致实部功率关系符号反向。
   - 已修复为与 `e^{-i\omega t}` 约定一致的符号链。

2. `chapters/ch09_cwt_minimal_model.tex`
   - `\tilde n^2` 写法量纲不一致（将 `k_0` 放在了错误位置）。
   - 已修复为 `\tilde n^2=n^2+2 i n\tilde\alpha/k_0`，并与后续 `k_0^2\tilde n^2` 项自洽。

3. `chapters/ch12_pwe_eigen_methods.tex`
   - `H_z` 分量方程在 `e^{-i\omega t}` 约定下符号错误。
   - `E_z` 的 PWEM 矩阵式写成了不正确的 `\eta`/双模长乘积结构。
   - 已按二维标量 `E_z` 方程改为标准卷积矩阵形式。

4. `chapters/ch17_qw_active_gain_models.tex`
   - 失谐抛物线模型将增益量与无量纲量直接相减，量纲不一致。
   - 已改为 `a_\lambda \Delta\lambda^2` 形式并显式声明 `a_\lambda` 单位。

### Major
1. `chapters/ch03_maxwell_periodic_media.tex`
   - “开放系统”解释把辐射衰减直接绑定到体损耗项，逻辑不严谨。
   - 已改为复本征频率/QNM 框架描述。

2. `chapters/ch05_band_gamma_mode_selection.tex`
   - 将 `B_1` 描述为“各向同性”不准确。
   - 已改为 `A_1` 全对称、`B_1` 具 `x^2-y^2` 各向异性。

3. `chapters/ch09_cwt_minimal_model.tex`
   - 圆孔 Fourier 系数前因子书写错误（代数不自洽）。
   - 偏振方位角公式仅适用于特殊情形，忽略相位项。
   - 椭圆率公式将 `\sin(2\chi)` 误写为 `\tan\chi`。
   - 已统一替换为一般复振幅形式（`atan2` + `\chi` 定义）。

4. `chapters/ch11_cmt_perturbation_splitting.tex`
   - 单端口反射式写成 `d_1^2`，与前文独立 `k/d` 定义不一致。
   - FWHM 叙述忽略背景散射引起的 Fano 线形条件。
   - 将开放系统写成“有效非互易 `\kappa_{12}\neq\kappa_{21}`”不严谨。
   - 已改为“开放导致非厄米，但不自动破坏互易”。

5. `chapters/ch13_rcwa_open_periodic_threshold.tex`
   - 周期层 `\beta` 直接写成单谐波根式不严谨。
   - 已改为“由层本征值问题给出；均匀层时才退化为根式”。

6. `chapters/ch15_method_comparison_workflow.tex`
   - 将有限器件问题直接建议改为 periodic/Bloch 边界可能改变物理问题本身。
   - 已补充“仅无限周期单胞可用；有限器件应保留开放边界+PML 收敛扫描”。

7. `chapters/ch17_qw_active_gain_models.tex`
   - `\alpha = \omega_0/(2Q)` 量纲链不完整。
   - 已改为 `\omega_0/(2Q v_g)=n_g\omega_0/(2Qc)`。

8. `chapters/ch19_thermal_electro_optic_coupling.tex`
   - 表面复合率写法量纲错误（把表面速度直接乘体密度项）。
   - 已改为“面通量 `U_\mathrm{surf}` -> 体复合率 `R_{\mathrm{surf,vol}}`”。
   - 温度斜率公式与“模增益温度斜率”叙述不一致，已修正为 `\partial g_{\mathrm{mod}}/\partial T` 形式。

9. `chapters/ch20_large_area_single_mode.tex`
   - 同一段落把 `g_{\mathrm{mat}}(r)` 同时当作可提出/不可提出积分号，定义冲突。
   - 已拆为“均匀近似式 + 非均匀积分式”两种情况。

10. `chapters/ch21b_dynamics_modulation_noise.tex`
    - 变量定义“数/密度”混用。
    - Henry 线宽式中 `S_0` 与前文密度符号体系不闭合。
    - 已改为“`N,S` 为密度；线宽式使用 `N_{\mathrm{ph},0}`，并给出 `N_{\mathrm{ph},0}=S_0V_{\mathrm{ph}}`”。

11. `chapters/ch25_math_appendix.tex`
    - 双正交基组下使用“平方系数和”误差指标不稳健。
    - Purcell-QNM 展开被过度简化为纯 Lorentz 叠加。
    - 已改为“残差范数误差定义 + 复残数通式 + Lorentz 退化条件”。

## 3. 审阅中识别但未采纳为缺陷的项（拒绝项）
- “必须在 ch03 的实部功率关系中显式加入 `\mu` 虚部项”：
  - 结论：本书该段默认非磁材料近似，可不强制展开磁损耗项；当前写法在既定假设下成立。
- “应将本轮所有章节做大段重写以统一风格”：
  - 结论：不属于物理正确性缺陷，且会显著扩大改动面，与最小必要改动原则冲突。

## 4. 一致性回归检查目标
- 不再出现以下旧式错误表达：
  - `\tilde n^2 = n^2 + 2 i k_0 n \tilde\alpha`
  - `\alpha = \omega_0/(2Q)`（未经过 `v_g`/`n_g` 换算）
  - 开放系统语境下直接写 `\kappa_{12}\neq\kappa_{21}` 作为“非互易”结论
- 全书编译应无新增报错与未定义引用。
