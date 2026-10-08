import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankScene, customLens, traceBench, parseScene, missionChecks, missionStart } from '../app/training/bench-engine.ts';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('source aperture and full divergence angle independently determine free propagation', () => {
  const s = { ...blankScene(), diameter: 6, fullAngle: 20, screen: 500 };
  const r = traceBench(s);
  near(r.span, 16); near(r.angleSpan, 20); assert.equal(r.passed, 17);
  near(traceBench({ ...s, diameter: 10 }).span, 20);
  near(traceBench({ ...s, fullAngle: 0 }).span, 6);
});
test('thin lens focuses parallel input at its focal plane', () => {
  const s = { ...blankScene(), screen: 300, elements: [{ ...customLens('a', 200), focal: 100 }] };
  near(traceBench(s).span, 0);
  near(traceBench({ ...s, screen: 350 }).span, 2);
});
test('fan collimation uses virtual origin behind entrance plane', () => {
  const s = missionStart('collimate'); s.elements[0].z = 50;
  const r = traceBench(s); near(r.angleSpan, 0); near(r.span, 4);
  assert.ok(missionChecks('collimate', s).every(c => c.pass));
});
test('extended source cannot be perfectly collimated like the correlated fan', () => {
  const s = missionStart('collimate'); s.elements[0].z = 50; s.sourceModel = 'extended';
  const r = traceBench(s); assert.equal(r.total, 49); assert.ok(r.angleSpan > 1);
});
test('two lenses form an afocal 2x telescope independent of insertion order', () => {
  const s = blankScene(); s.elements = [{ ...customLens('b', 250), focal: 100 }, customLens('a', 100)];
  const r = traceBench(s); near(r.span, 8); near(r.angleSpan, 0);
  assert.ok(missionChecks('expand', s).every(c => c.pass));
});
test('rays terminate at first finite aperture, never reaching downstream elements', () => {
  const s = blankScene(); s.elements = [{ ...customLens('iris', 100), kind: 'iris', aperture: 1 }, customLens('b', 200)];
  const r = traceBench(s); const stopped = r.rays.filter(ray => ray.blocked);
  assert.ok(stopped.length > 0); assert.ok(stopped.every(ray => ray.blocked === 'iris' && ray.points.at(-1).z === 100));
});
test('completely blocked bundle has no fabricated span', () => {
  const s = blankScene(); s.elements = [{ ...customLens('iris', 100), kind: 'iris', y: 20, aperture: 1 }];
  const r = traceBench(s); assert.equal(r.passed, 0); assert.equal(r.span, null); assert.equal(r.angleSpan, null);
});
test('decentered lens steers central ray with the correct sign', () => {
  const s = blankScene(); s.elements = [{ ...customLens('a', 100), y: 2, focal: 100 }];
  const r = traceBench(s).rays[8]; near(r.angle, .02); near(r.points.at(-1).y, 10);
});
test('Galilean negative-positive combination doubles beam without inversion', () => {
  const s = blankScene(); s.elements = [{ ...customLens('a', 100), focal: -50 }, { ...customLens('b', 150), focal: 100 }];
  const r = traceBench(s); near(r.span, 8); near(r.angleSpan, 0); assert.ok(r.rays.at(-1).points.every(p => p.y > 0));
});
test('challenges cannot be passed by shrinking source or clipping rays', () => {
  const s = missionStart('focus'); s.diameter = .1;
  assert.equal(missionChecks('focus', s)[0].pass, false);
  s.diameter = 4; s.elements[0].aperture = .1;
  assert.equal(missionChecks('focus', s)[1].pass, false);
});
test('all three challenges have a reachable solution', () => {
  const s = missionStart('focus'); s.elements[0].z = 300;
  assert.ok(missionChecks('focus', s).every(c => c.pass));
});
test('scene import enforces finite bounded values, unique IDs and positive apertures', () => {
  const good = { ...blankScene(), elements: [customLens('a')] };
  assert.deepEqual(parseScene(good), good);
  for (const bad of [{ ...good, diameter: NaN }, { ...good, fullAngle: -1 }, { ...good, elements: [good.elements[0], good.elements[0]] }, { ...good, elements: [{ ...good.elements[0], focal: 0 }] }, { ...good, elements: [{ ...good.elements[0], aperture: 60 }] }, { ...good, elements: [{ ...good.elements[0], z: 900 }] }]) assert.throws(() => parseScene(bad));
  assert.equal(parseScene({ ...good, elements: [{ ...good.elements[0], sku: 'LA1131-A' }] }).elements[0].sku, undefined);
});
test('manufacturer catalog matches downloaded official nominal titles and labels assumptions', () => {
  const catalog = JSON.parse(readFileSync(new URL('../app/training/thorlabs-catalog.json', import.meta.url)));
  assert.equal(catalog.length, 12);
  for (const p of catalog) {
    const raw = JSON.parse(readFileSync(new URL(`../public${p.record}`, import.meta.url)));
    const title = raw.descriptionsWithFallbacksTL.find(d => d.reviewType === 'Title').content;
    assert.equal(p.focal, Number(title.match(/f\s*=\s*(-?[\d.]+)\s*mm/)[1]));
    assert.equal(p.diameter, title.includes('Ø1/2"') ? 12.7 : 25.4);
    assert.ok(p.aperture <= p.diameter); assert.match(p.apertureBasis, /教学假设/);
    assert.equal(p.thickness, null); assert.equal(p.backFocalLength, null);
  }
});
