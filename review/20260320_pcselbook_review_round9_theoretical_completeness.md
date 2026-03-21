# PCSELbook 第三轮审阅报告（2026-03-20）

## 审阅者视角设定

**假设读者背景：** 本科物理专业毕业，具备电动力学、量子力学、固体物理基础，但未接触过 PCSEL 专业知识。

**审阅目标：** 

1. 理论知识完整性检查
2. 概念链条连续性验证
3. 关键推导步骤充分性评估
4. 易混淆概念的澄清程度
5. 从本科生视角识别理解障碍点

---

## 一、总体评价

### ✅ 优势总结

1. **理论框架完整性强**：从 Maxwell 方程→Bloch 定理→光子能带→CWT/RCWA→器件物理的主线清晰
2. **层级边界意识突出**：反复强调冷腔≠器件、阈值增益≠阈值电流、无限周期≠有限尺寸
3. **数学严谨度高**：时间因子约定、傅里叶展开、开放系统归一化等基础问题处理得当
4. **失败模式专章设置合理**：第 24 章的失败模式分析对初学者极具价值

### ⚠️ 核心问题概览

| 序号 | 问题类型 | 严重程度 | 涉及章节 |
|------|----------|----------|----------|
| 1 | 关键概念首次引入过快 | 高 | ch08b (BIC) |
| 2 | 重要物理图像缺失 | 中 | ch03, ch04 |
| 3 | 数学推导跳步 | 中 | ch11 (CMT), ch25 (附录) |
| 4 | 与前置章节呼应不足 | 低 | ch17-ch19 (器件物理) |
| 5 | 图示说明欠缺 | 中 | 多处 |

---

## 二、具体问题清单

### 【问题 1】BIC/quasi-BIC 章节的概念引入速度过快

**位置**: [`chapters/ch08b_bic_quasibic.tex`](chapters/ch08b_bic_quasibic.tex)

**问题描述**:

从本科生视角阅读第 8B 章时，会遇到以下理解障碍：

1. **"连续谱中的束缚态"这一核心概念缺乏直观的类比说明**。文中虽然给出了严格定义（频率落在辐射连续谱内但辐射耦合振幅为零），但没有回答本科生最可能问的问题：
   - "这与传统势阱中的束缚态有什么本质区别？"
   - "为什么会有'明明可以辐射却不辐射'的状态？"
   - "如何用更直观的方式理解这种'相消干涉'？"

2. **对称性保护 BIC 的物理图像不够具体**。第 4 节用群论语言给出了 irrep 匹配规则，这对已有群论基础的读者很好，但本科生很可能：
   - 不知道什么是 little group
   - 不理解为什么法向辐射通道属于 E 表示
   - 无法将抽象的表示论与实际场分布联系起来

3. **quasi-BIC 的$Q\propto\delta^{-2}$关系来得突然**。公式给出平方反比依赖，但没有解释：
   - 为什么是二次方而不是一次方或四次方？
   - 这个关系的物理根源是什么？
   - 有没有简单的量纲分析或物理论证？

**改进建议**:

1. 在第 2 节开头增加一个**直觉框**，用水波或声波的干涉现象做类比：
   
   ```latex
   \begin{IntuitionBox}
   \textbf{用声波干涉理解 BIC。} 
   想象两个同频率扬声器发出相位相反的声波。在某些位置，两列波会完全相消，形成静止点。
   BIC 的本质类似：它不是"没有辐射通道"，而是所有可用辐射通道的振幅相互抵消了。
   关键在于，这种相消不是偶然巧合，而是由结构对称性强制保证的。
   \end{IntuitionBox}
   ```

2. 在第 4 节前增加一个小节"**对称性与辐射耦合的最小模型**"，用一个具体的偶极子辐射例子说明：
   - 电偶极矩$\bm{d}=\int\bm{P}\dd V$在空间反演下的行为
   - 为什么奇宇称模式不能耦合到偶宇称辐射场
   - 将这个论证推广到$C_{4v}$的点群操作

3. 对$Q\propto\delta^2$关系，补充一个简单的微扰论证：
   ```latex
   \begin{NoteBox}{$Q\propto\delta^{-2}$的量纲分析}
   设对称性破缺参数为$\delta$，辐射振幅$d$是最小的线性响应量，则 Taylor 展开给出
   $d = d_0 + d_1\delta + O(\delta^2)$。由于$\delta=0$时对应理想 BIC ($d_0=0$)，故主导项为$d\approx d_1\delta$。
   辐射功率正比于$|d|^2$，因而$\gamma_{\rm rad}\propto\delta^2$，再由$Q=\omega_0/2\gamma_{\rm rad}$即得结果。
   \end{NoteBox}
   ```

---

### 【问题 2】Maxwell 方程章节缺少物理图像的早期建立

**位置**: [`chapters/ch03_maxwell_periodic_media.tex`](chapters/ch03_maxwell_periodic_media.tex)

**问题描述**:

第 3 章从时域 Maxwell 方程组出发，经过傅里叶变换得到频域本征问题，整个过程数学上很完整，但从教学角度看存在以下问题：

1. **过早进入形式化推导**。前 3 节几乎全是公式变换，本科生读到第 4 节时才第一次看到"为什么要这么做"的解释。

2. **开放系统与封闭系统的对比不充分**。文中提到"PCSEL 是开放系统"，但没有清楚说明：
   - 封闭系统（如金属腔）的本征模是什么样的
   - 开放系统（如 slab）的本征模有什么不同
   - 为什么开放系统必须用复频率描述

3. **能量守恒和损耗的来源没说透**。第 5 节讨论厄米/非厄米算符时，提到了介质虚部对应吸收，但这个结论是从哪里来的？坡印廷矢量的面积分去哪了？

**改进建议**:

1. 在第 1 节后增加一个**预览小节**："PCSEL 作为开放电磁系统的三大特征"
   - 特征 1：辐射损耗导致复频率本征值
   - 特征 2：模式不正交，需要双正交基
   - 特征 3：边界条件不是$\bm{E}_\parallel=0$，而是出射波条件

2. 在第 4 节中加入一个**对照表**，比较封闭腔 vs 开放腔：
   ```latex
   \begin{table}[htbp]
     \centering
     \caption{封闭谐振腔与开放 PCSEL 系统的对比}
     \begin{tabular}{l l l}
       \hline
       性质 & 封闭腔 (金属壁) & 开放腔 (PCSEL) \\
       \hline
       本征频率 & 实数 & 复数 $\omega-i\gamma$ \\
       模式正交性 & 标准内积正交 & 需要双正交基 \\
       边界条件 & $\bm{n}\times\bm{E}=0$ & Sommerfeld 辐射条件 \\
       Q 因子来源 & 导体损耗/介质损耗 & 辐射损耗 + 介质损耗 \\
       \hline
     \end{tabular}
   \end{table}
   ```

3. 在讨论损耗符号时，明确写出坡印廷定理的推导过程，展示体积内的能量变化率如何等于表面积分加上体内耗散。

---

### 【问题 3】耦合模理论的左右模概念讲解不够友好

**位置**: [`chapters/ch11_cmt_perturbation_splitting.tex`](chapters/ch11_cmt_perturbation_splitting.tex)

**问题描述**:

第 11 章第 5 节引入了左模/右模（left/right eigenvectors）的概念，这是理解非厄米系统的关键，但目前的处理方式对本科生不太友好：

1. **直接从$2\times2$矩阵跳到一般公式，跨度太大**。式 (\ref{eq:nh_2x2_right}) 给出了一个具体例子，但紧接着的一般公式 (\ref{eq:perturb_nonhermitian_general}) 就直接写成了算符形式，中间的桥梁没搭好。

2. **伴随算符的物理意义不清楚**。文中定义了伴随算符$\mathcal{L}^\dagger$，但没有回答：
   - 为什么需要伴随算符？
   - 左模$\psi_n^L$到底是什么物理对象？
   - 双正交条件$\braket{\psi_m^L}{\psi_n^R}=\delta_{mn}$怎么用？

3. **微扰公式的应用场景太抽象**。式 (\ref{eq:perturb_nonhermitian_general}) 看起来很强大，但本科生读完可能会问："我什么时候会用到这么复杂的公式？能不能举个例子？"

**改进建议**:

1. 在$2\times2$矩阵例子后，增加一个**数值实例**：
   ```latex
   \begin{ExampleBox}{数值演示：$2\times2$非厄米矩阵的左右模}
   取$a=1, d=2, b=0.1, c=0.3$，则矩阵$\mathbf{M}=\begin{bsmallmatrix}1&0.1\\0.3&2\end{bsmallmatrix}$。
   本征值为$\lambda_\pm = \frac{3\pm\sqrt{1+0.12}}{2}$。对$\lambda_+$，右模为$\bm{v}_+^R=[0.1,\lambda_+-1]^T$，
   左模需解$\bm{v}_+^L{}^T\mathbf{M}=\lambda_+\bm{v}_+^L{}^T$，得到$\bm{v}_+^L=[0.3,\lambda_+-1]^T$。
   验证双正交：$\bm{v}_-^L{}\cdot\bm{v}_+^R = 0.3\times0.1 + (\lambda_--1)(\lambda_+-1)=0$（利用韦达定理）。
   \end{ExampleBox}
   ```

2. 增加一小节"**左模的物理诠释**"，说明：
   - 在散射问题中，左模对应"接收模式"（receiving pattern）
   - 右模对应"发射模式"（emission pattern）
   - 在非互易系统中两者不同，但在互易系统中可通过时间反演联系

3. 给出一个**PCSEL 中的具体应用场景**：
   ```latex
   \begin{ApplicationBox}{用非厄米微扰公式估计孔形误差的影响}
   设设计好的圆孔 PCSEL 因工艺误差变成椭圆，介电常数扰动为$\delta\varepsilon(\bm{r})$。
   若已知理想结构的右模场分布$\bm{E}_n^R(\bm{r})$和左模分布$\bm{E}_n^L(\bm{r})$，
   则频率移动的一阶近似为
   \[
   \delta\omega_n \approx -\frac{\omega_n}{2}\frac{\int\delta\varepsilon\,\bm{E}_n^L\cdot\bm{E}_n^R\dd V}
                                          {\int\varepsilon\,\bm{E}_n^L\cdot\bm{E}_n^R\dd V}.
   \]
   注意分子中出现的是左模与右模的内积，而不是通常的$|\bm{E}|^2$。
   \end{ApplicationBox}
   ```

---

### 【问题 4】RCWA 章节的 Fourier Factorization 技术细节过于突兀

**位置**: [`chapters/ch13_rcwa_open_periodic_threshold.tex`](chapters/ch13_rcwa_open_periodic_threshold.tex)

**问题描述**:

第 13 章第 4 节的 Note Box 详细介绍了 Li 的 Fourier factorization 规则，这在技术上很重要，但目前的位置和处理方式存在问题：

1. **出现在基本散射矩阵框架还没稳固时就引入高阶技术细节**。本科生刚看懂式 (\ref{eq:rcwa_smatrix})，突然看到一个充满 Toeplitz 矩阵和逆规则的 Note Box，很容易被吓退。

2. **缺少动机说明**。为什么要区分 Laurent 规则和 inverse rule？直接用卷积会有什么后果？文中提到了"Gibbs 震荡"和"系统性频移"，但这些效应的量级有多大？

3. **与后续内容的衔接不好**。介绍完 factorization 后，下一节直接跳到被动谱共振，中间没有过渡说明"这个技术如何影响我们读取反射谱"。

**改进建议**:

1. 将 Fourier Factorization 的详细内容移到本章末尾的"**高级专题**"小节，正文只保留核心思想：
   ```latex
   \subsection{关于 Fourier Factorization 的简要说明}
   在高对比度周期结构中，电场分量可能在界面处不连续。直接使用介电常数的傅里叶系数构造卷积矩阵会导致收敛缓慢甚至错误。
   Li 的规则要求根据场的连续性选择合适的卷积形式：切向电场连续时用$[\varepsilon]$，法向电位移连续时用$[\varepsilon^{-1}]^{-1}$。
   详细数学推导见本节末的进阶注释。
   ```

2. 在主文本中增加一个**数值对比示例**：
   ```latex
   \begin{NumericalInsightBox}{Factorization 规则的实际影响}
   考虑 GaAs/空气二元光栅，折射率对比~3.4:1。若使用错误的卷积规则：
   \begin{itemize}
     \item TM 偏振的共振峰位可能有~5-10 nm 的系统性偏移
     \item 即使傅里叶阶数从 N=5 增加到 N=21，偏移仍存在（伪收敛）
     \item 正确的 factorization 可使收敛速度从代数级提升到指数级
   \end{itemize}
   这就是为什么 commercial RCWA 软件都把 factorization 当成核心技术。
   \end{NumericalInsightBox}
   ```

3. 在本章最后增加一节"**从 RCWA 到 CWT：两种耦合波语言的对话**"，说明：
   - RCWA 保留了全部傅里叶分量，是严格的半解析方法
   - CWT 主动截断到少数分量，是物理解释导向的模型
   - 两者的矩阵结构相似，都来自周期卷积，但目的不同

---

### 【问题 5】量子阱增益章节缺少与前面光学章节的双向呼应

**位置**: [`chapters/ch17_qw_active_gain_models.tex`](chapters/ch17_qw_active_gain_models.tex)

**问题描述**:

第 17 章详细讲解了量子阱的材料增益计算，包括费米黄金规则、态密度、准费米能级等，内容本身很扎实，但与前面章节的联系不够紧密：

1. **没有回扣第 7 章的阈值条件**。第 7 章给出了阈值增益公式$g_{\rm th} = \alpha_{\rm total}/\Gamma$，但第 17 章计算出材料增益$g(\hbar\omega,N,T)$后，没有清楚地展示如何将两者结合得到阈值载流子浓度$N_{\rm th}$。

2. **模增益的概念出现得太晚**。直到第 17 章后半部分才提到$\bar{g} = \Gamma g$，而这个量其实在第 7 章就应该预先埋下伏笔。

3. **TE/TM 增益差异与前面对称性分析的脱节**。第 8 章花了很多篇幅讲偏振和对称性，但第 17 章讲到 MQW 中 TE 增益通常高于 TM 时，没有回去呼应对称性语言。

**改进建议**:

1. 在第 17 章开头增加一个**回顾框**：
   ```latex
   \begin{ReviewBox}{从第 7 章到第 17 章：阈值问题的两层含义}
   第 7 章我们从纯光学角度得到了阈值条件：
   \[
   \Gamma g_{\rm th} = \alpha_{\rm int} + \alpha_{\rm rad}.
   \]
   当时我们把$g_{\rm th}$当作给定的材料参数。现在我们要回答：
   \begin{enumerate}
     \item 材料增益$g$本身是如何从量子阱微观物理产生的？
     \item 达到$g_{\rm th}$需要多大的载流子浓度$N_{\rm th}$？
     \item $N_{\rm th}$又如何决定阈值电流$I_{\rm th}$？（留给第 18 章）
   \end{enumerate}
   因此，本章的任务是为第 7 章的光学阈值提供半导体物理基础。
   \end{ReviewBox}
   ```

2. 在讲解模增益时，增加一个**跨章链接**：
   ```latex
   \begin{ConnectionBox}{模增益与第 5 章的能带选择}
   回忆第 5 章我们通过 PWEM 找到了$\Gamma$点的候选模及其偏振特性。
   现在我们可以把两条线索接起来了：
   \begin{itemize}
     \item 若能带计算显示某模式主要是 TE 偏振，而 MQW 的 TE 材料增益更高
       → 该模式的净模增益$\Gamma g - \alpha$更有优势
     \item 若另一模式是 TM 偏振，即使它的被动$Q$很高，也可能因为材料增益太低而无法起振
   \end{itemize}
   这就是为什么 PCSEL 设计必须同时优化光学模式和电子结构。
   \end{ConnectionBox}
   ```

3. 增加一道**综合练习题**：
   ```latex
   \begin{Exercise}{从材料增益到阈值载流子浓度的反推}
   已知某 980 nm InGaAs/GaAs MQW 在工作温度下的材料增益可拟合为
   $g(N) = g_0\ln(N/N_{\rm tr})$，其中$g_0=2000\,{\rm cm}^{-1}$，$N_{\rm tr}=1\times10^{18}\,{\rm cm}^{-3}$。
   若第 7 章给出的阈值条件要求$\Gamma g_{\rm th} = 150\,{\rm cm}^{-1}$，且$\Gamma=0.05$：
   \begin{enumerate}
     \item 计算所需的$N_{\rm th}$
     \item 若透明载流子浓度因温度升高变为$1.5\times10^{18}\,{\rm cm}^{-3}$，新的$N_{\rm th}$是多少？
     \item 讨论这对高温工作的启示
   \end{enumerate}
   \end{Exercise}
   ```

---

### 【问题 6】热-电-光耦合章节的自洽迭代流程不够可视化

**位置**: [`chapters/ch19_thermal_electro_optic_coupling.tex`](chapters/ch19_thermal_electro_optic_coupling.tex)

**问题描述**:

第 19 章正确地指出了热效应会回写 refractive index 和 gain spectrum，并提出了自洽迭代的必要性，但对本科生来说最大的困难是：

1. **迭代流程图缺失**。文字描述了"先算电学→得到热源→算热学→更新材料参数→重新算光学→..."，但没有一张清晰的流程图展示这个过程。

2. **收敛判据不明确**。迭代到什么程度算" converged"？是温度变化小于 1 K？还是激射波长漂移小于 0.1 nm？或是阈值电流变化小于 1%？

3. **计算成本的量级没有预警**。学生可能以为这是一两次迭代就能完成的，但实际上可能需要 5-10 轮才能达到稳定，每轮都涉及多个求解器。

**改进建议**:

1. 在本章第 2 节增加一个**流程图**（用 TikZ 绘制）：
   ```latex
   \begin{figure}[htbp]
     \centering
     \begin{tikzpicture}[node distance=1.8cm, >=Latex]
       \node[draw,rectangle,minimum width=3cm,minimum height=1cm] (elec) {电学模型};
       \node[draw,rectangle,minimum width=3cm,minimum height=1cm,right of=elec,xshift=2cm] (therm) {热学模型};
       \node[draw,rectangle,minimum width=3cm,minimum height=1cm,below of=elec,yshift=-1cm] (opt) {光学模型};
       \node[draw,diamond,aspect=2,below of=opt,yshift=-0.5cm] (conv) {收敛?};
       
       \draw[->] (elec) -- node[above] {$J(\bm{r}),Q_J(\bm{r})$} (therm);
       \draw[->] (therm) |- node[right,pos=0.3] {$T(\bm{r})$} (opt);
       \draw[->] (opt) -| node[left,pos=0.3] {$n(T),g(N,T)$} (elec);
       \draw[->] (opt) -- (conv);
       \draw[->] (conv) -| node[right] {否} ($(elec.north)+(0,0.5)$) -- (elec.north);
       \draw[->] (conv) -- node[right] {是} ++(0,-1.5);
     \end{tikzpicture}
     \caption{热 - 电 - 光自洽迭代流程。每一轮都用上一轮的温度场更新材料参数，直至输出量变化小于预设容差。}
     \label{fig:eto-loop}
   \end{figure}
   ```

2. 明确列出**三种常用的收敛判据**：
   ```latex
   \begin{ConvergenceCriteria}
   典型的热 - 电 - 光迭代可在以下任一判据满足时停止：
   \begin{enumerate}
     \item \textbf{温度判据}: $\max|T^{(k+1)}-T^{(k)}| < 0.5\,{\rm K}$
     \item \textbf{光学判据}: $|\lambda_{\rm peak}^{(k+1)}-\lambda_{\rm peak}^{(k)}| < 0.2\,{\rm nm}$
     \item \textbf{器件判据}: $|I_{\rm th}^{(k+1)}-I_{\rm th}^{(k)}|/I_{\rm th}^{(k)} < 1\%$
   \end{enumerate}
   实践中建议同时监控三个量，并要求连续两轮都满足才算收敛。
   \end{ConvergenceCriteria}
   ```

3. 增加一个**计算预算警示框**：
   ```latex
   \begin{ResourceAlertBox}{三轮耦合的计算成本估算}
   以一个$100\,\mu{\rm m}\times100\,\mu{\rm m}$的 PCSEL 为例：
   \begin{itemize}
     \item 电学 (CHARGE): ~5 分钟 (稳态漂移 - 扩散)
     \item 热学 (HEAT): ~2 分钟 (稳态热传导)
     \item 光学 (FDTD 有限阵列): ~4 小时 (若用 RCWA 单胞则~10 分钟)
   \end{itemize}
   若需要 6 轮迭代达到收敛，总时长可能是 24 小时量级。
   这就是为什么工作流章节建议先用单胞 RCWA 做快速筛选，再对最终候选结构做全耦合验证。
   \end{ResourceAlertBox}
   ```

---

### 【问题 7】数学附录的开放系统 QNM 理论缺少入门引导

**位置**: [`chapters/ch25_math_appendix.tex`](chapters/ch25_math_appendix.tex)

**问题描述**:

第 25 章（数学附录）的第 4 节讨论了开放 Maxwell 问题和准正规模（QNM），这是全书数学难度最高的部分之一。目前的问题是：

1. **从常规 Hilbert 空间到 QNM 的过渡太快**。文中说"普通 Hilbert 空间不够"，然后很快就引入了复频率和空间发散的 QNM，本科生可能跟不上这个思维跳跃。

2. **双正交归一化的物理动机不足**。为什么要引入$\braket{\tilde{\phi}_m|\phi_n}=2\omega_n\delta_{mn}$这样的归一化？这个奇怪的因子$2\omega_n$从哪里来？

3. **缺少与正文的显式连接**。附录中提到这些数学工具可用于 RCWA 极点分析和微扰公式，但没有具体指出是哪一章的哪一个公式。

**改进建议**:

1. 在第 4 节开头增加一个**预备知识框**，用最简单的 Fabry-Pérot 腔为例说明开放模式的特征：
   ```latex
   \begin{PrerequisiteBox}{从一个简单例子理解开放模式的复频率}
   考虑一个法布里 - 珀罗腔，两端镜面反射率为$R<1$。腔内往返一次的振幅衰减因子为$r^2=R$。
   若初始时刻$t=0$的场振幅为$A_0$，则经过一次往返时间$\tau_{\rm rt}=2L/c$后变为$A_1=A_0\sqrt{R}$。
   这等价于一个复频率阻尼振荡：
   \[
   A(t) = A_0\ee^{-\ii\omega_0 t}\ee^{-\gamma t},\qquad
   \ee^{-\gamma\tau_{\rm rt}} = \sqrt{R}.
   \]
   于是$\gamma = -\ln(R)/(2\tau_{\rm rt})$。这就是开放腔复频率$\tilde{\omega}=\omega_0-i\gamma$的最简单范例。
   QNM 理论要做的，就是把这种直观推广到任意形状的开放谐振腔。
   \end{PrerequisiteBox}
   ```

2. 对双正交归一化中的$2\omega_n$因子，补充一个**量纲与能量对应**的说明：
   ```latex
   \begin{NormalizationRemark}{$2\omega_n$因子的来源}
   在厄米波动理论中，模式能量正比于$\int\varepsilon|\bm{E}|^2\dd V$。
   对 QNM，由于场在远处发散，这个积分不收敛。但可以证明，适当的正则化方案会给出
   \[
   U_n \propto 2\omega_n\braket{\tilde{\phi}_n|\phi_n},
   \]
   其中左边是腔内储能。这就是归一化条件右边出现$2\omega_n$的原因：它保证了 QNM 振幅与储能的正确对应。
   详见 Sauvan et al., Phys. Rev. Lett. 110, 237401 (2013).
   \end{NormalizationRemark}
   ```

3. 在本章最后一节增加一个**应用索引表**：
   ```latex
   \begin{table}[htbp]
     \centering
     \caption{本附录数学工具在正文中的应用位置}
     \begin{tabular}{l l l}
       \hline
       数学工具 & 正文应用 & 具体用途 \\
       \hline
       时间因子约定 & 第 3,7,17 章 & 统一损耗/增益符号 \\
       Bloch-Floquet 展开 & 第 4,5,12 章 & PWEM/RCWA 的平面波基底 \\
       QNM 双正交归一化 & 第 11 章 & 非厄米微扰公式 \\
       互易定理 & 第 8,13 章 & 远场 - 近场关联 \\
       留数定理 & 第 13 章 & RCWA 散射矩阵极点分析 \\
       \hline
     \end{tabular}
   \end{table}
   ```

---

### 【问题 8】部分章节之间的"承上启下"段落可以更明确

**位置**: 多处章节交界处

**问题描述**:

虽然大多数章节都有"先修知识"和"本章路线图"，但在实际阅读中仍会发现一些断裂感较强的地方：

1. **第 6 章（面发射机制）与第 7 章（阈值）之间**：第 6 章结尾讲了面内耦合和垂直辐射的统一图像，但第 7 章开头直接开始推导阈值增益公式，中间缺少一句话连接："知道了模式如何辐射之后，下一个自然问题是：需要多少增益才能克服这些损耗并开始激射？"

2. **第 12 章（PWEM）与第 13 章（RCWA）之间**：虽然第 13 章第 1 节解释了为什么需要 RCWA，但没有明确指出 PWEM 的一个局限性：它不能直接给出上下辐射不对称的信息，而这正是 RCWA 的优势所在。

3. **第 22 章（工作流）与第 23 章（例题）之间**：第 22 章建立了完整的阶段划分，但第 23 章开头应该用一张表明确标注例题的每一步对应第 22 章的哪个阶段，方便读者来回翻阅。

**改进建议**:

在每个关键章节转换处增加**承上启下段**（1-2 句话即可），示例如下：

```latex
% 在第 7 章第 1 节开头添加
\noindent\textbf{与第 6 章的连接：}第 6 章分析了 PCSEL 的面内反馈机制和垂直辐射通道。
现在我们有了完整的损耗图像：$\alpha_{\rm total} = \alpha_{\rm rad} + \alpha_{\rm loss}$。
本章的自然任务就是回答：需要多大的材料增益才能补偿这些损耗？这就引出了阈值条件的严格推导。

% 在第 13 章第 1 节末尾添加
\noindent\textbf{与第 12 章的对比：}PWEM 擅长快速扫描晶格参数并找到候选模频段，
但它默认封闭边界，无法区分向上辐射和向下辐射的贡献。RCWA 则以开放散射问题为出发点，
可以直接计算$S_{11}$（反射）和$S_{21}$（透射），从而给出上下出光比例。
这就是为什么我们需要在学习 PWEM 之后再学习 RCWA。

% 在第 23 章第 1 节添加
\noindent\textbf{与第 22 章的映射：}下表展示了本章例题的各步骤与第 22 章定义的阶段之间的对应关系。
建议读者在完成例题的每一步后，回头查看第 22 章相应阶段的详细说明，以理解该步骤在整个工作流中的位置和作用。
```

---

## 三、其他次要问题与建议

### 【问题 9】部分公式编号引用未统一格式

**位置**: 分散在各章

**现状**: 有些地方用`\cref{eq:name}`，有些用`Eq.~(\ref{eq:name})`，有些直接写"式 (\ref{eq:name})"。

**建议**: 全文统一使用 `\cref{}`命令（已在 preamble 加载 cleveref 包），这样会自动生成"式 (1.2)"、"图 3.4"等带类型的引用。

---

### 【问题 10】少量图表缺少足够的 caption 解释

**位置**: 例如 ch08 的远场图、ch13 的反射谱

**现状**: 某些 figure 的 caption 只写了"某某情况的远场分布"，但没有告诉读者应该从图中读出什么信息。

**建议**: 每个图的 caption 应包含三部分：
1. 这是什么图（类型 + 工况）
2. 关键特征是什么（主瓣方向、旁瓣水平、对称性等）
3. 这个特征说明了什么物理

示例：
```latex
\caption{方格晶格圆孔 PCSEL 在$\Gamma$点的远场角谱。（a）TE-like 模，（b）TM-like 模。
注意到 TE 模的法向辐射强度明显高于 TM 模，这是因为 TE 模的电场主要在平面内振荡，
更容易耦合法向传播的自由空间波。这与我们在第 5 章的对称性分析一致。}
```

---

### 【问题 11】术语表中个别词条定义循环

**位置**: [`chapters/ch28_glossary_symbols.tex`](chapters/ch28_glossary_symbols.tex)

**现状**: "准 BIC (quasi-BIC)"的定义引用了"BIC"，而"BIC"的定义又说"参见准 BIC"。

**建议**: 改为：
- **BIC (bound state in the continuum)**: 频率位于辐射连续谱内但辐射耦合振幅严格为零的理想共振态。
- **准 BIC (quasi-BIC)**: 实际结构中因有限尺寸、对称性破缺或工艺误差而使 BIC 的辐射耦合被微弱打开的状态，表现为有限但极高的$Q$值。

---

## 四、肯定性评价（应保持的优点）

在阅读过程中，以下内容做得非常好，建议在后续修订中继续保持：

1. ** RigorousBox / IntuitionBox / PitfallBox 的使用**：这三种盒子很好地平衡了严谨性和可读性，建议在所有关键概念处继续使用这种三元结构。

2. **反复强调近似边界**：书中多次明确写出"这个公式只在...条件下成立"，这种诚实的学术态度对培养学生正确的科研观非常重要。

3. **失败模式专章的设置**：第 24 章按"证据链在哪里断了"来组织排错思路，这是一个非常成熟的研究者视角，远超普通教材的水平。

4. **符号统一的严格控制**：全书始终坚持统一的时间因子、傅里叶约定和归一化方式，避免了多物理场建模中最常见的混乱来源。

5. **不提供虚假确定性**：对于尚未达成共识的前沿问题（如 BIC 拓扑电荷的详细分类），书中诚实地标记为"进阶内容"而非强行简化，这种做法值得赞赏。

---

## 五、优先级排序与修改建议

基于上述问题，按照**对本科生理解影响最大**的原则，建议按以下顺序进行修改：

### 🔴 高优先级（直接影响核心理解）

1. **问题 1**: BIC 章节增加直观类比和对称性保护的物理论证
2. **问题 2**: Maxwell 章节早期建立物理图像
3. **问题 5**: 量子阱增益与光学阈值的显式连接
4. **问题 6**: 热 - 电 - 光迭代流程可视化

### 🟡 中优先级（改善学习体验）

5. **问题 3**: CMT 左右模概念的具体化和实例化
6. **问题 4**: RCWA Fourier Factorization 的动机和量级说明
7. **问题 7**: QNM 理论的入门引导
8. **问题 8**: 章节交界处的承上启下段落

### 🟢 低优先级（ polish 性质的改进）

9. **问题 9**: 统一公式引用格式
10. **问题 10**: 增强图表 caption 的解释性
11. **问题 11**: 修复术语表的循环定义

---

## 六、结语

总体而言，这份书稿已经达到了非常高的水准，特别是在理论严谨性和多层级边界意识方面表现出色。本轮审阅发现的 11 个问题主要集中在**教学法优化**层面，而非根本性的内容缺陷。

若能在保持现有优点的基础上，针对高优先级问题进行针对性改进，这本书有望成为 PCSEL 领域真正适合初学者从 0 入门的优秀教材。

---

**审阅完成日期**: 2026 年 3 月 20 日  
**审阅者角色设定**: 具有本科物理背景、初次系统学习 PCSEL 的研究生  
**审阅范围**: 全书 28 章（含附录、术语表）  
**审阅重点**: 理论知识完整性、概念链条连续性、数学推导充分性
