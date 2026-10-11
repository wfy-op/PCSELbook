# 光学实验室

独立 Cloudflare Pages 项目：<https://optical-lab-feiyang.pages.dev/>。与 PCSELbook 共用父 Git 仓库，但应用代码、依赖、入口、构建和发布相互独立，不需要教材数据或教材构建。

## 使用与开发

在本目录执行 `npm ci`，然后 `npm run dev`，打开 <http://127.0.0.1:5175/>。5175 专用于此项目；启动或恢复服务前读全局端口登记，并核对 IPv4/IPv6 监听与进程路径，不停止其他项目。

- `/`：元件认识与可动光路 → 公式、计算和搭建闯关 → 自由搭建 → 真实实验台。
- `/designer/`：空间折转、分光、物镜、柱透镜、探测器光斑和顺序 ABCD/Gaussian 设计。
- 原 `/optics/`、`/optics/tutorial/`、`/optics/designer/` 和 training/design 旧地址在本项目保持兼容。

九类元件教学调用实际空间追迹，支持拖动、滑块和方向键；机械支撑本身无光学功率，消色差镜只演示等效焦距。三关分别为平行光聚焦、两倍正正扩束、关联扇形源准直，同时校验计算、判断与所有光线实际通过的结果。关卡答案在页内切换时保留，关闭页面后练习进度重置。原八节实训、实操记录与自由工作台继续保留。

教程开头先用三个图文小实验认识聚焦、反射和截光：一次突出一个变量，滑块旁直接解释计算结果，再进入完整元件教学。图文节奏参考 Bartosz Ciechanowski 的 [Cameras and Lenses](https://ciechanow.ski/cameras-and-lenses/)，代码与图示独立实现。所有光线仍由现有引擎计算；播放只示意传播方向，离开视口、切到后台或启用减少动态效果时暂停。

## 结构与模型

| 目录 | 职责 |
|---|---|
| `app/training/` | 教学、实训、现场案例及四个纯计算/判题模块 |
| `app/design/core/` | 六个纯计算模块：顺序传播、空间追迹、双轴采样、优化、扫描、物镜模型 |
| `app/design/` | 工程状态、画布、参数、装备库、探测器显示、导入导出 |
| `app/optics/` | 独立导航和跨域记录迁移 |
| `public/training/` | 官方规格来源、目录及组内原始照片 |
| `scripts/`、`tests/` | 固定发布门槛、浏览器验收和计算回归 |
| `outputs/` | 本地证据、截图、报告；不进入部署目录 |

当前是静态浏览器应用，没有服务器数据库或 API。布局使用真实 XY 等比例；镜面反射为几何反射，透镜/物镜为局部近轴薄主面。二维强度是实际样本的功率分箱，不是衍射 PSF。未实现玻璃色散、真实厚透镜处方、相干衍射、偏振及完整容差分析，不宣称 Zemax 等效。模型公式、器件依据和工程格式见 [工作台文档](docs/optics-workbench.md)。组内照片仅确认蓝色光纤入口，其他拓扑与数值保留教学假设标记。

## 验证与发布

```text
npm run prepare:deploy
npm run qa:introduction
npm run qa:learning
npm run qa:workbench
npm run qa:usability
npm run deploy:pages
```

每次优化上传前，必须梳理纯计算边界、回收明确的临时文件，并通过构建、测试、lint、类型检查、部署负载审计和受影响浏览器验收。`deploy:pages` 串联整理及代码检查，仅上传审计通过的 `dist/`；禁止裸跑 Wrangler 绕过门槛。上传仍以用户的发布授权为前提。

浏览器验收使用一次性上下文，需要已运行的预览。`PCSEL_PLAYWRIGHT_MODULE` 指定现有 Playwright 模块，`PCSEL_OPTICS_URL` 指定本地或生产地址，默认 Edge。保留原始规格和验收证据；可重建临时文件优先进入回收站。

## 旧记录迁移

两个域名的 localStorage 不共享。先在原来使用的浏览器打开 [旧站迁移页](https://pcsel-knowledge-site.pages.dev/optics/migrate/)，导出实验室记录 JSON；然后在新首页底部“迁移旧工程与记录”导入。程序先校验，再明确提示替换同类记录。单个工程也可继续用工作台内的 JSON 导入导出。

教材站仅保留外链、旧地址跳转及迁移导出页；修改实验室不触发教材同步或教材发布。
