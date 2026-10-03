"""Extract only explicitly published nominal specifications; no inferred CAD data."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/training/thorlabs'
catalog = []
for folder in sorted(DEST.iterdir()):
    if not folder.is_dir():
        continue
    spec = json.loads((folder / 'specifications.json').read_text(encoding='utf-8'))
    record = json.loads((folder / 'official-record.json').read_text(encoding='utf-8'))
    title = next(d['content'] for d in spec['descriptionsWithFallbacksTL'] if d['reviewType'] == 'Title')
    focal = float(re.search(r'f\s*=\s*(-?[\d.]+)\s*mm', title)[1])
    diameter = 12.7 if 'Ø1/2"' in title else 25.4 if 'Ø1"' in title else None
    assert diameter is not None, title
    catalog.append(dict(sku=folder.name, title=title, focal=focal, diameter=diameter,
                        kind='doublet' if folder.name.startswith('AC') else 'concave' if focal < 0 else 'convex',
                        coating='400–700 nm' if folder.name.startswith('AC') else '350–700 nm',
                        aperture=round(diameter * .9, 3), apertureBasis='教学假设：外径的 90%，尚未核验厂家通光孔径',
                        thickness=None, backFocalLength=None,
                        source='https://www.thorlabs.com' + record['product']['familyPageUrlTL'] + '?pn=' + folder.name,
                        record=f'/training/thorlabs/{folder.name}/specifications.json',
                        engineeringRecord=f'/training/thorlabs/{folder.name}/official-record.json',
                        retrievedAt=record['retrievedAt']))
text = json.dumps(catalog, ensure_ascii=False, indent=2) + '\n'
(ROOT / 'app/training/thorlabs-catalog.json').write_text(text, encoding='utf-8')
(DEST / 'catalog.json').write_text(text, encoding='utf-8')
with (DEST / 'catalog.csv').open('w', encoding='utf-8-sig', newline='') as out:
    writer = csv.DictWriter(out, fieldnames=catalog[0].keys())
    writer.writeheader()
    writer.writerows(catalog)
print(f'Built {len(catalog)} nominal-specification entries; CAD dimensions remain unverified.')
