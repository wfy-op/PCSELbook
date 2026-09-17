# 外延层纵向模式：可运行教学例

对应教材“PCSEL 的半导体外延层与纵向光学结构”章。固定波长的一维、各向同性、无损平面波导中，TE/TM 可从 Maxwell 方程严格解耦；这不是完整三维 PCSEL 仿真。默认数据是教学参数，不是实测外延或材料数据库。

## 运行

依赖 Python、NumPy、SciPy、Matplotlib。在书稿根目录运行：

```powershell
& 'C:/ProgramData/anaconda3/envs/AI_group/python.exe' -X utf8 code/vertical_tmm_mode/run_tutorial.py
& 'C:/ProgramData/anaconda3/envs/AI_group/python.exe' -X utf8 -m unittest discover -s code/vertical_tmm_mode -v
```

其他电脑可用自己的 `python` 替换解释器路径。原 `run_vertical_tmm_mode.py` 入口仍兼容。

## 输入与输出

输入沿 z 从下到上排列；波长和层厚的输入单位均为 nm，内部使用 µm。
默认波长 940 nm，上下半无限包层折射率 3.30；七层厚度为
128/8/20/8/20/8/128 nm，三个 8 nm 阱的折射率为 3.55，其余为 3.42。
有限层总厚 320 nm，总阱厚 24 nm。

`--config layers.json` 可替换输入，JSON 顶层包含 `wavelength_nm`、`lower_index`、`upper_index`、`layers`；每层包含 `name`、`thickness_nm`、`index`、`is_qw`。默认完整输入也保存在结果 JSON 的 `parameters` 字段。修改层栈时应使用新的输出目录副本保存旧结果；脚本会重新生成本目录 `output/` 下同名结果。

生成文件：

- `vertical_tmm_mode_summary.json`：TE/TM 根、逐层积分、三种阱层约束因子、尾长和收敛校核。
- `vertical_te_mode_profile.csv`：TE 模的 z、折射率、峰值归一化场、平方场和阱层标记。CSV 延伸到上下各 8 个振幅衰减长度；积分使用解析无限尾，不截断在 CSV 边界。
- `vertical_te_mode_profile.pdf/svg/png`：同一实际求解结果的矢量/位图。显示窗口为有限层左右各 0.7 µm，TE 的 E 场与 TM 的 H 场各自峰值归一化，不能按高度比较功率。

## 默认结果与检查

TE0 有效折射率 3.3609351974；TM0 为 3.3573348219。
TE0 的阱层场强占比 0.0622243796，电场能量占比 0.0682059400，小信号材料功率增益权重 0.0657247268。
三者不可互换。程序逐层 Gauss 积分并解析积分半无限包层。

校核包括解析对称 slab 色散、TE/TM 连续条件、积分分区与增益恒等式、无导光区测试、q→0 极限，以及独立有限差分网格收敛。4/2/1 nm 网格下有效折射率误差约为 4.77e-6/1.19e-6/2.95e-7。
根扫描和积分节点加密结果保存在 JSON；默认例通过不等于任意输入都已收敛。

## 适用边界

程序不包含材料色散、复折射率、各向异性、孔阵辐射、金属损耗、电热耦合或激光阈值电流。
厚强倏逝层会令普通传输矩阵病态，应改用稳定散射矩阵或全波求解。
多模、弱束缚结构需加密根扫描并扩展有限差分边界。TE 重叠公式不能直接用于 TM 的 H 场。
