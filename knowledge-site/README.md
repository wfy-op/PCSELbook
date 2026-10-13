# PCSEL 知识站

《PCSEL 理论、仿真与器件物理导论》的纯静态、公开只读知识站。教材正文以父目录 LaTeX 书稿为唯一内容源；公式在构建期转成带 MathML 的 KaTeX，书中图形从原始 LaTeX/TikZ 图源生成独立 WebP，不使用 PDF 页面截图。实验入门模块另有独立的教学内容源，见下方本地 demo 说明。

## 本地开发与自动同步

前置条件：Node.js `>=22.13.0`、XeLaTeX/latexmk，以及项目 Python 环境中的 Pillow、pypdf、PyMuPDF 和 fontTools。

```powershell
npm install
npm run dev
```

`npm run dev` 会先执行一次完整书稿同步，然后监听父目录的章节、前言、图源、封面、主文件、符号表和参考文献。书稿保存后，本地 PDF、图形、章节 JSON、检索索引、字体子集和公式 HTML 会自动按需更新，Vite 随后刷新页面。默认开发地址为 `http://127.0.0.1:5173/`；生产版可用 `npm run preview` 在 `http://127.0.0.1:4173/` 审阅。

需要手动执行一次同步时：

```powershell
npm run sync:book
```

不要直接编辑 `public/data/chapters/*.json`、清单或检索索引；这些都是可重建产物。

## 光学实验室

实验室是 [独立项目](../optical-lab/README.md)，网址为 <https://optical-lab-feiyang.pages.dev/>。教材首页和侧栏仅提供跳转链接。光学源码、规格资料、计算与验收脚本已移到 `../optical-lab/`；在该目录使用 `npm run dev`，本机端口为登记的 5175。

旧 `/optics/`、`/optics/tutorial/`、`/optics/designer/` 和 training/design 地址跳转到独立站。迁移导出页 `/optical-lab-migration/` 留在教材域名；旧 `/optics/migrate/` 同域跳转到此页。导出原浏览器实验室记录，再到新首页底部导入。阅读记录与实验室记录分开，跨域迁移必须通过导出/导入。

路由维护入口为 `src/main.tsx`、`scripts/finalize_static_site.mjs` 与 `app/StorageTransfer.tsx`。教材构建不依赖实验室源代码；完整教学/模型/发布说明见 [实验室文档](../optical-lab/docs/optics-workbench.md)。

## 阅读进度与章节跳转

- 章节、小节、滚动位置和更新时间保存在浏览器 `localStorage` 的 `pcsel-reading-progress-v1` 中。
- 每台电脑、每个浏览器配置各有自己的记录；不会跨设备同步，也不使用 Cookie 或服务器数据库。
- 首页会显示“继续阅读”，恢复本机上次章节和滚动位置。
- 侧栏小章节使用真实正文锚点；即使仍在同一章内，点击也会显式滚动到目标标题。
- 阅读区顶部显示本章滚动进度；向下阅读后可用“回到本章开头”返回。目录会在自身滚动区内跟随当前章节与小节。
- 全书结构按正文分部与附录排列；搜索支持上下键选择、Enter 打开、Esc 关闭，选中结果会滚入可见范围。

## 构建、检查与精简

```powershell
npm run build
npm run check
```

标准流程依次完成：

1. 仅在书稿源比 PDF 新时调用 latexmk 重新编译。
2. 仅在图源或导言发生变化时重新渲染 WebP 图形。
3. 生成章节数据、引用、搜索索引、统计和字体子集，并严格预渲染全部公式。
4. Vite 输出 `dist/client`，再为每章生成可独立访问的静态回退页。
5. 删除部署中不需要的 TTF/WOFF 回退、source map 和构建清单，只保留现代 WOFF2 字体。
6. 审计文件数量、单文件大小、引用资源和禁止上传的临时/源码文件。

测试不再锁死某一次书稿的页数或公式数，而是按当前清单核对所有章节标题锚点、公式、图形、表格、引用、检索和路由，因此后续增删内容会自动进入网站并接受一致性检查。

## Cloudflare Pages

Cloudflare 上传必须等待用户明确命令，不会因书稿更新或本地构建自动发生。收到发布指令后才运行：

```powershell
npm run deploy:pages
```

该命令先核对静态站发布边界并回收明确的临时产物，再执行完整 `check` 和部署审计，通过后才用 Direct Upload 发布到 `pcsel-knowledge-site.pages.dev`。站点只包含公开静态资源，没有登录、写接口或服务器状态。

教材页面、外链或跳转更新可使用 `npm run deploy:pages:static`，保留已有教材数据，依次执行临时产物回收、构建、测试、lint、类型检查和上传负载审计。实验室更新只在独立项目执行自己的发布命令。这些整理步骤是以后每次优化上传前的必要操作，不通过不得跳过。旧 `build:optics` / `deploy:pages:optics` 仅作为教材静态发布的兼容命令。
