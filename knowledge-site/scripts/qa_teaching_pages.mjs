import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const runtime = process.env.PLAYWRIGHT_RUNTIME;
const loadPackage = createRequire(runtime ? path.join(runtime, 'package.json') : import.meta.url);
const { chromium } = loadPackage('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const output = path.resolve('outputs/sep17-browser-qa');
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  for (const [name, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const slug of ['', 'chapters/ch05-band-gamma-mode-selection/', 'chapters/ch08-polarization-symmetry-farfield/']) {
      await page.goto(`http://127.0.0.1:4174/${slug}`, { waitUntil: 'networkidle' });
      await page.locator(slug ? '.chapter-view' : '.pcsel-name-parts').waitFor();
      await page.evaluate(async () => {
        await Promise.all([...document.images].map(image => {
          image.loading = 'eager';
          return image.decode().catch(() => {});
        }));
      });
      const result = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        missingImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
        title: document.querySelector('main h1')?.textContent,
        formulaErrors: document.querySelectorAll('.katex-error').length
      }));
      if (result.scrollWidth > result.width + 1 || result.missingImages.length || result.formulaErrors || errors.length) {
        await browser.close();
        throw new Error(JSON.stringify({ name, slug, result, errors }));
      }
      await page.screenshot({ path: path.join(output, `${name}-${slug ? slug.split('/')[1] : 'home'}.png`), fullPage: !slug });
      results.push({ name, slug, ...result, errors });
    }
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
