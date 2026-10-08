/** Regression for the five reviewed usability defects, disposable storage only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PCSEL_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.PCSEL_OPTICS_URL || 'http://127.0.0.1:5175').replace(/\/+$/, '');
const out = fileURLToPath(new URL('../outputs/optics-workbench/usability/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PCSEL_OPTICS_BROWSER_CHANNEL || 'msedge', headless: true });
const result = { checkedAt: new Date().toISOString(), base, checks: [], pageErrors: [] };
async function check(name, run) { const detail = await run(); result.checks.push({ name, status: 'pass', detail }); console.log('PASS ' + name); }
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', e => result.pageErrors.push(e.message));
    await page.goto(base + '/optics/designer/', { waitUntil: 'networkidle' });
    const spatial = page.locator('#od-spatial-panel');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('pcsel-folded-optics-draft-v1')).scene);
    const select = id => spatial.getByLabel('选择空间元件', { exact: true }).selectOption(id);
    const close = async () => { const b = spatial.getByRole('button', { name: '返回光路', exact: true }); if (await b.isVisible()) await b.click(); };
    await check(width + ': parameters do not move canvas and results remain accessible', async () => {
      await close();
      const before = await spatial.locator('#fd-layout-svg').evaluate(el => el.getBoundingClientRect().top + scrollY);
      await select('lens-t');
      const after = await spatial.locator('#fd-layout-svg').evaluate(el => el.getBoundingClientRect().top + scrollY);
      if (width < 1100) { assert.ok(Math.abs(after - before) < 1); assert.equal(await spatial.locator('.fd-inspector').evaluate(el => getComputedStyle(el).position), 'fixed'); }
      if (width >= 1100) {
        await spatial.locator('.fd-detector-card').nth(1).scrollIntoViewIfNeeded();
        const b = await page.evaluate(() => { const a = document.querySelector('.fd-inspector').getBoundingClientRect(), d = document.querySelector('.fd-results').getBoundingClientRect(); return { bottom: a.bottom, resultsTop: d.top }; });
        assert.ok(b.bottom <= b.resultsTop + 1, JSON.stringify(b));
      }
      await select('detector-r');
      const preview = spatial.getByLabel('参数预览探测器', { exact: true });
      assert.equal(await preview.inputValue(), 'detector-r');
      await preview.selectOption('detector-t');
      assert.equal(await preview.inputValue(), 'detector-t');
      await close();
      return { canvasDocumentTopBefore: before, after };
    });
    await check(width + ': blank scene additions are visible without fitting', async () => {
      await spatial.getByLabel('载入空间模板').selectOption('blank');
      await spatial.getByRole('button', { name: '元件库', exact: true }).click();
      const library = spatial.getByRole('region', { name: '光学装备库', exact: true });
      await library.getByLabel('搜索光学装备').fill('完美薄透镜');
      await library.locator('.eq-item-toggle').filter({ hasText: '完美薄透镜' }).click();
      await library.getByRole('button', { name: '加入 lens', exact: true }).click();
      await close();
      const box = await spatial.locator('#fd-layout-svg').evaluate(svg => {
        const outer = svg.getBoundingClientRect(), el = svg.querySelectorAll('.fd-svg-part')[1].getBoundingClientRect();
        return { visible: el.left < outer.right && el.right > outer.left && el.top < outer.bottom && el.bottom > outer.top };
      });
      assert.equal(box.visible, true); return box;
    });
    await check(width + ': invalid focal values remain visible and do not mutate engineering state', async () => {
      const id = (await saved()).elements[0].id; await select(id);
      const field = spatial.getByLabel('薄透镜焦距', { exact: true });
      for (const value of ['0', '90000', '']) {
        await field.fill(value); await field.press('Enter');
        assert.equal(await field.getAttribute('aria-invalid'), 'true');
        assert.equal((await saved()).elements[0].focal, 100);
        assert.equal(await field.inputValue(), value);
      }
      await field.press('Escape'); assert.equal(await field.inputValue(), '100');
      await field.fill('125'); await field.press('Enter'); assert.equal((await saved()).elements[0].focal, 125);
      await close();
    });
    await check(width + ': malformed imports give Chinese recovery guidance', async () => {
      await spatial.locator('.od-file-menu > summary').click();
      await spatial.getByRole('button', { name: '导入', exact: true }).click();
      const before = await saved(), dialog = page.getByRole('dialog');
      await dialog.getByLabel('空间工程 JSON').fill('{bad'); await dialog.getByRole('button', { name: '导入工程', exact: true }).click();
      assert.match(await dialog.getByRole('alert').textContent(), /JSON 格式不正确.*当前工程未修改/);
      assert.deepEqual(await saved(), before); await dialog.getByRole('button', { name: '取消', exact: true }).click();
      await spatial.locator('.od-file-menu > summary').click();
    });
    await check(width + ': actual sampling count and zero reception are explained', async () => {
      await spatial.getByLabel('载入空间模板').selectOption('ellipse'); await select('source');
      const input = spatial.getByLabel('采样精度', { exact: true }); await input.fill('25'); await input.press('Enter');
      assert.match(await spatial.locator('.fd-sample-count').textContent(), /625 条/);
      const direction = spatial.getByLabel('传播方向', { exact: true }); await direction.fill('180'); await direction.press('Enter');
      await close();
      assert.ok(await spatial.locator('.fd-no-reception:visible').count() > 0);
      assert.match(await spatial.locator('.fd-reception-guide').first().textContent(), /光源传播方向.*通光孔径.*位置与法线/);
      assert.equal(await spatial.locator('.fd-detector-card canvas:visible').count(), 0);
    });
    await spatial.getByLabel('载入空间模板').selectOption('split'); await select('lens-t');
    await spatial.locator('#fd-layout-svg').scrollIntoViewIfNeeded();
    if (!process.argv.includes('--no-screenshots')) await page.screenshot({ path: path.join(out, width + '.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await context.close();
  }
  assert.deepEqual(result.pageErrors, []);
  result.status = 'pass';
} catch (e) { result.status = 'fail'; result.error = e.message; throw e; }
finally { await fs.writeFile(path.join(out, 'validation.json'), JSON.stringify(result, null, 2), 'utf8'); await browser.close(); }
