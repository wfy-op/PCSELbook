"""Inspect every source-rendered figure; preserve glyph-level findings and atlas.

TeX reuses one PDF text trace across several lines. Split traces at baseline
changes before collision testing instead of assigning a whole trace to each line.
The existing scientific-figure auditor still supplies stroke geometry and tests.
"""
import argparse
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audit-module', type=Path, required=True)
    parser.add_argument('--suffix', default='current')
    parser.add_argument('--detail-pages', type=int, nargs='*', default=[])
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('collision_engine', args.audit_module)
    audit = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = audit
    spec.loader.exec_module(audit)
    pdf = ROOT / 'outputs/figure-render/all_figures.pdf'
    out = ROOT / 'outputs/figure-audit'
    out.mkdir(exist_ok=True, parents=True)
    doc = fitz.open(pdf)
    for number in args.detail_pages:
        if not 1 <= number <= len(doc):
            raise ValueError(f'Figure page out of range: {number}')
        doc[number-1].get_pixmap(matrix=fitz.Matrix(2.4,2.4),alpha=False).save(out/f'{args.suffix}-figure-{number:02d}.png')
    geometries = audit.extract_pdf_geometry(pdf)
    for page, geometry in zip(doc, geometries):
        texts = []
        for trace in page.get_texttrace():
            current = []
            def flush():
                if current:
                    text = ''.join(chr(c[0]) for c in current if c[0] >= 0).strip()
                    if text:
                        texts.append(audit.TextBox(len(texts), text, audit.union_rects(c[3] for c in current)))
            for char in trace['chars']:
                if current:
                    prev = current[-1]
                    if abs(char[2][1] - prev[2][1]) > 0.3 or char[2][0] < prev[2][0] - .1 or char[3][0] - prev[3][2] > trace['size']:
                        flush()
                        current = []
                current.append(char)
            flush()
        geometry.texts = texts
    result = audit.audit_geometries(geometries)
    manifest = list(json.loads((ROOT/'public/figures/manifest.json').read_text(encoding='utf8'))['figures'].items())
    result['figure_labels'] = {str(i): entry[0] for i, entry in enumerate(manifest, 1)}
    (out/f'{args.suffix}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
    for start in range(0, len(doc), 8):
        canvas = Image.new('RGB', (1800, 1600), 'white')
        draw = ImageDraw.Draw(canvas)
        for j, page in enumerate(list(doc)[start:start+8]):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.8,1.8), alpha=False)
            img = Image.frombytes('RGB', (pix.width,pix.height),pix.samples)
            img.thumbnail((870,355))
            x,y=(j%2)*900, (j//2)*400
            canvas.paste(img, (x+(900-img.width)//2,y+30))
            draw.text((x+12,y+8), f'{start+j+1:02d}  {manifest[start+j][0]}',fill='black')
        canvas.save(out/f'{args.suffix}-sheet-{start//8+1:02d}.png')
    counts = Counter(f['page'] for f in result['findings'] if f['severity']=='FAIL')
    print(json.dumps({'summary':result['summary'],'pages':{str(p):{'label':manifest[p-1][0],'fail':n} for p,n in sorted(counts.items())}},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
