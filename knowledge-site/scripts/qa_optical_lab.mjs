/**
 * Browser regression checks for a running Optical Lab (does not start a server).
 * From knowledge-site: node scripts/qa_optical_lab.mjs
 * Requires an existing Playwright installation and installed Microsoft Edge.
 * Optional environment variables:
 *   PCSEL_PLAYWRIGHT_MODULE   module specifier or file:// URL (default: playwright)
 *   PCSEL_OPTICS_URL          running site URL (default: http://127.0.0.1:5175)
 *   PCSEL_OPTICS_QA_OUTPUT    output directory, relative to knowledge-site or absolute
 *                            (default: outputs/optical-lab-qa)
 *   PCSEL_OPTICS_BROWSER_CHANNEL browser channel (default: msedge)
 * --no-screenshots runs assertions without taking a second capture batch.
 * --recheck repeats the two sticky-anchor checks against an existing result file,
 *           without screenshots; useful for one targeted confirmation.
 * --recheck-compact repeats the compact layout/control checks without screenshots.
 * Screenshots always use the site's native CSS. The 200% reflow check halves the
 * desktop CSS viewport to 710x500; it is a reflow equivalent, not browser zoom.
 * All storage mutations are confined to a new, disposable browser context.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const base = (process.env.PCSEL_OPTICS_URL || 'http://127.0.0.1:5175').replace(/\/+$/, '');
const outputDir = path.resolve(siteRoot, process.env.PCSEL_OPTICS_QA_OUTPUT || 'outputs/optical-lab-qa');
const resultPath = path.join(outputDir, 'results.json');
const channel = process.env.PCSEL_OPTICS_BROWSER_CHANNEL || 'msedge';
const recheckCompact = process.argv.includes('--recheck-compact');
const recheck = recheckCompact || process.argv.includes('--recheck');
const captureScreenshots = !recheck && !process.argv.includes('--no-screenshots');
const viewports = [
  { label: 'desktop', width: 1420, height: 1000 },
  { label: 'mobile', width: 390, height: 844 },
];
const compactViewports = [
  { label: 'compact-desktop', width: 1024, height: 768 },
  { label: 'narrow-mobile', width: 320, height: 740 },
  { label: '200-percent-reflow', width: 710, height: 500 },
];
const storage = {
  spatialDraft: 'pcsel-folded-optics-draft-v1',
  sequentialDraft: 'pcsel-optics-designer-draft-v2',
  spatialLibrary: 'pcsel-folded-optics-library-v1',
  sequentialLibrary: 'pcsel-optics-designer-library-v2',
  notes: 'pcsel-training-demo-notes-v1',
};

await fs.mkdir(outputDir, { recursive: true });
const results = recheck
  ? JSON.parse(await fs.readFile(resultPath, 'utf8'))
  : { checkedAt: new Date().toISOString(), base, channel, checks: [], errors: [], layouts: [], screenshots: [] };
if (recheck) results.recheckedAt = new Date().toISOString();
let browser;
let page;

async function check(name, action) {
  results.checks = results.checks.filter(item => item.name !== name);
  try {
    const detail = await action();
    results.checks.push({ name, status: 'pass', ...(detail === undefined ? {} : { detail }) });
    console.log(`PASS ${name}`);
  } catch (error) {
    const diagnostics = page ? await page.evaluate(() => {
      const course = document.getElementById('ob-course');
      const header = document.querySelector('.ol-header');
      return {
        url: location.href, ready: document.readyState, scrollY,
        courseTop: course?.getBoundingClientRect().top,
        scrollMarginTop: course ? getComputedStyle(course).scrollMarginTop : null,
        headerBottom: header?.getBoundingClientRect().bottom,
        tabs: [...document.querySelectorAll('[role=tab]')].map(node => ({ name: node.innerText, selected: node.getAttribute('aria-selected') })),
        disclosures: [...document.querySelectorAll('button[aria-expanded]')].map(node => ({ name: node.innerText, expanded: node.getAttribute('aria-expanded') })),
        textareas: [...document.querySelectorAll('.ob-record textarea')].map(node => node.value),
      };
    }).catch(() => null) : null;
    results.checks.push({ name, status: 'fail', error: error.message, diagnostics });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

async function goto(route) {
  await page.goto(new URL(route, `${base}/`).href, { waitUntil: 'networkidle' });
  await page.locator('.ol-header').waitFor();
}
const spatialTab = () => page.getByRole('tab', { name: '空间光路 · 折转 / 分光', exact: true });
const sequentialTab = () => page.getByRole('tab', { name: '顺序光路 · Gaussian / 优化', exact: true });
const panel = model => page.getByRole('tabpanel').filter({ has: model === 'spatial'
  ? page.getByRole('textbox', { name: '空间工程名称', exact: true })
  : page.getByRole('textbox', { name: '工程名称', exact: true }) });
async function readKey(key) {
  const text = await page.evaluate(key => localStorage.getItem(key), key);
  assert.notEqual(text, null, `missing localStorage key: ${key}`);
  return JSON.parse(text);
}
const scene = async () => (await readKey(storage.spatialDraft)).scene;
const design = async () => (await readKey(storage.sequentialDraft)).project;

// Use disclosure names, not the layout's library/inspector class hierarchy.
async function reveal(locator, disclosureName = /元件与工程|器件与工程|元件库|工程库|参数/) {
  if (await locator.isVisible()) return;
  const disclosures = page.getByRole('button', { name: disclosureName });
  for (const button of await disclosures.all()) {
    if (await button.isVisible() && await button.getAttribute('aria-expanded') === 'false') {
      await button.click();
      if (await locator.isVisible()) return;
    }
  }
  for (const summary of await page.locator('details:not([open]) > summary').filter({ hasText: disclosureName }).all()) {
    if (await summary.isVisible()) {
      await summary.click();
      if (await locator.isVisible()) return;
    }
  }
  // A native <details> grouping may keep the input in the DOM while collapsed.
  for (const details of await locator.locator('xpath=ancestor::details[not(@open)]').all()) {
    await details.locator('summary').click();
  }
  await locator.waitFor({ state: 'visible' });
}
async function edit(name, value) {
  const input = page.getByRole('spinbutton', { name, exact: true, includeHidden: true });
  await reveal(input, /参数|光源/);
  await input.fill(String(value));
  await input.press('Enter');
}
async function screenshot(filename) {
  if (!captureScreenshots) return;
  const target = path.join(outputDir, filename);
  await page.screenshot({ path: target });
  if (!results.screenshots.includes(target)) results.screenshots.push(target);
}
async function switchPage(route) {
  const name = route.includes('tutorial') ? '教程与实训' : '自由设计';
  await page.getByRole('navigation', { name: '光学实验室分页面', exact: true }).getByRole('link', { name, exact: true }).click();
  await page.waitForURL(`**${route}`);
  await page.waitForLoadState('networkidle');
  await page.locator(route.includes('tutorial') ? '#ob-course' : '.od-mode-switch').waitFor();
}
const observationField = () => page.getByLabel('观察与原始读数', { exact: true });

async function layout(label) {
  const value = await page.evaluate(() => {
    const header = document.querySelector('.ol-header');
    const box = header.getBoundingClientRect();
    const links = [...header.querySelectorAll('a')].map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.innerText, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return {
      viewport: innerWidth, clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      header: { top: box.top, bottom: box.bottom, width: box.width, height: box.height, position: getComputedStyle(header).position }, links,
    };
  });
  results.layouts = results.layouts.filter(item => item.label !== label);
  results.layouts.push({ label, ...value });
  assert.ok(value.scrollWidth <= value.clientWidth + 1, `document horizontal overflow: ${value.scrollWidth} > ${value.clientWidth}`);
  assert.ok(value.bodyScrollWidth <= value.clientWidth + 1, `body horizontal overflow: ${value.bodyScrollWidth} > ${value.clientWidth}`);
  assert.equal(value.header.position, 'sticky');
  assert.ok(Math.abs(value.header.top) < 1, `header top=${value.header.top}`);
  for (const link of value.links) assert.ok(link.left >= 0 && link.right <= value.viewport + 1, `header link outside viewport: ${link.text}`);
  return value;
}

async function anchor(label) {
  await page.getByRole('navigation', { name: '教程页内目录', exact: true }).getByRole('link', { name: '透镜与光路', exact: true }).click();
  await page.waitForFunction(() => {
    const course = document.getElementById('ob-course').getBoundingClientRect();
    const header = document.querySelector('.ol-header').getBoundingClientRect();
    return course.top >= header.bottom && course.top < header.bottom + 80;
  });
  const measured = await page.evaluate(() => ({
    hash: location.hash, scrollY,
    scrollMarginTop: getComputedStyle(document.getElementById('ob-course')).scrollMarginTop,
    courseTop: document.getElementById('ob-course').getBoundingClientRect().top,
    headerBottom: document.querySelector('.ol-header').getBoundingClientRect().bottom,
    headingTop: document.getElementById('ob-course-title').getBoundingClientRect().top,
  }));
  assert.ok(measured.courseTop >= measured.headerBottom);
  await layout(`${label}-tutorial-anchor`);
  return measured;
}

async function headerKeyboardFocus() {
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  const links = page.locator('.ol-header a');
  const unfocused = await links.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).boxShadow));
  const details = [];
  for (let index = 0; index < await links.count(); index++) {
    await page.keyboard.press('Tab');
    const focus = await links.nth(index).evaluate(node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        name: node.innerText, focused: node === document.activeElement, focusVisible: node.matches(':focus-visible'),
        outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor,
        boxShadow: style.boxShadow, unobscured: node.contains(hit),
        insideViewport: box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight,
      };
    });
    assert.ok(focus.focused && focus.focusVisible, `header link is not keyboard focused: ${focus.name}`);
    const outline = !['none', 'hidden'].includes(focus.outlineStyle) && parseFloat(focus.outlineWidth) > 0 && !['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.outlineColor);
    assert.ok(outline || (focus.boxShadow !== 'none' && focus.boxShadow !== unfocused[index]), `missing visible focus indicator: ${focus.name}`);
    assert.ok(focus.insideViewport && focus.unobscured, `focused header link is clipped or covered: ${focus.name}`);
    details.push(focus);
  }
  return details;
}

async function modelKeyboardNavigation() {
  await spatialTab().click();
  await spatialTab().focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await sequentialTab().getAttribute('aria-selected'), 'true');
  assert.ok(await sequentialTab().evaluate(node => node === document.activeElement));
  await page.keyboard.press('End');
  assert.equal(await spatialTab().getAttribute('aria-selected'), 'true');
  assert.ok(await spatialTab().evaluate(node => node === document.activeElement));
  await page.keyboard.press('Home');
  assert.equal(await sequentialTab().getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await spatialTab().getAttribute('aria-selected'), 'true');
  return { keys: ['ArrowLeft', 'End', 'Home', 'ArrowRight'], finalMode: 'spatial' };
}

async function exportedJson(button) {
  await reveal(button, /工程文件/);
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const stream = await download.createReadStream();
  assert.ok(stream, 'export did not provide a readable download');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  JSON.parse(text);
  return text;
}

async function saveAndImport(model, expected) {
  const workspace = panel(model);
  await workspace.getByRole('button', { name: '保存副本', exact: true }).click();
  const library = await readKey(model === 'spatial' ? storage.spatialLibrary : storage.sequentialLibrary);
  assert.deepEqual(model === 'spatial' ? library[0].scene : library[0].file.project, expected);
  const json = await exportedJson(workspace.getByRole('button', { name: model === 'spatial' ? '导出 JSON' : '导出工程', exact: true, includeHidden: true }));
  await edit(model === 'spatial' ? '入射光源孔径' : '入射光源口径', 8.4);
  const importButton = workspace.getByRole('button', { name: '导入', exact: true, includeHidden: true });
  await reveal(importButton, /工程文件/);
  await importButton.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: model === 'spatial' ? '空间工程 JSON' : '也可粘贴 JSON', exact: true }).fill(json);
  await dialog.getByRole('button', { name: model === 'spatial' ? '导入工程' : '导入文本', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await (model === 'spatial' ? scene() : design()), expected);
  return { savedName: expected.name, exportedBytes: Buffer.byteLength(json), restoredSourceDiameter: expected.source.diameter };
}

async function compactControls(model) {
  const tab = model === 'spatial' ? spatialTab() : sequentialTab();
  await tab.click();
  const title = model === 'spatial' ? '元件与工程' : '器件与工程';
  const palette = panel(model).locator('details').filter({ has: page.getByText(title, { exact: true }) });
  assert.equal(await palette.count(), 1, `${model}: missing named palette disclosure`);
  assert.equal(await palette.getAttribute('open'), null, `${model}: compact palette should start collapsed`);
  const canvas = page.locator(model === 'spatial' ? '#fd-layout-svg' : '#od-layout-svg');
  assert.ok(await canvas.isVisible(), `${model}: canvas should remain visible while palette is collapsed`);
  const canvasPosition = await canvas.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, viewportHeight: innerHeight };
  });
  if (canvasPosition.viewportHeight >= 740) {
    assert.ok(canvasPosition.top < canvasPosition.viewportHeight && canvasPosition.bottom > 0, `${model}: collapsed palette pushes canvas below the initial viewport (${JSON.stringify(canvasPosition)})`);
  }
  const before = await (model === 'spatial' ? scene() : design());
  if (model === 'spatial') {
    const selector = page.getByRole('combobox', { name: '选择空间元件', exact: true });
    assert.equal(await selector.locator('option').count(), before.elements.length + 1);
    const first = before.elements[0];
    if (first) {
      await selector.selectOption(first.id);
      const optic = canvas.getByRole('button', { name: `选择 ${first.name}`, exact: true });
      assert.equal(await optic.getAttribute('aria-pressed'), 'true');
      assert.ok(await panel(model).getByRole('spinbutton', { name: '元件 x', exact: true }).isVisible(), 'selecting an optic should reveal its compact inspector');
      await optic.focus();
      await optic.press('ArrowRight');
      assert.equal((await scene()).elements[0].x, first.x + 5);
      await panel(model).getByRole('button', { name: '撤销', exact: true }).click();
      assert.deepEqual(await scene(), before);
    }
    await selector.selectOption('source');
    const text = await canvas.locator('text').first().evaluate(node => ({ font: parseFloat(getComputedStyle(node).fontSize), scale: node.getScreenCTM().a }));
    assert.ok(text.font * text.scale >= 11.5, 'spatial axis labels shrink below readable screen size');
  }
  const sourceName = model === 'spatial' ? '入射光源孔径' : '入射光源口径';
  await edit(sourceName, before.source.diameter);
  const inspectorFit = await panel(model).locator(model === 'spatial' ? '.fd-inspector' : '.od-inspector').evaluate(node => {
    const box = node.getBoundingClientRect();
    const child = node.querySelector('.od-tool-panel').getBoundingClientRect();
    const field = node.querySelector('input[type=number]').getBoundingClientRect();
    return { width: box.width, panelWidth: child.width, fieldLeft: field.left - box.left, fieldRight: field.right - box.left };
  });
  assert.ok(inspectorFit.panelWidth >= inspectorFit.width - 4 && inspectorFit.fieldLeft >= 0 && inspectorFit.fieldRight <= inspectorFit.width, `${model}: compact inspector does not occupy the full panel (${JSON.stringify(inspectorFit)})`);
  const part = panel(model).getByRole('button', { name: model === 'spatial' ? /^薄透镜/ : '＋ 正透镜', exact: model !== 'spatial', includeHidden: true });
  await reveal(part, /元件与工程|器件与工程|元件库|工程库/);
  await part.click();
  const changed = await (model === 'spatial' ? scene() : design());
  assert.equal(changed.elements.length, before.elements.length + 1, `${model}: palette button did not add a component`);
  await panel(model).getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await (model === 'spatial' ? scene() : design()), before);
  await palette.locator('summary').press('Enter');
  assert.equal(await palette.getAttribute('open'), null, `${model}: palette cannot be collapsed with the keyboard`);
  await page.evaluate(() => scrollTo(0, 0));
  return { sourceDiameter: before.source.diameter, elementCount: before.elements.length, paletteInitiallyCollapsed: true, paletteKeyboardCollapse: true, canvasPosition, inspectorFit, initialViewportChecked: canvasPosition.viewportHeight >= 740 };
}

try {
  const { chromium } = await import(process.env.PCSEL_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ channel, headless: true });
  const context = await browser.newContext({ viewport: { width: 1420, height: 1000 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => results.errors.push(error.message));

  if (!recheck) {
    for (const [route, selected] of [['/optics/', 'tutorial'], ['/optics/tutorial/', 'tutorial'], ['/optics/designer/', 'designer'], ['/training/optical-bench/', 'tutorial'], ['/design/optical-bench/', 'designer']]) {
      await check(`route ${route} has shared header and ${selected} active nav`, async () => {
        await goto(route);
        const navigation = page.getByRole('navigation', { name: '光学实验室分页面', exact: true });
        assert.equal(await page.locator('.ol-header').count(), 1);
        assert.equal(await navigation.locator('a[aria-current="page"]').count(), 1);
        assert.equal(await navigation.locator('a[aria-current="page"]').getAttribute('href'), `/optics/${selected}/`);
        assert.deepEqual(await navigation.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/optics/tutorial/', '/optics/designer/']);
        assert.match(await page.getByRole('link', { name: '光学实验室首页', exact: true }).innerText(), /光学实验室\s+PCSELbook · Optical Lab/);
        return { title: await page.title() };
      });
    }
    let spatialSnapshot;
    let sequentialSnapshot;
    const observation = `Optical Lab QA: ${new Date().toISOString().slice(0, 10)}, 原始观察保存在独立验收浏览器。`;
    await check('fresh designer defaults to spatial with model tabs and readout', async () => {
      await goto('/optics/designer/');
      assert.equal(await spatialTab().getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tablist', { name: '计算模型', exact: true }).count(), 1);
      assert.ok(await page.locator('#fd-layout-svg').isVisible());
      assert.ok(await page.locator('.fd-metrics').isVisible());
      assert.ok((await page.locator('.fd-metrics').innerText()).trim().length > 20);
      return { spatialReadout: await page.locator('.fd-metrics').innerText() };
    });
    await check('spatial source aperture and project name commit to own draft', async () => {
      await edit('入射光源孔径', 7.3);
      const name = page.getByRole('textbox', { name: '空间工程名称', exact: true });
      await name.fill('Optical Lab QA Draft');
      await name.press('Enter');
      spatialSnapshot = await scene();
      assert.equal(spatialSnapshot.source.diameter, 7.3);
      assert.equal(spatialSnapshot.name, 'Optical Lab QA Draft');
      return { name: spatialSnapshot.name, sourceDiameter: spatialSnapshot.source.diameter, elementCount: spatialSnapshot.elements.length };
    });
    await check('sequential model tab and its own canvas/readout remain usable', async () => {
      await sequentialTab().click();
      assert.equal(await sequentialTab().getAttribute('aria-selected'), 'true');
      assert.ok(await page.locator('#od-layout-svg').isVisible());
      assert.ok(await page.locator('.od-readout').isVisible());
      await edit('入射光源口径', 5.5);
      await page.getByRole('textbox', { name: '工程名称', exact: true }).fill('Optical Lab QA Sequential');
      sequentialSnapshot = await design();
      assert.equal(sequentialSnapshot.source.diameter, 5.5);
      assert.equal(sequentialSnapshot.name, 'Optical Lab QA Sequential');
      const sequentialReadout = await page.locator('.od-readout').innerText();
      await spatialTab().click();
      assert.deepEqual(await scene(), spatialSnapshot);
      return { sequentialReadout };
    });
    await check('canonical tutorial link switches page and observation saves', async () => {
      await switchPage('/optics/tutorial/');
      await page.getByRole('tab', { name: /实操记录/ }).click();
      await observationField().fill(observation);
      assert.equal((await readKey(storage.notes)).records['lens-pair'].measurements, observation);
    });
    await check('canonical designer return preserves geometry, source aperture, name and modes', async () => {
      await switchPage('/optics/designer/');
      assert.equal(await spatialTab().getAttribute('aria-selected'), 'true');
      assert.deepEqual(await scene(), spatialSnapshot);
      assert.equal(await page.getByRole('textbox', { name: '空间工程名称', exact: true }).inputValue(), spatialSnapshot.name);
      await reveal(page.getByRole('spinbutton', { name: '入射光源孔径', exact: true, includeHidden: true }), /参数|光源/);
      assert.equal(await page.getByRole('spinbutton', { name: '入射光源孔径', exact: true }).inputValue(), '7.3');
      await sequentialTab().click();
      assert.deepEqual(await design(), sequentialSnapshot);
      assert.equal(await page.getByRole('textbox', { name: '工程名称', exact: true }).inputValue(), sequentialSnapshot.name);
      await spatialTab().click();
    });
    await check('tutorial return preserves practical observation', async () => {
      await switchPage('/optics/tutorial/');
      await page.getByRole('tab', { name: /实操记录/ }).click();
      assert.equal(await page.locator('#ob-tab-record').getAttribute('aria-selected'), 'true');
      assert.equal(await observationField().inputValue(), observation);
      assert.deepEqual(await scene(), spatialSnapshot);
      assert.deepEqual(await design(), sequentialSnapshot);
    });
    await check('spatial saved copy and exported JSON import restore the design', async () => {
      await goto('/optics/designer/');
      return saveAndImport('spatial', spatialSnapshot);
    });
    await check('sequential saved copy and exported JSON import restore the design', async () => {
      await sequentialTab().click();
      const detail = await saveAndImport('sequential', sequentialSnapshot);
      await spatialTab().click();
      return detail;
    });
  }

  for (const viewport of recheckCompact ? [] : viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    if (!recheck) {
      await check(`${viewport.label} designer header and horizontal overflow`, async () => {
        await goto('/optics/designer/');
        await spatialTab().click();
        await page.evaluate(() => scrollTo(0, 0));
        const measured = await layout(`${viewport.label}-designer-spatial`);
        await screenshot(`lab-designer-${viewport.label}.png`);
        await sequentialTab().click();
        await page.evaluate(() => scrollTo(0, 0));
        await layout(`${viewport.label}-designer-sequential`);
        await screenshot(`lab-designer-${viewport.label}-sequential.png`);
        await spatialTab().click();
        return measured;
      });
      if (viewport.width < 1100) await check(`${viewport.label} collapsed palettes keep canvases visible and controls usable`, async () => {
        await goto('/optics/designer/');
        const spatial = await compactControls('spatial');
        const sequential = await compactControls('sequential');
        await spatialTab().click();
        return { spatial, sequential };
      });
      await check(`${viewport.label} header navigation has visible keyboard focus`, async () => {
        await goto('/optics/designer/');
        return headerKeyboardFocus();
      });
      await check(`${viewport.label} model tabs support arrow, Home and End keys`, async () => modelKeyboardNavigation());
      await check(`${viewport.label} tutorial header and horizontal overflow`, async () => {
        await goto('/optics/tutorial/');
        await page.evaluate(() => scrollTo(0, 0));
        const measured = await layout(`${viewport.label}-tutorial`);
        await screenshot(`lab-tutorial-${viewport.label}.png`);
        return measured;
      });
    } else await goto('/optics/tutorial/');
    await check(`${viewport.label} ob-course anchor clears sticky shared header`, async () => {
      const measured = await anchor(viewport.label);
      await screenshot(`lab-tutorial-${viewport.label}-anchor.png`);
      return measured;
    });
  }

  if (!recheck || recheckCompact) {
    for (const viewport of compactViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await check(`${viewport.label} both designers reflow and palette/source controls work`, async () => {
        await goto('/optics/designer/');
        await spatialTab().click();
        await page.evaluate(() => scrollTo(0, 0));
        await layout(`${viewport.label}-designer-collapsed`);
        await screenshot(`lab-designer-${viewport.label}.png`);
        const spatial = await compactControls('spatial');
        await layout(`${viewport.label}-designer-spatial-controls`);
        const sequential = await compactControls('sequential');
        await layout(`${viewport.label}-designer-sequential-controls`);
        await spatialTab().click();
        return { spatial, sequential, ...(viewport.label === '200-percent-reflow' ? { method: '1420x1000 desktop at 200% reflow equivalent: 710x500 CSS viewport' } : {}) };
      });
      await check(`${viewport.label} tutorial reflow and sticky course anchor`, async () => {
        await goto('/optics/tutorial/');
        await page.evaluate(() => scrollTo(0, 0));
        await layout(`${viewport.label}-tutorial`);
        return anchor(viewport.label);
      });
    }
    if (!recheckCompact) await check('book homepage has unified sidebar and canonical optical lab entry card', async () => {
      await page.setViewportSize({ width: 1420, height: 1000 });
      await page.goto(new URL('/', `${base}/`).href, { waitUntil: 'networkidle' });
      await page.locator('#optics-entry-title').waitFor();
      assert.equal(await page.locator('.book-nav a[href="/optics/"]').count(), 1);
      assert.match(await page.locator('.book-nav a[href="/optics/"]').innerText(), /光学实验室/);
      const links = await page.locator('section[aria-labelledby="optics-entry-title"] a').evaluateAll(nodes => nodes.map(node => ({ text: node.innerText, href: node.getAttribute('href') })));
      assert.deepEqual(links.map(link => link.href), ['/optics/tutorial/', '/optics/designer/']);
      return { sidebar: await page.locator('.book-nav a[href="/optics/"]').innerText(), links };
    });
  }
  await check('browser page errors absent', async () => assert.deepEqual(results.errors, []));
} catch (error) {
  results.checks.push({ name: 'QA execution', status: 'fail', error: error.stack ?? error.message });
  console.error(error.stack ?? error.message);
} finally {
  results.passed = results.checks.filter(item => item.status === 'pass').length;
  results.failed = results.checks.filter(item => item.status === 'fail').length;
  await fs.writeFile(resultPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  if (browser) await browser.close();
  console.log(JSON.stringify({ passed: results.passed, failed: results.failed, results: resultPath, screenshots: results.screenshots }));
  if (results.failed) process.exitCode = 1;
}
