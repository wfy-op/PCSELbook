# PCSELbook

《PCSEL 理论、仿真与器件物理导论》LaTeX 书稿项目。

本仓库面向 `photonic-crystal surface-emitting laser (PCSEL)` 的系统学习与研究入门，目标不是整理零散笔记，而是维护一套可编译、可扩展、可版本化管理的中文教材式书稿。

## 项目定位

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
- 实用工作流、完整教材式 worked example、失败模式与检查清单

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
│  └─ pwem_square_hole/     # 纯 Python PWEM 教学算例
├─ review/                  # 各轮审稿与修订依据
├─ reference/               # 参考论文/资料
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

仓库提供了一个最小 PWEM 教学算例：

- [code/pwem_square_hole/run_pwem_square_hole.py](code/pwem_square_hole/run_pwem_square_hole.py)
- [code/pwem_square_hole/README.md](code/pwem_square_hole/README.md)

该脚本使用纯 Python 标准库，实现一个正方晶格圆孔二维光子晶体的标量 PWEM 计算，并输出：

- `pwem_square_hole_hz_bands.csv`
- `pwem_square_hole_summary.json`

这部分用于支撑书中关于 PWEM、能带图读取和教学算例的内容。

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

