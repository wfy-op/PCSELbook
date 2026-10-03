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

在 `knowledge-site` 目录运行 `npm run dev:training`，打开 `http://127.0.0.1:5175/optics/`。此命令直接启动 Vite，使用已有教材数据，不执行书稿同步。5175 已登记给本项目；恢复服务前检查全局端口表和所有绑定地址的实际监听，冲突时另选登记端口，不停止其他项目。

- `/optics/tutorial/`：八节任务课程、近轴练习、组内泵浦案例和浏览器内实操记录。
- `/optics/designer/`：空间布局为主的设计工作台，另保留顺序 ABCD/Gaussian 模式。

首页和教材侧栏提供统一实验室入口，页头在教程与设计间导航。旧 `/training/optical-bench/`、`/design/optical-bench/` 继续兼容无尾斜线地址。页面间切换恢复已持久化草稿；教材搜索不索引这些工作区，阅读进度保持独立。布局和路由维护入口为 `app/optics/OpticalLab.tsx`、`src/main.tsx` 与 `scripts/finalize_static_site.mjs`。

### 设计、计算与模型边界

空间画布优先占据桌面操作区域，装备库按类别展开选择，参数面板可收起。网格和吸附间隔独立输入毫米；元件图标与光线线宽仅调整显示，不修改真实坐标。探测器按工程顺序编号 D1、D2……，画布、选择器、读数、扫描和导出使用同一标记。

空间模式支持最多48个薄透镜、物镜、柱透镜、光阑、平面镜、分光镜和探测面。`app/design/core/folded-engine.ts` 追迹三维方向及有限圆形光学面的真实交点，布局中心与法线位于 XY，Z 为第二横轴；薄透镜和物镜仍使用局部近轴主面。椭圆 Gaussian/均匀源独立设置两个轴的直径、发散全角（mrad）及横截面旋转；Gaussian 完整宽度为1/e²定义。旧工程继续使用原一维采样，可显式启用二维光束。

探测器显示实际接收样本、等比例二维功率分箱、积分剖面、质心、两轴/径向 RMS 与主轴。R/T 是非相干功率系数，接收、逸出、吸收、未完成四项保持守恒。柱透镜通过两个轴的焦距与滚转建模；球差、彗差、像散使用用户定义的瞳面 OPD 多项式及实际梯度，不是厂家处方或标准化 Zernike RMS。强度图是几何采样密度，不能解释为衍射 PSF；零几何尺寸不等于零物理光斑或无限辐照度。

`core/folded-optimizer.ts` 联合搜索有界 X/Y、法线与焦距变量，具有追迹预算、进度、取消、最低接收份额和功率核算约束。候选先比较再应用，工程或条件变化后旧候选失效；单变量21点扫描仍保留。有限局部搜索不保证全局最优。

顺序模式由 `core/design-engine.ts` 独立计算空气近轴 ABCD、最佳几何交会、Gaussian q、1/e²半径和有效波长 M²近似。其 y-RMS 是一维子午统计，参考光线不是强度权重，截光后的 Gaussian 包络仍是未截断参考。Gaussian 顺序工程不能直接复制为空间功率模型；几何处方转换保留原工程和空间撤销记录。

这两种模型未实现真实曲率/厚度/玻璃色散、多片厂家处方、完整三维倾斜偏心机构、相干衍射、偏振或容差分析，不能宣称已达到 Zemax/OpticStudio 等效精度。完整公式、数据流、目录依据、交接和云端准备见 [光学工作台文档](docs/optics-workbench.md)。

### 器件数据与工程文件

装备库包含十二款 Thorlabs 球面/消色差透镜、六款常用无限远物镜、三个柱透镜型号和折转分光参考器件。官方原始记录分别保存在 `public/training/thorlabs/`、`objectives/`、`cylindrical/`；公开接口只用于手动采集，启动和计算不依赖联网。球面模型通光孔径为外径90%的教学假设；柱透镜21mm孔径取官方历史目录 >21mm 的保守下界。工程文件下载返回403时不绕过控制，未获得的厚度/BFL/处方不编造。

物镜采用 `f = f_tube / M` 和估算瞳径 `2 NA f`；Evident 配180mm筒镜、Mitutoyo配200mm筒镜。WD 是机械工作距离；25.4mm默认遮挡范围不是镜筒结构。可见光型号不能据此认证940nm性能，高NA全孔径、盖玻片和真实多片像差未还原。改变光学参数后清除目录归属；自定义 OPD 是单独的用户模型。

顺序 JSON 外壳为 `pcsel-optics-design` / `formatVersion:1`，包含 DesignProject v2；草稿/工程库为 `pcsel-optics-designer-draft-v2`、`pcsel-optics-designer-library-v2`。空间外壳为 `pcsel-folded-optics` / `formatVersion:1`、FoldedScene v1；存储键为 `pcsel-folded-optics-draft-v1`、`pcsel-folded-optics-library-v1`。两种工程库各最多20份副本；旧文件可读，新增椭圆源、双轴焦距、滚转和OPD可选字段随保存与严格校验的JSON/HTML导出保留。CSV包含光源行及完整模型参数；HTML内嵌实际二维分箱、剖面、来源数据和完整工程。

教程记录、组内案例草稿、旧自由搭建台与新版设计存储互相独立。`PumpCaseStudy.tsx` 的组内照片只确认蓝色光纤泵光入口，其余拓扑/数值是教学假设。课程观察记录键为 `pcsel-training-demo-notes-v1`，案例为 `pcsel-optical-pump-case-draft-v1`，旧16元件自由台为 `pcsel-optical-playground-v1`；均不跨浏览器或设备同步。

### 验收、目录与云端准备

计算核心集中在六个无DOM/存储依赖的 `app/design/core/` 模块；`FoldedDesigner` 管理工程状态，`FoldedWorkspace` 组合画布/参数/探测器，`EquipmentLibrary` 维护统一装备选择，导出和转换留在设计层。未来可把核心调用放入Web Worker或云任务；当前无需服务器、数据库或空服务目录。

```powershell
npm run test
npm run typecheck
npm run lint
npm run build:optics
npm run qa:workbench
```

`build:optics` 使用已有教材数据生成独立静态路由，精简并审计 `dist/client`；不触发教材生成，也不上传。`qa:workbench` 组合原实验室回归和当前空间工作台验收，使用一次性浏览器上下文，不修改用户草稿或启动服务。报告、实际基准、截图、工程导出与清理清单统一放在忽略的 `outputs/optics-workbench/`，从实际结果确认通过情况。可复用 `scripts/build_workbench_report.py` 按验证JSON生成自包含 `outputs/optics-workbench/index.html`；缺失或失败的证据不会标成通过。

浏览器脚本接受 `PCSEL_PLAYWRIGHT_MODULE`（已安装模块或file URL）、`PCSEL_OPTICS_URL`（已运行地址）、`PCSEL_OPTICS_QA_OUTPUT`（输出目录）、`PCSEL_OPTICS_BROWSER_CHANNEL`（默认msedge）。各脚本默认目录可用输出变量统一；避免重复安装依赖或反复截图。数值基准覆盖旧工程、实际矩阵/双轴传播、反射/柱透镜互易、圆孔径守恒、OPD梯度及实际优化改进；性能与误差引用同目录的真实基准。

网站由父目录PCSELbook仓库管理，在 `codex/optical-lab-impeccable` 分支按相关清单暂存，避免 `git add .` / `git add -A` 混入书稿或审阅改动。本地提交不等于推送或发布授权；真正上传仅使用审计通过的 `dist/client`。历史可重建临时产物优先移入回收站，保留教材、原始来源、原对话诊断证据、Git历史和运行日志。所有本地输出及 `.openai` 配置禁止发布。

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
