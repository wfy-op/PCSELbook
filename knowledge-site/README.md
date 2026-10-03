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

## 光学实验室本地预览

在 `knowledge-site` 目录运行：

```powershell
npm run dev:training
```

打开 `http://127.0.0.1:5175/optics/`，默认进入教程。首页和教材侧栏统一提供“光学实验室”入口，实验室顶部导航连接两个独立分页面：

- `/optics/tutorial/`：教程与实训，包含任务课程、交互练习、组内案例及实操记录。
- `/optics/designer/`：自由设计，包含顺序近轴与空间折转分光两种计算模式。

此命令直接启动 Vite，不执行书稿同步；教材首页使用已有 `public/data`。本机预览依赖该服务进程持续运行。

共同布局与路由判断在 `app/optics/OpticalLab.tsx`，教程维护入口是 `app/training/`，设计维护入口是 `app/design/`。`src/main.tsx` 选择实验室或教材页面；旧 `/training/optical-bench/`、`/design/optical-bench/` 地址继续打开相应分页面，所有入口兼容无尾斜线。分页面通过普通链接切换，原浏览器草稿、工程库和课程记录的存储键保持不变。教材章节路由和阅读进度逻辑保持独立。

培训页与设计工作台均已提供生产静态入口页；它们不进入教材全文搜索。当前继续本地预览，正式部署仍需用户明确授权并执行完整发布检查。

本地 demo v0.2 以透镜组合为主线，含 8 节课程、双镜对准与单透镜成像，以及可调的开普勒扩束、伽利略扩束、4f 中继和三片透镜泵浦聚焦。`lens-system.ts` 使用实际近轴传递计算；几何光线范围不等同于真实光斑，模型未包含衍射、像差、有限孔径与透射损耗。数学基准随 `npm run test` 执行。

v0.3 新增页面上方的自由搭建台 `OpticalPlayground.tsx`，使用独立的 `bench-engine.ts` 计算：可拖放最多 16 个透镜/光阑，编辑位置、高度、正负焦距与孔径，复制、移除、撤销重做。光源几何直径与发散**全角（mrad）**分别设置，可选择关联发散束或位置/角度独立的扩展源。有限孔径会终止被挡光线；计数不代表透过率。三项挑战覆盖准直、两倍扩束与目标面聚焦。设计自动保存在 `pcsel-optical-playground-v1`，支持 JSON 导入导出；手机可放大并横向滚动画布。此自由台仍为近轴薄透镜教学模型，不包含厚透镜主面、像差、衍射或镜架碰撞。

器件盒包含 12 个 Thorlabs 型号，官网公开接口的原始记录保存在 `public/training/thorlabs/`，已提取外径、标称焦距和镀膜波段，页面提供 CSV/JSON 下载。2026-09-30 官网工程文件服务器返回 403，PDF/STEP/ZMX **均未成功下载**；厚度和后焦距保持空值，通光孔径暂按外径 90% 作为明确标注的教学假设。`scripts/fetch_thorlabs_catalog.py` 和 `fetch_thorlabs_specs.py` 是手动运行的只读采集脚本，`build_training_catalog.py` 从已保存的官方标题生成目录；后续拿到工程图后才能补全真实通光孔径和机械尺寸。修改目录元件的光学参数会转为自定义；导入 JSON 也按自定义处理，不能认证厂家规格。

## 光路设计工作台 v0.4

同一服务打开 `http://127.0.0.1:5175/optics/designer/`。这是光学实验室的“自由设计”分页面，可从顶部导航或教程中的“进入自由设计”入口打开。旧 `/design/optical-bench/` 地址继续兼容，原设计草稿保持可用。

核心流程是设置光源、从目录或自定义器件组装、查看同步处方表与布局、分析光束和目标面、按目标优化位置、保存工程。支持最多 24 个透镜/光阑、几何口径与发散全角、Gaussian 波长/束腰/M²、偏心和中心倾角、有限目标孔径、逐面裕量、一阶 ABCD/EFL、几何最佳交会及 Gaussian 束腰。参数扫描逐点计算；位置优化按所选变量、最小间距、孔径和输出角约束搜索，先显示候选再应用，并能一次撤销。

`app/design/design-engine.ts` 是科学计算入口；布局和处方共享同一个工程。模型采用空气近轴薄透镜，Gaussian 使用 q 参数和强度 1/e² 半径；M² 大于 1 使用有效波长近似。模型后焦距从最后理想镜平面量起，不是未核验的厂家 BFL。几何 y-RMS 只代表子午截面采样分布，不能解释为二维光斑或耦合效率。未模拟厚透镜、色差、像差、反射镜折转和截光衍射；Gaussian 孔径不足后仍显示未截断参考包络。改变波长不会改变目录中的标称焦距。

工程 JSON 使用 `pcsel-optics-design` / `formatVersion: 1` 外壳，包含 `DesignProject` v2、设计目标、变量 ID 和约束。草稿与最多 20 个命名副本分别保存在 `pcsel-optics-designer-draft-v2` 和 `pcsel-optics-designer-library-v2`；可手动读取旧自由搭建台 v1 草稿。导入严格检查数值、ID 和边界；厂家型号仅在本地目录验证标称焦距与外径后保留，孔径依据另行记录。可下载 JSON、处方 CSV，以及嵌入完整参数、布局和实际计算读数的自包含 HTML 报告。

本机端口 5175 已在全局登记中保留给 PCSELbook。恢复服务前先核对 `C:\Users\feiyang\.codex\project-ports.md` / `.json` 和实际 IPv4/IPv6 监听；冲突时另选登记端口，不停止其他项目。

数学基准由 `npm test` 执行。无书稿同步的本地构建验证：

```powershell
npx vite build --outDir outputs/design-v4-build
node scripts/finalize_static_site.mjs outputs/design-v4-build
```

浏览器验收脚本、截图和导出样例保存在忽略的 `outputs/design-v4-*`，覆盖拖动/处方同步、Gaussian 基准、优化应用/撤销、扫描有效性、目标孔径、工程往返、报告与手机布局。此输出不用于部署。

`PumpCaseStudy.tsx` 使用用户提供的组内现场照片 `public/training/group-optical-pump.png`，保留原图。已确认的信息为蓝色光纤是泵光入口；其余功能布局及数值以明确标识的教学假设补全，不能当作实物镜片参数或对准结果。后续按用户确认的拓扑、焦距、波长与样品位置更新案例。

课程观察记录保存在 `pcsel-training-demo-notes-v1`，案例参数草稿保存在 `pcsel-optical-pump-case-draft-v1`，均只在当前浏览器存储。课程记录可以预览、复制或导出 JSON，任务卡可以打印。新增课程沿用旧记录，不覆盖已有实操内容。

## 空间折转与分光 v0.5

设计页增加“顺序光路 / 空间光路”两种计算模式，首次进入默认空间模式；上次模式保存在 `pcsel-optics-workspace-mode-v1`。顺序模式仍提供 Gaussian q、矩阵与位置优化。几何顺序工程可以复制为空间工程，原顺序工程保持不变，原空间草稿可通过撤销恢复；无限目标面在复制时变成明确命名的有限视场探测面。Gaussian 工程需先切换为几何源，避免把参考光线当作功率分布。

`app/design/folded-engine.ts` 按真实等比例 XY 坐标追迹，支持最多 48 个薄透镜、光阑、平面镜、半透半反镜和探测面。最近前向有限交点决定传播次序；平面镜用矢量反射定律，分光镜同时生成反射 / 透射分支。元件外的光线绕过元件，有效孔径与外径之间计入截光吸收。源孔径、发散全角（mrad）、方向（°）、位置及相对输入权重独立设置；扩展源采样使用位置×角度网格并显示实际采样数。零输入保留空结果，不编造光斑。

R/T 是可编辑的非相干功率系数，满足 R+T≤1；无损联动开关保持 R+T=1，关闭后可以引入吸收。每个探测器显示输入份额、到达样本数、沿探测面切线的一维中心/RMS/范围和角度 RMS。系统分别报告接收、逃逸、吸收和未完成追迹；循环反射、低功率分支及全局预算限额的剩余权重保留在未完成项，不会偷偷丢弃。重叠交点给出歧义提示。

`folded-scan.ts` / `FoldedScan.tsx` 对元件 X、Y、法线角度或透镜焦距做 21 点实际追迹，可指定目标探测器和最低接收份额，再应用离散最小 RMS 可行点。无接收、无效参数和未完成追迹不能被选为最优；工程或扫描条件改变后，旧候选失效。应用可撤销。空间模式不提供多变量自动寻优或全局最优保证。

索雷博参考器件记录在 `folded-catalog.json`，于 2026-10-02 核对官方来源：BS013、BSW10 和 BB1-E02 的外形、厚度（适用时）、波段和标称分光类别。它们加入画布后是理想等效面；默认 R/T、分光面长度与有效孔径的假设和实际机械尺寸分开记录。真实分光板厚度位移、立方内传播、楔角、偏振、镀膜谱线、相位干涉、Gaussian q、像差和厚透镜色散均未计算；均匀离散子午采样权重不能当作真实三维功率积分或二维 PSF。

草稿与最多 20 个空间副本分别保存在 `pcsel-folded-optics-draft-v1` 和 `pcsel-folded-optics-library-v1`；与顺序工程、培训记录独立。工程外壳为 `pcsel-folded-optics` / `formatVersion:1`，包含严格校验的 `FoldedScene` v1。支持 JSON 导入导出、CSV 处方和含完整工程及真实读数的自包含 HTML 报告。浏览器验收与截图保存在忽略的 `outputs/design-v5-*`，同时复核原顺序模式。无书稿同步的本地构建可使用 `npx vite build --outDir outputs/design-v5-build`，再运行 `node scripts/finalize_static_site.mjs outputs/design-v5-build`。本地升级不触发 Cloudflare 上传。

## 界面样式 v0.6

2026-10-03 的界面调整统一了顺序与空间模式的暖白背景、深绿交互、描边图标、卡片、指标、表格及参数面板，并提高小字号标签的对比度。样式入口为 `app/design/designer-theme.css` 与 `sequential-polish.css`，图标为 `OpticsIcon.tsx`；均限定在设计页，不改变教材或培训页。光学计算、单位、工程格式与草稿存储保持原样。

桌面空间模式的元件库和参数面板可独立滚动；手机继续使用局部画布缩放和表格滚动。现有两种模式的完整浏览器流程已复核，结果、截图与本地静态构建保存在忽略的 `outputs/design-v6-*`。本次没有上传 Cloudflare。

## 工作台交互与本地验收

2026-10-04 增补探测面编号与常用物镜。空间探测面在画布、读数、元件选择、参数扫描及 CSV/HTML 中统一显示 D1、D2……，按探测面在参数表中的顺序编号；名称与内部 ID 保留。顺序模式的目标面标为 D1。

两种设计模式均可加入 RMS4X、RMS10X、RMS20X、RMS40X、MY10X-803 和 MY20X-804，并提供“10× 物镜与筒镜成像”模板。`app/design/objective-model.ts` 为共同目录与参数校验入口；官方当前标题中的倍率、NA、WD 原始记录保存在 `public/training/objectives/`。采集脚本 `scripts/fetch_objective_catalog.py` 只手动读取官方公开 API，不在启动时联网。

物镜采用无限远校正、空气中的近轴等效主面：`f = f_tube / M`，估算后瞳直径 `D = 2 NA f`。Evident 参考筒镜为 180 mm，Mitutoyo 为 200 mm；机械 WD 不等于焦距。模型外径默认 25.4 mm（或更大瞳径），仅是假设的遮挡范围。目录中可见光物镜不据此认证 940 nm 性能；高 NA 全孔径、多片结构、真实主面、盖玻片和像差未建模。修改焦距/孔径后转为自定义等效参数。新版读取旧工程，新增的可选物镜字段会在保存、重载、JSON 导入及模式转换中保留。

数值验证随 `npm run test` 执行，新增浏览器验收为 `node scripts/qa_objective_workbench.mjs`，沿用下文的 `PCSEL_PLAYWRIGHT_MODULE`、`PCSEL_OPTICS_URL` 和浏览器通道变量；输出位于忽略的 `outputs/objectives-qa/`。该脚本使用独立浏览器上下文，检查编号一致性、复制、等效成像、短焦物镜、编辑/撤销、重载、导出、模式转换和手机布局。`--no-screenshots` 可避免重复截图。

Impeccable 界面优化沿用暖白与深绿风格。`WorkspacePanel.tsx` 在宽度低于 1100 px 时默认收起器件库和参数面板，选择新元件时展开参数；桌面保持两侧面板可用。导入、导出与报告集中到“工程文件”，保存副本、撤销和重做直接可见。模型切换支持左右方向键、Home 和 End，并同步键盘焦点。空间画布的标签与选择区域按屏幕尺寸缩放，画布下方的选择菜单提供完整元件名称；实际光学坐标、计算模型、工程格式及存储键保持原样。实验室手机页头高度为 116 px，教程锚点采用同一高度避让。

浏览器验收脚本已纳入版本管理：`scripts/qa_optical_lab.mjs`。先确认现有本地服务可用，再在 `knowledge-site` 目录运行：

```powershell
npm run qa:optics
```

脚本默认动态导入已安装的 `playwright`，使用 Microsoft Edge 访问 `http://127.0.0.1:5175`；不启动服务，在独立的临时浏览器上下文中检查导航、草稿与工程往返、键盘操作、折叠面板和响应式布局。JSON 结果与截图默认写入忽略的 `outputs/optical-lab-qa/`；以实际生成的结果确认通过情况。可选环境变量为：

- `PCSEL_PLAYWRIGHT_MODULE`：现有 Playwright 模块标识或 `file://` URL，无需为检查重复安装依赖。
- `PCSEL_OPTICS_URL`：已运行的预览服务地址。
- `PCSEL_OPTICS_QA_OUTPUT`：结果目录，支持相对于 `knowledge-site` 的路径或绝对路径。
- `PCSEL_OPTICS_BROWSER_CHANNEL`：已安装的浏览器通道，默认 `msedge`。

网站文件由父目录 PCSELbook 仓库统一管理。本次使用 `codex/optical-lab-impeccable` 分支，功能基线已保存为 `4f7fab3`，界面调整单独提交。按相关文件清单暂存，避免 `git add .` / `git add -A` 混入其他书稿或审阅改动；构建、截图和临时文件留在忽略的 `outputs/`。本地提交不会自动推送远端或上传 Cloudflare。

## 阅读进度与章节跳转

- 章节、小节、滚动位置和更新时间保存在浏览器 `localStorage` 的 `pcsel-reading-progress-v1` 中。
- 每台电脑、每个浏览器配置各有自己的记录；不会跨设备同步，也不使用 Cookie 或服务器数据库。
- 首页会显示“继续阅读”，恢复本机上次章节和滚动位置。
- 侧栏小章节使用真实正文锚点；即使仍在同一章内，点击也会显式滚动到目标标题。

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

该命令会先执行完整 `check` 和部署审计，再通过 Direct Upload 发布到 `pcsel-knowledge-site.pages.dev`。站点只包含公开静态资源，没有登录、写接口或服务器状态。
