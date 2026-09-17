"""Local, self-contained review only; never part of the deploy payload."""
from pathlib import Path
import base64
import html
import json
from collections import Counter

ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/'knowledge-site'


def main():
    manifest=json.loads((SITE/'public/figures/manifest.json').read_text(encoding='utf8'))
    audit=json.loads((SITE/'outputs/figure-audit/final.json').read_text(encoding='utf8'))
    summary=json.loads((ROOT/'code/vertical_tmm_mode/output/vertical_tmm_mode_summary.json').read_text(encoding='utf8'))
    counts=Counter(f['page'] for f in audit['findings'] if f['severity']=='FAIL')
    cards=[]
    for i,(label,f) in enumerate(manifest['figures'].items(),1):
        content=(SITE/'public/figures'/f['file']).read_bytes()
        cards.append(f'''<article id="figure-{i}"><h3>{i:02d} · {html.escape(label)}</h3>
        <p>原书图号：{html.escape(str(f['number']))} · 几何算法候选警报：{counts[i]}（并非确认缺陷数）</p>
        <img loading="lazy" alt="{html.escape(label)}" src="data:image/webp;base64,{base64.b64encode(content).decode()}">
        </article>''')
    overlaps=summary['overlaps']
    body=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>PCSEL 教材插图与纵向模式修订核对</title><style>
    body{{margin:40px auto;max-width:1150px;padding:0 24px;font:17px/1.8 "Microsoft YaHei",sans-serif;color:#23303c;background:#f6f8fa}}
    h1,h2,h3{{line-height:1.4}}a{{color:#145cc4}}article,section{{padding:24px;background:white;border:1px solid #dbe2ea;border-radius:10px;margin:22px 0}}
    img{{display:block;width:auto;max-width:100%;height:auto;margin:20px auto}}article p{{color:#607080;font-size:14px}}
    table{{border-collapse:collapse;width:100%}}td,th{{padding:10px;border-bottom:1px solid #ddd;text-align:left}}code{{font:14px Consolas,monospace}}
    .note{{border-left:4px solid #d49b26;padding-left:16px}}@media print{{article{{break-inside:avoid}}}}
    </style><h1>PCSEL 教材：插图与纵向模式修订核对</h1><p>本地修订 · 2026-09-08 · 未发布 Cloudflare</p>
    <section><h2>本次修改</h2><p>全书 {manifest['count']} 张图重新从图源渲染；对照接触表逐张查看，并放大复核密集图。
    调整了标题与曲线间距、晶格点标签、箭头走线、面板边界、注释栏和层栈说明。
    四波图、外延图和多物理流程图保持图源可编辑；纵向模式图改为程序实际求解结果。
    同时修正了方格晶格高对称路径示意，以及动量折叠图中应保持频率不变的横向平移。</p>
    <p><a href="../build/pcselbook.pdf">打开更新后的教材 PDF</a> ·
    <a href="http://127.0.0.1:4173/chapters/ch16-epitaxial-optical-structure/">本地纵向光学章节</a> ·
    <a href="../code/vertical_tmm_mode/README.md">Python 使用说明</a> ·
    <a href="../code/vertical_tmm_mode/run_tutorial.py">运行入口</a> ·
    <a href="../code/vertical_tmm_mode/vertical_modes.py">求解器源代码</a></p></section>
    <section><h2>独立阅读的纵向光学章节</h2><p>新内容包括坐标与材料输入、TE/TM 从 Maxwell 方程解耦、界面连续条件、束缚模存在区间、传输矩阵与本征根搜索、有效折射率、模场节点与衰减尾、有效折射率近似的限制，以及场强重叠、电能重叠和材料功率增益权重的区别。章内最小 Python 代码可直接运行，完整程序额外计算 TM 根、逐层重叠和收敛校核。</p>
    <table><tr><th>实际计算量</th><th>结果</th></tr>
    <tr><td>TE0 有效折射率</td><td>{summary['selected_fundamental_effective_index']:.10f}</td></tr>
    <tr><td>TM0 有效折射率</td><td>{summary['tm_effective_indices'][0]:.10f}</td></tr>
    <tr><td>阱层场强 / 电能 / 增益权重</td><td>{overlaps['gamma_qw_field']:.8f} / {overlaps['gamma_qw_electric']:.8f} / {overlaps['gamma_qw_gain']:.8f}</td></tr>
    <tr><td>4 / 2 / 1 nm 有限差分交叉校核误差</td><td>{' / '.join(f"{v['absolute_error']:.3e}" for v in summary['validation']['finite_difference'])}</td></tr></table>
    <p>7 项数值单元测试通过；涵盖解析 slab、TE/TM 界面、积分恒等式、无导模反例、矩阵极限、独立网格收敛和教材代码实跑。新增纵向图的原始 PDF 碰撞检查、文字检查与面板对齐检查通过。网站 16 项测试、lint 与类型检查通过；浏览器实查了公式显示、小节跳转和 Python 缩进。代码块转换增加了百分号与 HTML 转义保护。</p>
    <p class="note">输入为明确标注的 940 nm、320 nm 芯层、三量子阱教学层栈，不是实测材料参数。程序限于无损平面波导，不能据此宣称三维 PCSEL 辐射损耗、阈值电流或器件性能。</p>
    <p><a href="../code/vertical_tmm_mode/output/vertical_tmm_mode_summary.json">全部数值、输入与收敛数据 JSON</a> · <a href="../code/vertical_tmm_mode/output/vertical_te_mode_profile.csv">场分布 CSV</a></p></section>
    <section><h2>如何理解插图检查结果</h2><p>算法仍输出 {audit['summary']['fail']} 条 FAIL 和 {audit['summary']['warn']} 条 WARN 候选。
    原始结果保留，未通过放宽阈值把数字清零。TeX 的波浪号/帽号、拼接括号、字距，以及已经被节点背景遮住的线条和坐标区裁切，都会触发几何警报；它不能直接替代对实际图面的判断。</p>
    <p>下方嵌入全部实际网页图，可逐图放大核对。此处的全量目视复查不是对教材全部物理结论的重新审定。</p>
    <p><a href="../knowledge-site/outputs/figure-audit/final.json">未删减的几何检查结果</a> · <a href="../knowledge-site/outputs/figure-render/all_figures.pdf">80 页矢量插图汇总</a></p></section>
    <h2>全量插图</h2>{''.join(cards)}</html>'''
    target=ROOT/'review/20260908_figures_vertical_optics.html'
    target.write_text(body,encoding='utf8')
    print(f'{target} ({target.stat().st_size/1024/1024:.2f} MiB)')


if __name__=='__main__':main()
