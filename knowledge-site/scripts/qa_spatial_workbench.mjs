/**
 * Acceptance against the running Optical Lab using disposable browser contexts.
 * PCSEL_PLAYWRIGHT_MODULE, PCSEL_OPTICS_URL and PCSEL_OPTICS_BROWSER_CHANNEL match
 * qa:optics; PCSEL_SPATIAL_QA_OUTPUT defaults to outputs/optics-workbench/browser.
 * One final batch of six screenshots; --no-screenshots performs assertions only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, traceFoldedScene } from '../app/design/core/folded-engine.ts';

const { chromium } = await import(process.env.PCSEL_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.PCSEL_OPTICS_URL || 'http://127.0.0.1:5175').replace(/\/+$/, '');
const output = path.resolve(fileURLToPath(new URL('../', import.meta.url)), process.env.PCSEL_SPATIAL_QA_OUTPUT || 'outputs/optics-workbench/browser');
await fs.mkdir(output, { recursive: true });
const results = { checkedAt: new Date().toISOString(), base, checks: [], pageErrors: [], screenshots: [] };
const browser = await chromium.launch({ channel: process.env.PCSEL_OPTICS_BROWSER_CHANNEL || 'msedge', headless: true });
const spatialKey = 'pcsel-folded-optics-draft-v1';
const sequentialKey = 'pcsel-optics-designer-draft-v2';
let page;
const spatial = () => page.locator('#od-spatial-panel');
const sequential = () => page.locator('#od-sequential-panel');
const near = (actual, expected, tolerance = .0006) => assert.ok(Math.abs(actual - expected) <= tolerance, String(actual) + ' != ' + expected);
async function stored(key) { return JSON.parse(await page.evaluate(k => localStorage.getItem(k), key)); }
const scene = async () => (await stored(spatialKey)).scene;
async function reveal(locator) {
  if (await locator.isVisible()) return;
  const show = spatial().getByRole('button', { name: '显示参数', exact: true });
  if (await show.isVisible()) await show.click();
  for (const details of (await locator.locator('xpath=ancestor::details').all()).reverse()) {
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  }
  await locator.waitFor({ state: 'visible' });
}
async function number(locator, value) { await reveal(locator); await locator.fill(String(value)); await locator.press('Tab'); }
async function select(id) { await spatial().getByLabel('选择空间元件', { exact: true }).selectOption(id); }
async function check(name, action) {
  try {
    const detail = await action();
    results.checks.push({ name, status: 'pass', ...(detail === undefined ? {} : { detail }) });
    console.log('PASS ' + name);
  } catch (error) {
    results.checks.push({ name, status: 'fail', error: error.message });
    console.log('FAIL ' + name + ': ' + error.message);
    throw error;
  }
}
async function download(button, filename) {
  await reveal(button);
  const [result] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const destination = path.join(output, filename);
  await result.saveAs(destination);
  return fs.readFile(destination, 'utf8');
}
async function importScene(next) {
  const open = spatial().getByRole('button', { name: '导入', exact: true, includeHidden: true });
  await reveal(open); await open.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('空间工程 JSON', { exact: true }).fill(JSON.stringify({ format: 'pcsel-folded-optics', formatVersion: 1, scene: next }));
  await dialog.getByRole('button', { name: '导入工程', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await scene(), next);
}
function beamFixture({ cylinder = false, detectorX = 350, rayCount = 25, rotate = 0 } = {}) {
  const s = blankFoldedScene();
  return {
    ...s, name: 'Browser QA · actual two-axis trace',
    source: { ...s.source, diameter: 8, fullAngle: 0, rayCount,
      beam: { profile: 'gaussian', diameterMinor: 4, fullAngleMinor: 0, rotationDeg: rotate } },
    elements: [
      { ...foldedElement(cylinder ? 'cylindrical' : 'lens', 'qa-lens', 250, 150), name: 'QA 透镜' },
      { ...foldedElement('detector', 'qa-detector', detectorX, 150), name: 'QA 相机', diameter: 100, aperture: 100 },
      { ...foldedElement('iris', 'qa-ruler', 250, 250), name: 'QA 标尺元件', diameter: 1, aperture: 1 },
    ],
  };
}
async function readSpot(index = 0) {
  const card = spatial().locator('.fd-detector-card').nth(index);
  const entries = await card.locator('dl > div').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
  const values = text => (text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || []).map(Number);
  return {
    rmsU: values(entries['RMS u / v'])[0], rmsV: values(entries['RMS u / v'])[1],
    rms2D: values(entries['二维 RMS'])[0], centroid: values(entries['质心 u / v']),
    power: values(entries['接收功率'])[0], entries,
  };
}
async function verifySpot(index = 0) {
  const s = await scene(), d = traceFoldedScene(s).detectors[index], ui = await readSpot(index);
  near(ui.power, d.power); near(ui.rmsU, d.spot.rmsU); near(ui.rmsV, d.spot.rmsV); near(ui.rms2D, d.spot.rms2D);
  near(ui.centroid[0], d.spot.centroidU); near(ui.centroid[1], d.spot.centroidV);
  return { displayed: ui, computed: { power: d.power, rmsU: d.spot.rmsU, rmsV: d.spot.rmsV, rms2D: d.spot.rms2D } };
}
async function pickEquipment(query, identifier) {
  await spatial().getByRole('button', { name: '元件库', exact: true }).click();
  const library = spatial().getByRole('region', { name: '光学装备库', exact: true });
  await library.getByLabel('搜索光学装备', { exact: true }).fill(query);
  await library.locator('.eq-item-toggle').filter({ hasText: identifier === 'lens' ? '完美薄透镜' : identifier }).click();
  await library.getByRole('button', { name: '加入 ' + identifier, exact: true }).click();
  await spatial().locator('.fd-equipment-drawer').waitFor({ state: 'hidden' });
}
async function canvasGeometry() {
  return spatial().locator('#fd-layout-svg').evaluate(svg => {
    const box = svg.getBoundingClientRect(), grid = document.getElementById('fd-workspace').getBoundingClientRect();
    const pattern = svg.querySelector('pattern'), ctm = svg.getScreenCTM();
    return { width: box.width, height: box.height, workWidth: grid.width,
      ratio: box.width / grid.width, svgScaleX: ctm.a, svgScaleY: ctm.d,
      gridX: Number(pattern.getAttribute('width')), gridY: Number(pattern.getAttribute('height')),
      paths: [...svg.querySelectorAll('path[stroke="#c78310"],path[stroke="#2870a2"]')].filter(p => p.getAttribute('d').match(/^M.+L.+/)).length };
  });
}
async function capture(label, target, elementOnly = false) {
  if (process.argv.includes('--no-screenshots')) return;
  for (const menu of await page.locator('.od-file-menu[open]').all()) await menu.locator(':scope > summary').click();
  await target.scrollIntoViewIfNeeded();
  const file = label + '.png';
  if (elementOnly) await target.screenshot({ path: path.join(output, file) });
  else await page.screenshot({ path: path.join(output, file) });
  results.screenshots.push(file);
}
async function optimizerCheck(label) {
  const input = beamFixture({ detectorX: 380, rayCount: 65 });
  await importScene(input); await page.reload({ waitUntil: 'networkidle' });
  const optimize = spatial().locator('.fd-optimizer');
  await optimize.locator(':scope > summary').click();
  await number(optimize.getByLabel('优化最低接收份额', { exact: true }), 90);
  await number(optimize.getByLabel('优化追迹预算', { exact: true }), 600);
  await optimize.getByRole('button', { name: '计算优化候选', exact: true }).click();
  const stop = optimize.getByRole('button', { name: '停止计算', exact: true });
  await stop.waitFor({ state: 'visible' }); await stop.click();
  await optimize.getByRole('status').filter({ hasText: /已停止，完成/ }).waitFor();
  assert.deepEqual(await scene(), input, 'cancelling must not mutate the draft');
  await number(optimize.getByLabel('优化追迹预算', { exact: true }), 120);
  await optimize.getByRole('button', { name: '计算优化候选', exact: true }).click();
  await optimize.locator('.fd-optimizer-comparison').waitFor();
  await stop.waitFor({ state: 'hidden' });
  assert.deepEqual(await scene(), input, 'preview must not mutate the draft');
  const rows = await optimize.locator('.fd-optimizer-comparison tbody tr').evaluateAll(nodes => nodes.map(row => [...row.cells].map(cell => cell.textContent)));
  const baseline = traceFoldedScene(input).detectors[0].spot.rms2D;
  near(Number(rows[0][1]), baseline, .00006);
  assert.ok(Number(rows[1][1]) < baseline * .1, 'candidate should improve actual target RMS');
  assert.ok(parseFloat(rows[1][3]) >= 90, 'candidate must preserve capture constraint');
  const apply = optimize.getByRole('button', { name: '应用优化候选', exact: true });
  assert.equal(await apply.isEnabled(), true);
  await select('source');
  await number(spatial().getByLabel('长轴光斑直径', { exact: true }), 8.2);
  assert.equal(await apply.isEnabled(), false, 'changed source must invalidate candidate');
  assert.match(await optimize.textContent(), /工程或条件已改变/);
  await spatial().getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await scene(), input);
  assert.equal(await apply.isEnabled(), true);
  await apply.click();
  const after = await scene(), target = traceFoldedScene(after).detectors[0];
  assert.ok(target.spot.rms2D < baseline * .1); near(target.spot.rms2D, Number(rows[1][1]), .00006);
  assert.deepEqual(after.source, input.source);
  await verifySpot();
  return { label, beforeRms2D: baseline, appliedRms2D: target.spot.rms2D, captured: target.power, previewAndCancellationPreservedDraft: true, staleBlocked: true };
}
try {
  for (const viewport of [{ width: 1420, height: 1000, label: 'desktop' }, { width: 390, height: 844, label: 'mobile' }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => results.pageErrors.push(error.message));
    await page.goto(base + '/optics/designer/', { waitUntil: 'networkidle', timeout: 30000 });
    await spatial().locator('#fd-layout-svg').waitFor();
    await check(viewport.label + ': default canvas occupies primary workspace and has real visible rays', async () => {
      const g = await canvasGeometry();
      assert.ok(g.width > 300 && g.height > 400); assert.ok(g.paths > 10);
      if (viewport.width > 1100) assert.ok(g.ratio >= .7, 'canvas/workspace ratio=' + g.ratio);
      near(g.svgScaleX, g.svgScaleY, .002); near(g.gridX, g.gridY, .00001);
      return g;
    });
    await check(viewport.label + ': detector numbering remains consistent through rename and duplication', async () => {
      assert.deepEqual(await spatial().locator('.obj-detector-tag').allTextContents(), ['D1', 'D2']);
      const text = await spatial().locator('#fd-layout-svg text').allTextContents();
      assert.ok(text.some(t => /^D1\b/.test(t)) && text.some(t => /^D2\b/.test(t)));
      assert.match(await spatial().getByLabel('选择空间元件').textContent(), /D1 · 探测面/);
      await reveal(spatial().getByLabel('空间扫描目标探测器'));
      assert.match(await spatial().getByLabel('空间扫描目标探测器').textContent(), /D2 · 探测面/);
      await select('detector-t');
      await number(spatial().getByRole('textbox', { name: '空间元件名称', exact: true }), '相机 A');
      await spatial().getByRole('button', { name: '复制元件', exact: true }).click();
      assert.deepEqual(await spatial().locator('.obj-detector-tag').allTextContents(), ['D1', 'D2', 'D3']);
      assert.match(await spatial().getByLabel('选择空间元件').textContent(), /D3 · 相机 A 副本/);
    });
    await check(viewport.label + ': manual 12.5 mm grid, 2 mm snapping and equal physical axis scale', async () => {
      await importScene(beamFixture());
      await reveal(spatial().getByLabel('网格间隔', { exact: true }));
      await number(spatial().getByLabel('网格间隔', { exact: true }), 12.5);
      await number(spatial().getByLabel('吸附间隔', { exact: true }), 2);
      assert.match(await spatial().locator('.fd-canvas-caption').textContent(), /网格 12\.5 mm/);
      const source = spatial().locator('#fd-layout-svg').getByRole('button', { name: '选择并移动空间光源', exact: true });
      await source.focus(); await source.press('ArrowRight');
      assert.equal((await scene()).source.x, 62);
      await spatial().getByRole('button', { name: '撤销', exact: true }).click();
      const transforms = await spatial().locator('#fd-layout-svg').evaluate(svg => {
        const at = name => svg.querySelector('g[aria-label="' + name + '"] > g').getScreenCTM();
        const lens = at('选择 QA 透镜'), detector = at('选择 D1 · QA 相机'), ruler = at('选择 QA 标尺元件');
        return { horizontalPerMm: (detector.e - lens.e) / 100, verticalPerMm: (lens.f - ruler.f) / 100 };
      });
      near(transforms.horizontalPerMm, transforms.verticalPerMm, .00001);
      const geometry = await canvasGeometry(); near(geometry.gridX, 12.5 * transforms.horizontalPerMm, .001);
      return transforms;
    });
    await check(viewport.label + ': hiding inspector expands canvas and preserves parameters', async () => {
      await select('source'); const before = await scene(), width = (await canvasGeometry()).width;
      await spatial().getByRole('button', { name: '收起参数', exact: true }).click();
      assert.equal(await spatial().locator('.fd-inspector').count(), 0);
      const afterWidth = (await canvasGeometry()).width;
      if (viewport.width > 1100) assert.ok(afterWidth > width + 150);
      assert.deepEqual(await scene(), before);
      await spatial().getByRole('button', { name: '显示参数', exact: true }).click();
      assert.ok(await spatial().getByLabel('长轴光斑直径', { exact: true }).isVisible());
      return { beforeWidth: width, afterWidth };
    });
    await check(viewport.label + ': searchable equipment expands before selecting sphere and cylinder', async () => {
      await pickEquipment('AC254-050-A', 'AC254-050-A');
      assert.equal((await scene()).elements.at(-1).focal, 50);
      assert.equal((await scene()).elements.at(-1).kind, 'lens');
      await pickEquipment('LJ1567RM-A', 'LJ1567RM-A');
      assert.equal((await scene()).elements.at(-1).focal, 100);
      assert.equal((await scene()).elements.at(-1).kind, 'cylindrical');
      assert.equal((await scene()).elements.at(-1).focalSagittal, null);
      await pickEquipment('完美薄透镜', 'lens');
      assert.equal((await scene()).elements.at(-1).focal, 100);
      assert.equal((await scene()).elements.at(-1).aberration, undefined);
    });
    await check(viewport.label + ': ellipse axes, divergence and rotation persist across reload', async () => {
      await importScene(beamFixture()); await select('source');
      await spatial().getByLabel('光源光斑形状', { exact: true }).selectOption('uniform');
      for (const [name, value] of [['长轴光斑直径', 7], ['短轴光斑直径', 3], ['长轴发散全角', 16], ['短轴发散全角', 8], ['椭圆旋转角', 27]]) await number(spatial().getByLabel(name, { exact: true }), value);
      const before = await scene(); await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(await scene(), before);
      assert.deepEqual(before.source.beam, { profile: 'uniform', diameterMinor: 3, fullAngleMinor: 8, rotationDeg: 27 });
      assert.equal(before.source.fullAngle, 16); assert.equal(before.source.diameter, 7);
      return verifySpot();
    });
    await check(viewport.label + ': live detector density uses true aspect, computed bins and changing focal/OPD', async () => {
      await importScene(beamFixture()); await select('qa-lens'); await verifySpot();
      near((await readSpot()).rms2D, 0);
      await number(spatial().getByLabel('薄透镜焦距', { exact: true }), 125);
      const defocused = await verifySpot(); assert.ok(defocused.computed.rms2D > .4);
      await number(spatial().getByLabel('薄透镜焦距', { exact: true }), 100);
      await number(spatial().getByLabel('球差 W040', { exact: true }), 20);
      const aberrated = await verifySpot(); assert.ok(aberrated.computed.rms2D > .005);
      const grid = traceFoldedScene(await scene()).detectors[0].spot.grid;
      const image = await spatial().locator('.fd-detector-card canvas').first().evaluate(canvas => {
        const r = canvas.getBoundingClientRect(), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return { width: r.width, height: r.height, brightPixels: Array.from(data).filter((v, i) => i % 4 === 0 && v > 20).length };
      });
      assert.ok(image.brightPixels > 0);
      // CSS rounds fractional pixel dimensions; compare the physical scale
      // ratio, allowing 0.2% raster/layout rounding rather than an absolute px/mm.
      near((image.width / grid.extentU) / (image.height / grid.extentV), 1, .002);
      near(grid.integratedPower, traceFoldedScene(await scene()).detectors[0].power, 1e-10);
      return { defocused, aberrated, image, gridIntegral: grid.integratedPower };
    });
    await check(viewport.label + ': cylindrical single-axis focus and 90 degree roll exchange the focused axes', async () => {
      await importScene(beamFixture({ cylinder: true })); await select('qa-lens');
      let spot = await readSpot(); near(spot.rmsU, 0); assert.ok(spot.rmsV > .9);
      await number(spatial().getByLabel('柱透镜轴旋转', { exact: true }), 90);
      spot = await readSpot(); assert.ok(spot.rmsU > 1.9); near(spot.rmsV, 0);
      return verifySpot();
    });
    await check(viewport.label + ': asynchronous optimization previews, cancels, blocks stale results and applies real improvement', () => optimizerCheck(viewport.label));
    await check(viewport.label + ': objective template remains legacy-compatible and 40X reference edits undo correctly', async () => {
      await spatial().getByLabel('载入空间模板').selectOption('objective');
      assert.equal((await scene()).source.beam, undefined);
      assert.match(await spatial().locator('.fd-detector-card').textContent(), /范围1\.000 mm/);
      const sourceLabel = await spatial().locator('#fd-layout-svg text').filter({ hasText: /^光源$/ }).boundingBox();
      const opticLabel = await spatial().locator('#fd-layout-svg text').filter({ hasText: /^1(?: · 等效物镜)?$/ }).boundingBox();
      assert.ok(sourceLabel && opticLabel && sourceLabel.y > opticLabel.y + opticLabel.height);
      await pickEquipment('RMS40X', 'RMS40X');
      const optic = (await scene()).elements.at(-1);
      assert.equal(optic.focal, 4.5); assert.equal(optic.objective.workingDistance, .6);
      await number(spatial().getByLabel('物镜等效焦距', { exact: true }), 5);
      assert.equal((await scene()).elements.at(-1).objective.catalogSku, undefined);
      await spatial().getByRole('button', { name: '撤销', exact: true }).click();
      assert.equal((await scene()).elements.at(-1).objective.catalogSku, 'RMS40X');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await scene()).elements.at(-1).focal, 4.5);
    });
    await check(viewport.label + ': spatial engineering JSON and HTML retain actual model inputs and detector labels', async () => {
      const file = JSON.parse(await download(spatial().getByRole('button', { name: '导出 JSON', exact: true, includeHidden: true }), viewport.label + '-spatial.json'));
      assert.equal(file.scene.elements.at(-1).objective.catalogSku, 'RMS40X');
      const html = await download(spatial().getByRole('button', { name: '导出 HTML 报告', exact: true, includeHidden: true }), viewport.label + '-spatial.html');
      assert.match(html, /D1/); assert.match(html, /物镜参考规格与等效模型/);
      assert.match(html, /几何|非相干/); assert.match(html, /a\.u\.\/mm/);
    });
    await check(viewport.label + ': sequential 40X, conversion and spatial undo preserve the separate drafts', async () => {
      const beforeSpatial = await scene();
      await page.locator('#od-sequential-tab').click();
      await sequential().getByLabel('载入光路模板').selectOption('objective');
      const category = sequential().getByLabel('透镜类型'); await reveal(category); await category.selectOption('objective');
      const button = sequential().getByRole('button', { name: '加入物镜 RMS40X', exact: true, includeHidden: true }); await reveal(button); await button.click();
      assert.equal((await stored(sequentialKey)).project.elements.at(-1).focal, 4.5);
      const beforeSequential = (await stored(sequentialKey)).project;
      await sequential().getByRole('button', { name: '复制到空间光路', exact: true }).click();
      assert.equal((await scene()).elements.at(-2).objective.catalogSku, 'RMS40X');
      await spatial().getByRole('button', { name: '撤销', exact: true }).click();
      assert.deepEqual(await scene(), beforeSpatial);
      await page.locator('#od-sequential-tab').click();
      assert.deepEqual((await stored(sequentialKey)).project, beforeSequential);
      await page.locator('#od-spatial-tab').click();
    });
    await check(viewport.label + ': old routes preserve both drafts and independent source history', async () => {
      const beforeSpatial = await scene(), beforeSequential = (await stored(sequentialKey)).project;
      await page.goto(base + '/training/optical-bench/', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.ol-header').count(), 1);
      await page.goto(base + '/design/optical-bench/', { waitUntil: 'networkidle' });
      assert.deepEqual(await scene(), beforeSpatial); assert.deepEqual((await stored(sequentialKey)).project, beforeSequential);
      await page.locator('#od-spatial-tab').click(); await select('source');
      await spatial().getByLabel('光源光斑形状', { exact: true }).selectOption('gaussian');
      const enabled = await scene(); assert.ok(enabled.source.beam);
      await spatial().getByRole('button', { name: '撤销', exact: true }).click();
      assert.deepEqual(await scene(), beforeSpatial);
      await spatial().getByRole('button', { name: '重做', exact: true }).click();
      assert.deepEqual(await scene(), enabled);
    });
    await importScene(beamFixture({ cylinder: true, detectorX: 360, rotate: 20 }));
    const collapse = spatial().getByRole('button', { name: '收起参数', exact: true }); if (await collapse.isVisible()) await collapse.click();
    await capture(viewport.label + '-spatial-canvas', spatial().locator('#fd-layout-svg'));
    await capture(viewport.label + '-detector-spots', spatial().getByRole('region', { name: '探测器光斑与强度', exact: true }), true);
    await page.locator('#od-sequential-tab').click();
    await sequential().getByLabel('载入光路模板').selectOption('objective');
    await capture(viewport.label + '-sequential', sequential().locator('#od-layout-svg'));
    await check(viewport.label + ': page reflows without horizontal overflow in either model', async () => {
      let overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 1, 'sequential overflow=' + overflow);
      await page.locator('#od-spatial-tab').click();
      overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 1, 'spatial overflow=' + overflow);
    });
    await context.close();
  }
  assert.equal(results.pageErrors.length, 0, results.pageErrors.join('\n'));
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(results.checks.filter(c => c.status === 'pass').length + '/' + results.checks.length + ' checks passed; ' + results.pageErrors.length + ' page errors');
}
