import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const siteRoot = path.resolve(import.meta.dirname, "..");
const bookRoot = path.dirname(siteRoot);

async function texFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return texFiles(target);
    return entry.name.endsWith(".tex") ? [target] : [];
  }));
  return nested.flat();
}

async function loadBookSources() {
  const files = [
    ...(await texFiles(path.join(bookRoot, "chapters"))),
    ...(await texFiles(path.join(bookRoot, "figures"))),
    path.join(bookRoot, "notation.tex"),
  ];
  return Promise.all(files.map(async (file) => ({
    file: path.relative(bookRoot, file),
    text: await readFile(file, "utf8"),
  })));
}

test("book sources preserve the global decay, loss, and gain conventions", async () => {
  const sources = await loadBookSources();
  const violations = [];

  for (const { file, text } of sources) {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const location = `${file}:${index + 1}`;
      const hasBareThresholdGain = /g_(?:\{\\mathrm\{th\}\}|\\mathrm\{th\})/.test(line);
      const isConventionWarning = /不再使用未加限定的/.test(line);
      if (hasBareThresholdGain && !isConventionWarning) {
        violations.push(`${location}: unqualified threshold gain`);
      }
      if (/Q\s*v_g|Qv_g|2\s*Q\s*v_g/.test(line)) {
        violations.push(`${location}: group velocity used in Q-to-loss conversion`);
      }
      if (/[^\t\x20-\x7e\u0080-\uffff]/u.test(line)) {
        violations.push(`${location}: unexpected control character`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test("notation declares the factor-of-two and gross/net gain interfaces", async () => {
  const notation = await readFile(path.join(bookRoot, "notation.tex"), "utf8");
  assert.match(notation, /Q=\\omega_0\/\(2\\gamma\)=\\omega_0\\tau_p/);
  assert.match(notation, /2\\gamma=v_\\mathrm\{en\}\\alpha/);
  assert.match(notation, /g_\\mathrm\{net\}=g_\\mathrm\{mod\}-\\alpha_\\mathrm\{int\}-\\alpha_\\mathrm\{rad\}/);
  assert.match(notation, /g_\\mathrm\{mat,th\}=g_\\mathrm\{mod,th\}\/\\Gamma_\\mathrm\{opt\}/);
});

test("the PDF figure index is generated from the live list of figures", async () => {
  const index = await readFile(path.join(bookRoot, "frontmatter", "figure_index.tex"), "utf8");
  assert.match(index, /\\listoffigures/);
  assert.doesNotMatch(index, /\\FigureIndexRow/);
});

test("chapter source lines stay reviewable", async () => {
  const sources = await texFiles(path.join(bookRoot, "chapters"));
  const violations = [];
  for (const file of sources) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.length > 350) {
        violations.push(`${path.relative(bookRoot, file)}:${index + 1} (${line.length} chars)`);
      }
    });
  }
  assert.deepEqual(violations, []);
});
