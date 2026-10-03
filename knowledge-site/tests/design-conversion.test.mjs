import test from 'node:test';
import assert from 'node:assert/strict';
import { blankProject, customDesignLens } from '../app/design/core/design-engine.ts';
import { convertSequentialProject } from '../app/design/design-conversion.ts';

test('spatial copy preserves the geometric source and optical prescription without mutating it', () => {
  const p = blankProject();
  p.name = 'copy'; p.source.tilt = 20; p.source.offset = 3; p.source.diameter = 6; p.source.fullAngle = 12;
  p.source.model = 'extended'; p.elements = [{ ...customDesignLens('lens', 150), y: -2, focal: -50 }];
  p.screenAperture = 7;
  const original = structuredClone(p); const scene = convertSequentialProject(p);
  assert.deepEqual(p, original);
  assert.equal(scene.source.directionDeg, 20 * 180 / (1000 * Math.PI));
  assert.equal(scene.source.diameter, 6); assert.equal(scene.source.fullAngle, 12); assert.equal(scene.source.model, 'extended');
  assert.equal(scene.elements[0].x, 150); assert.equal(scene.elements[0].y, -2); assert.equal(scene.elements[0].focal, -50);
  assert.equal(scene.elements.at(-1).aperture, 7); assert.equal(scene.elements.at(-1).x, p.screen);
});

test('an unlimited sequential target is explicitly converted into a bounded spatial detector', () => {
  const p = blankProject(); const s = convertSequentialProject(p); const detector = s.elements.at(-1);
  assert.match(detector.name, /有限视场/);
  assert.equal(detector.aperture, s.bounds.maxY - s.bounds.minY);
  assert.ok(detector.diameter >= detector.aperture);
  assert.ok(s.bounds.maxX > p.screen && s.bounds.minX < 0);
});

test('Gaussian rays cannot silently become power-weighted spatial rays', () => {
  const p = blankProject(); p.source.mode = 'gaussian';
  assert.throws(() => convertSequentialProject(p), /几何光源/);
});

test('legacy Unicode identifiers and blank names are canonicalized for spatial copies', () => {
  const p = blankProject(); p.name = '光'.repeat(120); p.elements = [{ ...customDesignLens('透镜 甲', 150), name: '' }];
  const s = convertSequentialProject(p);
  assert.equal(s.name.length, 120); assert.match(s.elements[0].id, /^[a-zA-Z0-9_-]{1,64}$/);
  assert.equal(s.elements[0].name, '薄透镜'); assert.equal(p.elements[0].id, '透镜 甲');
});
