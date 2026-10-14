import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PCSEL_PLAYWRIGHT_MODULE || 'file:///C:/Users/feiyang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base = process.env.PCSEL_OPTICS_URL || 'http://127.0.0.1:5175';
const out = 'outputs/introduction-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], checks = [];
const screenshots = !process.argv.includes('--no-screenshots');
async function frame(page, id, file) {
  await page.evaluate(id => { const node = document.getElementById(id); window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 160); }, id);
  if (screenshots) await page.screenshot({ path: `${out}/${file}.png` });
}
try {
  for (const width of [1420, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (screenshots) await page.screenshot({ path: `${out}/entry-${width}.png` });
    const focus = page.locator('#li-focus');
    assert.ok(await focus.getByRole('button', { name: '静态演示' }).isDisabled());
    const screen = focus.getByRole('slider', { name: '屏到透镜的距离 d', exact: true });
    for (const [distance, span, text] of [[60,'6.400000','还在会聚'],[100,'0.000000','找到了'],[160,'9.600000','越过焦点']]) {
      await screen.fill(String(distance));
      assert.equal(await focus.locator('.li-observation').getAttribute('data-span'), span);
      assert.match(await focus.locator('.li-observation').innerText(), new RegExp(text));
    }
    await focus.getByRole('button', { name: '取走透镜' }).click();
    assert.equal(await focus.locator('.li-observation').getAttribute('data-span'), '16.000000');
    await focus.getByRole('button', { name: '放回透镜' }).click();
    const drag = focus.getByRole('slider', { name: '拖动接收屏，方向键微调距离', exact: true });
    await drag.focus(); await drag.press('ArrowLeft');
    assert.equal(await screen.inputValue(), '159');
    if (width === 1420) {
      await frame(page, 'li-focus-title', `focus-keyboard-${width}`);
      const svg = await focus.locator('svg.li-diagram').boundingBox();
      const from = svg.x + (56 + 359 * 1.35) / 720 * svg.width;
      const to = svg.x + (56 + 300 * 1.35) / 720 * svg.width;
      const y = svg.y + 140 / 300 * svg.height;
      await page.mouse.move(from,y); await page.mouse.down(); await page.mouse.move(to,y,{steps:8}); await page.mouse.up();
      assert.equal(await screen.inputValue(),'100');
    }
    await focus.getByRole('button', { name: '焦点后', exact: true }).click();
    await frame(page, 'li-focus-title', `focus-${width}`);
    const mirror = page.locator('#li-mirror');
    const initial = await mirror.locator('.li-rays').innerHTML();
    await mirror.getByRole('slider', { name: '镜面转角 Δθ', exact: true }).fill('5');
    assert.equal(await mirror.locator('.li-observation').getAttribute('data-deflection'),'10.000000');
    assert.notEqual(await mirror.locator('.li-rays').innerHTML(),initial);
    await frame(page, 'li-mirror-title', `mirror-${width}`);
    await mirror.getByRole('button', { name: '回到初始方向' }).click();
    assert.equal(await mirror.locator('.li-observation').getAttribute('data-deflection'),'0.000000');
    const aperture = page.locator('#li-aperture');
    assert.equal(await aperture.locator('.li-observation').getAttribute('data-passed'),'17');
    await aperture.getByRole('slider', { name: '光阑孔径', exact: true }).fill('4');
    assert.equal(await aperture.locator('.li-observation').getAttribute('data-passed'),'3');
    assert.ok(await aperture.locator('.li-rays path').count() < 34);
    await frame(page, 'li-aperture-title', `aperture-${width}`);
    await aperture.getByRole('button', { name: '重新开满' }).click();
    assert.equal(await aperture.locator('.li-observation').getAttribute('data-passed'),'17');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await focus.getByRole('button', { name: '播放光线方向演示' }).click();
    await page.waitForFunction(() => document.querySelector('#li-focus .li-diagram').classList.contains('is-playing'));
    assert.equal(await focus.locator('.li-flow path').first().evaluate(e => getComputedStyle(e).animationPlayState),'running');
    await page.locator('#ob-component-lab').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('#li-focus .li-diagram').classList.contains('is-playing'));
    assert.equal(await focus.locator('.li-flow path').first().evaluate(e => getComputedStyle(e).animationPlayState),'paused');
    await page.emulateMedia({reducedMotion:'reduce'});
    await focus.getByRole('button', { name: '静态演示' }).waitFor();
    assert.ok(await focus.getByRole('button', { name: '静态演示' }).isDisabled());
    assert.equal(await focus.locator('.li-flow path').first().evaluate(e => getComputedStyle(e).animationName),'none');
    assert.equal(await page.getByRole('group',{name:'选择教学元件'}).getByRole('button').count(),12);
    assert.equal(await page.locator('#ob-challenges').getByRole('group',{name:'选择关卡'}).getByRole('button').count(),3);
    const controls = await page.locator('.li-controls button, .li-slider input, .li-motion-button').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().height));
    assert.ok(controls.every(height=>height>=44));
    checks.push({width,status:'pass',checks:'focus scan/removal, SVG keyboard/pointer, reflection x2, real clipping, reset, reduced motion, offscreen pause, 44px controls, existing lessons'});
    await context.close();
  }
  const context = await browser.newContext({viewport:{width:320,height:960},reducedMotion:'reduce'});
  const page = await context.newPage(); await page.goto(base,{waitUntil:'networkidle'});
  for(const width of [320,710,1024]) {
    await page.setViewportSize({width,height:960});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    checks.push({width,status:'pass',checks:'responsive overflow'});
  }
  await context.close();
  assert.deepEqual(errors,[]);
} finally { await browser.close(); await writeFile(`${out}/results.json`,JSON.stringify({base,checks,errors},null,2)); }
console.log(JSON.stringify({checks,errors},null,2));
