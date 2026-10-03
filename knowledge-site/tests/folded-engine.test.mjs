import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, foldedPresets, parseFoldedScene, traceFoldedScene } from '../app/design/folded-engine.ts';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const element = (kind, id, x, y, overrides = {}) => ({ ...foldedElement(kind, id, x, y), ...overrides });
const scene = (elements = [], source = {}, bounds = {}) => ({ ...blankFoldedScene(), elements, source: { ...blankFoldedScene().source, ...source }, bounds: { ...blankFoldedScene().bounds, ...bounds } });
const balanced = result => near(result.energy.balanceError, 0, 1e-10);

test('normal -45 degrees folds +X incident rays into +Y exactly', () => {
  const r = traceFoldedScene(foldedPresets().mirror);
  near(r.energy.captured, 1); near(r.energy.escaped, 0); balanced(r);
  const first = r.segments.find(s => s.event === 'mirror');
  const next = r.segments.find(s => s.branchId === first.branchId + '.R');
  near(next.start.x, next.end.x); assert.ok(next.end.y > next.start.y);
  near(r.detectors[0].span, 4); near(r.detectors[0].angleRms, 0);
});

test('rotating mirror normal +45 degrees folds +X toward -Y', () => {
  const r = traceFoldedScene(scene([
    element('mirror', 'm', 320, 150, { angleDeg: 45 }),
    element('detector', 'd', 320, 20, { angleDeg: 90 }),
  ]));
  near(r.detectors[0].power, 1); balanced(r);
  const s = r.segments.find(s => s.event === 'detector');
  near(s.start.x, s.end.x); assert.ok(s.end.y < s.start.y);
});

test('50:50 plane splitter captures half power on each focused branch', () => {
  const r = traceFoldedScene(foldedPresets().split);
  for (const d of r.detectors) { near(d.power, .5); near(d.rms, 0); assert.equal(d.rayCount, 25); }
  near(r.energy.captured, 1); balanced(r);
  const f = r.footprints.find(f => f.elementId === 'splitter-1');
  near(f.incomingPower, 1); near(f.reflectedPower, .5); near(f.transmittedPower, .5);
});

test('unequal splitting and actual coating loss conserve supplied power', () => {
  const s = foldedPresets().split;
  s.elements[0].reflectance = .3; s.elements[0].transmittance = .6; s.source.intensity = 7;
  const r = traceFoldedScene(s);
  near(r.detectors.find(d => d.elementId === 'detector-r').power, 2.1);
  near(r.detectors.find(d => d.elementId === 'detector-t').power, 4.2);
  near(r.energy.absorbed, .7); balanced(r);
});

test('two-stage splitting yields one half and two quarter-power outputs', () => {
  const r = traceFoldedScene(scene([
    element('beamsplitter', 'bs1', 250, 150),
    element('detector', 'r1', 250, 440, { angleDeg: 90 }),
    element('beamsplitter', 'bs2', 450, 150),
    element('detector', 'r2', 450, 440, { angleDeg: 90 }),
    element('detector', 't2', 650, 150),
  ]));
  near(r.detectors.find(d => d.elementId === 'r1').power, .5);
  near(r.detectors.find(d => d.elementId === 'r2').power, .25);
  near(r.detectors.find(d => d.elementId === 't2').power, .25); balanced(r);
});

test('iris clear-aperture clipping absorbs blocked samples and passes the rest', () => {
  const r = traceFoldedScene(scene([
    element('iris', 'a', 200, 150, { aperture: 1 }),
    element('detector', 'd', 500, 150),
  ]));
  const passed = 7 / 25;
  near(r.energy.captured, passed); near(r.energy.absorbed, 1 - passed); balanced(r);
  assert.equal(r.detectors[0].rayCount, 7);
  const blocked = r.segments.filter(s => s.event === 'blocked');
  assert.equal(blocked.length, 18); assert.ok(blocked.every(s => s.elementId === 'a'));
});

test('finite physical segments are bypassed rather than infinite absorbing planes', () => {
  const r = traceFoldedScene(scene([element('iris', 'a', 200, 150, { diameter: 1, aperture: 1 })]));
  near(r.energy.escaped, 1); near(r.energy.absorbed, 0); balanced(r);
  assert.equal(r.footprints[0].hits, 7);
  const missed = traceFoldedScene(scene([element('detector', 'd', 300, 300)]));
  near(missed.detectors[0].power, 0); assert.equal(missed.detectors[0].rms, null);
});

test('tilted thin lens focuses collimated rays along its local axis', () => {
  const r = traceFoldedScene(scene([
    element('lens', 'l', 250, 250, { angleDeg: 90 }),
    element('detector', 'd', 250, 350, { angleDeg: 90 }),
  ], { x: 250, y: 100, directionDeg: 90 }));
  near(r.energy.captured, 1); near(r.detectors[0].rms, 0); near(r.detectors[0].span, 0); balanced(r);
});

test('thin lens refraction is valid for propagation from its reverse side', () => {
  const r = traceFoldedScene(scene([
    element('lens', 'l', 400, 150), element('detector', 'd', 300, 150),
  ], { x: 650, y: 150, directionDeg: 180 }));
  near(r.energy.captured, 1); near(r.detectors[0].rms, 0); balanced(r);
});

test('flipping lens-plane normal by 180 degrees does not change physical rays', () => {
  const s = scene([
    element('lens', 'l', 400, 150, { y: 151 }), element('detector', 'd', 300, 150),
  ], { x: 650, y: 150, directionDeg: 180, fullAngle: 5 });
  const a = traceFoldedScene(s);
  s.elements[0].angleDeg = 180;
  const b = traceFoldedScene(s);
  near(a.detectors[0].centroid, b.detectors[0].centroid);
  near(a.detectors[0].rms, b.detectors[0].rms);
  for (let i = 0; i < a.segments.length; i++) {
    near(a.segments[i].end.x, b.segments[i].end.x);
    near(a.segments[i].end.y, b.segments[i].end.y);
  }
  balanced(a); balanced(b);
});

test('mirror normal reversal represents the same reflecting plane', () => {
  const s = foldedPresets().mirror;
  const a = traceFoldedScene(s);
  s.elements[0].angleDeg += 180;
  const b = traceFoldedScene(s);
  near(a.detectors[0].power, b.detectors[0].power);
  near(a.detectors[0].centroid, b.detectors[0].centroid);
  near(a.detectors[0].rms, b.detectors[0].rms);
  balanced(a); balanced(b);
});

test('fold after a lens preserves ideal geometric focus along reflected path', () => {
  const r = traceFoldedScene(foldedPresets().focus);
  near(r.energy.captured, 1); near(r.detectors[0].rms, 0); balanced(r);
});

test('ray-plane intersection chooses the nearest element regardless of table order', () => {
  const s = scene([element('detector', 'back', 500, 150), element('detector', 'front', 200, 150)]);
  const r = traceFoldedScene(s);
  near(r.detectors.find(d => d.elementId === 'front').power, 1);
  near(r.detectors.find(d => d.elementId === 'back').power, 0); balanced(r);
});

test('independent source diameter and full divergence compute a free-space fan', () => {
  const r = traceFoldedScene(scene([element('detector', 'd', 560, 150, { diameter: 100, aperture: 100 })], { diameter: 6, fullAngle: 20 }));
  near(r.detectors[0].span, 6 + 1000 * Math.tan(.01));
  near(r.energy.captured, 1); balanced(r);
});

test('extended source uses independent deterministic position-angle sampling', () => {
  const r = traceFoldedScene(scene([
    element('lens', 'l', 250, 150), element('detector', 'd', 350, 150),
  ], { model: 'extended', fullAngle: 20 }));
  assert.equal(r.sourceRayCount, 25); assert.ok(r.detectors[0].rms > .1);
  near(r.detectors[0].span, 200 * Math.tan(.01)); balanced(r);
});

test('mirror reflection loss is absorbed without a fake transmitted branch', () => {
  const s = foldedPresets().mirror; s.elements[0].reflectance = .8;
  const r = traceFoldedScene(s);
  near(r.energy.captured, .8); near(r.energy.absorbed, .2); balanced(r);
  assert.ok(r.segments.every(s => !s.branchId.endsWith('.T')));
});

test('recurrent two-mirror cavity stops at explicit event limit with unresolved power', () => {
  const r = traceFoldedScene(scene([
    element('mirror', 'left', 200, 150, { angleDeg: 0 }),
    element('mirror', 'right', 400, 150, { angleDeg: 0 }),
  ], { x: 300 }, {}), { maxEvents: 8 });
  near(r.energy.unresolved, 1); near(r.energy.absorbed, 0); near(r.energy.escaped, 0); balanced(r);
  assert.ok(r.segments.some(s => s.event === 'limit'));
  assert.ok(r.footprints.some(f => f.hits > r.sourceRayCount));
});

test('low-power split cutoff remains unresolved and preserves conservation', () => {
  const s = foldedPresets().split; s.elements[0].reflectance = .001; s.elements[0].transmittance = .999;
  const r = traceFoldedScene(s, { minPowerFraction: .001 });
  near(r.energy.unresolved, .001); near(r.energy.captured, .999); balanced(r);
});

test('global segment budget accounts for every remaining live branch', () => {
  const r = traceFoldedScene(foldedPresets().split, { maxSegments: 2 });
  assert.equal(r.segments.length, 2); assert.ok(r.energy.unresolved > .9); balanced(r);
});

test('parallel ray does not invent a crossing of a mirror plane', () => {
  const r = traceFoldedScene(scene([element('mirror', 'm', 300, 150, { angleDeg: 90 })]));
  assert.equal(r.footprints[0].hits, 0); near(r.energy.escaped, 1); balanced(r);
});

test('canonical parser discards unknown metadata and rejects invalid models and power', () => {
  const s = { ...foldedPresets().split, injected: '<script>', source: { ...blankFoldedScene().source, rogue: 'value' } };
  const p = parseFoldedScene(s);
  assert.ok(!('injected' in p)); assert.ok(!('rogue' in p.source));
  assert.throws(() => parseFoldedScene({ ...s, version: 9 }), /版本/);
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, model: 'gaussian' } }), /模型/);
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, intensity: -1 } }), /功率/);
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, rayCount: 4.5 } }), /整数/);
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, directionDeg: NaN } }), /方向/);
});

test('parser prevents unphysical R+T, zero focal length, outside points and duplicate ids', () => {
  const s = foldedPresets().split;
  assert.throws(() => parseFoldedScene({ ...s, elements: [{ ...s.elements[0], reflectance: .6, transmittance: .6 }] }), /之和/);
  assert.throws(() => parseFoldedScene(scene([element('lens', 'l', 200, 150, { focal: 0 })])), /焦距/);
  assert.throws(() => parseFoldedScene(scene([element('iris', 'a', 200, 150, { aperture: 100 })])), /孔径/);
  assert.throws(() => parseFoldedScene(scene([element('mirror', 'm', -100, 150)])), /元件 X/);
  assert.throws(() => parseFoldedScene(scene([element('mirror', 'same', 200, 150), element('lens', 'same', 400, 150)])), /唯一/);
  assert.throws(() => parseFoldedScene({ ...s, bounds: { ...s.bounds, maxX: s.bounds.minX } }), /宽高/);
});

test('detector angular RMS is circular and remains small across +/-180 degree wrap', () => {
  const r = traceFoldedScene(scene([element('detector', 'd', 200, 150)], { x: 600, y: 150, directionDeg: 180, fullAngle: 20 }));
  assert.ok(r.detectors[0].angleRms > 0 && r.detectors[0].angleRms < 10); near(r.energy.captured, 1); balanced(r);
});

test('large local thin-lens angles produce a model-limit warning', () => {
  const r = traceFoldedScene(scene([element('lens', 'l', 250, 150, { focal: 5 })]));
  assert.ok(r.warnings.some(w => w.includes('近轴'))); balanced(r);
});

test('source rays beginning outside a finite workspace remain escaped energy', () => {
  const r = traceFoldedScene(scene([], { y: 0 }));
  near(r.energy.escaped, 1); balanced(r);
});

test('zero input power returns an empty trace with defined conservative accounting', () => {
  const r = traceFoldedScene(scene([element('detector', 'd', 300, 150)], { intensity: 0 }));
  assert.equal(r.segments.length, 0); assert.equal(r.sourceRayCount, 0);
  assert.equal(r.detectors[0].power, 0); assert.equal(r.detectors[0].rms, null);
  near(r.energy.input, 0); near(r.energy.unresolved, 0); balanced(r);
  assert.ok(r.warnings.some(w => w.includes('功率为 0')));
});

test('intersecting finite optical planes warn even when their centers differ', () => {
  const r = traceFoldedScene(scene([
    element('mirror', 'a', 320, 150, { angleDeg: -45 }),
    element('mirror', 'b', 330, 140, { angleDeg: 45 }),
  ], { diameter: .01, rayCount: 3 }));
  assert.ok(r.warnings.some(w => w.includes('同一命中点'))); balanced(r);
});
