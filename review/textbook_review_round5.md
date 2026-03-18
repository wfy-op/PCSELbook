# PCSEL 教材第五轮修订报告（round5）

**修订范围：** Ch05（能带）、Ch09（CWT）
**修订日期：** 2026-03-18
**参考文献：** Liang 博士论文 (liang2012square, liang2013triangular)、Wang Ziye 博士论文 (wang2024)

> 本轮重点：参照 reference 中两篇文献，对能带概念和 CWT 理论进行更详细的来源推导补充。

---

## Ch05 能带章节新增内容

### 新增节：$\Gamma$ 点四带——从 PWEM 矩阵本征问题到 ABCD 模式分类

1. **TE 极化 PWEM 矩阵方程完整推导**：从 $H_z$ 标量方程出发，经 Bloch 展开和 $\eta$ Fourier 展开，给出矩阵本征方程 `eq:pwem_matrix_ch5`，并给出圆形空气孔 $\eta_{\mathbf{G}}$ 的解析表达式 `eq:eta_G_circle`（含 Bessel 函数）。

2. **修正等效介电常数方法**：按 Liang 文献路线，给出从 TMM 基模场剖面到修正介电常数 $\tilde\varepsilon_a,\tilde\varepsilon_b$ 的完整公式链 `eq:gamma_pc, eq:modified_eps`，解释如何将三维 slab 效应折算进二维 PWEM。

3. **ABCD 四模分类与物理含义**：解释四支带边模的 irrep 归属、辐射特性差异（A/B 暗模 vs C/D 亮模），以及与 1D-DFB 对称/反对称模的类比。

4. **RigorousBox**：强调 PWEM 是厄米本征问题，只给频率排序和场型分类，不给损耗排序。

---

## Ch09 CWT 章节新增内容

### 新增节：从二维到三维——Liang--Noda 3D CWT 的推导框架（§sec:3d-cwt-derivation）

1. **矢量波动方程出发点**：解释为什么必须从 $\nabla\times\nabla\times\mathbf{E}$ 出发而非 $H_z$ 标量方程（辐射波无 $H_z$ 分量）。

2. **波矢三类分类**：基本波（$m^2+n^2=1$，束缚型）、高阶波（$m^2+n^2>1$，倏逝型）、辐射波（$m=n=0$，振荡型），并新增 TikZ 纵向场剖面示意图 `fig:vertical_profiles_3types`。

3. **基本波耦合方程推导**：从矢量波动方程经基模方程消去、纵向投影，得到四波本征方程 `eq:3d_cwt_eigenvalue`。

4. **三个子矩阵的解析表达与物理解释**：
   - $\mathbf{C}_{\rm 1D}$：一维反馈耦合，公式 `eq:3d_cwt_kappa1D`
   - $\mathbf{C}_{\rm rad}$：辐射耦合（非厄米），通过 Green 函数 `eq:3d_cwt_green` 求解辐射波场 `eq:3d_cwt_rad_field`，给出矩阵元 `eq:3d_cwt_Crad_element`
   - $\mathbf{C}_{\rm 2D}$：二维高阶耦合（厄米），高阶波倏逝波数 `eq:3d_cwt_kz_ho`，矩阵元 `eq:3d_cwt_C2D_element`

5. **核心输出与二维模型差异**：列出三维 CWT 的四类输出（频率、辐射常数、场型偏振、纵向剖面），以及相比二维 CWT 的三点本质进步。

6. **圆孔 vs 非对称孔形的干涉抵消机制**：解释圆孔 $\alpha_{\rm rad}=0$（BIC）的物理原因（反向基本波纵向干涉相消），以及非对称孔形打开辐射通道的机制，含数值量级 ExampleBox。

7. **三晶格 PCSEL 应用**：RigorousBox 引用 wang2024，说明三维 CWT 如何指导三晶格间距优化。

### 其他 Ch09 已有改进（round4 遗留）
- 四波截断定量条件
- irrep 变换矩阵 $U$ 显式形式
- $\kappa_1$ 数量级 ExampleBox

---

## 修改文件清单

| 文件 | 修改类型 |
|---|---|
| `chapters/ch05_band_gamma_mode_selection.tex` | 新增 §$\Gamma$ 点四带（约 80 行） |
| `chapters/ch09_cwt_minimal_model.tex` | 新增 §3D CWT 推导框架（约 150 行）+ 纵向场剖面图 + 干涉抵消节 + 三晶格 RigorousBox |

---

## 总结

本轮修订将 Ch05 和 Ch09 中原本只给出结论的物理概念补充了完整的来源推导链条，使读者能从 Maxwell 方程一步步走到 PWEM 矩阵本征问题和 3D CWT 耦合方程，而不只是接受最终结果。所有推导均参照 Liang 博士论文和 Wang Ziye 博士论文的框架，并在正文中给出了明确的文献引用。
