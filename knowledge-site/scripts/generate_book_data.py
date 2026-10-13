from __future__ import annotations

import html
import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader


SITE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = SITE_ROOT.parent
PUBLIC_ROOT = SITE_ROOT / "public"
DATA_ROOT = PUBLIC_ROOT / "data"
CHAPTER_DATA_ROOT = DATA_ROOT / "chapters"
MANIFEST_PATH = DATA_ROOT / "book-manifest.json"
SEARCH_INDEX_PATH = DATA_ROOT / "search-index.json"


# Box environments from preamble.tex: (argument style, title template, default title).
# "none" boxes take no title argument (a leading [...] such as RigorousBox difficulty is ignored),
# "optional" boxes read the title from [...], and "required" boxes from the first {...}
# (NoteBox-style boxes may put tcolorbox options in a leading [...]).
BOX_SPECS: dict[str, tuple[str, str, str]] = {
    "IntuitionBox": ("none", "", "物理直觉"),
    "RigorousBox": ("none", "", "严格表述"),
    "ExampleBox": ("optional", "例子：{}", "例子"),
    "PitfallBox": ("none", "", "易错点"),
    "WarningBox": ("optional", "{}", "提示"),
    "warningbox": ("optional", "{}", "提示"),
    "WhatCouldGoWrong": ("none", "", "可能出错处"),
    "NoteBox": ("required", "{}", "注记"),
    "notebox": ("optional", "{}", "注记"),
    "ConnectionBox": ("required", "{}", "知识连接"),
    "NumericalInsightBox": ("required", "{}", "数值洞见"),
    "ApplicationBox": ("required", "{}", "应用提示"),
    "ReviewBox": ("required", "{}", "回看"),
    "SymmetryQuick": ("none", "", "对称性速成"),
    "ConvergenceCriteria": ("required", "{}", "收敛判据"),
    "ResourceAlertBox": ("required", "{}", "资源提示"),
    "PrerequisiteBox": ("required", "{}", "前置知识"),
    "NormalizationRemark": ("required", "{}", "归一化说明"),
    "NumericalErrorBox": ("none", "", "数值误差控制"),
    "CrossValidationBox": ("none", "", "交叉验证协议"),
    "PracticalTipBox": ("none", "", "实用技巧"),
    "ReportingStandardBox": ("none", "", "报告规范"),
    "ExperimentalAlignmentBox": ("none", "", "实验对标要求"),
    "EthicsReminderBox": ("none", "", "学术诚信提醒"),
    "ComparisonBox": ("required", "{}", "对比"),
    "MathematicalFoundationBox": ("required", "数学基础：{}", "数学基础"),
    "AssumptionAuditBox": ("required", "假设审查：{}", "假设审查"),
    "SymmetryToolkitBox": ("required", "对称性工具箱：{}", "对称性工具箱"),
    "DimensionCheckNote": ("optional", "量纲检查：{}", "量纲检查"),
    "MaterialPropertyBox": ("optional", "{}", "材料参数"),
    "MaterialSpecificityBox": ("optional", "{}", "材料特异性"),
    "ModelAssumptionBox": ("optional", "{}", "模型假设"),
    "ReciprocityConditionBox": ("optional", "{}", "互易性条件"),
    "MinRunnableBox": ("required", "最小可计算例子：{}", "最小可计算例子"),
    "CommonPitfallBox": ("required", "常见错误：{}", "常见错误"),
    "EngineeringIntuitionBox": ("required", "工程直觉：{}", "工程直觉"),
}

TEXT_ACCENTS = {
    "'": "́", "`": "̀", '"': "̈", "^": "̂",
    "~": "̃", "=": "̄", ".": "̇",
}

GREEK_TEXT = {
    "Gamma": "Γ",
    "Delta": "Δ",
    "Theta": "Θ",
    "Lambda": "Λ",
    "Omega": "Ω",
    "alpha": "α",
    "beta": "β",
    "gamma": "γ",
    "delta": "δ",
    "epsilon": "ε",
    "lambda": "λ",
    "mu": "μ",
    "nu": "ν",
    "omega": "ω",
    "phi": "φ",
    "pi": "π",
    "rho": "ρ",
    "sigma": "σ",
    "theta": "θ",
}


def strip_comments(source: str) -> str:
    lines: list[str] = []
    literal_environment = None
    for line in source.splitlines():
        literal_start = re.search(r"\\begin\{(lstlisting|verbatim)\}", line)
        if literal_start:
            literal_environment = literal_start.group(1)
        if literal_environment:
            lines.append(line)
            if f"\\end{{{literal_environment}}}" in line:
                literal_environment = None
            continue
        cut = len(line)
        for index, char in enumerate(line):
            if char != "%":
                continue
            slash_count = 0
            cursor = index - 1
            while cursor >= 0 and line[cursor] == "\\":
                slash_count += 1
                cursor -= 1
            if slash_count % 2 == 0:
                cut = index
                break
        lines.append(line[:cut].rstrip())
    return "\n".join(lines).lstrip("\ufeff")


def consume_group(source: str, start: int, opener: str = "{", closer: str = "}") -> tuple[str, int] | None:
    if start >= len(source) or source[start] != opener:
        return None
    depth = 0
    escaped = False
    for index in range(start, len(source)):
        char = source[index]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return source[start + 1 : index], index + 1
    return None


def command_argument(source: str, command: str, start: int = 0, argument_number: int = 1) -> str | None:
    marker = f"\\{command}"
    position = source.find(marker, start)
    if position < 0:
        return None
    cursor = position + len(marker)
    if cursor < len(source) and source[cursor] == "*":
        cursor += 1
    while cursor < len(source) and source[cursor].isspace():
        cursor += 1
    if cursor < len(source) and source[cursor] == "[":
        optional = consume_group(source, cursor, "[", "]")
        if optional:
            cursor = optional[1]
    result = None
    for _ in range(argument_number):
        while cursor < len(source) and source[cursor].isspace():
            cursor += 1
        parsed = consume_group(source, cursor)
        if not parsed:
            return None
        result, cursor = parsed
    return result


def replace_command(source: str, command: str, argument_count: int, handler) -> str:
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
        starred = False
        if scan < len(source) and source[scan] == "*":
            starred = True
            scan += 1
        while scan < len(source) and source[scan].isspace():
            scan += 1
        optional = None
        if scan < len(source) and source[scan] == "[":
            parsed_optional = consume_group(source, scan, "[", "]")
            if parsed_optional:
                optional, scan = parsed_optional
        arguments: list[str] = []
        valid = True
        for _ in range(argument_count):
            while scan < len(source) and source[scan].isspace():
                scan += 1
            parsed = consume_group(source, scan)
            if not parsed:
                valid = False
                break
            value, scan = parsed
            arguments.append(value)
        if not valid:
            pieces.append(source[cursor:end_name])
            cursor = end_name
            continue
        pieces.append(source[cursor:position])
        pieces.append(handler(arguments, optional, starred))
        cursor = scan
    return "".join(pieces)


def split_top_level(source: str, separator: str) -> list[str]:
    """Split LaTeX text only when braces and inline math are balanced."""
    parts: list[str] = []
    start = 0
    depth = 0
    in_math = False
    escaped = False
    index = 0
    while index < len(source):
        char = source[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\":
            if separator == r"\\" and depth == 0 and not in_math and source.startswith(separator, index):
                parts.append(source[start:index])
                index += len(separator)
                if index < len(source) and source[index] == "[":
                    optional = consume_group(source, index, "[", "]")
                    if optional:
                        index = optional[1]
                start = index
                continue
            escaped = True
            index += 1
            continue
        if char == "$":
            in_math = not in_math
        elif not in_math:
            if char == "{":
                depth += 1
            elif char == "}" and depth:
                depth -= 1
            elif separator == "&" and char == "&" and depth == 0:
                parts.append(source[start:index])
                start = index + 1
        index += 1
    parts.append(source[start:])
    return parts


def find_environment_end(source: str, environment: str, start: int) -> int:
    """Return the index of the \\end that closes an environment opened before start."""
    begin = f"\\begin{{{environment}}}"
    end = f"\\end{{{environment}}}"
    depth = 1
    cursor = start
    while True:
        next_end = source.find(end, cursor)
        if next_end < 0:
            return -1
        next_begin = source.find(begin, cursor)
        if 0 <= next_begin < next_end:
            depth += 1
            cursor = next_begin + len(begin)
            continue
        depth -= 1
        if depth == 0:
            return next_end
        cursor = next_end + len(end)


def extract_environment_body(block: str, environments: tuple[str, ...]) -> str | None:
    for environment in environments:
        marker = f"\\begin{{{environment}}}"
        start = block.find(marker)
        if start < 0:
            continue
        cursor = start + len(marker)
        while cursor < len(block) and block[cursor].isspace():
            cursor += 1
        if cursor < len(block) and block[cursor] == "[":
            optional = consume_group(block, cursor, "[", "]")
            if optional:
                cursor = optional[1]
        required_arguments = 2 if environment in {"tabular*", "tabularx"} else 1
        for _ in range(required_arguments):
            while cursor < len(block) and block[cursor].isspace():
                cursor += 1
            parsed = consume_group(block, cursor)
            if not parsed:
                return None
            _argument, cursor = parsed
        end = block.find(f"\\end{{{environment}}}", cursor)
        return block[cursor:end] if end >= 0 else None
    return None


def expand_inputs(source: str, current_file: Path, depth: int = 0) -> str:
    if depth > 12:
        raise RuntimeError(f"LaTeX input nesting is too deep near {current_file}")
    pattern = re.compile(r"\\input\{([^{}]+)\}")

    def replace(match: re.Match[str]) -> str:
        relative = Path(match.group(1))
        candidates = [SOURCE_ROOT / relative, current_file.parent / relative]
        for candidate in candidates:
            if candidate.suffix == "":
                candidate = candidate.with_suffix(".tex")
            try:
                resolved = candidate.resolve()
                resolved.relative_to(SOURCE_ROOT.resolve())
            except (ValueError, OSError):
                continue
            if resolved.exists() and resolved.is_file():
                nested = strip_comments(resolved.read_text(encoding="utf-8"))
                return expand_inputs(nested, resolved, depth + 1)
        return match.group(0)

    return pattern.sub(replace, source)


def remove_command_definitions(source: str) -> str:
    for command in ("newcommand", "renewcommand", "providecommand"):
        marker = f"\\{command}"
        cursor = 0
        pieces: list[str] = []
        while True:
            position = source.find(marker, cursor)
            if position < 0:
                pieces.append(source[cursor:])
                break
            scan = position + len(marker)
            while scan < len(source) and source[scan].isspace():
                scan += 1
            name = consume_group(source, scan)
            if not name:
                pieces.append(source[cursor : scan])
                cursor = scan
                continue
            scan = name[1]
            while scan < len(source) and source[scan].isspace():
                scan += 1
            if scan < len(source) and source[scan] == "[":
                optional = consume_group(source, scan, "[", "]")
                if optional:
                    scan = optional[1]
            while scan < len(source) and source[scan].isspace():
                scan += 1
            body = consume_group(source, scan)
            if not body:
                pieces.append(source[cursor : scan])
                cursor = scan
                continue
            pieces.append(source[cursor:position])
            cursor = body[1]
        source = "".join(pieces)
    return source


def latex_math_to_text(source: str) -> str:
    text = plain_title(source)
    text = text.replace("mathrm", "").replace("text", "")
    return re.sub(r"\s+", " ", text).strip()


def accessible_alt(caption: str) -> str:
    text = replace_command(caption, "cite", 1, lambda _args, _opt, _star: "")
    text = re.sub(r"(?<!\\)\$(.+?)(?<!\\)\$", lambda match: latex_math_to_text(match.group(1)), text, flags=re.S)
    text = plain_title(text)
    first_sentence = re.split(r"(?<=[。！？])", text, maxsplit=1)[0].strip()
    if len(first_sentence) < 24:
        first_sentence = text
    return first_sentence[:220].rstrip("，；： ")


def parse_bib_entries(path: Path) -> dict[str, dict[str, str]]:
    source = path.read_text(encoding="utf-8")
    entries: dict[str, dict[str, str]] = {}
    cursor = 0
    while True:
        match = re.search(r"@(\w+)\s*\{\s*([^,\s]+)\s*,", source[cursor:], re.S)
        if not match:
            break
        entry_start = cursor + match.start()
        body_start = source.find("{", entry_start, cursor + match.end())
        if body_start < 0:
            cursor = cursor + match.end()
            continue
        parsed = consume_group(source, body_start)
        if not parsed:
            cursor = cursor + match.end()
            continue
        body, entry_end = parsed
        fields: dict[str, str] = {"type": match.group(1).lower(), "key": match.group(2)}
        field_cursor = body.find(",") + 1
        while field_cursor > 0 and field_cursor < len(body):
            field_match = re.search(r"([A-Za-z]+)\s*=\s*", body[field_cursor:])
            if not field_match:
                break
            name = field_match.group(1).lower()
            value_start = field_cursor + field_match.end()
            while value_start < len(body) and body[value_start].isspace():
                value_start += 1
            if value_start < len(body) and body[value_start] == "{":
                value = consume_group(body, value_start)
                if not value:
                    break
                raw_value, field_cursor = value
            elif value_start < len(body) and body[value_start] == '"':
                end_quote = value_start + 1
                while end_quote < len(body) and body[end_quote] != '"':
                    end_quote += 1
                raw_value = body[value_start + 1 : end_quote]
                field_cursor = end_quote + 1
            else:
                end_value = body.find(",", value_start)
                if end_value < 0:
                    end_value = len(body)
                raw_value = body[value_start:end_value]
                field_cursor = end_value + 1
            fields[name] = plain_title(raw_value).replace("--", "–")
        entries[fields["key"]] = fields
        cursor = entry_end
    return entries


def citation_label(entry: dict[str, str]) -> str:
    authors = [part.strip() for part in entry.get("author", "").split(" and ") if part.strip()]
    surnames = [(author.split(",", 1)[0] if "," in author else author.split()[-1]) for author in authors]
    if not surnames:
        author_text = entry.get("key", "参考文献")
    elif len(surnames) == 1:
        author_text = surnames[0]
    elif len(surnames) == 2:
        author_text = f"{surnames[0]} & {surnames[1]}"
    else:
        author_text = f"{surnames[0]} et al."
    return f"{author_text}, {entry.get('year', 'n.d.')}"


def unit_text(source: str) -> str:
    replacements = {
        r"\per": "/",
        r"\micro": "μ",
        r"\nano": "n",
        r"\pico": "p",
        r"\milli": "m",
        r"\centi": "c",
        r"\meter": "m",
        r"\second": "s",
        r"\watt": "W",
        r"\joule": "J",
        r"\kelvin": "K",
        r"\hertz": "Hz",
        r"\volt": "V",
        r"\ampere": "A",
        r"\degreeCelsius": "°C",
        r"\celsius": "°C",
        r"\percent": "%",
        r"\degree": "°",
    }
    text = source
    for command, replacement in replacements.items():
        text = text.replace(command, replacement)
    text = text.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text).strip()


def remove_first_chapter_command(source: str) -> str:
    match = re.search(r"\\chapter(\*)?", source)
    if not match:
        return source
    scan = match.end()
    while scan < len(source) and source[scan].isspace():
        scan += 1
    if scan < len(source) and source[scan] == "[":
        optional = consume_group(source, scan, "[", "]")
        if optional:
            scan = optional[1]
    while scan < len(source) and source[scan].isspace():
        scan += 1
    title = consume_group(source, scan)
    if not title:
        return source
    return source[: match.start()] + source[title[1] :]


def plain_title(source: str) -> str:
    text = source
    for command in ("cite", "citep", "citet"):
        text = replace_command(text, command, 1, lambda _args, _opt, _star: "")
    accent_marks = {
        "'": "\u0301", "`": "\u0300", '"': "\u0308", "^": "\u0302",
        "~": "\u0303", "=": "\u0304", ".": "\u0307", "v": "\u030c",
        "u": "\u0306", "H": "\u030b", "c": "\u0327", "k": "\u0328",
    }

    def replace_accent(match: re.Match[str]) -> str:
        return unicodedata.normalize("NFC", match.group(2) + accent_marks[match.group(1)])

    text = re.sub(r"\\(['`\"^~=\.uvHck])\s*\{?([A-Za-z])\}?", replace_accent, text)
    text = re.sub(r"\\[,;:!]", " ", text)
    text = replace_command(text, "texorpdfstring", 2, lambda args, _opt, _star: args[1])
    for command in ("textbf", "textit", "emph", "mathrm", "mathbf", "mathsf", "bm", "operatorname"):
        text = replace_command(text, command, 1, lambda args, _opt, _star: args[0])
    text = re.sub(r"(?<!\\)\$([^$]+)(?<!\\)\$", r"\1", text)
    for command, symbol in GREEK_TEXT.items():
        text = re.sub(rf"\\{command}\b", symbol, text)
    text = text.replace(r"\&", "&").replace(r"\_", "_").replace("~", " ")
    text = re.sub(r"\\[A-Za-z@]+\*?", "", text)
    text = text.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text).strip()


class HtmlConverter:
    def __init__(
        self,
        chapter_slug: str,
        figure_assets: dict[str, dict[str, object]],
        reference_map: dict[str, dict[str, str]],
        bibliography: dict[str, dict[str, str]],
    ):
        self.chapter_slug = chapter_slug
        self.figure_assets = figure_assets
        self.reference_map = reference_map
        self.bibliography = bibliography
        self.tokens: list[str] = []
        self.headings: list[dict[str, str | int]] = []
        self.heading_counter = 0

    def stash(self, value: str) -> str:
        token = f"@@HTMLTOKEN{len(self.tokens):06d}@@"
        self.tokens.append(value)
        return token

    def restore(self, value: str) -> str:
        token_pattern = re.compile(r"@@HTMLTOKEN(\d{6})@@")
        for _ in range(12):
            if not token_pattern.search(value):
                break
            value = token_pattern.sub(lambda match: self.tokens[int(match.group(1))], value)
        return value

    def math_token(self, tex: str, display: bool, anchors: list[str] | None = None) -> str:
        tex = tex.replace(r"\begin{bsmallmatrix}", r"\begin{smallmatrix}")
        tex = tex.replace(r"\end{bsmallmatrix}", r"\end{smallmatrix}")
        safe = html.escape(tex.strip(), quote=False)
        labels = anchors or []
        anchor_attr = f' id="{html.escape(labels[0], quote=True)}"' if labels else ""
        if display:
            extra_anchors = "".join(
                f'<span id="{html.escape(label, quote=True)}" class="equation-anchor" aria-hidden="true"></span>'
                for label in labels[1:]
            )
            numbers: list[str] = []
            for label in labels:
                reference = self.reference_map.get(label)
                if reference and reference.get("type") == "equation":
                    number = reference.get("short", "").strip("()")
                    if number and number not in numbers:
                        numbers.append(number)
            number_html = (
                f'<span class="equation-number" aria-label="公式编号 {"、".join(numbers)}">'
                f'{"、".join(f"({number})" for number in numbers)}</span>'
                if numbers
                else ""
            )
            return self.stash(
                f'<div class="math-block"{anchor_attr}><span class="math-source">\\[{safe}\\]</span>'
                f"{extra_anchors}{number_html}</div>"
            )
        return self.stash(f'<span class="math-inline"><span class="math-source">\\({safe}\\)</span></span>')

    def protect_math(self, source: str) -> str:
        environment_pattern = re.compile(
            r"\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?)\}(.*?)\\end\{\1\}",
            re.S,
        )

        def environment_replacement(match: re.Match[str]) -> str:
            environment = match.group(1).rstrip("*")
            body = match.group(2).strip()
            labels = re.findall(r"\\label\{([^{}]+)\}", body)
            body = re.sub(r"\\label\{[^{}]+\}", "", body)
            if environment == "equation":
                tex = body
            elif environment == "multline":
                tex = f"\\begin{{gathered}}{body}\\end{{gathered}}"
            else:
                tex = f"\\begin{{aligned}}{body}\\end{{aligned}}"
            return f"\n\n{self.math_token(tex, True, labels)}\n\n"

        source = environment_pattern.sub(environment_replacement, source)
        source = re.sub(
            r"\\\[(.*?)\\\]",
            lambda match: f"\n\n{self.math_token(match.group(1), True)}\n\n",
            source,
            flags=re.S,
        )
        source = re.sub(
            r"(?<!\\)\$\$(.*?)(?<!\\)\$\$",
            lambda match: f"\n\n{self.math_token(match.group(1), True)}\n\n",
            source,
            flags=re.S,
        )
        source = re.sub(
            r"(?<!\\)\\\((.+?)\\\)",
            lambda match: self.math_token(match.group(1), False),
            source,
            flags=re.S,
        )
        source = re.sub(
            r"(?<!\\)\$(?!\$)(.+?)(?<!\\)\$",
            lambda match: self.math_token(match.group(1), False),
            source,
            flags=re.S,
        )
        return source

    def inline(self, source: str) -> str:
        text = self.protect_math(source)
        for command in ("crefrange", "Crefrange"):
            text = replace_command(text, command, 2, lambda args, _opt, _star: self.stash(
                self.render_reference(args[0], "cref") + "至" + self.render_reference(args[1], "cref")
            ))

        text = replace_command(
            text,
            "href",
            2,
            lambda args, _opt, _star: self.stash(
                f'<a href="{html.escape(args[0], quote=True)}" target="_blank" rel="noreferrer">{self.inline(args[1])}</a>'
            ),
        )
        text = replace_command(
            text,
            "url",
            1,
            lambda args, _opt, _star: self.stash(
                f'<a href="{html.escape(args[0], quote=True)}" target="_blank" rel="noreferrer">{html.escape(args[0])}</a>'
            ),
        )
        text = replace_command(
            text,
            "texttt",
            1,
            # Typewriter text keeps literal double hyphens such as command-line options.
            lambda args, _opt, _star: self.stash(f"<code>{self.inline(args[0].replace('--', self.stash('--')))}</code>"),
        )
        for command, tag in (("textbf", "strong"), ("emph", "em"), ("textit", "em")):
            text = replace_command(
                text,
                command,
                1,
                lambda args, _opt, _star, tag=tag: self.stash(f"<{tag}>{self.inline(args[0])}</{tag}>")
            )
        for command in ("mathrm", "mathbf", "mathsf", "bm", "operatorname", "mbox", "textrm"):
            text = replace_command(text, command, 1, lambda args, _opt, _star: args[0])
        text = replace_command(text, "texorpdfstring", 2, lambda args, _opt, _star: args[0])
        text = replace_command(
            text,
            "SI",
            2,
            lambda args, _opt, _star: self.stash(
                f'<span class="quantity">{self.inline(args[0])} {html.escape(unit_text(args[1]))}</span>'
            ),
        )
        text = replace_command(
            text,
            "SIrange",
            3,
            lambda args, _opt, _star: self.stash(
                f'<span class="quantity">{self.inline(args[0])}–{self.inline(args[1])} {html.escape(unit_text(args[2]))}</span>'
            ),
        )
        text = replace_command(
            text,
            "si",
            1,
            lambda args, _opt, _star: self.stash(f'<span class="quantity-unit">{html.escape(unit_text(args[0]))}</span>'),
        )
        text = replace_command(
            text,
            "cite",
            1,
            lambda args, _opt, _star: self.stash(self.render_citation(args[0])),
        )
        for command in ("cref", "Cref", "ref", "eqref", "autoref"):
            text = replace_command(
                text,
                command,
                1,
                lambda args, _opt, _star, command=command: self.stash(
                    self.render_reference(args[0], command)
                ),
            )
        text = replace_command(
            text,
            "label",
            1,
            lambda args, _opt, _star: self.stash(f'<span id="{html.escape(args[0], quote=True)}"></span>'),
        )
        text = text.replace(r"\basicq", "[基础]").replace(r"\midq", "[进阶]").replace(r"\hardq", "[综合]")
        text = re.sub(
            r"(?<!\\)\\([\"'`^~=.])\s*\{?([A-Za-z])\}?",
            lambda match: unicodedata.normalize("NFC", match.group(2) + TEXT_ACCENTS[match.group(1)]),
            text,
        )
        text = re.sub(r"(?<!\\)\\[,;:]", " ", text)
        text = re.sub(r"(?<!\\)\\!", "", text)
        text = re.sub(r"(?<!\\)\\ ", " ", text)
        text = text.replace("---", "—").replace("--", "–")
        text = text.replace(r"\%", "%").replace(r"\_", "_").replace(r"\&", "&").replace(r"\#", "#")
        text = text.replace(r"\textbackslash", "\\").replace("~", "\u00a0")
        for command, symbol in GREEK_TEXT.items():
            text = re.sub(rf"\\{command}\b", symbol, text)
        text = re.sub(r"\\(?:noindent|smallskip|medskip|bigskip|centering|raggedright|displaystyle|textstyle)\b", "", text)
        text = re.sub(r"\\(?:vspace|hspace|rule|setlength|addvspace)\*?\s*\{[^{}]*\}", "", text)
        text = re.sub(r"\\(?:footnote|marginpar)\s*\{([^{}]*)\}", r"（\1）", text)
        text = re.sub(r"\\[A-Za-z@]+\*?", "", text)
        text = text.replace("{", "").replace("}", "")
        text = text.replace("\\\\", "\n")
        escaped = html.escape(text, quote=False)
        return self.restore(escaped)

    def render_reference(self, labels_raw: str, command: str) -> str:
        rendered: list[str] = []
        for raw_label in labels_raw.split(","):
            label = raw_label.strip()
            reference = self.reference_map.get(label)
            display = reference["display"] if reference else "未解析引用"
            if command == "eqref" and reference and reference.get("type") == "equation":
                display = reference.get("short", display)
            title = reference.get("title", "书稿交叉引用") if reference else f"未解析标签：{label}"
            if reference:
                slug = reference.get("slug", self.chapter_slug)
                anchor = "" if reference.get("type") == "chapter" else f"#{html.escape(label, quote=True)}"
                rendered.append(
                    f'<a class="reference-chip" href="/chapters/{html.escape(slug, quote=True)}/{anchor}" '
                    f'title="{html.escape(title, quote=True)}">{html.escape(display)}</a>'
                )
            else:
                rendered.append(
                    f'<span class="reference-chip broken-reference" title="{html.escape(title, quote=True)}">'
                    f'{html.escape(display)}</span>'
                )
        return "、".join(rendered)

    def render_citation(self, keys_raw: str) -> str:
        links: list[str] = []
        for key in (part.strip() for part in keys_raw.split(",")):
            if not key:
                continue
            entry = self.bibliography.get(key)
            label = citation_label(entry) if entry else key
            title = entry.get("title", "参考文献") if entry else f"未解析文献：{key}"
            links.append(
                f'<a class="citation" href="/chapters/references/#ref-{html.escape(key, quote=True)}" '
                f'title="{html.escape(title, quote=True)}">[{html.escape(label)}]</a>'
            )
        return " ".join(links)

    def render_figure(self, block: str) -> str:
        caption_raw = command_argument(block, "caption") or "书稿原始图形"
        caption = self.inline(caption_raw)
        label = command_argument(block, "label") or ""
        asset = self.figure_assets.get(label)
        source_match = re.search(r"\\input\{([^{}]*figures/[^{}]+)\}", block)
        graphic_match = re.search(r"\\includegraphics(?:\[[^]]*\])?\{([^{}]+)\}", block)
        source_name = source_match.group(1) if source_match else (graphic_match.group(1) if graphic_match else "内嵌 TikZ 图形")
        anchor = html.escape(label or f"figure-{abs(hash(source_name))}", quote=True)
        if asset:
            filename = html.escape(str(asset["file"]), quote=True)
            visual = (
                f'<a class="figure-preview" href="/figures/{filename}" target="_blank" rel="noreferrer" '
                f'aria-label="在新窗口打开图 {asset.get("number", "")}"><img loading="lazy" src="/figures/{filename}" '
                f'width="{asset.get("width", "")}" height="{asset.get("height", "")}" '
                f'alt="{html.escape(accessible_alt(caption_raw), quote=True)}" /></a>'
            )
            number = f'<span class="figure-number">图 {html.escape(str(asset.get("number", "")))}</span>'
        else:
            visual = '<div class="figure-fallback">该图的独立图源尚未生成</div>'
            number = ""
        return (
            f'<figure id="{anchor}" class="book-figure">{visual}'
            f"<figcaption>{number}{caption}</figcaption>"
            "</figure>"
        )

    def replace_figures(self, source: str) -> str:
        figure_pattern = re.compile(r"\\begin\{figure\*?\}(.*?)\\end\{figure\*?\}", re.S)
        source = figure_pattern.sub(lambda match: f"\n\n{self.stash(self.render_figure(match.group(0)))}\n\n", source)
        source = re.sub(
            r"\\includegraphics(?:\[[^]]*\])?\{([^{}]+)\}",
            lambda match: f"\n\n{self.stash(self.render_figure(match.group(0)))}\n\n",
            source,
        )
        return source

    def render_table(self, block: str) -> str:
        caption_raw = command_argument(block, "caption") or ""
        label = command_argument(block, "label") or ""
        body = extract_environment_body(block, ("tabular", "tabular*", "tabularx", "longtable")) or block
        if r"\endfirsthead" in body and r"\endhead" in body:
            first_header, repeated = body.split(r"\endfirsthead", 1)
            _repeated_header, remainder = repeated.split(r"\endhead", 1)
            body = first_header + remainder
        body = re.sub(r"\\(?:toprule|midrule|bottomrule|hline|endfirsthead|endhead|endfoot|endlastfoot)\b", "", body)
        body = replace_command(body, "multicolumn", 3, lambda args, _opt, _star: args[2])
        body = replace_command(body, "multirow", 3, lambda args, _opt, _star: args[2])
        rows: list[list[str]] = []
        for raw_row in split_top_level(body, r"\\"):
            raw_row = raw_row.strip()
            if not raw_row or raw_row.startswith("\\caption") or raw_row.startswith("\\label"):
                continue
            cells = [self.inline(self.replace_lists(cell.strip())) for cell in split_top_level(raw_row, "&")]
            if any(re.sub(r"<[^>]+>", "", cell).strip() for cell in cells):
                rows.append(cells)
        if not rows:
            return ""
        width = max(len(row) for row in rows)
        normalized = [row + [""] * (width - len(row)) for row in rows]
        header = normalized[0]
        rest = normalized[1:]
        html_rows = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rest)
        reference = self.reference_map.get(label)
        number = f'<span class="table-number">{html.escape(reference["display"])}</span> ' if reference else ""
        caption = f"<caption>{number}{self.inline(caption_raw)}</caption>" if caption_raw else ""
        id_attr = f' id="{html.escape(label, quote=True)}"' if label else ""
        note_raw = command_argument(block, "parbox", argument_number=2) or ""
        note = f'<div class="table-note">{self.inline(note_raw)}</div>' if note_raw else ""
        return (
            f'<div class="table-scroll"{id_attr}><table class="book-table">'
            + caption
            + "<thead><tr>"
            + "".join(f"<th>{cell}</th>" for cell in header)
            + "</tr></thead><tbody>"
            + html_rows
            + f"</tbody></table>{note}</div>"
        )

    def replace_tables(self, source: str) -> str:
        source = re.sub(
            r"\\begin\{table\*?\}(.*?)\\end\{table\*?\}",
            lambda match: f"\n\n{self.stash(self.render_table(match.group(0)))}\n\n",
            source,
            flags=re.S,
        )
        source = re.sub(
            r"\\begin\{longtable\}(.*?)\\end\{longtable\}",
            lambda match: f"\n\n{self.stash(self.render_table(match.group(0)))}\n\n",
            source,
            flags=re.S,
        )
        # Tables typeset directly in the text (e.g. inside center or a box) have no float.
        source = re.sub(
            r"\\begin\{(tabularx|tabular\*?)\}.*?\\end\{\1\}",
            lambda match: f"\n\n{self.stash(self.render_table(match.group(0)))}\n\n",
            source,
            flags=re.S,
        )
        return source

    def replace_boxes(self, source: str) -> str:
        for environment, (style, template, default_title) in BOX_SPECS.items():
            begin = f"\\begin{{{environment}}}"
            pieces: list[str] = []
            cursor = 0
            while True:
                start = source.find(begin, cursor)
                if start < 0:
                    pieces.append(source[cursor:])
                    break
                scan = start + len(begin)
                probe = scan
                while probe < len(source) and source[probe] in " \t":
                    probe += 1
                optional_argument = ""
                if probe < len(source) and source[probe] == "[":
                    optional = consume_group(source, probe, "[", "]")
                    if optional:
                        optional_argument, scan = optional
                required_argument = ""
                if style == "required":
                    probe = scan
                    while probe < len(source) and source[probe].isspace():
                        probe += 1
                    parsed = consume_group(source, probe)
                    if parsed:
                        required_argument, scan = parsed
                end = find_environment_end(source, environment, scan)
                if end < 0:
                    pieces.append(source[cursor:])
                    break
                argument = {"required": required_argument, "optional": optional_argument}.get(style, "").strip()
                title = template.format(argument) if argument else default_title
                body = self.fragment(source[scan:end])
                rendered = (
                    f'<aside class="callout callout-{environment.lower()}">'
                    f'<div class="callout-title">{self.inline(title)}</div><div>{body}</div></aside>'
                )
                pieces.append(source[cursor:start] + f"\n\n{self.stash(rendered)}\n\n")
                cursor = end + len(f"\\end{{{environment}}}")
            source = "".join(pieces)
        for environment, label in (
            ("definition", "定义"),
            ("theorem", "定理"),
            ("proposition", "命题"),
            ("lemma", "引理"),
            ("corollary", "推论"),
            ("remark", "注记"),
            ("example", "例"),
        ):
            pattern = re.compile(
                rf"\\begin\{{{environment}\}}(?:\[([^]]*)\])?(.*?)\\end\{{{environment}\}}",
                re.S,
            )

            def render_theorem(match: re.Match[str], label: str = label) -> str:
                suffix = f"：{self.inline(match.group(1))}" if match.group(1) else ""
                rendered = (
                    f'<aside class="theorem"><div class="callout-title">{label}{suffix}</div>'
                    f"{self.fragment(match.group(2))}</aside>"
                )
                return f"\n\n{self.stash(rendered)}\n\n"

            source = pattern.sub(render_theorem, source)
        return source

    def replace_lists(self, source: str) -> str:
        # Convert innermost lists first so nested and repeated lists all become HTML.
        list_pattern = re.compile(
            r"\\begin\{(itemize|enumerate|description)\}(?:\[[^\]]*\])?"
            r"((?:(?!\\begin\{(?:itemize|enumerate|description)\}).)*?)\\end\{\1\}",
            re.S,
        )
        while True:
            match = list_pattern.search(source)
            if not match:
                break
            kind = match.group(1)
            tag = "ol" if kind == "enumerate" else "ul"
            parts = re.split(r"\\item(?![A-Za-z])(?:\[([^\]]*)\])?", match.group(2))
            items: list[str] = []
            for index in range(1, len(parts), 2):
                body = self.fragment(parts[index + 1])
                label = (parts[index] or "").strip()
                if label:
                    label_html = f'<strong class="item-label">{self.inline(label)}</strong> '
                    body = f"<p>{label_html}{body[3:]}" if body.startswith("<p>") else label_html + body
                items.append(f"<li>{body}</li>")
            css = ' class="description-list"' if kind == "description" else ""
            rendered = f"<{tag}{css}>" + "".join(items) + f"</{tag}>"
            source = source[: match.start()] + f"\n\n{self.stash(rendered)}\n\n" + source[match.end() :]
        return source

    def replace_headings(self, source: str) -> str:
        levels = {"chapter": 2, "section": 2, "subsection": 3, "subsubsection": 4, "paragraph": 2}
        pattern = re.compile(r"\\(chapter|section|subsection|subsubsection|paragraph)(\*)?")
        cursor = 0
        pieces: list[str] = []
        while True:
            match = pattern.search(source, cursor)
            if not match:
                pieces.append(source[cursor:])
                break
            scan = match.end()
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
                pieces.append(source[cursor : match.end()])
                cursor = match.end()
                continue
            title_raw, end = parsed
            level = levels[match.group(1)]
            self.heading_counter += 1
            label_match = re.match(r"\s*\\label\{([^{}]+)\}", source[end:])
            heading_id = label_match.group(1) if label_match else f"{self.chapter_slug}-h{self.heading_counter}"
            if label_match:
                end += label_match.end()
            title_text = plain_title(title_raw) or f"第 {self.heading_counter} 节"
            self.headings.append({"id": heading_id, "title": title_text, "level": level})
            rendered = (
                f'<h{level} id="{heading_id}">{self.inline(title_raw)}'
                f'<a class="heading-anchor" href="#{heading_id}" aria-hidden="true" tabindex="-1">#</a></h{level}>'
            )
            pieces.append(source[cursor : match.start()])
            pieces.append(f"\n\n{self.stash(rendered)}\n\n")
            cursor = end
        return "".join(pieces)

    def paragraphize(self, rendered: str) -> str:
        blocks: list[str] = []
        for chunk in re.split(r"\n\s*\n", rendered):
            chunk = chunk.strip()
            if not chunk:
                continue
            if re.match(r"^<(?:h[1-6]|div|aside|figure|table|ul|ol|pre|blockquote)", chunk):
                blocks.append(chunk)
            else:
                chunk = re.sub(r"\s*\n\s*", " ", chunk)
                blocks.append(f"<p>{chunk}</p>")
        return "\n".join(blocks)

    def fragment(self, source: str) -> str:
        def code_block(match):
            options = match.group(2) or ""
            language = re.search(r"language\s*=\s*([A-Za-z0-9_+-]+)", options)
            css = f' class="language-{language.group(1).lower()}"' if language else ""
            code = html.escape(match.group(3).strip("\n"), quote=False).replace("\n", "&#10;")
            return "\n\n" + self.stash(f'<pre class="source-code"><code{css}>{code}</code></pre>') + "\n\n"
        text = re.sub(r"\\begin\{(lstlisting|verbatim)\}(?:\[([^\]]*)\])?\s*\n(.*?)\\end\{\1\}", code_block, source, flags=re.S)
        text = strip_comments(text)
        text = self.replace_figures(text)
        text = self.replace_tables(text)
        text = self.replace_boxes(text)
        text = self.replace_lists(text)
        text = self.protect_math(text)
        text = self.replace_headings(text)
        text = re.sub(r"\\begin\{(?:center|flushleft|flushright|quote|quotation|minipage)\}(?:\{[^{}]*\})?", "\n\n", text)
        text = re.sub(r"\\end\{(?:center|flushleft|flushright|quote|quotation|minipage)\}", "\n\n", text)
        text = re.sub(r"\\begin\{(?:proof|abstract)\}(?:\[[^]]*\])?", "\n\n", text)
        text = re.sub(r"\\end\{(?:proof|abstract)\}", "\n\n", text)
        text = re.sub(r"\\ChapterModelLevel\{([^{}]*)\}", r"\n\n本章所处模型层级：\1\n\n", text)
        text = re.sub(r"\\part\*?(?:\[[^]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}", "", text)
        text = re.sub(r"\\(?:bibliographystyle|bibliography|addcontentsline|markboth|thispagestyle|pagestyle|clearpage|cleardoublepage|newpage)\b(?:\{[^{}]*\})*", "", text)
        rendered = self.inline(text)
        return self.paragraphize(rendered)


def source_order() -> list[tuple[str, Path]]:
    main = (SOURCE_ROOT / "main.tex").read_text(encoding="utf-8")
    part = "前置内容"
    ordered: list[tuple[str, Path]] = []
    for line in main.splitlines():
        stripped = strip_comments(line).strip()
        part_match = re.match(r"\\part\{(.+)\}", stripped)
        if part_match:
            part = plain_title(part_match.group(1))
            continue
        input_match = re.match(r"\\input\{([^{}]+)\}", stripped)
        if not input_match:
            continue
        relative = input_match.group(1)
        if relative in {"preamble", "frontmatter/cover"}:
            continue
        if not (
            relative.startswith("chapters/")
            or relative in {"frontmatter/preface", "frontmatter/figure_index", "notation"}
        ):
            continue
        path = SOURCE_ROOT / f"{relative}.tex"
        if path.exists():
            ordered.append((part, path))
    return ordered


def escape_generated_latex(text: str) -> str:
    """Escape plain manifest text before feeding it back through the TeX converter."""
    return (
        text.replace("\\", "")
        .replace("&", r"\&")
        .replace("%", r"\%")
        .replace("#", r"\#")
        .replace("_", r"\_")
        .replace("{", r"\{")
        .replace("}", r"\}")
    )


def generated_figure_index(figure_assets: dict[str, dict[str, object]]) -> str:
    """Build the web figure index from the same manifest used by chapter figures."""
    rows = []
    for asset in figure_assets.values():
        number = escape_generated_latex(str(asset.get("number", "")))
        caption = escape_generated_latex(str(asset.get("caption", "")))
        filename = str(asset.get("file", ""))
        rows.append(
            rf"\href{{/figures/{filename}}}{{图 {number}}} & {caption} \\"
        )
    return "\n".join(
        [
            r"\chapter*{插图索引}",
            r"本页由书稿插图清单自动生成。点击图号可打开网页原图。",
            r"\begin{longtable}{p{2.0cm}p{11.0cm}}",
            r"\toprule",
            r"图号 & 图题 \\",
            r"\midrule",
            *rows,
            r"\bottomrule",
            r"\end{longtable}",
        ]
    )


def prepared_source(
    path: Path, figure_assets: dict[str, dict[str, object]] | None = None
) -> str:
    if path.name == "figure_index.tex" and figure_assets is not None:
        source = generated_figure_index(figure_assets)
    else:
        source = strip_comments(path.read_text(encoding="utf-8"))
    source = expand_inputs(source, path)
    source = replace_command(
        source,
        "FigureIndexRow",
        3,
        lambda args, _opt, _star: f"{args[0]} & {args[1]} & {args[2]} \\\\",
    )
    return remove_command_definitions(source)


def expand_figure_inputs(source: str) -> str:
    pattern = re.compile(r"\\input\{([^{}]*figures/[^{}]+)\}")
    for _ in range(8):
        changed = False

        def replace(match: re.Match[str]) -> str:
            nonlocal changed
            relative = match.group(1)
            candidate = SOURCE_ROOT / relative
            if candidate.suffix == "":
                candidate = candidate.with_suffix(".tex")
            if not candidate.exists():
                return match.group(0)
            changed = True
            return strip_comments(candidate.read_text(encoding="utf-8"))

        source = pattern.sub(replace, source)
        if not changed:
            break
    return source


def equation_label_records(source: str, chapter_number: int) -> tuple[list[tuple[str, str]], int]:
    pattern = re.compile(
        r"\\begin\{((?:equation|align|alignat|gather|multline)\*?)\}(.*?)\\end\{\1\}",
        re.S,
    )
    records: list[tuple[str, str]] = []
    counter = 0
    for match in pattern.finditer(source):
        environment_name = match.group(1)
        if environment_name.endswith("*"):
            continue
        environment = environment_name.removesuffix("*")
        body = match.group(2)
        rows = split_top_level(body, r"\\") if environment in {"align", "alignat", "gather"} else [body]
        for row in rows:
            labels = re.findall(r"\\label\{([^{}]+)\}", row)
            numbered = not re.search(r"\\(?:notag|nonumber)\b", row)
            if numbered and row.strip():
                counter += 1
            if labels:
                number = f"{chapter_number}.{counter}" if chapter_number else str(counter)
                records.extend((label, number) for label in labels)
    return records, counter


def load_figure_assets() -> dict[str, dict[str, object]]:
    path = PUBLIC_ROOT / "figures" / "manifest.json"
    if not path.exists():
        raise RuntimeError("缺少独立图形清单，请先运行 scripts/render_figures.py。")
    data = json.loads(path.read_text(encoding="utf-8"))
    figures = data.get("figures", {})
    if not isinstance(figures, dict):
        raise RuntimeError("图形清单格式错误。")
    return figures


def heading_labels(source: str) -> list[tuple[str, str, int, str]]:
    pattern = re.compile(r"\\(section|subsection|subsubsection)(\*)?")
    section_number = 0
    subsection_number = 0
    subsubsection_number = 0
    records: list[tuple[str, str, int, str]] = []
    cursor = 0
    while True:
        match = pattern.search(source, cursor)
        if not match:
            break
        scan = match.end()
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
            cursor = match.end()
            continue
        title_raw, end = parsed
        label_match = re.match(r"\s*\\label\{([^{}]+)\}", source[end:])
        if match.group(1) == "section":
            section_number += 1
            subsection_number = 0
            subsubsection_number = 0
            number = str(section_number)
            level = 2
        elif match.group(1) == "subsection":
            subsection_number += 1
            subsubsection_number = 0
            number = f"{section_number}.{subsection_number}"
            level = 3
        else:
            subsubsection_number += 1
            number = f"{section_number}.{subsection_number}.{subsubsection_number}"
            level = 4
        if label_match:
            records.append((label_match.group(1), number, level, plain_title(title_raw)))
            end += label_match.end()
        cursor = end
    return records


def build_reference_map(
    ordered: list[tuple[str, Path]], figure_assets: dict[str, dict[str, object]]
) -> dict[str, dict[str, str]]:
    references: dict[str, dict[str, str]] = {}
    chapter_number = 0
    for _part, path in ordered:
        slug = path.stem.replace("_", "-")
        source = prepared_source(path, figure_assets)
        if path.parent.name == "chapters":
            chapter_number += 1

        title = plain_title(command_argument(source, "chapter") or path.stem)
        for label in re.findall(r"\\label\{([^{}]+)\}", source):
            references.setdefault(
                label,
                {
                    "display": "相关位置",
                    "short": "",
                    "type": "anchor",
                    "slug": slug,
                    "title": title,
                },
            )

        chapter_label = command_argument(source, "label")
        if chapter_label and chapter_number:
            references[chapter_label] = {
                "display": f"第 {chapter_number} 章",
                "short": str(chapter_number),
                "type": "chapter",
                "slug": slug,
                "title": title,
            }

        for label, number, level, title in heading_labels(source):
            full_number = f"{chapter_number}.{number}" if chapter_number else number
            label_name = "节" if level == 2 else "小节"
            references[label] = {
                "display": f"第 {full_number} {label_name}",
                "short": full_number,
                "type": "section",
                "slug": slug,
                "title": title,
            }

        for figure_label, asset in figure_assets.items():
            if asset.get("chapter") != path.relative_to(SOURCE_ROOT).as_posix():
                continue
            number = str(asset.get("number", ""))
            references[figure_label] = {
                "display": f"图 {number}",
                "short": number,
                "type": "figure",
                "slug": slug,
                "title": str(asset.get("caption", "书稿图形")),
            }

        table_blocks = re.findall(
            r"\\begin\{(?:table\*?|longtable)\}(.*?)\\end\{(?:table\*?|longtable)\}", source, re.S
        )
        for table_number, block in enumerate(table_blocks, start=1):
            label = command_argument(block, "label")
            if label:
                number = f"{chapter_number}.{table_number}" if chapter_number else str(table_number)
                references[label] = {
                    "display": f"表 {number}",
                    "short": number,
                    "type": "table",
                    "slug": slug,
                    "title": plain_title(command_argument(block, "caption") or "书稿表格"),
                }

        equation_records, _equation_count = equation_label_records(source, chapter_number)
        for label, number in equation_records:
            references[label] = {
                "display": f"式 ({number})",
                "short": f"({number})",
                "type": "equation",
                "slug": slug,
                "title": f"{title}中的公式 {number}",
            }
    return references


def plain_from_html(body: str) -> str:
    def replace_math(match: re.Match[str]) -> str:
        return " " + latex_math_to_text(html.unescape(match.group(1))) + " "

    text = re.sub(r'<a class="heading-anchor"[^>]*>#</a>', "", body)
    text = re.sub(
        r'<span class="math-source">\\(?:\(|\[)(.*?)\\(?:\)|\])</span>',
        replace_math,
        text,
        flags=re.S,
    )
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def search_sections(body: str) -> list[dict[str, str]]:
    matches = list(re.finditer(r'<h[2-4] id="([^"]+)">(.*?)</h[2-4]>', body, re.S))
    records: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        title = plain_from_html(match.group(2)).replace("#", "").strip()
        text = plain_from_html(body[match.end() : end])
        records.append({"id": match.group(1), "title": title, "text": text})
    return records


def render_bibliography(bibliography: dict[str, dict[str, str]]) -> str:
    items: list[str] = []
    for key, entry in bibliography.items():
        authors = entry.get("author", "作者信息缺失")
        title = entry.get("title", "题名缺失")
        venue = entry.get("journal") or entry.get("publisher") or entry.get("booktitle") or ""
        year = entry.get("year", "n.d.")
        doi = entry.get("doi", "")
        url = entry.get("url", "") or (f"https://doi.org/{doi}" if doi else "")
        link = (
            f' <a href="{html.escape(url, quote=True)}" target="_blank" rel="noreferrer">DOI / 原文</a>'
            if url
            else ""
        )
        items.append(
            f'<li id="ref-{html.escape(key, quote=True)}"><span class="reference-authors">{html.escape(authors)}</span> '
            f'({html.escape(year)}). <cite>{html.escape(title)}</cite>. '
            f'<span class="reference-venue">{html.escape(venue)}</span>.{link}</li>'
        )
    return (
        '<p class="references-intro">以下条目由书稿的 <code>refs.bib</code> 自动生成；正文中的作者—年份引文均链接到这里。</p>'
        f'<ol class="bibliography">{"".join(items)}</ol>'
    )


def ensure_pdf_is_current(pdf_path: Path) -> None:
    if not pdf_path.exists():
        raise RuntimeError("缺少 build/pcselbook.pdf，请先运行 latexmk 重新编译原书。")
    source_files = [SOURCE_ROOT / "refs.bib"]
    source_files.extend(
        path
        for path in SOURCE_ROOT.rglob("*.tex")
        if "knowledge-site" not in path.parts and "build" not in path.parts
    )
    newest = max(source_files, key=lambda path: path.stat().st_mtime)
    if newest.stat().st_mtime > pdf_path.stat().st_mtime:
        raise RuntimeError(f"原书 PDF 已过期：{newest.relative_to(SOURCE_ROOT)} 比 PDF 更新，请先重新编译。")


def optimize_static_images() -> None:
    cover_path = SOURCE_ROOT / "assets" / "cover_center_pcsel.png"
    if cover_path.exists():
        with Image.open(cover_path) as image:
            image.thumbnail((780, 1200), Image.Resampling.LANCZOS)
            image.save(PUBLIC_ROOT / "cover.webp", "WEBP", quality=84, method=6)
    og_path = PUBLIC_ROOT / "og.png"
    if og_path.exists():
        with Image.open(og_path) as image:
            card = ImageOps.fit(image.convert("RGB"), (1200, 630), method=Image.Resampling.LANCZOS)
            card.save(PUBLIC_ROOT / "og.jpg", "JPEG", quality=88, optimize=True, progressive=True)


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    CHAPTER_DATA_ROOT.mkdir(parents=True, exist_ok=True)
    ordered = source_order()
    figure_assets = load_figure_assets()
    bibliography = parse_bib_entries(SOURCE_ROOT / "refs.bib")
    reference_map = build_reference_map(ordered, figure_assets)
    chapter_payloads: list[dict[str, object]] = []
    search_payloads: list[dict[str, object]] = []
    chapter_number = 0
    for order, (part, path) in enumerate(ordered, start=1):
        source = prepared_source(path, figure_assets)
        chapter_title = command_argument(source, "chapter") or path.stem
        title = plain_title(chapter_title)
        slug = path.stem.replace("_", "-")
        if path.parent.name == "chapters":
            chapter_number += 1
        source_body = remove_first_chapter_command(source)
        converter = HtmlConverter(slug, figure_assets, reference_map, bibliography)
        body = converter.fragment(source_body)
        plain = plain_from_html(body)
        anchors = sorted(set(re.findall(r'\bid="([^"]+)"', body)))
        relative_source = path.relative_to(SOURCE_ROOT).as_posix()
        nav_label = str(chapter_number).zfill(2) if path.parent.name == "chapters" else {
            "preface": "前言",
            "figure_index": "索引",
            "notation": "符号",
        }.get(path.stem, "前置")
        metadata: dict[str, object] = {
            "order": order,
            "chapterNumber": chapter_number if path.parent.name == "chapters" else None,
            "navLabel": nav_label,
            "slug": slug,
            "part": part,
            "title": title,
            "sourceUpdated": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).date().isoformat(),
            "headings": converter.headings,
            "anchors": anchors,
            "summary": plain[:220],
        }
        chapter_payloads.append({**metadata, "html": body})
        search_payloads.append({
            "slug": slug,
            "part": part,
            "title": title,
            "text": plain,
            "sections": search_sections(body),
        })

    references_body = render_bibliography(bibliography)
    references_metadata: dict[str, object] = {
        "order": len(chapter_payloads) + 1,
        "chapterNumber": None,
        "navLabel": "参考",
        "slug": "references",
        "part": "附录与索引",
        "title": "参考文献",
        "sourceUpdated": datetime.fromtimestamp((SOURCE_ROOT / "refs.bib").stat().st_mtime, tz=timezone.utc).date().isoformat(),
        "headings": [],
        "anchors": [f"ref-{key}" for key in bibliography],
        "summary": "书稿引用的完整参考文献、DOI 与原文链接。",
    }
    chapter_payloads.append({**references_metadata, "html": references_body})
    search_payloads.append({
        "slug": "references",
        "part": "附录与索引",
        "title": "参考文献",
        "text": plain_from_html(references_body),
        "sections": [],
    })

    pdf_path = SOURCE_ROOT / "build" / "pcselbook.pdf"
    ensure_pdf_is_current(pdf_path)
    shutil.copy2(pdf_path, PUBLIC_ROOT / "book.pdf")
    optimize_static_images()

    for chapter in chapter_payloads:
        chapter_path = CHAPTER_DATA_ROOT / f'{chapter["slug"]}.json'
        chapter_path.write_text(json.dumps(chapter, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    expected_chapter_files = {f'{chapter["slug"]}.json' for chapter in chapter_payloads}
    stale_chapter_files = [path for path in CHAPTER_DATA_ROOT.glob("*.json") if path.name not in expected_chapter_files]
    for stale_path in stale_chapter_files:
        stale_path.unlink()

    all_html = "".join(str(chapter["html"]) for chapter in chapter_payloads)
    pdf_pages = len(PdfReader(str(pdf_path)).pages)
    content_units = len(chapter_payloads)

    payload = {
        "title": "PCSEL 理论、仿真与器件物理导论",
        "author": "Feiyang Wu",
        "edition": "2026",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "pdfPages": pdf_pages,
            "chapters": chapter_number,
            "contentUnits": content_units,
            "figures": len(figure_assets),
            "tables": all_html.count('<table class="book-table"'),
            "displayEquations": all_html.count('class="math-block"'),
            "inlineEquations": all_html.count('class="math-inline"'),
            "references": len(bibliography),
        },
        "chapters": [{key: value for key, value in chapter.items() if key != "html"} for chapter in chapter_payloads],
    }
    MANIFEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    SEARCH_INDEX_PATH.write_text(json.dumps(search_payloads, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {MANIFEST_PATH} ({MANIFEST_PATH.stat().st_size:,} bytes)")
    print(f"Content units: {content_units}; chapters: {chapter_number}; figures: {len(figure_assets)}")
    if stale_chapter_files:
        print(f"Pruned {len(stale_chapter_files)} stale generated chapter files.")


if __name__ == "__main__":
    main()
