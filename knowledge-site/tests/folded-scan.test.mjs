import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, foldedPresets, traceFoldedScene } from '../app/design/core/folded-engine.ts';
import { bestFoldedScanPoint, scanFoldedParameter, sceneAtScanValue } from '../app/design/core/folded-scan.ts';

const options = { elementId: 'detector-t', detectorId: 'detector-t', parameter: 'x', min: 590, max: 650, minCaptureFraction: .49 };
test('space scan finds the actual lens focus and preserves half-input split power', () => {
  const scene = foldedPresets().split; const original = structuredClone(scene);
  const points = scanFoldedParameter(scene, options);
  const best = bestFoldedScanPoint(points);
  assert.equal(points.length, 21); assert.equal(best.value, 620); assert.ok(best.rms < 1e-10);
  assert.ok(Math.abs(best.captureFraction - .5) < 1e-12);
  assert.deepEqual(scene, original);
  const candidate = sceneAtScanValue(scene, options, 623);
  assert.equal(candidate.elements.find(e => e.id === 'detector-t').x, 623);
  assert.deepEqual(candidate.source, scene.source);
});

test('inaccessible power requirements and zero-reception points cannot become best results', () => {
  const scene = foldedPresets().split;
  assert.equal(bestFoldedScanPoint(scanFoldedParameter(scene, { ...options, minCaptureFraction: .55 })), null);
  const missed = scanFoldedParameter(scene, { ...options, parameter: 'y', min: 250, max: 300, minCaptureFraction: 0 });
  assert.ok(missed.every(p => !p.feasible && p.rms === null && p.captureFraction === 0));
  assert.equal(bestFoldedScanPoint(missed), null);
});

test('invalid focal gaps are reported per point and invalid scan contracts fail early', () => {
  const scene = foldedPresets().split;
  const points = scanFoldedParameter(scene, { ...options, elementId: 'lens-t', parameter: 'focal', min: -2, max: 2 });
  assert.ok(points.some(p => p.value === 0 && !p.feasible && /焦距/.test(p.reason)));
  assert.throws(() => scanFoldedParameter(scene, { ...options, min: 5, max: 5 }), /大于/);
  assert.throws(() => scanFoldedParameter(scene, { ...options, detectorId: 'splitter-1' }), /探测器/);
  assert.throws(() => sceneAtScanValue(scene, { ...options, parameter: 'focal' }, 100), /只适用/);
});

test('cylinder focal scan accepts its powered axis while reporting the real broad 2D spot', () => {
  const scene = blankFoldedScene();
  scene.source = { ...scene.source, diameter: 4, beam: { profile: 'uniform', diameterMinor: 8, fullAngleMinor: 0, rotationDeg: 0 } };
  scene.elements = [foldedElement('cylindrical', 'c', 250, 150), foldedElement('detector', 'd', 350, 150)];
  const spec = { elementId: 'c', detectorId: 'd', parameter: 'focal', min: 80, max: 120, count: 21, minCaptureFraction: .9 };
  const points = scanFoldedParameter(scene, spec), best = bestFoldedScanPoint(points);
  assert.equal(best.value, 100); assert.ok(best.rms > 1.9);
  const result = traceFoldedScene(scene), target = result.detectors[0];
  assert.ok(target.rms < 1e-10); assert.ok(Math.abs(best.rms - target.spot.rms2D) < 1e-10);
  assert.equal(sceneAtScanValue(scene, spec, 120).elements[0].focal, 120);
});

test('2D beam scan chooses the least-circle-of-confusion plane rather than the U-only focus', () => {
  const scene = blankFoldedScene();
  scene.source = { ...scene.source, diameter: 4, rayCount: 65, beam: { profile: 'uniform', diameterMinor: 8, fullAngleMinor: 0, rotationDeg: 0 } };
  scene.elements = [{ ...foldedElement('lens', 'l', 250, 150), focalSagittal: 200 }, foldedElement('detector', 'd', 400, 150)];
  const spec = { elementId: 'd', detectorId: 'd', parameter: 'x', min: 350, max: 450, count: 21, minCaptureFraction: .9 };
  const points = scanFoldedParameter(scene, spec), best = bestFoldedScanPoint(points);
  assert.equal(best.value, 400); assert.ok(best.rms < points.find(p => p.value === 350).rms);
  const uFocus = traceFoldedScene(sceneAtScanValue(scene, spec, 350)).detectors[0];
  assert.ok(uFocus.rms < 1e-10); assert.ok(uFocus.spot.rms2D > best.rms);
});
