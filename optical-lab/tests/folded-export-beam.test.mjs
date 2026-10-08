import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFoldedScene, foldedElement, parseFoldedScene, traceFoldedScene } from '../app/design/core/folded-engine.ts';
import { foldedCsv, foldedEngineeringFile, foldedReport, foldedSpotSvg, parseFoldedEngineeringFile } from '../app/design/folded-export.ts';

const close = (actual, expected, tol = 1e-10) => assert.ok(Math.abs(actual - expected) < tol, `${actual} should equal ${expected}`);
const decode = html => html.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
function sceneWithBeam() {
  const scene = blankFoldedScene();
  scene.name = '<script>untrusted</script> & "ellipse"';
  scene.source = { ...scene.source, diameter: 8, fullAngle: 8, rayCount: 15, intensity: 2.5, beam: { profile: 'gaussian', diameterMinor: 3, fullAngleMinor: 2, rotationDeg: 25 } };
  scene.elements = [{ ...foldedElement('cylindrical', 'cylinder', 250, 150), rollDeg: 20, focalSagittal: null, aberration: { sphericalUm: .15, comaUm: .06, astigmatismUm: -.2 } }, { ...foldedElement('detector', 'target', 340, 150), diameter: 100, aperture: 100, name: '<script>camera</script>' }];
  return parseFoldedScene(scene);
}

test('engineering JSON round-trip preserves elliptic source, cylinder roll and OPD inputs', () => {
  const scene = sceneWithBeam();
  assert.deepEqual(parseFoldedEngineeringFile(JSON.parse(JSON.stringify(foldedEngineeringFile(scene))), parseFoldedScene), scene);
  const report = foldedReport(scene, '<svg aria-label="layout"></svg>');
  const json = decode(report.match(/<summary>完整工程 JSON<\/summary><pre>([\s\S]*?)<\/pre>/)[1]);
  assert.deepEqual(parseFoldedEngineeringFile(JSON.parse(json), parseFoldedScene), scene);
  assert.ok(!report.includes('<script>untrusted</script>'));
  assert.ok(!report.includes('<script>camera</script>'));
  assert.match(report, /&lt;script&gt;camera&lt;\/script&gt;/);
});

test('CSV carries source metadata and anisotropic/aberration values with aligned columns', () => {
  const scene = sceneWithBeam(); scene.elements[0].name = '=unsafe';
  const rows = foldedCsv(scene).slice(1).split('\r\n').map(line => line.slice(1, -1).split('","').map(cell => cell.replaceAll('""', '"')));
  const header = rows[0];
  assert.ok(rows.every(row => row.length === header.length));
  const source = Object.fromEntries(header.map((key, i) => [key, rows[1][i]]));
  assert.equal(source.光源分布, 'gaussian');
  assert.equal(source.光源主轴直径_mm, '8'); assert.equal(source.光源次轴直径_mm, '3');
  assert.equal(source.主轴发散全角_mrad, '8'); assert.equal(source.次轴发散全角_mrad, '2');
  assert.equal(source.光斑旋转_deg, '25'); assert.equal(source.输入相对功率_au, '2.5');
  const cylinder = Object.fromEntries(header.map((key, i) => [key, rows[2][i]]));
  assert.equal(cylinder.名称, "'=unsafe"); assert.equal(cylinder.类型, 'cylindrical');
  assert.equal(cylinder.次轴焦距_mm, '无光焦度'); assert.equal(cylinder.瞳面滚转_deg, '20');
  assert.equal(cylinder.球差OPD系数_um, '0.15');
  assert.equal(cylinder.彗差OPD系数_um, '0.06'); assert.equal(cylinder.像散OPD系数_um, '-0.2');
});

test('self-contained report bins the actual hits and keeps identical pixel/mm axes', () => {
  const scene = sceneWithBeam(), result = traceFoldedScene(scene), detector = result.detectors[0];
  const report = foldedReport(scene, '<svg></svg>'), svg = foldedSpotSvg(detector, 'D1');
  assert.match(report, /实际采样数 225/); assert.match(report, /1\/e² 强度定义/);
  assert.ok(report.includes(detector.spot.rms2D.toFixed(6)));
  assert.ok(report.includes(detector.spot.principalRmsMajor.toFixed(6)));
  assert.ok(report.includes(detector.spot.centroidV.toFixed(6)));
  const attr = name => Number(svg.match(new RegExp(`${name}="([^"]+)"`))[1]);
  close(attr('data-px-per-mm-u'), attr('data-px-per-mm-v'));
  close(attr('data-extent-u-mm'), detector.spot.grid.extentU);
  close(attr('data-extent-v-mm'), detector.spot.grid.extentV);
  close(attr('data-integrated-power'), detector.power);
  const bins = [...svg.matchAll(/data-bin-index="(\d+)" data-bin-power="([^"]+)" data-bin-density="([^"]+)"/g)];
  assert.equal(bins.length, detector.spot.grid.power.filter(p => p > 0).length);
  close(bins.reduce((sum, match) => sum + Number(match[2]), 0), detector.power);
  for (const match of bins) {
    close(Number(match[2]), detector.spot.grid.power[Number(match[1])]);
    close(Number(match[3]), detector.spot.grid.irradiance[Number(match[1])]);
  }
  for (const profile of report.matchAll(/data-axis="([uv])" data-extent-mm="([^"]+)" data-bin-width-mm="([^"]+)" data-density-values="([^"]+)"/g)) {
    const values = JSON.parse(decode(profile[4]));
    close(values.reduce((sum, v) => sum + v, 0) * Number(profile[3]), detector.power);
  }
  assert.equal([...report.matchAll(/class="beam-profile"/g)].length, 2);
  assert.match(report, /不是相干衍射 PSF/);
  assert.match(report, /data:application\/json;charset=utf-8/);
  assert.ok(!/<script src=|<link[^>]*stylesheet/.test(report));
});

test('zero-width and zero-reception plots state numerical/physical limits', () => {
  const scene = blankFoldedScene(); scene.elements = [foldedElement('lens', 'lens', 250, 150), foldedElement('detector', 'target', 350, 150)];
  const zeroReport = foldedReport(scene, '<svg></svg>');
  assert.match(zeroReport, /有限网格是数值可视化/);
  assert.match(zeroReport, /不代表实物具有无限辐照度/);
  assert.match(zeroReport, /没有完整第二横轴输入/);
  scene.elements[1].y = 400;
  const missed = foldedReport(scene, '<svg></svg>');
  assert.match(missed, /没有接收样本/);
  assert.ok(!missed.includes('class="beam-heatmap"'));
  assert.ok(!missed.includes('NaN'));
});
