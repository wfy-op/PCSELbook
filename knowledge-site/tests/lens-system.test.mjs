import test from 'node:test';
import assert from 'node:assert/strict';
import { getLensPreset, traceLensSystem } from '../app/training/lens-system.ts';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

test('Kepler telescope reverses and doubles a collimated bundle, with parallel output', () => {
  const result = traceLensSystem(getLensPreset('kepler'));
  assert.equal(result.afocal, true);
  near(result.afocalMagnification, -2);
  near(result.targetSpan, 10);
  for (const ray of result.rays) { near(ray.outputAngle, 0); near(ray.points.at(-1).y, -2 * ray.points[0].y); }
});

test('Galilean telescope doubles the bundle without inversion or an internal crossing', () => {
  const result = traceLensSystem(getLensPreset('galilean'));
  near(result.afocalMagnification, 2);
  near(result.targetSpan, 10);
  const upper = result.rays.at(-1);
  assert.ok(upper.points.every(point => point.y > 0));
  near(upper.outputAngle, 0);
});

test('4f relay maps two independent object points to inverted images, regardless of launch angle', () => {
  const result = traceLensSystem(getLensPreset('relay'));
  assert.equal(result.imagesOnTarget, true);
  near(result.imagingMagnification, -2);
  near(result.targetMatrix.b, 0);
  near(result.maxFamilySpread, 0);
  near(result.targetSpan, 6);
  for (const ray of result.rays) near(ray.points.at(-1).y, -2 * ray.points[0].y);
});

test('75 mm final lens focuses an expanded parallel bundle at 75 mm', () => {
  const result = traceLensSystem(getLensPreset('pump'));
  assert.equal(result.collimatedFocusOnTarget, true);
  assert.equal(result.afocal, false);
  near(result.targetSpan, 0);
  // A 2 mm input range expands to 4 mm before the 75 mm focusing lens.
  near(result.rays.at(-1).points[3].y, -2);
  near(result.rays.at(-1).outputAngle, 2 / 75);
  near(result.targetZ, 385);
});

test('moving a screen preserves collimated width, but spoils a point image', () => {
  const parallel = getLensPreset('kepler');
  parallel.targetDistance += 35;
  near(traceLensSystem(parallel).targetSpan, 10);
  const image = getLensPreset('relay');
  image.targetDistance += 35;
  const result = traceLensSystem(image);
  assert.equal(result.imagesOnTarget, false);
  assert.equal(result.imagingMagnification, null);
  // 4f relay halves the angular fan (40 mrad to 20 mrad): 35 mm × .02 rad = .7 mm.
  near(result.maxFamilySpread, .7);
});

test('20 mm spacing error destroys afocality; matrices conserve phase-space area', () => {
  const config = getLensPreset('kepler');
  config.gaps[0] = 170;
  const result = traceLensSystem(config);
  assert.equal(result.afocal, false);
  assert.equal(result.afocalMagnification, null);
  near(result.outputMatrix.c, .004);
  const { a, b, c, d } = result.targetMatrix;
  near(a * d - b * c, 1);
});

test('invalid, zero-focal-length and nonpositive-distance configurations are rejected', () => {
  for (const patch of [{ focalLengths: [0, 100] }, { gaps: [0] }, { targetDistance: -1 }, { sourceDistance: Infinity }, { focalLengths: [50, NaN] }, { gaps: [] }]) assert.equal(traceLensSystem({ ...getLensPreset('kepler'), ...patch }), null);
});

test('presets are copied before edit and negative focal lengths remain valid', () => {
  const config = getLensPreset('galilean');
  config.focalLengths[0] = -75;
  assert.equal(getLensPreset('galilean').focalLengths[0], -50);
  assert.notEqual(traceLensSystem(config), null);
});
