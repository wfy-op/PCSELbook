import test from 'node:test';
import assert from 'node:assert/strict';
import { foldedPresets } from '../app/design/folded-engine.ts';
import { bestFoldedScanPoint, scanFoldedParameter, sceneAtScanValue } from '../app/design/folded-scan.ts';

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
