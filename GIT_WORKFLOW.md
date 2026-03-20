# Git Workflow For PCSELbook

本文档记录 `PCSELbook` 项目的 Git、GitHub、编译与 release 流程，供你自己或后续 AI 直接调用。

## 1. 项目与仓库信息

- 项目目录：`C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南`
- Git 数据目录：`C:\Users\lenovo\OneDrive\研究生资料\PCSEL指南\.git`
- 默认分支：`main`
- 远程仓库：`origin = https://github.com/wfy-op/PCSELbook.git`

## 2. 当前 Git 身份

本仓库当前使用 GitHub `noreply` 身份：

```text
user.name  = Feiyang Wu
user.email = 154874224+wfy-op@users.noreply.github.com
```

检查命令：

```powershell
git config user.name
git config user.email
```

## 3. AI 能读取什么

后续 AI 可以读取：

- 已保存到磁盘的 `.tex`、`.bib`、`.md`、脚本等文件内容
- 已提交或未提交但已经保存的本地修改
- `git diff`、`git status`、`git log` 反映出来的版本差异

后续 AI 不能读取：

- 你编辑器里尚未保存到磁盘的内容
- 浏览器页面里未下载到本地的内容

结论：

- 你手动修改过并且已经保存的内容，我可以读取并纳入后续 release 总结
- 你若希望 AI 在发布时自动总结版本改动，前提是这些改动已经保存到文件里

## 4. 哪些内容会被 Git 追踪

### 会被追踪

- `main.tex`
- `preamble.tex`
- `notation.tex`
- `refs.bib`
- `frontmatter/`
- `chapters/`
- `code/`
- `review/`
- `README.md`
- `WRITING_GUIDE.md`
- `GIT_WORKFLOW.md`
- 其他源码、说明文档、审稿文档

### 不会被追踪

以下内容已写入 `.gitignore`：

- `build/`
- LaTeX 辅助文件：`*.aux`, `*.log`, `*.toc`, `*.xdv`, `*.synctex.gz` 等
- `version/`
- `.claude/`
- `.vscode/`

### 特别说明

- `version/` 是本地版本留档目录，不推送到 GitHub
- 正式对外版本使用 `git tag + GitHub release`
- 不要把 `build/` 或 `version/` 当作 Git 历史快照目录

## 5. 日常工作流

### 5.1 查看状态

```powershell
git status
```

### 5.2 查看改动

```powershell
git diff
```

### 5.3 编译验收

```powershell
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
```

输出 PDF：

```text
build/pcselbook.pdf
```

### 5.4 提交

```powershell
git add .
git commit -m "你的提交说明"
```

建议提交粒度：

- 一次修一个主链问题
- 一次处理一个 review round
- 一次修一个章节组

### 5.5 推送

```powershell
git push
```

## 6. 版本历史与回退

### 查看历史

```powershell
git log --oneline --graph --decorate --all
```

### 查看单文件历史

```powershell
git log -- chapters/ch05_band_gamma_mode_selection.tex
```

### 查看某次提交改了什么

```powershell
git show <commit-hash>
```

### 撤销工作区未提交改动

```powershell
git restore 路径
```

### 撤销已 add 的文件

```powershell
git restore --staged 路径
```

### 回到上一提交但保留改动

```powershell
git reset --soft HEAD~1
```

不要轻易使用：

```powershell
git reset --hard
```

## 7. GitHub CLI (`gh`) 流程

### 检查登录状态

```powershell
gh auth status
```

### 登录

```powershell
gh auth login --hostname github.com --git-protocol https --web
```

### 查看 release

```powershell
gh release view v3.19
```

## 8. 自动生成 release 说明

本项目已提供脚本：

- `scripts/generate_release_notes.ps1`

它的用途：

- 自动读取两个版本之间的 `git diff`
- 统计修改文件、章节标题、改动类别
- 生成一份可编辑的 release 说明草稿
- 在 `CurrentRef=HEAD` 时，还会额外列出当前工作区尚未提交的已保存改动

### 推荐用法

生成 `v3.19` 相对 `v3.18` 的说明草稿：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_release_notes.ps1 -Version v3.19 -CurrentRef v3.19 -BaseRef v3.18 -OutputPath build\release_notes_v3.19.auto.md
```

若你只是想在正式发布前预览当前 `HEAD` 的改动总结，可用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_release_notes.ps1 -Version draft -CurrentRef HEAD
```

输出文件默认写入：

```text
build/release_notes_<version>.auto.md
```

### 使用原则

- 脚本生成的是初稿，不是最终对外说明
- 正式 release 前仍应人工收紧措辞
- 若工作区有未保存内容，脚本无法读取
- 若工作区有未提交但已保存内容，脚本在 `HEAD` 模式下可以列出它们

## 9. 项目专用 release 流程

### 9.1 编译正式 PDF

```powershell
latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build -jobname=pcselbook main.tex
```

### 9.2 本地留档（默认执行）

每次准备发布新版本时，先把当前 PDF 复制到 `version/`：

```powershell
Copy-Item build\pcselbook.pdf version\pcselbook3.19.pdf
```

命名规则：

- `version/pcselbook3.19.pdf`
- `version/pcselbook3.20.pdf`
- `version/pcselbook3.21.pdf`

注意：`version/` 不推送到 GitHub。

### 9.3 生成 release 说明草稿

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_release_notes.ps1 -Version v3.19 -CurrentRef v3.19 -BaseRef v3.18 -OutputPath build\release_notes_v3.19.auto.md
```

然后人工整理这份草稿，生成正式说明文本。

### 9.4 提交与打 tag

```powershell
git add .
git commit -m "release: prepare v3.19"
git push
git tag -a v3.19 -m "PCSELbook release v3.19"
git push origin v3.19
```

### 9.5 创建 GitHub release 并上传 PDF

```powershell
gh release create v3.19 build\pcselbook.pdf --title "PCSELbook v3.19" --notes-file build\release_notes_v3.19.txt
```

如果 release 已存在，只更新附件：

```powershell
gh release upload v3.19 build\pcselbook.pdf --clobber
```

## 10. 当前已发布版本

- `v3.18`
- `v3.19`

查看命令：

```powershell
gh release view v3.19
```

网页地址：

```text
https://github.com/wfy-op/PCSELbook/releases
```

## 11. 对后续 AI 的约定

后续 AI 在执行版本发布时，默认应按下面顺序走：

1. 读取当前工作区已保存改动
2. 编译 `build/pcselbook.pdf`
3. 复制一份到 `version/pcselbookX.YY.pdf`
4. 用 `scripts/generate_release_notes.ps1` 生成 release 说明初稿
5. 人工或 AI 收紧措辞，形成正式 `release_notes_vX.YY.txt`
6. 提交、打 tag、创建 GitHub release

如果用户只说“发布新版本”而没有额外说明，默认采用上述流程。
