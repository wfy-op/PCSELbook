"""Download public product specification HTML (read-only, no sign-in)."""
import json
from concurrent.futures import ThreadPoolExecutor
from fetch_thorlabs_catalog import DEST, query, PARTS

def fetch(part):
    items = query('query { products(storeId:"Thorlabs-Website",currencyCode:"USD",'
                  f'query:"{part}",first:30) {{ items {{ id code }} }} }}')['products']['items']
    item = next(i for i in items if i['code'] == part)
    result = query('query { product(storeId:"Thorlabs-Website",currencyCode:"USD",'
                   f'id:"{item["id"]}") {{ code dataSheetUrlTL '
                   'descriptionsWithFallbacksTL { content reviewType } '
                   'infoIconTabsTL { title content } } }')['product']
    (DEST / part / 'specifications.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print(part, 'public specifications saved', flush=True)

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(fetch, PARTS))
