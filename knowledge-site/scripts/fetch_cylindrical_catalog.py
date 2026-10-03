"""Collect bounded, public Thorlabs cylindrical-lens product records.

Run manually; no site-startup dependency, account, cookies, or inferred asset
URLs. Only the .zmx file returned by the official API is downloaded.
"""
import json
import hashlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from fetch_thorlabs_catalog import API, query

DEST = Path(__file__).resolve().parents[1] / 'public' / 'training' / 'cylindrical'
PARTS = ['LJ1695RM-A', 'LJ1567RM-A', 'LJ1653RM-B']


def fetch(sku):
    result = query('query { products(storeId:"Thorlabs-Website",currencyCode:"USD",'
                   f'query:"{sku}",first:30) {{ items {{ id code }} }} }}')['products']['items']
    part = next(p for p in result if p['code'] == sku)
    product = query('query { product(storeId:"Thorlabs-Website",currencyCode:"USD",'
                    f'id:"{part["id"]}") {{ code name familyPageUrlTL '
                    'properties { name value label propertyValueType } '
                    'descriptionsWithFallbacksTL { content reviewType } '
                    'assets { name url optiUrl size description } } }')['product']
    DEST.mkdir(parents=True, exist_ok=True)
    downloads = []
    for asset in product['assets']:
        if Path(asset['name']).suffix.lower() != '.zmx':
            continue
        urls = list(dict.fromkeys([asset['optiUrl'], asset['url']]))
        error = None
        for url in urls:
            if not url or not url.startswith('https://'):
                continue
            try:
                with urllib.request.urlopen(url, timeout=30) as response:
                    data = response.read(1024 * 1024 + 1)
                if len(data) > 1024 * 1024:
                    raise RuntimeError('ZMX asset exceeds bounded 1 MiB download.')
                text = data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8')
                if 'VERS' not in text or 'SURF' not in text:
                    raise RuntimeError('The asset is not a text Zemax prescription.')
                filename = f'{sku}.zmx'
                (DEST / filename).write_bytes(data)
                downloads.append({'name': asset['name'], 'url': url, 'bytes': len(data),
                                  'sha256': hashlib.sha256(data).hexdigest(),
                                  'local': f'/training/cylindrical/{filename}'})
                break
            except Exception as exc:
                error = str(exc)
        else:
            downloads.append({'name': asset['name'], 'error': error or 'No official HTTPS URL.'})
    record = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'api': API,
              'product': product, 'downloads': downloads,
              'verificationNote': 'Nominal focal length, optic diameter, and coating band are verified against the current official product title. Conservative 21 mm clear aperture is the historical catalog lower bound, not a measured value. No optical prescription is used by the ideal model.'}
    (DEST / f'{sku}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    title = next((d['content'] for d in product['descriptionsWithFallbacksTL'] if d['reviewType'] == 'Title'), product['name'])
    print(json.dumps({'sku': sku, 'title': title, 'source': product['familyPageUrlTL'],
                      'properties': product['properties'], 'downloads': downloads}, ensure_ascii=False), flush=True)
    return record


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(fetch, PARTS))
    (DEST / 'manifest.json').write_text(json.dumps([
        {'sku': r['product']['code'], 'retrievedAt': r['retrievedAt'],
         'record': f"/training/cylindrical/{r['product']['code']}.json"}
        for r in records], ensure_ascii=False, indent=2), encoding='utf-8')
