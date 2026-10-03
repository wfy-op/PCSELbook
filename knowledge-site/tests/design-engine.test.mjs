import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  blankProject, customDesignLens, catalogDesignLens, parseDesignProject,
  analyzeDesign, multiplyMatrices, optimizePositions,
} from '../app/design/design-engine.ts';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}, tolerance ${tolerance}`);
const lens = (id, z, focal = 100, overrides = {}) => ({ ...customDesignLens(id, z), focal, ...overrides });
const gaussianProject = (source = {}) => ({ ...blankProject(), source: { ...blankProject().source, mode: 'gaussian', ...source } });
const catalog = JSON.parse(readFileSync(new URL('../app/training/thorlabs-catalog.json', import.meta.url)));

test('free-space source diameter and full divergence remain independent', () => {
  const p = blankProject();
  p.source.diameter = 6; p.source.fullAngle = 20; p.source.offset = 2; p.source.tilt = 3; p.screen = 500;
  const r = analyzeDesign(p);
  near(r.span, 16); near(r.angleSpan, 20); near(r.centroid, 3.5);
  near(r.matrix.A, 1); near(r.matrix.B, 500); near(r.matrix.D, 1);
  assert.equal(r.passed, 25); assert.equal(r.bestFocus.afterLastElement, false);
  near(analyzeDesign({ ...p, source: { ...p.source, fullAngle: 0 } }).span, 6);
});

test('affine matrix predicts every surviving ray through decentered lenses', () => {
  const p = { ...blankProject(), elements: [lens('second', 260, 80, { y: -.5 }), lens('first', 100, 60, { y: 1 })] };
  const r = analyzeDesign(p);
  assert.equal(r.passed, r.total);
  for (const ray of r.rays) {
    near(ray.points.at(-1).y, r.matrix.A * ray.initial.y + r.matrix.B * ray.initial.angle + r.matrix.E);
    near(ray.angle, r.matrix.C * ray.initial.y + r.matrix.D * ray.initial.angle + r.matrix.F);
  }
  near(r.matrix.A * r.matrix.D - r.matrix.B * r.matrix.C, 1);
});

test('matrix multiplication includes decenter affine offsets in proper order', () => {
  const lensM = { A: 1, B: 0, C: -.01, D: 1, E: 0, F: .02 };
  const drift = { A: 1, B: 100, C: 0, D: 1, E: 0, F: 0 };
  const m = multiplyMatrices(drift, lensM);
  near(m.A, 0); near(m.E, 2); near(m.F, .02);
});

test('cardinal EFL and BFL use first-lens to last-lens planes, excluding source and screen', () => {
  const p = { ...blankProject(), elements: [lens('a', 120, 50), lens('b', 220, 100)] };
  const r = analyzeDesign(p);
  near(r.cardinal.efl, 100); near(r.cardinal.bfl, -100); near(r.cardinal.backFocusZ, 120);
  near(r.cardinal.matrix.A, -1); near(r.cardinal.matrix.C, -.01);
  const movedScreen = analyzeDesign({ ...p, screen: 900 });
  near(movedScreen.cardinal.efl, r.cardinal.efl); near(movedScreen.cardinal.bfl, r.cardinal.bfl);
  assert.notEqual(movedScreen.matrix.B, r.matrix.B);
});

test('afocal telescope has no finite cardinal focal length, rather than Infinity JSON', () => {
  const r = analyzeDesign({ ...blankProject(), elements: [lens('a', 100, 50), lens('b', 250, 100)] });
  assert.equal(r.cardinal.afocal, true); assert.equal(r.cardinal.efl, null); assert.equal(r.cardinal.bfl, null);
  near(r.span, 8); near(r.angleSpan, 0); assert.equal(r.bestFocus, null);
});

test('geometric best focus minimizes centroid variance analytically', () => {
  const p = { ...blankProject(), elements: [lens('a', 200, 100, { y: 1 })] };
  p.source.tilt = 5;
  const r = analyzeDesign(p);
  near(r.bestFocus.z, 300); near(r.bestFocus.rms, 0); near(r.bestFocus.centroid, 1.5);
  near(r.cardinal.bfl, 100); near(r.rms, Math.sqrt(variance(r.rays.map(ray => ray.points.at(-1).y))));
});

function variance(values) { const avg = values.reduce((sum, n) => sum + n, 0) / values.length; return values.reduce((sum, n) => sum + (n - avg) ** 2, 0) / values.length; }

test('extended source focus has finite centroid RMS and no fabricated perfect focus', () => {
  const p = { ...blankProject(), elements: [lens('a', 200, 100)] };
  p.source.model = 'extended'; p.source.fullAngle = 20;
  const r = analyzeDesign(p);
  assert.equal(r.total, 81); assert.ok(r.bestFocus.rms > 0); near(r.bestFocus.z, 320);
});

test('finite aperture terminates rays, reports true incident footprint and zero upstream survivors', () => {
  const p = { ...blankProject(), elements: [lens('stop', 100, 100, { kind: 'iris', aperture: 1 }), lens('b', 300)] };
  const r = analyzeDesign(p);
  near(r.footprints[0].span, 4); near(r.footprints[0].apertureMargin, -1.5);
  assert.ok(r.footprints[0].blockedCount > 0);
  assert.equal(r.footprints[1].incomingCount, r.footprints[0].passedCount);
  assert.ok(r.rays.filter(ray => ray.blocked).every(ray => ray.points.at(-1).z === 100));
  const noRays = analyzeDesign({ ...p, elements: [lens('offaxis', 100, 100, { kind: 'iris', aperture: 1, y: 20 }), lens('b', 300)] });
  assert.equal(noRays.span, null); assert.equal(noRays.rms, null); assert.equal(noRays.bestFocus, null);
  assert.equal(noRays.footprints[1].span, null);
});

test('finite target aperture blocks target rays without erasing their endpoint', () => {
  const r = analyzeDesign({ ...blankProject(), screenAperture: 1 });
  assert.ok(r.passed < r.total);
  assert.ok(r.rays.filter(ray => ray.blocked === 'target').every(ray => ray.points.at(-1).z === 600));
  assert.ok(r.span <= 1 + 1e-9);
  const focusedProject = { ...blankProject(), elements: [lens('a', 200)], screenAperture: 1 };
  near(analyzeDesign(focusedProject).bestFocus.z, analyzeDesign({ ...focusedProject, screenAperture: 0 }).bestFocus.z);
});

test('Gaussian free-space q propagation follows the actual waist and Rayleigh length', () => {
  const p = gaussianProject({ w0: .1, waistZ: 150, wavelength: 532 });
  p.screen = 600;
  const r = analyzeDesign(p).gaussian;
  const rayleigh = Math.PI * .1 ** 2 / .000532;
  near(r.waist.z, 150); near(r.waist.w0, .1); near(r.waist.rayleigh, rayleigh);
  near(r.screen.w, .1 * Math.sqrt(1 + (450 / rayleigh) ** 2));
  near(r.sourceDiameter, .2 * Math.sqrt(1 + (150 / rayleigh) ** 2));
  near(r.waist.fullAngle, 2000 * .000532 / (Math.PI * .1));
  assert.ok(r.samples.length > 100); assert.equal(r.valid, true);
});

test('Gaussian lens at incident waist agrees with analytical thin-lens focusing', () => {
  const f = 100;
  const p = gaussianProject({ w0: 1, waistZ: 100, wavelength: 532 });
  p.elements = [lens('a', 100, f)];
  const r = analyzeDesign(p).gaussian;
  const zr = Math.PI / .000532;
  near(r.waist.z, 100 + f / (1 + (f / zr) ** 2));
  near(r.waist.w0, 1 / Math.sqrt(1 + (zr / f) ** 2));
  assert.ok(r.waist.w0 > 0); assert.ok(r.waist.z < 200);
  near(r.elements[0].w, 1); assert.equal(r.elements[0].curvature, null);
});

test('Gaussian decenter steers center but does not fabricate a changed ideal beam width', () => {
  const p = gaussianProject(); p.elements = [lens('a', 100, 100)];
  const q1 = analyzeDesign(p).gaussian;
  const q2 = analyzeDesign({ ...p, elements: [{ ...p.elements[0], y: 1 }] }).gaussian;
  near(q2.screen.w, q1.screen.w); near(q2.screen.center, 5);
  near(q2.waist.w0, q1.waist.w0);
});

test('an afocal 2x telescope doubles Gaussian waist radius while retaining finite diffraction', () => {
  const p = gaussianProject({ w0: .1, waistZ: 100 });
  p.elements = [lens('a', 100, 50), lens('b', 250, 100)];
  const r = analyzeDesign(p);
  assert.equal(r.cardinal.afocal, true);
  near(r.gaussian.waist.w0, .2);
  near(r.gaussian.waist.z, 550);
  near(r.gaussian.waist.fullAngle, r.gaussian.sourceFullAngle / 2);
  assert.ok(r.gaussian.waist.fullAngle > 0);
});

test('M² envelope preserves the chosen beam parameter product and enlarges divergence', () => {
  const g1 = analyzeDesign(gaussianProject({ w0: .5, m2: 1 })).gaussian;
  const g2 = analyzeDesign(gaussianProject({ w0: .5, m2: 2 })).gaussian;
  near(g2.waist.fullAngle, 2 * g1.waist.fullAngle);
  near(g2.waist.rayleigh, g1.waist.rayleigh / 2);
  near(g2.waist.w0 * g2.waist.fullAngle / 2000, .000532 * 2 / Math.PI);
});

test('Gaussian clipping invalidates ideal-envelope output instead of reporting false transmission', () => {
  const p = gaussianProject({ w0: 2 });
  p.elements = [lens('stop', 100, 100, { kind: 'iris', aperture: 1 })];
  const r = analyzeDesign(p);
  assert.equal(r.gaussian.valid, false); assert.ok(r.gaussian.elements[0].apertureMargin < 0);
  assert.ok(r.gaussian.screen.w > 0); assert.match(r.warnings.join(' '), /理想外推/);
  const targetClips = analyzeDesign({ ...gaussianProject({ w0: 2 }), screenAperture: 1 });
  assert.equal(targetClips.gaussian.valid, false); assert.ok(targetClips.gaussian.screen.clearanceMargin < 0);
});

test('Gaussian final-segment virtual waist is clearly marked upstream of the lens', () => {
  const p = gaussianProject(); p.elements = [lens('negative', 100, -100)];
  const r = analyzeDesign(p);
  assert.equal(r.gaussian.waist.afterLastLens, false); assert.equal(r.gaussian.waist.afterLastElement, false);
  assert.match(r.warnings.join(' '), /上游/);
});

test('project validation migrates v1 while preserving an independently verified catalog SKU', () => {
  const v1 = { version: 1, diameter: 4, fullAngle: 10, sourceModel: 'fan', screen: 600, elements: [catalogDesignLens(catalog[2], 'a', 150)] };
  const p = parseDesignProject(v1, catalog);
  assert.equal(p.version, 2); assert.equal(p.screenAperture, 0); near(p.source.fullAngle, 10);
  assert.equal(p.elements[0].sku, 'LA1131-A'); assert.equal(p.elements[0].apertureBasis, 'assumed-90-percent');
  const changed = parseDesignProject({ ...p, elements: [{ ...p.elements[0], focal: 55 }] }, catalog);
  assert.equal(changed.elements[0].sku, undefined); assert.equal(changed.elements[0].apertureBasis, 'custom');
  assert.equal(parseDesignProject(p).elements[0].sku, undefined);
});

test('strict finite validation rejects corrupt source, duplicate IDs and aperture/position bounds', () => {
  const p = { ...blankProject(), elements: [lens('a', 100)] };
  assert.deepEqual(parseDesignProject(p), p);
  for (const bad of [
    null, [], { ...p, version: 3 }, { ...p, source: { ...p.source, w0: 0 } },
    { ...p, source: { ...p.source, tilt: Infinity } }, { ...p, screenAperture: -1 },
    { ...p, elements: [p.elements[0], p.elements[0]] },
    { ...p, elements: [{ ...p.elements[0], aperture: 99 }] },
    { ...p, elements: [{ ...p.elements[0], focal: 0 }] },
    { ...p, elements: [{ ...p.elements[0], z: 610 }] },
  ]) assert.throws(() => parseDesignProject(bad));
});

test('position optimization computes a better geometric focal plane without editing source or specs', () => {
  const p = { ...blankProject(), screen: 500, elements: [lens('moving', 250, 100), lens('fixed-stop', 450, 100, { kind: 'iris' })] };
  const original = JSON.stringify(p);
  const result = optimizePositions(p, { target: { kind: 'focus' }, selectedIds: ['moving'], minGap: 10 });
  assert.equal(result.feasible, true); assert.equal(result.improved, true); assert.ok(result.after < 1e-4);
  near(result.project.elements[0].z, 400, .001);
  assert.equal(result.project.elements[1].z, 450); assert.deepEqual(result.project.source, p.source);
  assert.equal(result.project.elements[0].focal, 100); assert.equal(JSON.stringify(p), original);
  assert.equal(analyzeDesign(result.project).passed, analyzeDesign(result.project).total);
});

test('position optimization actually reduces Gaussian spot with finite diffraction', () => {
  const p = gaussianProject({ w0: 1 }); p.screen = 500; p.elements = [lens('a', 200, 100)];
  const result = optimizePositions(p, { target: { kind: 'focus' }, selectedIds: ['a'] });
  assert.equal(result.feasible, true); assert.equal(result.improved, true); assert.ok(result.after < .04);
  assert.ok(result.after > .01); assert.ok(analyzeDesign(result.project).gaussian.valid);
});

test('diameter optimization cannot use geometric clipping to cheat the target', () => {
  const p = { ...blankProject(), screenAperture: .1, elements: [lens('a', 100, 100)] };
  const result = optimizePositions(p, { target: { kind: 'diameter', value: 2 }, maxIterations: 20 });
  assert.equal(result.feasible, true);
  const analysis = analyzeDesign(result.project);
  assert.equal(analysis.passed, analysis.total); assert.ok(analysis.span <= .1 + 1e-9);
  assert.ok(result.after >= .95 - 1e-9); // honest mismatch, not a fabricated 2 mm design
});

test('optimization respects positional bounds, minimum gap and optional output-angle constraint', () => {
  const p = { ...blankProject(), screen: 500, elements: [lens('a', 150, 100), lens('b', 350, 100)] };
  const result = optimizePositions(p, { target: { kind: 'collimation' }, minZ: 100, maxZ: 400, minGap: 20 });
  assert.equal(result.feasible, true);
  const es = [...result.project.elements].sort((a, b) => a.z - b.z);
  assert.ok(es.every(e => e.z >= 100 && e.z <= 400)); assert.ok(es[1].z - es[0].z >= 20);
  assert.ok(result.after < 1e-4);
  const impossible = optimizePositions({ ...blankProject(), elements: [lens('a', 100, 50)] }, { target: { kind: 'focus' }, maxOutputAngle: .01 });
  assert.equal(impossible.feasible, false);
});

test('invalid optimizer target cannot silently return NaN or edit the original', () => {
  assert.throws(() => optimizePositions({ ...blankProject(), elements: [lens('a', 100)] }, { target: { kind: 'diameter', value: 0 } }));
  const result = optimizePositions(blankProject(), { target: { kind: 'focus' }, selectedIds: [] });
  assert.equal(result.improved, false); assert.equal(result.evaluations, 0);
});
