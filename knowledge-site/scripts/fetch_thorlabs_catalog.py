"""Read-only download of public Thorlabs product records and linked engineering files.

No account, cookies, order APIs, or inferred attachment URLs. Files come from URLs
returned by the official storefront. Run manually; never part of site startup.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'training' / 'thorlabs'
DEST.mkdir(parents=True, exist_ok=True)
API = 'https://www.thorlabs.com/graphql'
PARTS = ['LA1131-A', 'LA1608-A', 'LA1509-A', 'LA1433-A', 'LA1708-A',
         'LC1715-A', 'LC1582-A', 'LC1120-A', 'AC254-050-A', 'AC254-100-A',
         'LA1540-A', 'LA1213-A']

def query(text):
    req = urllib.request.Request(API, data=json.dumps({'query': text}).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.load(response)
    if result.get('errors'):
        raise RuntimeError(result['errors'])
    return result['data']

def fetch(part):
    items = query('query { products(storeId:"Thorlabs-Website",currencyCode:"USD",'
                  f'query:"{part}",first:30) {{ items {{ id code }} }} }}')['products']['items']
    item = next((item for item in items if item['code'] == part), None)
    if not item:
        raise RuntimeError(f'Exact part not returned: {part}')
    product = query('query { product(storeId:"Thorlabs-Website",currencyCode:"USD",'
                    f'id:"{item["id"]}") {{ code name familyPageUrlTL '
                    'properties { name value label propertyValueType } '
                    'assets { name url optiUrl size description } } }')['product']
    folder = DEST / part
    folder.mkdir(exist_ok=True)
    files = []
    for asset in product['assets']:
        extension = Path(asset['name']).suffix.lower()
        if extension not in ['.pdf', '.zmx', '.step']:
            continue
        url = asset['optiUrl'] or asset['url']
        if not url.startswith('https://media.thorlabs.com/'):
            continue
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read()
        except Exception:
            # Both addresses are supplied by the public official product record.
            url = asset['url']
            try:
                with urllib.request.urlopen(url, timeout=30) as response:
                    data = response.read()
            except Exception as error:
                files.append({'name': asset['name'], 'url': url, 'error': str(error)})
                continue
        if extension == '.pdf' and not data.startswith(b'%PDF'):
            raise RuntimeError(f'Not a PDF: {url}')
        if extension == '.step' and b'ISO-10303' not in data[:100]:
            raise RuntimeError(f'Not STEP: {url}')
        filename = Path(asset['name']).name
        (folder / filename).write_bytes(data)
        files.append({'name': filename, 'url': url, 'bytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest(),
                      'local': f'/training/thorlabs/{part}/{filename}'})
    record = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'api': API,
              'product': product, 'downloads': files}
    (folder / 'official-record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    successful = sum('local' in item for item in files)
    print(f'{part}: product record saved; {successful}/{len(files)} engineering files downloaded', flush=True)
    return record

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(fetch, PARTS))
    (DEST / 'download-manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    successful = sum('local' in file for record in records for file in record['downloads'])
    print(f'Saved {len(records)} official product records and {successful} engineering files. Inspect manifest for failures.')
