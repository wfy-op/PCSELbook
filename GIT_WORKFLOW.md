# Git Workflow For PCSELbook

本文件记录 `PCSELbook` 项目的 Git、GitHub、编译与 release 使用约定，供你自己或后续 AI 直接调用。

## 1. 仓库基本信息

- 项目目录：`C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南`
- Git 元数据目录：`C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南\.git`
- 默认分支：`main`
- 远程仓库：
  - `origin = https://github.com/wfy-op/PCSELbook.git`

## 2. 当前 Git 身份

本仓库已经配置为使用 GitHub `noreply` 身份：

```text
user.name  = Feiyang Wu
user.email = 154874224+wfy-op@users.noreply.github.com
```

查看命令：

```powershell
git config user.name
git config user.email
```

如果需要修改：

```powershell
git config user.name "Feiyang Wu"
git config user.email "154874224+wfy-op@users.noreply.github.com"
```

## 3. 哪些内容会被 Git 追踪

### 会追踪

- `main.tex`
- `preamble.tex`
- `notation.tex`
- `refs.bib`
- `frontmatter/`
- `chapters/`
- `code/`
- `reference/`
- `review/`
- `README.md`
- `WRITING_GUIDE.md`
- 其他源码、说明文档、审稿文档

### 不会追踪

以下内容已经写入 `.gitignore`：

- `build/`
- LaTeX 辅助文件：`*.aux`, `*.log`, `*.toc`, `*.xdv`, `*.synctex.gz` 等
- `version/`
- `.claude/`
- `.vscode/`

### 特别说明

`version/` 是你自己的本地留档目录，不要提交到 GitHub。  
如果需要做正式发布，请用 Git tag + GitHub Release，而不是把 PDF 快照直接纳入仓库版本历史。

## 4. 日常工作流

### 4.1 查看状态

```powershell
git status
```

### 4.2 查看改动

```powershell
git diff
```

### 4.3 编译验收

在项目根目录运行：

```powershell
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
```

输出 PDF：

```text
build/pcselbook.pdf
```

### 4.4 提交

```powershell
git add .
git commit -m "你的提交说明"
```

建议提交粒度：

- 一次修一个主题
- 一次修一个 review round
- 一次修一个章节链

推荐提交信息风格：

```text
docs: refine repository homepage readme
fix: repair chapter 5 gamma-point PWEM section
refactor: reorganize symmetry and BIC narrative
chore: ignore local archived versions
```

### 4.5 推送

```powershell
git push
```

## 5. 分支管理建议

当前主分支要求：

- `main` 始终保持可编译
- 不要把明显未完成且无法编译的状态直接推到 `main`

如果要做较大改动，建议新建分支：

```powershell
git switch -c rewrite-ch16-19
```

完成后推送：

```powershell
git push -u origin rewrite-ch16-19
```

常见分支命名建议：

- `rewrite-ch1-6`
- `review-round4-fixes`
- `device-modeling-upgrade`
- `bic-formalism-pass`

## 6. 查看历史

### 查看简洁历史

```powershell
git log --oneline --graph --decorate --all
```

### 查看某个文件历史

```powershell
git log -- chapters/ch05_band_gamma_mode_selection.tex
```

### 查看某次提交改了什么

```powershell
git show <commit-hash>
```

## 7. 回退与恢复

### 只撤销工作区未提交修改

```powershell
git restore 路径
```

例子：

```powershell
git restore chapters/ch05_band_gamma_mode_selection.tex
```

### 撤销已经 `git add` 的文件

```powershell
git restore --staged 路径
```

### 回到上一个提交但保留改动

```powershell
git reset --soft HEAD~1
```

### 不要做的事

除非你非常确定，否则不要使用：

```powershell
git reset --hard
```

## 8. GitHub CLI (`gh`) 使用

当前机器已经安装 `gh`，版本约定如下：

```powershell
gh --version
```

如果新终端里 `gh` 不生效，先重开终端再试。

### 登录状态检查

```powershell
gh auth status
```

### 登录

```powershell
gh auth login --hostname github.com --git-protocol https --web
```

登录完成后应看到：

- `Logged in as wfy-op`
- `Active account: true`

## 9. 发布 release 的项目专用流程

### 9.1 编译正式 PDF

```powershell
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
```

### 9.2 本地留档（可选）

复制一份到 `version/`，仅本地保留，后缀以日期命名

```powershell
Copy-Item build\pcselbook.pdf version\pcselbook3.19.pdf
```

注意：`version/` 不会推送到 GitHub。

### 9.3 打 tag

通用格式：

```powershell
git tag -a vX.YY -m "PCSELbook release vX.YY"
git push origin vX.YY
```

### 9.4 创建 GitHub release 并上传 PDF

```powershell
gh release create vX.YY build\pcselbook.pdf --title "PCSELbook vX.YY" --notes "Release vX.YY of PCSELbook. This release includes the compiled PDF generated from the current LaTeX project state."
```

### 9.5 如果 release 已存在，只更新附件

```powershell
gh release upload vX.YY build\pcselbook.pdf --clobber
```

`--clobber` 表示覆盖同名附件。

## 10. 当前已经存在的发布记录

已完成：

- GitHub tag: `v3.18`
- GitHub release: `v3.18`
- release 附件：`build/pcselbook.pdf`

查看 release：

```powershell
gh release view v3.18
```

网页地址：

```text
https://github.com/wfy-op/PCSELbook/releases/tag/v3.18
```

## 11. 当前目标版本：v3.19

`v3.19` 当前应理解为“下一次准备发布的工作版本”，不是已经存在于 GitHub 的 release。
在正式打 tag 和创建 release 之前，应先确认：

1. 工作区改动已经过编译验收
2. 提交信息能够清楚概括本轮修订主题
3. `build/pcselbook.pdf` 与正文状态一致
4. release note 已准备好

### 11.1 v3.19 计划纳入的修订点

根据当前项目内审记录，`v3.19` 主要覆盖以下内容：

- `ch09`：补 Green 函数误差界，并加入 Fresnel 反射的定量估计
- `ch09`：补 `D_x/D_y` 群速度矩阵的显式 `2\times 2` 推导示例框
- `ch09/ch07`：统一 `v_g \rightarrow v_{\mathrm{en}}` 的记号，并明确区分能量速度与 Bloch 群速度
- `ch05`：新增 `ABCD \leftrightarrow irrep` 映射表
- `ch07`：用 `v_{\mathrm{en}}` 重写阈值映射语境，并补“能量速度” `RigorousBox`
- `ch10`：新增“本章定位”节，明确“继承什么、升级什么”
- `ch13`：压缩 RCWA 开篇冗长列表，收紧方法入口叙述
- `ch09`：补模式竞争动力学框架，与多模速率方程链形成接口
- `ch09`：新增 `g_{\mathrm{mod}}` 来自 QW 模型的 `RigorousBox`
- `ch25`：新增关键量首次定义位置索引

### 11.2 v3.19 建议 release notes

可直接作为 `gh release create` 的说明文本使用：

```text
PCSELbook v3.19

This release focuses on theory-chain tightening and notation cleanup around the core PCSEL modeling workflow.

- Added ABCD-to-irrep mapping in the Gamma-point band chapter
- Unified energy-velocity notation and clarified its distinction from Bloch group velocity
- Strengthened the CWT chapter with Green-function error bounds, Dx/Dy 2x2 examples, and multimode competition links
- Tightened the RCWA chapter introduction
- Added key-definition indexing in the mathematical appendix
- Updated the compiled PDF to match the current LaTeX project state
```

### 11.3 v3.19 正式发布命令模板

当且仅当 `v3.19` 对应的提交已经准备好时，再执行：

```powershell
git add .
git commit -m "release: prepare v3.19"
git push
git tag -a v3.19 -m "PCSELbook release v3.19"
git push origin v3.19
gh release create v3.19 build\pcselbook.pdf --title "PCSELbook v3.19" --notes-file release_notes_v3.19.txt
```

如果不单独准备 `release_notes_v3.19.txt`，也可以直接把上一小节的说明文字写进 `--notes`。

## 12. 对后续 AI 的项目约定

后续 AI 如果要操作本仓库，应遵守以下规则：

1. 默认先看 `git status`
2. 不要把 `build/` 或 `version/` 加进提交
3. 提交前先编译，确认 `build/pcselbook.pdf` 正常生成
4. 大改动优先新建分支，不要直接污染 `main`
5. release 只上传 `build/pcselbook.pdf`
6. 本地留档 PDF 只放 `version/`，不推送
7. 若要改 Git 身份，只改仓库本地配置，不改全局配置，除非用户明确要求

## 13. 一套最小可执行命令

### 提交日常修改

```powershell
cd /d C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南
git status
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
git add .
git commit -m "refine chapter 5 Gamma-point derivation"
git push
```

### 生成新 release

```powershell
cd /d C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
git tag -a vX.YY -m "PCSELbook release vX.YY"
git push origin vX.YY
gh release create vX.YY build\pcselbook.pdf --title "PCSELbook vX.YY" --notes "Release vX.YY of PCSELbook. This release includes the compiled PDF generated from the current LaTeX project state."
```
