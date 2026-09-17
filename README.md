# PCSELbook

《PCSEL 理论、仿真与器件物理导论》LaTeX 书稿项目。

本仓库面向 `photonic-crystal surface-emitting laser (PCSEL)` 的系统学习与研究入门，目标不是整理零散笔记，而是维护一套可编译、可扩展、可版本化管理的中文教材式书稿。

## 项目定位

### 2026-09-17 图解与入门修订

网页首页拆解 PC / SE / L；第一章前移结构比较并增加 FP 边发射原理与阈值算例；第五章增加 Γ 点相位、ABCD 组合、正方晶格真实 PWEM 能带及三角晶格 I–IV 图解；第八章增加 FFT 远场对照与椭圆化二模算例。同步纠正群速度、有限腔寿命和对称性标签的适用条件，并重写前言。

新增计算入口见 `code/teaching_visuals/README.md`。书本与网站共用 `figures/computed/` 中的图源；实际计算与教学参数模型分别标明。

本书尝试把 PCSEL 作为三类对象同时处理：

- 周期开放电磁系统
- 半导体有源光学腔
- 含真实外延、电注入、热分布与损耗机制的器件

全书主线覆盖：

- Maxwell 方程、Bloch 理论、光子能带与 `\Gamma` 点模
- 对称性、偏振、BIC / quasi-BIC、耦合波理论
- PWEM、RCWA、FDTD、FEM 等数值方法
- 外延层光学、量子阱增益、电注入、载流子输运、热-电-光耦合
- 大面积单模设计、鲁棒性分析、动态学与噪声
- 从单胞到器件的仿真路径、两层可复核例题、失败模式与检查清单

## 仓库结构

```text
PCSELbook/
├─ main.tex                 # 主文件
├─ preamble.tex             # 导言区
├─ notation.tex             # 统一符号
├─ refs.bib                 # 参考文献
├─ frontmatter/             # 封面、前言
├─ chapters/                # 各章节正文
├─ code/
│  ├─ vertical_tmm_mode/    # 一维纵向 TE 模与量子阱重叠
│  ├─ pwem_square_hole/     # 二维圆孔方格 PWEM
│  ├─ pwem_cutoff_failure/  # 截断不足反例
│  ├─ fp_decay_q/           # 衰减寿命与 Q 的校准算例
│  └─ rcwa_square_hole/     # RCWA 单胞算例入口
├─ review/                  # 各轮审稿与修订依据
├─ reference/               # 参考论文/资料
├─ knowledge-site/          # 从书稿自动生成的静态知识站
├─ build/                   # 编译输出（忽略追踪）
└─ version/                 # 个人留档版本（忽略追踪）
```

## 编译方式

推荐在项目根目录使用 `latexmk + xelatex`：

```powershell
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
```

生成文件：

```text
build/pcselbook.pdf
```

如果你只想快速清理辅助文件：

```powershell
latexmk -c -outdir=build -jobname=pcselbook main.tex
```

## 环境要求

- TeX Live（建议使用 `XeLaTeX`）
- Windows 下建议直接在 PowerShell 中运行
- 书稿默认使用中文 `ctexbook` 文档类

## 数值算例代码

可运行算例按“校准件—反例—主例题”组织：

- [code/vertical_tmm_mode/README.md](code/vertical_tmm_mode/README.md)：求纵向 TE 束缚模、$n_{\mathrm{eff}}$ 与 $\Gamma_{\mathrm{QW}}$。
- [code/pwem_square_hole/README.md](code/pwem_square_hole/README.md)：计算正方晶格圆孔的标量 PWEM 能带与高对称点数据。
- [code/pwem_cutoff_failure/README.md](code/pwem_cutoff_failure/README.md)：展示倒格截断不足如何造成伪收敛与模式误判。
- `code/fp_decay_q/`：由实际衰减信号核对振幅寿命、能量寿命与 $Q$ 的因子 2。
- `code/rcwa_square_hole/`：开放周期单胞的 RCWA 算例入口。

书中第 23 章只把已实际运行的 TMM 与 PWEM 标为“实算值”；有限阵列和电热项明确保留为待验证条件。练习题的答案线索与逐题评分点集中在第 29 章。

## 知识站同步

`knowledge-site/` 不维护另一份正文，章节、公式、图片、目录和检索索引都从本书源文件生成。进入该目录后运行 `npm run dev`，会先同步现有书稿，并在本地开发期间监听后续书稿变化；`npm run check` 则生成并完整检查可部署版本。

Cloudflare Pages 不会自动上传。只有收到明确发布指令后，才运行 `npm run deploy:pages`；该命令上传前会清理字体回退、构建清单等无用文件并审计部署产物。

## 写作与修订原则

本项目不是“写完即止”的单次稿件，而是持续演化的教材书稿。核心要求包括：

- 教材化叙述，而不是综述堆砌
- 重要结论尽量给出推导、证明思路或适用边界
- 明确区分冷腔结果、线性阈值代理与器件级结论
- 将外延、电注入、热效应真正纳入主线

详细规范见：

- [WRITING_GUIDE.md](WRITING_GUIDE.md)

## Git 工作流建议

建议保持 `main` 分支始终可编译，并按“一个主题、一条提交”的粒度提交：

```powershell
git status
git add .
git commit -m "refine chapter 5 Gamma-point PWEM derivation"
git push
```

仓库默认忽略：

- `build/` 编译产物
- `version/` 个人留档 PDF
- 常见 LaTeX 辅助文件

## 当前状态

本仓库已经完成基础 Git 管理，可直接继续：

- 章节修订
- 编译验收
- 分支开发
- GitHub 远程同步

如果你的目标是继续完善书稿，建议优先遵循：

1. 先改正文
2. 再编译验收
3. 再做一次小粒度提交
