import assert from 'node:assert/strict';
import test from 'node:test';
import { thinLens, traceAlignment } from '../app/training/optics.ts';

test('a 1 mrad single-plane mirror turn produces 2 mrad angular change', () => {
  const ray = traceAlignment(0, 0, 1, 0);
  assert.equal(ray.mirror2, .5);
  assert.ok(Math.abs(ray.near - .7) < 1e-12);
  assert.ok(Math.abs(ray.far - 1.7) < 1e-12);
  assert.equal(ray.nearPass, false);
  assert.equal(ray.farPass, false);
});

test('near centering alone can leave far point off axis; upstream stop blocks even a centered far prediction', () => {
  const onePoint = traceAlignment(0, 0, 1, -3.5);
  assert.ok(Math.abs(onePoint.near) < 1e-12);
  assert.equal(onePoint.far, -2.5);
  assert.equal(onePoint.aligned, false);
  const blocked = traceAlignment(1.4, 0, 0, -7 / 6);
  assert.ok(Math.abs(blocked.far) < 1e-12);
  assert.equal(blocked.nearPass, false);
  assert.equal(blocked.farPass, false);
});

test('independently constructed geometry reaches both references', () => {
  // Start 1 mm up, traverse 250 mm at -4 mrad, then leave horizontally.
  const ray = traceAlignment(1, 0, -2, 2);
  assert.equal(ray.mirror2, 0);
  assert.equal(ray.near, 0);
  assert.equal(ray.far, 0);
  assert.equal(ray.aligned, true);
});

test('2f imaging gives a unit-magnification inverted image and respects screen placement', () => {
  const lens = thinLens(150, 75, 150);
  assert.equal(lens.v, 150);
  assert.equal(lens.magnification, -1);
  assert.equal(lens.focused, true);
  assert.equal(thinLens(150, 75, 160).focused, false);
});

test('focal and virtual regimes cannot be focused onto a positive-distance screen', () => {
  assert.equal(thinLens(75, 75, 150).kind, 'infinite');
  assert.equal(thinLens(75, 75, 150).v, null);
  const virtual = thinLens(50, 100, 100);
  assert.equal(virtual.kind, 'virtual');
  assert.equal(virtual.v, -100);
  assert.equal(virtual.magnification, 2);
  assert.equal(virtual.focused, false);
});

test('nonphysical and nonfinite inputs are rejected', () => {
  assert.equal(thinLens(0, 75, 150), null);
  assert.equal(thinLens(150, -75, 150), null);
  assert.equal(thinLens(150, 75, NaN), null);
  assert.equal(traceAlignment(0, 0, Infinity, 0), null);
});
