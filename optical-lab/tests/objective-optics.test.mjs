import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { objectiveFocal, objectiveParts, objectivePupil, objectiveReference, objectiveWarnings, parseObjectiveModel } from '../app/design/core/objective-model.ts';
import { analyzeDesign, blankProject, catalogDesignObjective, customDesignLens, parseDesignProject } from '../app/design/core/design-engine.ts';
import { blankFoldedScene, foldedElement, foldedPresets, parseFoldedScene, traceFoldedScene } from '../app/design/core/folded-engine.ts';
import { foldedLabels } from '../app/design/folded-labels.ts';
import { convertSequentialProject } from '../app/design/design-conversion.ts';
import { sceneAtScanValue } from '../app/design/core/folded-scan.ts';
import { foldedCsv, foldedEngineeringFile, foldedReport, parseFoldedEngineeringFile } from '../app/design/folded-export.ts';
import { prescriptionCsv, designReport } from '../app/design/design-export.ts';

const near = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);
const ten = objectiveParts.find(p => p.sku === 'RMS10X');
function imageProject(tubeFocal = 180) {
  const p = blankProject();
  p.source.diameter = .1; p.source.fullAngle = 40; p.source.model = 'extended';
  p.screen = 260 + tubeFocal;
  p.elements = [catalogDesignObjective(ten, 'o', 18), { ...customDesignLens('tube', 260), focal: tubeFocal }];
  return p;
}

test('all six M/NA/WD records match saved current official product titles', () => {
  assert.equal(objectiveParts.length, 6);
  for (const p of objectiveParts) {
    const record = JSON.parse(fs.readFileSync(new URL(`../public/training/objectives/${p.sku}.json`, import.meta.url), 'utf8'));
    assert.equal(record.product.code, p.sku);
    const titles = record.product.descriptionsWithFallbacksTL.map(d => d.content).join(' ').replace(/<[^>]*>/g, ' ');
    assert.match(titles, new RegExp(`${p.magnification}X .*?Objective`));
    const na = titles.match(/([\d.]+) NA/);
    const wd = titles.match(/([\d.]+) mm WD/);
    near(Number(na[1]), p.numericalAperture); near(Number(wd[1]), p.workingDistance);
    if (p.manufacturer === 'Mitutoyo') assert.match(titles, /436 - 656 nm/);
  }
});

test('objective equivalent focal length is distinct from mechanical WD', () => {
  near(objectiveFocal(ten), 18); near(objectivePupil(ten), 9);
  assert.notEqual(objectiveFocal(ten), ten.workingDistance);
  const forty = objectiveParts.find(p => p.sku === 'RMS40X');
  near(objectiveFocal(forty), 4.5); near(forty.workingDistance, .6);
});

test('180 mm tube and 18 mm objective image every height at -10 times regardless of input angle', () => {
  const p = imageProject(), a = analyzeDesign(p);
  near(a.matrix.A, -10); near(a.matrix.B, 0); near(a.matrix.D, -.1);
  assert.equal(a.passed, a.total);
  for (const ray of a.rays) near(ray.points.at(-1).y, -10 * ray.initial.y);
  near(a.span, 1);
});

test('a 200 mm replacement tube changes magnification to 200/18', () => {
  const p = imageProject(200), a = analyzeDesign(p);
  near(a.matrix.A, -200 / 18); near(a.matrix.B, 0);
  near(a.span, .1 * 200 / 18);
});

test('a collimated input focuses f after the objective, not WD after it', () => {
  const p = blankProject(); p.source.diameter = .2; p.screen = 118;
  p.elements = [catalogDesignObjective(ten, 'o', 100)];
  const a = analyzeDesign(p); near(a.span, 0); near(a.bestFocus.z, 118);
  p.screen = 100 + ten.workingDistance;
  assert.ok(analyzeDesign(p).span > .05);
});

test('Gaussian propagation through equivalent objective retains a finite waist', () => {
  const p = blankProject(); p.source.mode = 'gaussian'; p.source.w0 = .3; p.source.waistZ = 100; p.screen = 118;
  p.elements = [catalogDesignObjective(ten, 'o', 100)];
  const a = analyzeDesign(p);
  assert.ok(a.gaussian.waist.w0 > 0);
  assert.ok(a.gaussian.waist.z > 117 && a.gaussian.waist.z < 118);
  assert.equal(a.gaussian.valid, true);
});

test('spatial collection collimates rays from the same object point independently of angle', () => {
  const s = foldedPresets().objective, r = traceFoldedScene(s);
  const input = new Map(r.segments.filter(seg => seg.elementId === 'objective-1').map(seg => [seg.rootId, seg]));
  for (const seg of r.segments.filter(seg => seg.elementId === 'tube-lens')) {
    const start = input.get(seg.rootId).start;
    const slope = (seg.end.y - seg.start.y) / (seg.end.x - seg.start.x);
    near(slope, -(start.y - s.source.y) / 18);
  }
  near(r.energy.captured, 1); near(r.energy.balanceError, 0);
  near(r.detectors[0].span, 1);
});

test('reverse spatial illumination focuses on the opposite side of an objective', () => {
  const s = blankFoldedScene();
  s.source = { ...s.source, x: 200, y: 150, directionDeg: 180, diameter: .2 };
  s.elements = [foldedElement('objective', 'o', 100, 150), foldedElement('detector', 'd', 82, 150)];
  const r = traceFoldedScene(s); near(r.detectors[0].span, 0); near(r.energy.captured, 1); near(r.energy.balanceError, 0);
});

test('estimated pupil clips the actual ray sample with conservative power budget', () => {
  const s = blankFoldedScene(); s.source.diameter = 10; s.source.rayCount = 13;
  s.elements = [foldedElement('objective', 'o', 200, 150), foldedElement('detector', 'd', 218, 150)];
  const r = traceFoldedScene(s);
  assert.equal(r.detectors[0].rayCount, 11); near(r.energy.captured, 11 / 13); near(r.energy.absorbed, 2 / 13); near(r.energy.balanceError, 0);
});

test('40X f4.5 objective survives sequential and spatial JSON round trips', () => {
  const p = blankProject(), forty = objectiveParts.find(p => p.sku === 'RMS40X');
  p.elements = [catalogDesignObjective(forty, 'o')];
  const imported = parseDesignProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(imported.elements[0].objective, p.elements[0].objective); near(imported.elements[0].focal, 4.5);
  const spatial = convertSequentialProject(imported);
  assert.equal(spatial.elements[0].kind, 'objective');
  const round = parseFoldedEngineeringFile(JSON.parse(JSON.stringify(foldedEngineeringFile(spatial))), parseFoldedScene);
  assert.deepEqual(round, spatial);
});

test('objective data validates NA/WD, discards unknown URLs and rejects negative focal length', () => {
  assert.throws(() => parseObjectiveModel({ ...ten, numericalAperture: 0 }));
  assert.throws(() => parseObjectiveModel({ ...ten, workingDistance: -1 }));
  const raw = { ...ten, catalogSku: 'invented', arbitraryUrl: 'https://invalid.example' };
  const m = parseObjectiveModel(raw); assert.equal(m.catalogSku, undefined); assert.equal(m.arbitraryUrl, undefined);
  const s = foldedPresets().objective; delete s.elements[0].objective;
  assert.throws(() => parseFoldedScene(s));
  const p = imageProject(); p.elements[0].focal = -18;
  assert.throws(() => parseDesignProject(p));
});

test('old sequential projects and spatial scenes retain their original schemas and results', () => {
  const p = blankProject(); p.elements = [customDesignLens('old', 100)]; p.screen = 150;
  near(analyzeDesign(parseDesignProject(p)).span, 0);
  const s = parseFoldedScene(foldedPresets().split); near(traceFoldedScene(s).energy.captured, 1);
  assert.equal(s.version, 1); assert.equal(p.version, 2);
});

test('changing objective focal length during scan marks a custom equivalent', () => {
  const s = foldedPresets().objective;
  const next = sceneAtScanValue(s, { elementId: 'objective-1', detectorId: 'image-1', parameter: 'focal', min: 15, max: 20, minCaptureFraction: .1 }, 19);
  assert.equal(next.elements[0].objective.catalogSku, undefined);
  assert.equal(objectiveReference(next.elements[0].objective, 19, 9, 25.4), undefined);
  assert.equal(s.elements[0].objective.catalogSku, 'RMS10X');
});

test('visible objective evidence does not certify 940 nm performance', () => {
  assert.equal(objectiveWarnings(ten, 532).length, 0);
  assert.match(objectiveWarnings(ten, 940)[0], /940 nm/);
  const mito = objectiveParts.find(p => p.sku === 'MY10X-803');
  assert.match(objectiveWarnings(mito, 940)[0], /436–656/);
  const s = foldedPresets().objective; s.source.wavelength = 940;
  assert.match(traceFoldedScene(s).warnings.join(' '), /940 nm/);
});

test('D1/D2/D3 distinguish duplicate names independently of optic sequence numbers', () => {
  const s = foldedPresets().split;
  s.elements.push({ ...foldedElement('detector', 'd3'), name: '探测面' });
  const labels = foldedLabels(s);
  assert.equal(labels.get('detector-t').label, 'D1 · 探测面');
  assert.equal(labels.get('detector-r').label, 'D2 · 探测面');
  assert.equal(labels.get('d3').label, 'D3 · 探测面');
  s.elements.find(e => e.id === 'detector-t').name = '相机 A';
  assert.equal(foldedLabels(s).get('detector-t').label, 'D1 · 相机 A');
});

test('CSV and HTML carry detector labels, objective data and escaped custom names', () => {
  const s = foldedPresets().objective; s.elements[0].name = '<script>unsafe</script>';
  assert.match(foldedCsv(s), /"D1"/); assert.match(foldedCsv(s), /工作距离WD_mm/);
  const report = foldedReport(s, '<svg></svg>');
  assert.match(report, /D1 · 探测面/); assert.match(report, /物镜参考规格/); assert.match(report, /10\.6/);
  assert.ok(!report.includes('<script>unsafe</script>'));
  const p = imageProject(); assert.match(prescriptionCsv(p), /"objective"/);
  const html = designReport(p, '<svg></svg>', p);
  assert.match(html, /物镜参考规格/); assert.match(html, /D1 · 目标面/);
});
