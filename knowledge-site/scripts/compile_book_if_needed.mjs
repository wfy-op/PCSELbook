import { access, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const siteRoot = path.resolve(".");
const sourceRoot = path.dirname(siteRoot);
const pdfPath = path.join(sourceRoot, "build", "pcselbook.pdf");
const watchedRoots = ["chapters", "frontmatter", "figures", "assets"].map((entry) => path.join(sourceRoot, entry));
const watchedFiles = ["main.tex", "preamble.tex", "notation.tex", "refs.bib"].map((entry) => path.join(sourceRoot, entry));
const watchedExtensions = new Set([".tex", ".bib", ".png", ".jpg", ".jpeg", ".webp", ".pdf"]);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectInputs(directory) {
  if (!await exists(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectInputs(target);
    return watchedExtensions.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
  }));
  return nested.flat();
}

async function runLatexmk() {
  await new Promise((resolve, reject) => {
    const child = spawn("latexmk", [
      "-xelatex",
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-outdir=build",
      "-jobname=pcselbook",
      "main.tex",
    ], { cwd: sourceRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`latexmk exited with code ${code}`)));
  });
}

const nestedInputs = (await Promise.all(watchedRoots.map(collectInputs))).flat();
const inputs = [...watchedFiles, ...nestedInputs].filter((target) => watchedExtensions.has(path.extname(target).toLowerCase()) || watchedFiles.includes(target));
const inputStats = await Promise.all(inputs.map(async (target) => ({ target, info: await stat(target) })));
const newestInput = inputStats.sort((left, right) => right.info.mtimeMs - left.info.mtimeMs)[0];
const pdfIsCurrent = await exists(pdfPath) && (await stat(pdfPath)).mtimeMs >= newestInput.info.mtimeMs;

if (pdfIsCurrent) {
  console.log(`Book PDF is current (${path.relative(sourceRoot, pdfPath)}).`);
} else {
  console.log(`Rebuilding book PDF because ${path.relative(sourceRoot, newestInput.target)} is newer.`);
  await runLatexmk();
  if (!await exists(pdfPath) || (await stat(pdfPath)).mtimeMs < newestInput.info.mtimeMs) {
    throw new Error("latexmk completed without producing a current build/pcselbook.pdf");
  }
}
