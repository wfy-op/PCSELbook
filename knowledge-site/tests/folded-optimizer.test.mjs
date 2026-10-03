import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, foldedPresets, traceFoldedScene } from '../app/design/core/folded-engine.ts';
import { sampleBeam } from '../app/design/core/beam-analysis.ts';
import { applyFoldedOptimization, canApplyFoldedOptimization, foldedOptimizationMetrics, optimizeFoldedScene, optimizeFoldedSceneSync, validateFoldedOptimizationOptions } from '../app/design/core/folded-optimizer.ts';

const close = (actual, expected, tol = 1e-4) => assert.ok(Math.abs(actual - expected) < tol, `${actual} should be ${expected} ± ${tol}`);
function singleLens() {
  return { ...blankFoldedScene(), source: { ...blankFoldedScene().source, diameter: 8 }, elements: [foldedElement('lens', 'lens', 250, 151), foldedElement('detector', 'target', 385, 153)] };
}
function twoLens() {
  return { ...blankFoldedScene(), source: { ...blankFoldedScene().source, diameter: 8 }, elements: [foldedElement('lens', 'lens-1', 200, 150), { ...foldedElement('lens', 'lens-2', 260, 151), focal: 75 }, foldedElement('detector', 'target', 320, 152)] };
}
const options = { detectorId: 'target', goal: 'rms', minCaptureFraction: .95, variables: [{ elementId: 'target', parameter: 'x', min: 320, max: 420 }, { elementId: 'target', parameter: 'y', min: 148, max: 156 }], maxEvaluations: 250, relativeTolerance: 1e-5 };

test('bounded two-variable search recovers actual focus and centroid of a decentered lens', () => {
  const scene = singleLens(), original = structuredClone(scene);
  const optimized = optimizeFoldedSceneSync(scene, options);
  assert.equal(optimized.improved, true);
  assert.equal(optimized.best.feasible, true);
  assert.ok(optimized.best.rms < optimized.baseline.rms / 1000);
  assert.ok(optimized.best.centroidError < .001);
  close(optimized.candidate.elements.find(e => e.id === 'target').x, 350, .005);
  close(optimized.candidate.elements.find(e => e.id === 'target').y, 151, .005);
  close(optimized.best.captureFraction, 1, 1e-12);
  assert.ok(optimized.evaluations <= options.maxEvaluations);
  assert.deepEqual(scene, original);
  assert.deepEqual(optimized.candidate.source, scene.source);
  assert.deepEqual(optimized.candidate.elements[0], scene.elements[0]);
  const traced = traceFoldedScene(optimized.candidate);
  close(traced.energy.balanceError, 0, 1e-12);
});

test('actual two-lens focus agrees with independent paraxial analytic distance', () => {
  const scene = twoLens();
  const settings = { ...options, variables: [{ elementId: 'target', parameter: 'x', min: 270, max: 330 }, { elementId: 'target', parameter: 'y', min: 148, max: 153 }], maxEvaluations: 350 };
  const optimized = optimizeFoldedSceneSync(scene, settings);
  const after = optimized.candidate.elements.find(e => e.id === 'target');
  const distance = (1 - 60 / 100) / (1 / 100 + (1 - 60 / 100) / 75);
  close(after.x, 260 + distance, .002);
  close(after.y, 150 + distance / 75, .002);
  assert.ok(optimized.best.rms < .0001);
  assert.ok(optimized.best.centroidError < .001);
});

test('2D optimization minimizes both actual transverse axes rather than a misleading line focus', () => {
  const scene = singleLens();
  const beam = { profile: 'gaussian', diameterMinor: 3, fullAngleMinor: 0, rotationDeg: 0 };
  scene.source = { ...scene.source, rayCount: 11, beam };
  scene.elements[0] = { ...scene.elements[0], y: 150, focalSagittal: 70, aperture: 100, diameter: 100 };
  scene.elements[1] = { ...scene.elements[1], y: 150 };
  const samples = sampleBeam(scene.source.diameter, 0, scene.source.rayCount, beam);
  const varU = samples.reduce((sum, s) => sum + s.u ** 2, 0) / samples.length;
  const varV = samples.reduce((sum, s) => sum + s.v ** 2, 0) / samples.length;
  const distance = (varU / 100 + varV / 70) / (varU / 100 ** 2 + varV / 70 ** 2);
  const optimized = optimizeFoldedSceneSync(scene, { ...options, variables: [{ elementId: 'target', parameter: 'x', min: 320, max: 420 }] });
  close(optimized.candidate.elements[1].x, 250 + distance, .002);
  const expectedRms = Math.sqrt(varU * (1 - distance / 100) ** 2 + varV * (1 - distance / 70) ** 2);
  close(optimized.best.rms, expectedRms, .0001);
  assert.ok(optimized.best.rms > .1);
  close(optimized.best.rms, traceFoldedScene(optimized.candidate).detectors[0].spot.rms2D, 1e-12);
});

test('focal-length and mirror-normal variables improve real traced targets', () => {
  const scene = singleLens(); scene.elements[1].y = 151;
  const settings = { ...options, variables: [{ elementId: 'lens', parameter: 'focal', min: 80, max: 160 }] };
  const focused = optimizeFoldedSceneSync(scene, settings);
  close(focused.candidate.elements[0].focal, 135, .005);
  assert.ok(focused.best.rms < .0001);
  const mirror = foldedPresets().mirror; mirror.elements[0].angleDeg = -44;
  const aligned = optimizeFoldedSceneSync(mirror, { ...options, detectorId: 'detector-1', goal: 'centroid', variables: [{ elementId: 'mirror-1', parameter: 'angleDeg', min: -46, max: -43 }] });
  close(aligned.candidate.elements[0].angleDeg, -45, .0001);
  assert.ok(aligned.best.centroidError < .001);
  close(aligned.best.captureFraction, 1, 1e-12);
});

test('capture objective can recover an initially blocked small receiving aperture', () => {
  const scene = singleLens(); scene.elements[1].x = 350; scene.elements[1].aperture = 1;
  const recovered = optimizeFoldedSceneSync(scene, { ...options, goal: 'capture', variables: [{ elementId: 'target', parameter: 'y', min: 148, max: 156 }] });
  assert.equal(recovered.baseline.captureFraction, 0);
  assert.equal(recovered.baseline.feasible, false);
  assert.equal(recovered.improved, true);
  close(recovered.best.captureFraction, 1, 1e-12);
  close(recovered.best.centroidError, 0, .001);
});

test('missing power and impossible capture constraints never create an applicable winner', () => {
  const scene = foldedPresets().split;
  const settings = { ...options, detectorId: 'detector-t', variables: [{ elementId: 'detector-t', parameter: 'x', min: 590, max: 650 }], minCaptureFraction: .55, maxEvaluations: 100 };
  const impossible = optimizeFoldedSceneSync(scene, settings);
  assert.equal(impossible.improved, false);
  assert.equal(impossible.candidate, null);
  assert.equal(impossible.best.feasible, false);
  const noPower = optimizeFoldedSceneSync({ ...singleLens(), source: { ...singleLens().source, intensity: 0 } }, options);
  assert.equal(noPower.candidate, null);
  assert.equal(noPower.best.feasible, false);
});

test('an already focused centered design has no fake optimization improvement', () => {
  const scene = singleLens(); scene.elements[1].x = 350; scene.elements[1].y = 151;
  const optimized = optimizeFoldedSceneSync(scene, options);
  assert.equal(optimized.candidate, null);
  assert.equal(optimized.improved, false);
});

test('source, geometry and constraint changes reject stale candidates before apply', () => {
  const scene = singleLens(), optimized = optimizeFoldedSceneSync(scene, options);
  assert.ok(canApplyFoldedOptimization(scene, options, optimized));
  assert.deepEqual(applyFoldedOptimization(scene, options, optimized), optimized.candidate);
  const changed = { ...scene, source: { ...scene.source, wavelength: 633 } };
  assert.equal(canApplyFoldedOptimization(changed, options, optimized), false);
  assert.equal(canApplyFoldedOptimization(scene, { ...options, minCaptureFraction: .5 }, optimized), false);
  assert.throws(() => applyFoldedOptimization(changed, options, optimized), /重新计算/);
});

test('bounds, duplicate variables, focal zero gap and evaluation budget are strict', () => {
  const scene = singleLens();
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, variables: [...options.variables, options.variables[0]] }), /重复/);
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, variables: [{ elementId: 'target', parameter: 'x', min: -1, max: 420 }] }), /计算区域/);
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, variables: [{ elementId: 'lens', parameter: 'focal', min: -120, max: 120 }] }), /不能穿过/);
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, variables: [{ elementId: 'target', parameter: 'focal', min: 90, max: 120 }] }), /只适用/);
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, maxEvaluations: 2001 }), /预算/);
  assert.throws(() => validateFoldedOptimizationOptions(scene, { ...options, variables: [{ elementId: 'target', parameter: 'x', min: 390, max: 420 }] }), /包含当前/);
  const limited = optimizeFoldedSceneSync(scene, { ...options, maxEvaluations: 10 });
  assert.ok(limited.evaluations <= 10);
  assert.equal(limited.status, 'budget');
});

test('cooperative async path agrees with synchronous search and supports cancellation', async () => {
  const scene = singleLens(), settings = { ...options, maxEvaluations: 100 };
  let progress = 0;
  const asyncResult = await optimizeFoldedScene(scene, settings, { yieldEvery: 2, onProgress: () => progress++ });
  assert.deepEqual(asyncResult, optimizeFoldedSceneSync(scene, settings));
  assert.ok(progress > 1);
  const controller = new AbortController();
  const cancelled = await optimizeFoldedScene(scene, settings, { signal: controller.signal, onProgress: p => { if (p.evaluations >= 3) controller.abort(); } });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.improved, false);
  assert.equal(cancelled.candidate, null);
  assert.ok(cancelled.evaluations <= 3);
});

test('power accounting and unresolved traces are constraints independent of small spot size', () => {
  const result = traceFoldedScene(singleLens());
  const metrics = foldedOptimizationMetrics({ ...result, energy: { ...result.energy, unresolved: .01, captured: result.energy.captured - .01 } }, options);
  assert.equal(metrics.feasible, false);
  assert.match(metrics.reason, /未完成/);
  const imbalance = foldedOptimizationMetrics({ ...result, energy: { ...result.energy, balanceError: .01 } }, options);
  assert.equal(imbalance.feasible, false);
  assert.match(imbalance.reason, /功率核算/);
  const loop = { ...blankFoldedScene(), source: { ...blankFoldedScene().source, x: 150 }, elements: [{ ...foldedElement('mirror', 'back', 100, 150), angleDeg: 0 }, { ...foldedElement('beamsplitter', 'split', 250, 150), angleDeg: 0 }, foldedElement('detector', 'target', 450, 150)] };
  const tracedLoop = traceFoldedScene(loop);
  assert.ok(tracedLoop.energy.unresolved > 1e-10);
  close(tracedLoop.energy.balanceError, 0, 1e-12);
  const noLoopCandidate = optimizeFoldedSceneSync(loop, { ...options, variables: [{ elementId: 'target', parameter: 'x', min: 350, max: 550 }] });
  assert.equal(noLoopCandidate.candidate, null);
  assert.match(noLoopCandidate.best.reason, /未完成/);
});
