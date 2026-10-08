"""Build a portable HTML handoff from actual local optical-workbench evidence.

Usage (from optical-lab):
  python scripts/build_workbench_report.py
  python scripts/build_workbench_report.py --evidence outputs/optics-workbench/verification.json

No simulation, screenshots, network access, deletion or publication is performed.
Missing evidence remains unverified; nonzero exits, failed checks and page errors
override any supplied success label. This script uses only the Python stdlib.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

SITE = Path(__file__).resolve().parents[1]


def escaped(value):
    return html.escape(str(value), quote=True)


def numeric(value, digits=3):
    return str(round(value, digits)) if isinstance(value, (int, float)) and math.isfinite(value) else "—"


def resolve_site(value):
    path = Path(value)
    return path if path.is_absolute() else SITE / path


def read_json(path):
    if not path.is_file():
        return None, "文件缺失"
    try:
        return json.loads(path.read_text(encoding="utf-8-sig")), ""
    except (OSError, ValueError) as error:
        return None, str(error)


def file_link(path, report_dir, label=None):
    relative = os.path.relpath(path, report_dir).replace("\\", "/")
    return f'<a href="{quote(relative, safe="/.-_")}">{escaped(label or path.name)}</a>'


def check_status(check):
    counts = check.get("counts") or {}
    failed = check.get("failed", counts.get("failed", 0))
    if check.get("status") in ("fail", "failed", "error") or check.get("exitCode") not in (None, 0) or failed:
        return "fail"
    # A declared pass without an execution result is not independent evidence.
    if check.get("exitCode") == 0 and check.get("status") not in ("missing", "unknown", "unverified"):
        return "pass"
    return "unknown"


def qa_summary(path, report_dir):
    data, error = read_json(path)
    if not isinstance(data, dict):
        return {"path": path, "status": "unknown", "text": error or "结果格式无效", "html": ""}
    checks = data.get("checks", [])
    if not isinstance(checks, list):
        checks = []
    passed = sum(item.get("status") == "pass" for item in checks if isinstance(item, dict))
    failed = sum(item.get("status") in ("fail", "failed", "error") for item in checks if isinstance(item, dict))
    errors = data.get("pageErrors", data.get("errors"))
    error_count = len(errors) if isinstance(errors, list) else None
    failure_count = max(failed, data.get("failed", 0) or 0)
    status = "fail" if failure_count or error_count else "pass" if checks and passed == len(checks) and error_count == 0 else "unknown"
    detail = f"{passed}/{len(checks)} 项通过；页面错误 {error_count if error_count is not None else '未记录'}"
    failures = "".join(f'<li>{escaped(item.get("name", "检查"))}：{escaped(item.get("error", "失败"))}</li>' for item in checks if isinstance(item, dict) and item.get("status") != "pass")
    name = os.path.relpath(path, report_dir).replace("\\", "/")
    row = f'<tr><td>{file_link(path, report_dir, name)}</td><td class="{status}">{escaped({"pass": "通过", "fail": "失败", "unknown": "待确认"}[status])}</td><td>{escaped(detail)}</td></tr>'
    return {"path": path, "status": status, "text": detail, "html": row, "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="outputs/optics-workbench/index.html")
    parser.add_argument("--evidence", default="outputs/optics-workbench/verification.json")
    parser.add_argument("--url", default="http://127.0.0.1:5175/optics/designer/")
    parser.add_argument("--no-images", action="store_true", help="Link existing screenshots instead of embedding up to four.")
    args = parser.parse_args()
    output = resolve_site(args.output)
    report_dir = output.parent
    report_dir.mkdir(parents=True, exist_ok=True)
    evidence_path = resolve_site(args.evidence)
    evidence, evidence_error = read_json(evidence_path)
    evidence = evidence if isinstance(evidence, dict) else {}
    checks = evidence.get("checks", [])
    checks = checks if isinstance(checks, list) else []
    checks = [item for item in checks if isinstance(item, dict)]
    statuses = [check_status(item) for item in checks]
    check_rows = []
    for item, status in zip(checks, statuses):
        counts = item.get("counts") or {}
        detail = item.get("detail", "")
        if counts:
            detail += "；" + ", ".join(f"{key}={value}" for key, value in counts.items())
        artifact = item.get("artifact")
        artifact_path = resolve_site(artifact) if artifact else None
        link = file_link(artifact_path, report_dir) if artifact_path and artifact_path.is_file() else ""
        check_rows.append(f'<tr><td>{escaped(item.get("name", "验证"))}<br><code>{escaped(item.get("command", ""))}</code></td><td class="{status}">{escaped({"pass": "通过", "fail": "失败", "unknown": "待确认"}[status])}</td><td>退出码 {escaped(item.get("exitCode", "未记录"))} · {escaped(detail)} {link}</td></tr>')
    qa_paths = sorted(path for path in report_dir.rglob("*results.json") if path.stat().st_size < 2_000_000)[:20]
    qa = [qa_summary(path, report_dir) for path in qa_paths]
    failed = any(status == "fail" for status in statuses) or any(item["status"] == "fail" for item in qa)
    # At least test/type/lint/build and an actual browser result are required.
    complete = len(checks) >= 4 and all(status == "pass" for status in statuses) and bool(qa) and all(item["status"] == "pass" for item in qa)
    summary = "验收存在失败，请依据下表处理。" if failed else "所提供的计算、构建与浏览器验收证据通过。" if complete else "交付内容已整理；部分验证证据缺失或待确认，不据此宣称完整验收通过。"
    benchmark_path = report_dir / "beam-benchmark.json"
    benchmark, benchmark_error = read_json(benchmark_path)
    benchmark = benchmark if isinstance(benchmark, dict) else {}
    benchmark_rows = []
    for row in benchmark.get("rows", []):
        timing = row.get("timingMs", {}); measured = row.get("measured", {}); error = row.get("relativeErrorPercent", {}); energy = row.get("energy", {})
        benchmark_rows.append(f'<tr><td>{escaped(row.get("actualSourceSamples", "—"))}</td><td>{escaped(numeric(timing.get("mean")))}</td><td>{escaped(numeric(timing.get("median")))}</td><td>{escaped(numeric(measured.get("rmsU"), 6))} / {escaped(numeric(measured.get("rmsV"), 6))}</td><td>{escaped(numeric(error.get("rmsU"), 4))}% / {escaped(numeric(error.get("rmsV"), 4))}%</td><td>{escaped(energy.get("balanceError", "—"))}</td></tr>')
    benchmark_section = f'<p>{escaped(benchmark.get("benchmark", ""))}</p><p>{escaped(benchmark.get("method", ""))}</p><div class="scroll"><table><thead><tr><th>实际样本</th><th>平均 ms</th><th>中位数 ms</th><th>RMS u / v / mm</th><th>相对解析误差 u / v</th><th>功率残差</th></tr></thead><tbody>{"".join(benchmark_rows)}</tbody></table></div><p>{file_link(benchmark_path, report_dir, "实际基准 JSON")}</p>' if benchmark_rows else f'<p class="unknown">基准未确认：{escaped(benchmark_error or "没有基准记录")}</p>'
    cleanup = evidence.get("cleanup") or {}
    cleanup_path = resolve_site(cleanup.get("manifestPath")) if cleanup.get("manifestPath") else report_dir / "cleanup-result.json" if (report_dir / "cleanup-result.json").is_file() else report_dir / "cleanup-manifest.json"
    cleanup_record, _ = read_json(cleanup_path)
    if isinstance(cleanup_record, dict):
        cleanup = {**cleanup, **cleanup_record}
    cleanup_text = f'清理状态：{escaped(cleanup.get("status", "待确认"))}；已送入回收站 {escaped(cleanup.get("count", "未记录"))} 项，{escaped(cleanup.get("bytes", "未记录"))} 字节。'
    if cleanup.get("consolidatedCount"):
        cleanup_text += f' 另有 {escaped(cleanup["consolidatedCount"])} 个旧构建目录（{escaped(cleanup.get("consolidatedBytes", "未记录"))} 字节）合并保留在单一 outputs/retired-legacy-builds 目录；文件数、字节和SHA256内容清单已逐项核对，未删除，也未释放其占用空间。Windows回收接口返回错误，因此采用保留文件的整理方式。'
    if cleanup.get("failedCount"):
        cleanup_text += f' 仍有 {escaped(cleanup["failedCount"])} 项未处理。'
    if cleanup_record is not None:
        cleanup_text += " " + file_link(cleanup_path, report_dir, "逐项清理清单")
    artifacts = sorted(path for path in report_dir.rglob("*") if path.is_file() and path != output and path.suffix.lower() in (".json", ".png", ".html", ".csv", ".log", ".txt") and path.stat().st_size < 20_000_000)[:80]
    artifact_list = "".join(f'<li>{file_link(path, report_dir, os.path.relpath(path, report_dir).replace(chr(92), "/"))} · {path.stat().st_size:,} 字节</li>' for path in artifacts)
    images = []
    if not args.no_images:
        candidates = [path for path in artifacts if path.suffix.lower() == ".png" and path.stat().st_size <= 4_000_000 and any(word in path.name.lower() for word in ("desktop", "mobile"))]
        for path in candidates[:4]:
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            images.append(f'<figure><img src="data:image/png;base64,{encoded}" alt="{escaped(path.stem)}" loading="lazy"><figcaption>{file_link(path, report_dir)}</figcaption></figure>')
    features = [
        ("1. 画布与参数布局", "空间画布为主要操作区域；紧凑参数面板可以收起，装备库按需展开。图标和光线显示大小可调整，真实计算坐标保持不变。"),
        ("2. 真实尺度网格", "毫米网格、吸附间隔独立设置；坐标和两轴比例保持真实尺度，支持适应元件、全区域和局部缩放。"),
        ("3. 实时探测器光斑", "根据实际到达样本显示双横轴密度分箱、光线散点、积分剖面、质心和二维RMS；导出HTML保留实际分箱数据。"),
        ("4. 椭圆源与两轴发散", "Gaussian/均匀椭圆分布，独立输入主/次轴直径、发散全角与旋转；旧工程保留一维模型。"),
        ("5. 装备式器件库", "十二款球面/消色差透镜、六款物镜、三个柱透镜及理想/分光元件按分类选择；名义规格与模型假设有来源，瞳面OPD球差/彗差/像散为独立用户输入。"),
        ("6. 计算与专业分析", "实际三维方向/有限面交点、功率守恒、二维统计和有预算的多变量局部优化；先预览后应用，支持取消及旧候选保护。未实现完整Zemax/OpticStudio能力，详见模型范围。"),
        ("7. 架构与云端准备", "六个纯计算核心集中在core，工程状态与界面组合分离；验收与临时输出统一目录，静态构建精简并审计。当前没有服务器/数据库，不创建空服务层。"),
    ]
    feature_rows = "".join(f'<tr><th scope="row">{escaped(name)}</th><td>{escaped(description)}</td></tr>' for name, description in features)
    sources = [
        ("Ansys：扩展源效率、质心与径向RMS", "https://optics.ansys.com/hc/en-us/articles/42661975992851-How-to-generate-cross-section-and-moment-data-for-an-extended-source-using-Geometric-Image-Analysis"),
        ("Ansys：几何与Gaussian激光传播的区别", "https://optics.ansys.com/hc/en-us/articles/42661513633683-How-to-model-laser-beam-propagation-in-OpticStudio-Part-1-Gaussian-beam-theory-and-ray-based-approach"),
        ("Thorlabs：柱透镜官方历史目录", "https://www.thorlabs.com/catalogpages/V21/764.PDF"),
        ("Evident：物镜焦距与倍率", "https://evidentscientific.com/en/learn/microscope/terms/focal-length"),
    ]
    source_links = "".join(f'<li><a href="{escaped(url)}">{escaped(label)}</a></li>' for label, url in sources)
    for folder in ("thorlabs", "objectives", "cylindrical"):
        path = SITE / "public" / "training" / folder
        if path.is_dir():
            index = path / "manifest.json" if (path / "manifest.json").is_file() else path / "catalog.json" if (path / "catalog.json").is_file() else path
            source_links += f'<li>{file_link(index, report_dir, "本地官方记录索引：" + folder)}</li>'
    limits = "布局中心和法线在XY、第二横轴为Z；反射使用真实几何方向，透镜是近轴理想主面。Gaussian采样不是Gaussian q或相干波传播；强度直方图不是衍射PSF。用户OPD不是厂家实测处方或标准化Zernike RMS。真实厚度/曲率/玻璃色散、全三维倾斜偏心机构、衍射、偏振、高NA物镜和容差尚未实现。零几何宽度只表示理想几何焦点；不代表零物理焦斑或无限辐照度。局部优化不保证全局最优。"
    timestamp = datetime.now(timezone.utc).isoformat()
    evidence_note = file_link(evidence_path, report_dir, "验证证据 JSON") if evidence_path.is_file() else f'验证证据缺失：{escaped(evidence_error)}'
    qa_rows = "".join(item["html"] for item in qa) or '<tr><td colspan="3" class="unknown">没有可读的浏览器验收结果。</td></tr>'
    failure_details = "".join(item.get("failures", "") for item in qa)
    report = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>光学工作台 · 改进与验收记录</title><style>
body{{margin:0;background:#f1f3ed;color:#29483b;font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}}main{{max-width:1120px;margin:30px auto;padding:30px;background:#fff}}h1{{font-size:30px}}h2{{font-size:21px;margin-top:32px}}a{{color:#256d51;text-underline-offset:3px}}.meta{{font-size:12px;color:#5f7468}}.notice{{padding:15px;background:#edf4e9}}table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{padding:11px;text-align:left;vertical-align:top;border-bottom:1px solid #dce6dd}}th{{font-weight:600}}.scroll{{overflow:auto}}.pass{{color:#24694e}}.fail{{color:#a33428}}.unknown{{color:#826016}}code{{font-size:12px;overflow-wrap:anywhere}}img{{max-width:100%;height:auto}}figure{{margin:20px 0}}figcaption{{font-size:12px}}details{{padding:12px 0}}li{{margin:6px 0}}@media(max-width:650px){{main{{margin:0;padding:18px}}h1{{font-size:25px}}table{{min-width:580px}}}}@media print{{body{{background:white}}main{{margin:0;padding:0}}figure{{break-inside:avoid}}}}
</style></head><body><main><p class="meta">Optical Lab · 本地计算与静态站点 · 生成于 {escaped(timestamp)}</p><h1>光学工作台：改进与可验证结果</h1><p class="notice">{escaped(summary)}</p><p><a href="{escaped(args.url)}">打开本地工作台</a> · {file_link(SITE / "docs" / "optics-workbench.md", report_dir, "模型、架构与交接文档")} · {evidence_note}</p><h2>七项请求的对应实现</h2><div class="scroll"><table><tbody>{feature_rows}</tbody></table></div><h2>计算、检查与构建证据</h2><div class="scroll"><table><thead><tr><th>检查 / 命令</th><th>状态</th><th>执行结果</th></tr></thead><tbody>{"".join(check_rows) or '<tr><td colspan="3" class="unknown">验证清单尚未提供。</td></tr>'}</tbody></table></div><h2>浏览器验收</h2><div class="scroll"><table><thead><tr><th>原始结果</th><th>状态</th><th>真实计数</th></tr></thead><tbody>{qa_rows}</tbody></table></div>{('<details><summary>失败或未确认的检查</summary><ul>' + failure_details + '</ul></details>') if failure_details else ''}<h2>实际采样误差与本机性能</h2>{benchmark_section}<p class="meta">以上耗时仅来自所列单一基准场景和本机Node运行，不能推广为复杂分光布局、浏览器或云端性能保证；有限采样误差也不是已认证误差上界。</p><h2>画布与手机显示</h2>{"".join(images) or '<p>没有嵌入现有截图；请从下方产物链接查看已生成图像。</p>'}<h2>精简与发布边界</h2><p>{cleanup_text}</p><p>清理边界只允许可重建历史产物按清单移入回收站，是否完成以以上状态和逐项证据为准；源代码、原始规格、教材、原对话诊断、Git历史和现有运行日志须保留。当前为静态浏览器应用，计算在客户端；真正上传只使用审计通过的dist/，发布仍需用户明确授权。本报告生成器没有执行上传或修改其他项目。</p><h2>模型范围</h2><p>{escaped(limits)}</p><h2>来源与工程依据</h2><ul>{source_links}</ul><h2>源数据、图形与可下载产物</h2><ul>{artifact_list or '<li>尚无可列出的验收产物。</li>'}</ul><details><summary>报告生成规则</summary><p>本文件由scripts/build_workbench_report.py读取已存在的验证JSON、浏览器结果、实际基准和截图生成；缺失项标记待确认，失败优先于成功标签。内嵌截图来自既有产物，不重新截图，也不绘制相似的模拟结果。</p></details></main></body></html>'''
    output.write_text(report, encoding="utf-8")
    print(json.dumps({"report": str(output), "checks": len(checks), "browserResultFiles": len(qa), "passedEvidence": complete and not failed, "failedEvidence": failed, "embeddedImages": len(images)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
