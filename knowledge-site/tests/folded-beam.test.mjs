import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, foldedPresets, parseFoldedScene, traceFoldedScene } from '../app/design/core/folded-engine.ts';
import { analyzeBeamHits, buildSpotGrid, pupilAberrationSlope, sampleBeam } from '../app/design/core/beam-analysis.ts';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const relative = (actual, expected, tolerance = .02) => near(actual, expected, Math.max(1e-10, Math.abs(expected) * tolerance));
const element = (kind, id, x, y = 150, overrides = {}) => ({ ...foldedElement(kind, id, x, y), ...overrides });
const make = (elements = [], overrides = {}, beam = {}) => {
  const scene = blankFoldedScene();
  return { ...scene, elements, source: { ...scene.source, rayCount: 65, diameter: 8, fullAngle: 0, ...overrides,
    beam: { profile: 'gaussian', diameterMinor: 4, fullAngleMinor: 0, rotationDeg: 0, ...beam } } };
};
const detect = (result, id = 'd') => result.detectors.find(d => d.elementId === id);
const balanced = result => near(result.energy.balanceError, 0, 1e-9);

test('4D beam sampling is deterministic, independently centered and bounded', () => {
  const beam = { profile: 'gaussian', diameterMinor: 4, fullAngleMinor: 12, rotationDeg: 27 };
  const a = sampleBeam(8, 20, 65, beam), b = sampleBeam(8, 20, 65, beam);
  assert.deepEqual(a, b); assert.equal(a.length, 4096);
  const sum = key => a.reduce((s, h) => s + h[key], 0);
  for (const key of ['u', 'v', 'slopeU', 'slopeV']) near(sum(key), 0);
  const small = sampleBeam(8, 20, 3, beam); assert.equal(small.length, 64);
  assert.equal(sampleBeam(8, 20, 25, beam).length, 625);
});

test('Gaussian full 1/e² axes give sigma=D/4 and propagate both divergent axes', () => {
  const r = traceFoldedScene(make([element('detector', 'd', 260, 150, { diameter: 100, aperture: 100 })], { fullAngle: 20 }, { fullAngleMinor: 12 }));
  const spot = detect(r).spot;
  // Independent geometric Gaussian phase space: Var(h+L*theta)=Var(h)+L² Var(theta).
  relative(spot.rmsU, Math.sqrt((8 / 4) ** 2 + (200 * 20 / 4000) ** 2), .015);
  relative(spot.rmsV, Math.sqrt((4 / 4) ** 2 + (200 * 12 / 4000) ** 2), .015);
  near(spot.centroidU, 0); near(spot.centroidV, 0);
  near(spot.rms2D ** 2, spot.rmsU ** 2 + spot.rmsV ** 2);
  near(detect(r).rms, spot.rmsU); near(r.energy.captured, 1); balanced(r);
});

test('rotated elliptical source preserves principal radii and rotates measured covariance', () => {
  const r = traceFoldedScene(make([element('detector', 'd', 260, 150, { diameter: 100, aperture: 100 })], {}, { rotationDeg: 45 }));
  const spot = detect(r).spot;
  relative(spot.principalRmsMajor, 2, .012); relative(spot.principalRmsMinor, 1, .012);
  near(spot.orientationDeg, 45, .7);
  relative(spot.covarianceUV, (2 ** 2 - 1 ** 2) / 2, .02); balanced(r);
});

test('uniform ellipse stays inside both actual full-diameter boundaries', () => {
  const r = traceFoldedScene(make([element('detector', 'd', 260, 150, { diameter: 100, aperture: 100 })], {}, { profile: 'uniform' }));
  for (const hit of detect(r).spot.hits) assert.ok((hit.u / 4) ** 2 + (hit.v / 2) ** 2 <= 1 + 1e-12);
  relative(detect(r).spot.rmsU, 2, .015); relative(detect(r).spot.rmsV, 1, .015);
  balanced(r);
});

test('spherical ideal lens focuses both transverse coordinates at its focal plane', () => {
  const r = traceFoldedScene(make([element('lens', 'l', 250), element('detector', 'd', 350)]));
  near(detect(r).spot.rmsU, 0); near(detect(r).spot.rmsV, 0); near(detect(r).spot.rms2D, 0);
  near(r.energy.captured, 1); balanced(r);
});

test('cylindrical lens focuses one axis while the unpowered axis stays extended', () => {
  const r = traceFoldedScene(make([element('cylindrical', 'l', 250), element('detector', 'd', 350)]));
  near(detect(r).spot.rmsU, 0); relative(detect(r).spot.rmsV, 1, .012);
  near(r.energy.captured, 1); balanced(r);
});

test('cylinder roll of 90 degrees exchanges its powered and unpowered axes', () => {
  const r = traceFoldedScene(make([element('cylindrical', 'l', 250, 150, { rollDeg: 90 }), element('detector', 'd', 350)]));
  relative(detect(r).spot.rmsU, 2, .012); near(detect(r).spot.rmsV, 0);
  balanced(r);
});

test('different sagittal focal length yields the calculated two-axis astigmatic focus', () => {
  const r = traceFoldedScene(make([element('lens', 'l', 250, 150, { focalSagittal: 200 }), element('detector', 'd', 350)]));
  near(detect(r).spot.rmsU, 0); relative(detect(r).spot.rmsV, .5, .012);
  const s = make([element('lens', 'l', 250, 150, { focalSagittal: 200 }), element('detector', 'd', 450)]);
  const q = traceFoldedScene(s); relative(detect(q).spot.rmsU, 2, .012); near(detect(q).spot.rmsV, 0);
  balanced(r); balanced(q);
});

test('both axes focus identically when the same ideal lens is illuminated in reverse', () => {
  const r = traceFoldedScene(make([element('lens', 'l', 400), element('detector', 'd', 300)], { x: 650, directionDeg: 180 }));
  near(detect(r).spot.rms2D, 0); near(r.energy.captured, 1); balanced(r);
});

test('planar mirror preserves radii and reverses pupil parity in the folded detector basis', () => {
  const r = traceFoldedScene(make([element('mirror', 'm', 250), element('detector', 'd', 250, 350, { angleDeg: 90, diameter: 100, aperture: 100 })], {}, { rotationDeg: 33 }));
  const straight = traceFoldedScene(make([element('detector', 'd', 450, 150, { diameter: 100, aperture: 100 })], {}, { rotationDeg: 33 }));
  const a = detect(r).spot, b = detect(straight).spot;
  near(a.rmsU, b.rmsU); near(a.rmsV, b.rmsV); near(a.covarianceUV, -b.covarianceUV);
  near(a.principalRmsMajor, b.principalRmsMajor); near(a.principalRmsMinor, b.principalRmsMinor);
  near(a.grid.integratedPower, 1); balanced(r);
});

test('two real splitter branches focus both axes and conserve unequal power', () => {
  const s = foldedPresets().split;
  s.source = make().source; s.elements[0].reflectance = .3; s.elements[0].transmittance = .6;
  const r = traceFoldedScene(s);
  near(detect(r, 'detector-r').power, .3); near(detect(r, 'detector-t').power, .6);
  for (const d of r.detectors) { near(d.spot.rms2D, 0); near(d.spot.grid.integratedPower, d.power); }
  near(r.energy.absorbed, .1); balanced(r);
});

test('finite circular clear aperture clips V as well as U with counted real sample power', () => {
  const s = make([element('iris', 'a', 200, 150, { diameter: 25.4, aperture: 4 }), element('detector', 'd', 500)], { diameter: 8 }, { profile: 'uniform', diameterMinor: 8 });
  const r = traceFoldedScene(s);
  const samples = sampleBeam(8, 0, s.source.rayCount, s.source.beam);
  const expected = samples.filter(h => Math.hypot(h.u, h.v) <= 2 + 1e-8).length / samples.length;
  near(detect(r).power, expected); relative(expected, .25, .015);
  near(r.energy.absorbed, 1 - expected); balanced(r);
  assert.ok(detect(r).spot.hits.every(h => Math.hypot(h.u, h.v) <= 2 + 1e-8));
});

test('received intensity bins integrate to captured power and irradiance respects bin area', () => {
  const r = traceFoldedScene(make([element('detector', 'd', 260, 150, { diameter: 100, aperture: 100 })], { intensity: 7 }));
  const d = detect(r), grid = d.spot.grid, area = 4 * grid.extentU * grid.extentV / grid.size ** 2;
  near(grid.power.reduce((sum, p) => sum + p, 0), d.power); near(grid.outsidePower, 0);
  near(grid.irradiance.reduce((sum, density) => sum + density * area, 0), 7);
  const cropped = buildSpotGrid(d.spot.hits, { size: 32, extentU: .25, extentV: .25 });
  assert.ok(cropped.outsidePower > 0); near(cropped.integratedPower + cropped.outsidePower, d.power); balanced(r);
});

test('zero received power leaves empty geometry metrics and an empty honest density grid', () => {
  const spot = analyzeBeamHits([]);
  assert.equal(spot.rms2D, null); assert.equal(spot.centroidV, null); near(spot.grid.integratedPower, 0);
  assert.ok(spot.grid.irradiance.every(v => v === 0));
});

test('specified pupil OPD slope agrees with actual polynomial finite differences', () => {
  const aberration = { sphericalUm: 2.1, comaUm: -.8, astigmatismUm: .4 }, a = 10;
  const w = (u, v) => { const x = u / a, y = v / a, r2 = x * x + y * y;
    return .001 * (aberration.sphericalUm * r2 ** 2 + aberration.comaUm * x * r2 + aberration.astigmatismUm * (x * x - y * y)); };
  const u = 3.2, v = -1.7, h = .0001, slope = pupilAberrationSlope(u, v, a, aberration);
  near(slope.u, (w(u + h, v) - w(u - h, v)) / (2 * h), 1e-12);
  near(slope.v, (w(u, v + h) - w(u, v - h)) / (2 * h), 1e-12);
});

test('zero OPD coefficients recover ideal focus while spherical OPD yields real finite rays', () => {
  const base = make([element('lens', 'l', 250), element('detector', 'd', 350)]);
  const ideal = traceFoldedScene(base);
  base.elements[0].aberration = { sphericalUm: 0, comaUm: 0, astigmatismUm: 0 };
  const zero = traceFoldedScene(base); near(detect(zero).spot.rms2D, detect(ideal).spot.rms2D);
  base.elements[0].aberration.sphericalUm = 20;
  const aberrated = traceFoldedScene(base); assert.ok(detect(aberrated).spot.rms2D > .005);
  assert.ok(aberrated.warnings.some(w => w.includes('OPD'))); near(aberrated.energy.captured, 1); balanced(aberrated);
});

test('coma and astigmatism alter measured centroid and principal radii through OPD gradients', () => {
  const s = make([element('lens', 'l', 250, 150, { aberration: { sphericalUm: 0, comaUm: 50, astigmatismUm: 0 } }), element('detector', 'd', 350)]);
  const coma = traceFoldedScene(s); assert.ok(detect(coma).spot.centroidU > .01); near(detect(coma).spot.centroidV, 0, .002);
  s.elements[0].aberration = { sphericalUm: 0, comaUm: 0, astigmatismUm: 20 };
  const astigmatism = traceFoldedScene(s); near(detect(astigmatism).spot.centroidU, 0); near(detect(astigmatism).spot.centroidV, 0);
  assert.ok(detect(astigmatism).spot.principalRmsMajor > detect(astigmatism).spot.principalRmsMinor); balanced(coma); balanced(astigmatism);
});

test('optional source/optic metadata round trips safely while retaining only known numeric fields', () => {
  const s = make([element('cylindrical', 'l', 250, 150, { rollDeg: 25, aberration: { sphericalUm: .2, comaUm: .1, astigmatismUm: 0, html: '<script>' } })]);
  s.source.beam.extra = '<script>';
  const parsed = parseFoldedScene(JSON.parse(JSON.stringify(s)));
  assert.equal(parsed.elements[0].focalSagittal, null); assert.equal(parsed.elements[0].rollDeg, 25);
  assert.ok(!('extra' in parsed.source.beam)); assert.ok(!('html' in parsed.elements[0].aberration));
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, beam: { ...s.source.beam, diameterMinor: 0 } } }), /直径/);
  assert.throws(() => parseFoldedScene({ ...s, source: { ...s.source, beam: { ...s.source.beam, profile: 'coherent' } } }), /分布/);
  assert.throws(() => parseFoldedScene({ ...s, elements: [{ ...s.elements[0], focalSagittal: 0 }] }), /焦距/);
  assert.throws(() => parseFoldedScene({ ...s, elements: [{ ...s.elements[0], aberration: { sphericalUm: Infinity } }] }), /OPD/);
});

test('bounded trace of 2D rays conserves all unfinished sampled branch power', () => {
  const s = make([element('mirror', 'left', 200, 150, { angleDeg: 0 }), element('mirror', 'right', 400, 150, { angleDeg: 0 })], { x: 300, rayCount: 25 });
  const r = traceFoldedScene(s, { maxEvents: 8, maxSegments: 1000 });
  assert.ok(r.energy.unresolved > .9); balanced(r);
});

test('large out-of-layout-plane coordinates bypass finite optics and escape with finite paths', () => {
  const s = make([element('iris', 'a', 200, 150, { diameter: 1, aperture: 1 }), element('detector', 'd', 500, 150, { diameter: 1, aperture: 1 })], { diameter: .01, fullAngle: 0, rayCount: 25 },
    { profile: 'uniform', diameterMinor: 100, fullAngleMinor: 200 });
  const r = traceFoldedScene(s);
  assert.ok(r.energy.escaped > .95); near(r.energy.absorbed, 0);
  for (const segment of r.segments) for (const point of [segment.start, segment.end]) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  }
  // XY bounds define layout termination; Z is an unbounded transverse coordinate,
  // whose aperture misses do not invent absorption or an invisible Z wall.
  assert.ok(r.segments.some(segment => Math.abs(segment.end.z) > 50)); balanced(r);
});

test('specular reflection of normalized 3D rays preserves out-of-plane direction exactly', () => {
  const r = traceFoldedScene(make([element('mirror', 'm', 250), element('detector', 'd', 250, 350, { angleDeg: 90, diameter: 100, aperture: 100 })], { fullAngle: 20, rayCount: 25 }, { fullAngleMinor: 12 }));
  const direction = segment => {
    const vector = [segment.end.x - segment.start.x, segment.end.y - segment.start.y, segment.end.z - segment.start.z];
    const norm = Math.hypot(...vector); return vector.map(v => v / norm);
  };
  const n = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  for (const incoming of r.segments.filter(segment => segment.event === 'mirror')) {
    const outgoing = r.segments.find(segment => segment.branchId === incoming.branchId + '.R');
    const a = direction(incoming), b = direction(outgoing), dot = a.reduce((sum, v, index) => sum + v * n[index], 0);
    for (let i = 0; i < 3; i++) near(b[i], a[i] - 2 * dot * n[i], 1e-12);
    near(Math.hypot(...b), 1); near(outgoing.power, incoming.power);
  }
  balanced(r);
});

test('reverse illumination of a cylinder retains the same physical powered-axis focus', () => {
  const forward = traceFoldedScene(make([element('cylindrical', 'l', 400), element('detector', 'd', 500)], { rayCount: 25 }));
  const reverse = traceFoldedScene(make([element('cylindrical', 'l', 400), element('detector', 'd', 300)], { x: 650, directionDeg: 180, rayCount: 25 }));
  near(detect(forward).spot.rmsU, 0); near(detect(reverse).spot.rmsU, 0);
  near(detect(forward).spot.rmsV, detect(reverse).spot.rmsV);
  near(detect(forward).power, detect(reverse).power); balanced(forward); balanced(reverse);
});

test('both 625 and 4096 Gaussian samples resolve analytic propagated RMS within finite-quadrature tolerance', () => {
  const expectedU = Math.sqrt(5), expectedV = Math.sqrt(1.36);
  for (const rayCount of [25, 65]) {
    const r = traceFoldedScene(make([element('detector', 'd', 260, 150, { diameter: 100, aperture: 100 })], { rayCount, fullAngle: 20 }, { fullAngleMinor: 12 }));
    relative(detect(r).spot.rmsU, expectedU, .01); relative(detect(r).spot.rmsV, expectedV, .01);
    balanced(r);
  }
  // This verifies this smooth representative case, not monotonic convergence
  // or a universal certified precision near discontinuous aperture clipping.
});
