#!/usr/bin/env python3
"""Apply remaining Ch03 fixes: complex freq diagram + PML explanation."""
import re

path = r"chapters/ch03_maxwell_periodic_media.tex"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Fix 3.4: Add complex frequency plane figure after line about gamma
old = '的意识进行。\n\n\\begin{proposition}'
new = r'''的意识进行。\cref{fig:complex-freq-plane} 展示了这些模式在复频率平面上的位置和物理含义。

\begin{figure}[htbp]
  \centering
  \begin{tikzpicture}[scale=0.95]
    \draw[->,thick] (-3.8,0)--(3.8,0) node[right]{$\operatorname{Re}\tilde{\omega}=\omega_r$};
    \draw[->,thick] (0,-3.2)--(0,1.5) node[above]{$\operatorname{Im}\tilde{\omega}$};
    \fill[red!8] (-3.7,0) rectangle (3.7,1.4);
    \node[red!60,font=\footnotesize] at (2.6,0.85){non-physical (passive)};
    \draw[dashed,gray] (-3.7,0)--(3.7,0);
    \fill[blue!70] (1.0,-0.4) circle (0.08) node[right,font=\footnotesize]{high-$Q$};
    \fill[blue!70] (-1.5,-1.8) circle (0.08) node[right,font=\footnotesize]{low-$Q$};
    \fill[orange!80!black] (2.5,-0.02) circle (0.08) node[above right,font=\footnotesize]{BIC ($\gamma\to 0$)};
    \fill[green!60!black] (0.5,-1.0) circle (0.08) node[right,font=\footnotesize]{quasi-BIC};
    \draw[<->,thin] (1.15,-0.02)--(1.15,-0.38);
    \draw[<->,thin] (-1.35,-0.02)--(-1.35,-1.78);
    \node[font=\footnotesize] at (0,-2.8){lower half-plane = open/lossy resonances};
  \end{tikzpicture}
  \caption{复频率平面示意。被动开放系统的共振模位于下半平面（$\gamma>0$），距实轴越近表示 $Q$ 越高。BIC 理想地处于实轴上（$\gamma=0$），quasi-BIC 则刚刚离开实轴。}
  \label{fig:complex-freq-plane}
\end{figure}

\begin{proposition}'''
assert old in text, "Marker for complex freq diagram not found"
text = text.replace(old, new)

# Fix 3.5: Expand PML explanation
old_pml = '完全匹配层（perfectly matched layer, PML）来近似它。'
new_pml = r'''完全匹配层（perfectly matched layer, PML）来近似它。

PML 的核心思想值得在这里做一个最小介绍。它在计算域边界处引入一层特殊介质，通过对坐标做复数延拓
\[
x \to x + \frac{\ii\sigma(x)}{\omega},
\]
使出射波在该层中指数衰减，但由于变换是连续的、在物理--PML 界面上梯度为零，波在进入该层时不产生反射。换句话说，PML 不是一个物理实体，而是一种把无限开放空间折叠进有限计算域的数学技巧。'''

assert old_pml in text, "Marker for PML not found"
text = text.replace(old_pml, new_pml)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("Ch03 fixes applied successfully.")
