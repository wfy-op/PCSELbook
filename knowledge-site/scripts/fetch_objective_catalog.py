"""Save bounded public Thorlabs objective records. No authentication or assets.

Manual collection only; never runs during site startup. Existing lens records
remain untouched. Numeric catalog entries are reviewed against these records.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fetch_thorlabs_catalog import query, API

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'training' / 'objectives'
PARTS = ['RMS4X', 'RMS10X', 'RMS20X', 'RMS40X', 'MY10X-803', 'MY20X-804']


def fetch(part):
    products = query('query { products(storeId:"Thorlabs-Website",currencyCode:"USD",'
                     f'query:"{part}",first:30) {{ items {{ id code }} }} }}')['products']['items']
    item = next(p for p in products if p['code'] == part)
    product = query('query { product(storeId:"Thorlabs-Website",currencyCode:"USD",'
                    f'id:"{item["id"]}") {{ code name familyPageUrlTL '
                    'properties { name value label propertyValueType } '
                    'descriptionsWithFallbacksTL { content reviewType } '
                    'infoIconTabsTL { title content } } }')['product']
    record = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'api': API, 'product': product}
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / f'{part}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'sku': part, 'title': product['name'], 'source': product['familyPageUrlTL'],
                      'properties': product['properties']}, ensure_ascii=False), flush=True)
    return record


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(fetch, PARTS))
    (DEST / 'manifest.json').write_text(json.dumps([{'sku': r['product']['code'],
                                                   'retrievedAt': r['retrievedAt'],
                                                   'record': f"/training/objectives/{r['product']['code']}.json"}
                                                  for r in records], ensure_ascii=False, indent=2), encoding='utf-8')
