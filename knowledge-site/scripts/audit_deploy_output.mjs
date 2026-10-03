import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist/client");
const forbiddenExtensions = new Set([".aux", ".bak", ".bib", ".blg", ".log", ".map", ".orig", ".psd", ".tex", ".tmp", ".ttf", ".woff"]);
const forbiddenNames = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return nested.flat();
}

const files = await walk(outputRoot);
const records = await Promise.all(files.map(async (file) => ({
  file,
  relative: path.relative(outputRoot, file).replaceAll("\\", "/"),
  size: (await stat(file)).size,
})));
const forbidden = records.filter(({ file, relative }) => forbiddenExtensions.has(path.extname(file).toLowerCase()) || forbiddenNames.has(path.basename(file)) || /(^|\/)(?:outputs|tmp|work|\.wrangler|\.openai|\.git)(\/|$)/.test(relative));
if (forbidden.length) throw new Error(`Forbidden deployment files:\n${forbidden.map((item) => item.relative).join("\n")}`);

const cssRecords = records.filter((item) => path.extname(item.file) === ".css");
for (const cssRecord of cssRecords) {
  const css = await readFile(cssRecord.file, "utf8");
  if (/\.(?:woff|ttf)\)/.test(css)) throw new Error(`Legacy font fallback remains in ${cssRecord.relative}`);
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const raw = match[1].replace(/^['"]|['"]$/g, "");
    if (!raw.startsWith("/")) continue;
    const target = path.join(outputRoot, decodeURIComponent(raw.slice(1)));
    if (!records.some((item) => item.file === target)) throw new Error(`Missing CSS asset ${raw}`);
  }
}

const totalBytes = records.reduce((sum, item) => sum + item.size, 0);
const largest = [...records].sort((left, right) => right.size - left.size)[0];
if (records.length > 20_000) throw new Error(`Cloudflare Pages file limit exceeded: ${records.length}`);
if (largest.size > 25 * 1024 * 1024) throw new Error(`Cloudflare Pages file-size limit exceeded: ${largest.relative}`);
console.log(`Deployment audit passed: ${records.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB total, largest ${largest.relative} (${(largest.size / 1024 / 1024).toFixed(2)} MiB).`);
