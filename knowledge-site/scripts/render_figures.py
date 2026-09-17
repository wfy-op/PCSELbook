from __future__ import annotations

import json
import hashlib
import re
import shutil
import subprocess
import time
from pathlib import Path

from generate_book_data import command_argument, consume_group, plain_title, source_order, strip_comments


SITE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = SITE_ROOT.parent
BUILD_ROOT = SITE_ROOT / "outputs" / "figure-render"
PUBLIC_ROOT = SITE_ROOT / "public" / "figures"
MANIFEST_PATH = PUBLIC_ROOT / "manifest.json"


def strip_command(source: str, command: str) -> str:
    marker = f"\\{command}"
    cursor = 0
    pieces: list[str] = []
    while True:
        position = source.find(marker, cursor)
        if position < 0:
            pieces.append(source[cursor:])
            break
        end_name = position + len(marker)
        if end_name < len(source) and source[end_name].isalpha():
            pieces.append(source[cursor:end_name])
            cursor = end_name
            continue
        scan = end_name
        if scan < len(source) and source[scan] == "*":
            scan += 1
        while scan < len(source) and source[scan].isspace():
            scan += 1
        if scan < len(source) and source[scan] == "[":
            optional = consume_group(source, scan, "[", "]")
            if optional:
                scan = optional[1]
        while scan < len(source) and source[scan].isspace():
            scan += 1
        parsed = consume_group(source, scan)
        if not parsed:
            pieces.append(source[cursor:end_name])
            cursor = end_name
            continue
        pieces.append(source[cursor:position])
        cursor = parsed[1]
    return "".join(pieces)


def unwrap_figure(source: str) -> str:
    match = re.search(
        r"\\begin\{figure\*?\}(?:\s*\[[^]]*\])?(.*?)\\end\{figure\*?\}",
        source,
        re.S,
    )
    return match.group(1) if match else source


def inline_figure_inputs(source: str, *, unwrap: bool = True) -> str:
    input_pattern = re.compile(r"\\input\{([^{}]+)\}")
    for _ in range(8):
        changed = False

        def replace(match: re.Match[str]) -> str:
            nonlocal changed
            relative = match.group(1)
            candidate = SOURCE_ROOT / relative
            if candidate.suffix == "":
                candidate = candidate.with_suffix(".tex")
            try:
                candidate.relative_to(SOURCE_ROOT / "figures")
            except ValueError:
                return match.group(0)
            if not candidate.exists():
                return match.group(0)
            changed = True
            included = strip_comments(candidate.read_text(encoding="utf-8"))
            return unwrap_figure(included) if unwrap else included

        source = input_pattern.sub(replace, source)
        if not changed:
            break
    return source


def clean_figure_content(block: str) -> str:
    content = unwrap_figure(block)
    content = inline_figure_inputs(content)
    content = re.sub(r"\\begin\{figure\*?\}(?:\[[^]]*\])?", "", content)
    content = re.sub(r"\\end\{figure\*?\}", "", content)
    content = strip_command(content, "caption")
    content = strip_command(content, "label")
    content = re.sub(r"\\(?:centering|raggedright|raggedleft)\b", "", content)
    return content.strip()


def validate_figure_content(content: str, label: str) -> None:
    forbidden = {
        "placement option": r"^\s*\[[!htbpH]+\]",
        "figure environment": r"\\(?:begin|end)\{figure\*?\}",
        "caption command": r"\\caption\b",
        "label command": r"\\label\b",
    }
    leftovers = [name for name, pattern in forbidden.items() if re.search(pattern, content, re.M)]
    if leftovers:
        raise RuntimeError(f"图 {label} 的独立渲染内容残留浮动体控制文本：{', '.join(leftovers)}")


def figure_records() -> list[dict[str, str | int]]:
    records: list[dict[str, str | int]] = []
    chapter_number = 0
    for _part, path in source_order():
        if path.parent.name == "chapters":
            chapter_number += 1
        source = strip_comments(path.read_text(encoding="utf-8"))
        source = inline_figure_inputs(source, unwrap=False)
        blocks = re.findall(r"\\begin\{figure\*?\}(.*?)\\end\{figure\*?\}", source, re.S)
        for figure_index, body in enumerate(blocks, start=1):
            block = f"\\begin{{figure}}{body}\\end{{figure}}"
            label = command_argument(block, "label") or f"fig:{path.stem}-{figure_index}"
            caption = command_argument(block, "caption") or "书稿原始图形"
            content = clean_figure_content(block)
            validate_figure_content(content, label)
            records.append(
                {
                    "label": label,
                    "number": f"{chapter_number}.{figure_index}",
                    "chapter": path.relative_to(SOURCE_ROOT).as_posix(),
                    "caption": plain_title(caption),
                    "content": content,
                }
            )
    return records


def tex_document(records: list[dict[str, str | int]]) -> str:
    previews = []
    for record in records:
        previews.append(
            "\\begin{preview}\n"
            "\\noindent\\begin{minipage}{0.98\\textwidth}\n"
            "\\centering\n"
            f"{record['content']}\n"
            "\\end{minipage}\n"
            "\\end{preview}\n"
        )
    return (
        "% Generated from the book's original LaTeX/TikZ figure sources.\n"
        "\\documentclass[UTF8,11pt,openany,oneside]{ctexbook}\n"
        "\\input{preamble}\n"
        "\\usepackage[active,tightpage]{preview}\n"
        "\\setlength\\PreviewBorder{5pt}\n"
        "\\begin{document}\n"
        + "\n".join(previews)
        + "\\end{document}\n"
    )


def find_xelatex() -> str:
    found = shutil.which("xelatex")
    if found:
        return found
    known = Path(r"C:\Program Files\MiKTeX\miktex\bin\x64\xelatex.exe")
    if known.exists():
        return str(known)
    raise RuntimeError("未找到 xelatex，无法从原始 TikZ 图源生成图片。")


def render_pdf(records: list[dict[str, str | int]]) -> Path:
    BUILD_ROOT.mkdir(parents=True, exist_ok=True)
    tex_path = BUILD_ROOT / "all_figures.tex"
    tex_path.write_text(tex_document(records), encoding="utf-8")
    command = [
        find_xelatex(),
        "-interaction=nonstopmode",
        "-halt-on-error",
        f"-output-directory={BUILD_ROOT}",
        str(tex_path),
    ]
    result = subprocess.run(
        command,
        cwd=SOURCE_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        tail = "\n".join((result.stdout + "\n" + result.stderr).splitlines()[-80:])
        raise RuntimeError(f"独立图形编译失败：\n{tail}")
    pdf_path = BUILD_ROOT / "all_figures.pdf"
    if not pdf_path.exists():
        raise RuntimeError("xelatex 未生成 all_figures.pdf")
    return pdf_path


def safe_filename(label: str, index: int) -> str:
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", label).strip("-").lower()
    return f"{index:03d}-{stem or 'figure'}.webp"


def records_hash(records: list[dict[str, str | int]]) -> str:
    graphics = {}
    for record in records:
        for relative in re.findall(r"\\includegraphics(?:\[[^]]*\])?\{([^{}]+)\}", str(record["content"])):
            target = SOURCE_ROOT / relative
            if not target.suffix:
                target = next((target.with_suffix(ext) for ext in (".pdf", ".png", ".jpg", ".jpeg")
                               if target.with_suffix(ext).exists()), target)
            graphics[relative] = hashlib.sha256(target.read_bytes()).hexdigest()
    payload = json.dumps(
        {
            "records": records,
            "graphics": graphics,
            "preamble": (SOURCE_ROOT / "preamble.tex").read_text(encoding="utf-8"),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def current_manifest(source_hash: str, records: list[dict[str, str | int]]) -> dict[str, object] | None:
    if not MANIFEST_PATH.exists():
        return None
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    figures = manifest.get("figures")
    if manifest.get("sourceHash") != source_hash or manifest.get("count") != len(records) or not isinstance(figures, dict):
        return None
    expected_labels = {str(record["label"]) for record in records}
    if set(figures) != expected_labels:
        return None
    if any(not (PUBLIC_ROOT / str(item.get("file", ""))).is_file() for item in figures.values() if isinstance(item, dict)):
        return None
    if any(not isinstance(item, dict) for item in figures.values()):
        return None
    return manifest


def render_webp(pdf_path: Path, records: list[dict[str, str | int]], source_hash: str) -> dict[str, object]:
    try:
        import fitz  # type: ignore
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("缺少 PyMuPDF 或 Pillow，无法生成网页图形。") from error

    document = None
    for attempt in range(20):
        try:
            document = fitz.open(stream=pdf_path.read_bytes(), filetype="pdf")
            break
        except (OSError, RuntimeError):
            if attempt == 19:
                raise
            time.sleep(0.25)
    assert document is not None
    if len(document) != len(records):
        raise RuntimeError(f"图形页数不匹配：PDF {len(document)} 页，源记录 {len(records)} 条。")
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {"sourceHash": source_hash, "count": len(records), "figures": {}}
    figures = manifest["figures"]
    assert isinstance(figures, dict)
    expected_files: set[str] = set()
    for index, (page, record) in enumerate(zip(document, records), start=1):
        filename = safe_filename(str(record["label"]), index)
        expected_files.add(filename)
        target = PUBLIC_ROOT / filename
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2.25, 2.25), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(target, "WEBP", lossless=True, method=6)
        figures[str(record["label"])] = {
            "file": filename,
            "number": record["number"],
            "chapter": record["chapter"],
            "caption": record["caption"],
            "width": pixmap.width,
            "height": pixmap.height,
        }
    document.close()
    stale_root = BUILD_ROOT / "retired-webp"
    for existing in PUBLIC_ROOT.glob("*.webp"):
        if existing.name in expected_files:
            continue
        stale_root.mkdir(parents=True, exist_ok=True)
        target = stale_root / existing.name
        suffix = 1
        while target.exists():
            target = stale_root / f"{existing.stem}-{suffix}{existing.suffix}"
            suffix += 1
        shutil.move(str(existing), str(target))
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    records = figure_records()
    if not records:
        raise RuntimeError("未在书稿章节中找到 figure 环境。")
    labels = [str(record["label"]) for record in records]
    duplicate_labels = sorted({label for label in labels if labels.count(label) > 1})
    if duplicate_labels:
        raise RuntimeError(f"发现重复图标签：{', '.join(duplicate_labels)}")
    source_hash = records_hash(records)
    manifest = current_manifest(source_hash, records)
    if manifest is not None:
        print(f"Figure assets are current ({manifest['count']} files; {source_hash[:12]}).")
        return
    pdf_path = render_pdf(records)
    manifest = render_webp(pdf_path, records, source_hash)
    print(f"Rendered {manifest['count']} source figures to {PUBLIC_ROOT}")
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
