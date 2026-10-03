/** Focused browser acceptance against a running service, disposable storage.
 * Uses the same PCSEL_PLAYWRIGHT_MODULE / PCSEL_OPTICS_URL variables as qa:optics.
 * One batched desktop/mobile capture. --no-screenshots verifies without images.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PCSEL_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.PCSEL_OPTICS_URL || 'http://127.0.0.1:5175').replace(/\/+$/, '');
const output = path.resolve(fileURLToPath(new URL('../', import.meta.url)), process.env.PCSEL_OBJECTIVES_QA_OUTPUT || 'outputs/objectives-qa');
await fs.mkdir(output, { recursive: true });
const results = { checkedAt: new Date().toISOString(), checks: [], pageErrors: [], screenshots: [] };
const browser = await chromium.launch({ channel: process.env.PCSEL_OPTICS_BROWSER_CHANNEL || 'msedge', headless: true });
const spatialKey = 'pcsel-folded-optics-draft-v1';
const sequentialKey = 'pcsel-optics-designer-draft-v2';
let page;
const spatial = () => page.locator('#od-spatial-panel');
const sequential = () => page.locator('#od-sequential-panel');
async function stored(key) { return JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)); }
const scene = async () => (await stored(spatialKey)).scene;
async function reveal(locator) {
  if (await locator.isVisible()) return;
  for (const details of (await locator.locator('xpath=ancestor::details').all()).reverse()) {
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  }
  await locator.waitFor({ state: 'visible' });
}
async function number(locator, value) { await reveal(locator); await locator.fill(String(value)); await locator.press('Tab'); }
async function check(name, action) {
  try { await action(); results.checks.push({ name, status: 'pass' }); console.log(`PASS ${name}`); }
  catch (error) { results.checks.push({ name, status: 'fail', error: error.message }); console.log(`FAIL ${name}: ${error.message}`); throw error; }
}
async function capture(label, panel) {
  if (process.argv.includes('--no-screenshots')) return;
  for (const menu of await panel.locator('.od-file-menu[open]').all()) await menu.locator(':scope > summary').click();
  await panel.locator('#fd-layout-svg, #od-layout-svg').scrollIntoViewIfNeeded();
  const file = `${label}.png`;
  await page.screenshot({ path: path.join(output, file) });
  results.screenshots.push(file);
}
async function download(button, filename) {
  await reveal(button);
  const [result] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const destination = path.join(output, filename);
  await result.saveAs(destination);
  return fs.readFile(destination, 'utf8');
}
try {
  for (const viewport of [{ width: 1420, height: 1000, label: 'desktop' }, { width: 390, height: 844, label: 'mobile' }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    page = await context.newPage();
    page.on('pageerror', error => results.pageErrors.push(error.message));
    await page.goto(`${base}/optics/designer/`, { waitUntil: 'networkidle', timeout: 30000 });
    await spatial().locator('#fd-layout-svg').waitFor();
    await check(`${viewport.label}: detector labels agree across diagram, cards, selector and scan`, async () => {
      const texts = await spatial().locator('#fd-layout-svg text').allTextContents();
      assert.ok(texts.some(t => /^D1\b/.test(t)) && texts.some(t => /^D2\b/.test(t)));
      assert.deepEqual(await spatial().locator('.obj-detector-tag').allTextContents(), ['D1', 'D2']);
      assert.match(await spatial().getByLabel('选择空间元件').textContent(), /D1 · 探测面/);
      assert.match(await spatial().getByLabel('空间扫描目标探测器').textContent(), /D2 · 探测面/);
    });
    await check(`${viewport.label}: rename and duplicate retain distinguishable detector numbers`, async () => {
      await spatial().getByLabel('选择空间元件').selectOption('detector-t');
      const name = spatial().getByRole('textbox', { name: '空间元件名称', exact: true, includeHidden: true });
      await reveal(name); await name.fill('相机 A'); await name.press('Tab');
      await spatial().getByRole('button', { name: '复制元件', exact: true }).click();
      assert.deepEqual(await spatial().locator('.obj-detector-tag').allTextContents(), ['D1', 'D2', 'D3']);
      assert.match(await spatial().getByLabel('选择空间元件').textContent(), /D3 · 相机 A 副本/);
    });
    await check(`${viewport.label}: objective-plus-tube template computes a one mm image`, async () => {
      await spatial().getByLabel('载入空间模板').selectOption('objective');
      const s = await scene(); assert.equal(s.elements[0].focal, 18); assert.equal(s.elements[0].objective.workingDistance, 10.6);
      assert.match(await spatial().locator('.fd-detector-card').textContent(), /范围1\.000 mm/);
      const sourceLabel = await spatial().locator('#fd-layout-svg text').filter({ hasText: /^光源$/ }).boundingBox();
      const objectiveLabel = await spatial().locator('#fd-layout-svg text').filter({ hasText: /^1(?: · 等效物镜)?$/ }).boundingBox();
      assert.ok(sourceLabel && objectiveLabel && sourceLabel.y > objectiveLabel.y + objectiveLabel.height, 'source and objective labels overlap');
    });
    await check(`${viewport.label}: 40X objective is available with f4.5 and WD0.6`, async () => {
      const button = spatial().getByRole('button', { name: '加入物镜 RMS40X', exact: true, includeHidden: true });
      await reveal(button); await button.click();
      const optic = (await scene()).elements.at(-1);
      assert.equal(optic.kind, 'objective'); assert.equal(optic.focal, 4.5); assert.equal(optic.objective.workingDistance, .6);
      await reveal(spatial().getByLabel('物镜规格与输入输出'));
      assert.match(await spatial().getByLabel('物镜规格与输入输出').textContent(), /物镜怎样改变光束/);
    });
    await check(`${viewport.label}: edit, undo and reload preserve objective provenance correctly`, async () => {
      const id = (await scene()).elements.at(-1).id;
      await number(spatial().getByLabel('物镜等效焦距'), 5);
      assert.equal((await scene()).elements.at(-1).objective.catalogSku, undefined);
      assert.match(await spatial().getByLabel('物镜规格与输入输出').textContent(), /自定义等效物镜/);
      await spatial().getByRole('button', { name: '撤销', exact: true }).click();
      assert.equal((await scene()).elements.at(-1).objective.catalogSku, 'RMS40X');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await scene()).elements.at(-1).focal, 4.5);
      await spatial().getByLabel('选择空间元件').selectOption(id);
    });
    await check(`${viewport.label}: spatial JSON and HTML retain objective data and D labels`, async () => {
      const text = await download(spatial().getByRole('button', { name: '导出 JSON', exact: true, includeHidden: true }), `${viewport.label}-spatial.json`);
      const file = JSON.parse(text); assert.equal(file.scene.elements.at(-1).objective.catalogSku, 'RMS40X');
      const html = await download(spatial().getByRole('button', { name: '导出 HTML 报告', exact: true, includeHidden: true }), `${viewport.label}-spatial.html`);
      assert.match(html, /D1 · 探测面/); assert.match(html, /物镜参考规格与等效模型/);
    });
    await spatial().getByLabel('载入空间模板').selectOption('objective');
    await spatial().getByLabel('选择空间元件').selectOption('objective-1');
    await capture(`${viewport.label}-spatial`, spatial());
    await page.locator('#od-sequential-tab').click();
    await check(`${viewport.label}: sequential objective template and catalog are available`, async () => {
      await sequential().getByLabel('载入光路模板').selectOption('objective');
      const category = sequential().getByLabel('透镜类型'); await reveal(category); await category.selectOption('objective');
      assert.equal(await sequential().getByRole('button', { name: /^加入物镜 /, includeHidden: true }).count(), 6);
      const button = sequential().getByRole('button', { name: '加入物镜 RMS40X', exact: true }); await button.click();
      assert.equal((await stored(sequentialKey)).project.elements.at(-1).focal, 4.5);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await stored(sequentialKey)).project.elements.at(-1).objective.catalogSku, 'RMS40X');
    });
    await check(`${viewport.label}: conversion preserves an objective and its reference data`, async () => {
      await sequential().getByRole('button', { name: '复制到空间光路', exact: true }).click();
      const s = await scene();
      assert.equal(s.elements.at(-2).kind, 'objective'); assert.equal(s.elements.at(-2).objective.catalogSku, 'RMS40X');
      await page.locator('#od-sequential-tab').click();
    });
    await sequential().getByLabel('载入光路模板').selectOption('objective');
    await sequential().locator('#od-layout-svg [aria-label^="选择"]').first().click();
    await capture(`${viewport.label}-sequential`, sequential());
    await check(`${viewport.label}: page reflows without horizontal overflow`, async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `horizontal overflow: ${overflow}`);
    });
    await context.close();
  }
  assert.equal(results.pageErrors.length, 0, results.pageErrors.join('\n'));
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${results.checks.filter(c => c.status === 'pass').length}/${results.checks.length} checks passed; ${results.pageErrors.length} page errors`);
}
