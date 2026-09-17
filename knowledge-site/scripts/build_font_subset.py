from __future__ import annotations

import os
import string
from pathlib import Path

from fontTools.subset import Options, Subsetter, load_font, save_font


SITE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FONT = Path(r"C:\Windows\Fonts\NotoSansSC-VF.ttf")
SOURCE_FONT = Path(os.environ.get("PCSEL_NOTO_SANS_SC_PATH", DEFAULT_FONT))
OUTPUT_DIRECTORY = SITE_ROOT / "public" / "fonts"
OUTPUT_FONT = OUTPUT_DIRECTORY / "noto-sans-sc-pcsel.woff2"
NOTICE_PATH = OUTPUT_DIRECTORY / "noto-sans-sc-NOTICE.txt"


def source_files() -> list[Path]:
    files = [
        SITE_ROOT / "index.html",
        SITE_ROOT / "app" / "BookSite.tsx",
        SITE_ROOT / "app" / "globals.css",
        SITE_ROOT / "public" / "data" / "book-manifest.json",
        SITE_ROOT / "public" / "data" / "search-index.json",
    ]
    files.extend(sorted((SITE_ROOT / "public" / "data" / "chapters").glob("*.json")))
    return [path for path in files if path.exists()]


def character_set() -> set[int]:
    characters = set(string.printable)
    characters.update("—–·…“”‘’、。，；：？！《》〈〉（）【】±×÷≈∞℃°μΓΔΛΣΦΨΩαβγδεζηθικλμνξοπρστυφχψω")
    for path in source_files():
        characters.update(path.read_text(encoding="utf-8"))
    return {ord(character) for character in characters if ord(character) >= 0x20}


def name_value(font, name_id: int) -> str:
    for record in font["name"].names:
        if record.nameID == name_id:
            try:
                return record.toUnicode().strip()
            except UnicodeDecodeError:
                continue
    return ""


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    if not SOURCE_FONT.exists():
        if OUTPUT_FONT.exists():
            print(f"Noto Sans SC source font unavailable; keeping {OUTPUT_FONT.name}.")
            return
        raise RuntimeError(
            "Noto Sans SC variable font not found. Set PCSEL_NOTO_SANS_SC_PATH "
            "to a local NotoSansSC variable font file."
        )

    options = Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17, 25]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.recalc_average_width = True

    font = load_font(str(SOURCE_FONT), options)
    copyright_text = name_value(font, 0)
    license_text = name_value(font, 13)
    license_url = name_value(font, 14) or "https://openfontlicense.org/"

    subsetter = Subsetter(options=options)
    unicodes = character_set()
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    save_font(font, str(OUTPUT_FONT), options)

    notice = (
        "Noto Sans SC subset used by the PCSEL knowledge site.\n\n"
        f"Source: {SOURCE_FONT.name}\n"
        f"Characters requested: {len(unicodes)}\n"
        f"Copyright: {copyright_text}\n"
        f"License: {license_text}\n"
        f"License URL: {license_url}\n"
    )
    NOTICE_PATH.write_text(notice, encoding="utf-8")
    print(
        f"Wrote {OUTPUT_FONT} ({OUTPUT_FONT.stat().st_size:,} bytes; "
        f"{len(unicodes):,} requested characters)."
    )


if __name__ == "__main__":
    main()
