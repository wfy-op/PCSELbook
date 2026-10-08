# 光学实验室已独立

代码、规格、计算、教学、测试和发布文档在 [optical-lab 项目](../../optical-lab/README.md)。模型与工程详情见 [独立项目工作台文档](../../optical-lab/docs/optics-workbench.md)。在线入口为 <https://optical-lab-feiyang.pages.dev/>。

教材站仅提供外链、旧 `/optics/`、training/design 地址跳转，以及 `/optical-lab-migration/` 的旧浏览器记录导出（旧 `/optics/migrate/` 同域跳转到此页）。迁移页必须放在通配跳转前缀之外，避免被 `/optics/*` 覆盖。没有嵌入实验室运行时代码。历史诊断及验收证据留在本项目 `outputs/`，不发布。

每次优化上传仍须先整理源代码边界并回收临时文件，再通过生产构建、测试、lint、类型检查和负载审计。实验室在自己的目录执行 `npm run deploy:pages`；教材站已有数据的页面/跳转更新执行 `npm run deploy:pages:static`，书稿同步发布执行 `npm run deploy:pages`。发布命令均串联准备门槛，不裸跑 Wrangler。
