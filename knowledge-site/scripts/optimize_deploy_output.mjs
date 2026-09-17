import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist/client");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return nested.flat();
}

let files = await walk(outputRoot);
const cssFiles = files.filter((file) => path.extname(file) === ".css");
let optimizedCssCount = 0;
for (const cssFile of cssFiles) {
  const source = await readFile(cssFile, "utf8");
  const optimized = source.replace(/,url\([^)]*\.(?:woff|ttf)\)format\("(?:woff|truetype)"\)/g, "");
  if (optimized !== source) {
    await writeFile(cssFile, optimized, "utf8");
    optimizedCssCount += 1;
  }
}

const removable = files.filter((file) => {
  const relative = path.relative(outputRoot, file).replaceAll("\\", "/");
  return [".woff", ".ttf", ".map"].includes(path.extname(file).toLowerCase()) || relative === "figures/manifest.json";
});
await Promise.all(removable.map((file) => rm(file, { force: true })));
files = await walk(outputRoot);
console.log(`Optimized ${optimizedCssCount} CSS files and pruned ${removable.length} deployment-only fallback or build files; ${files.length} files remain.`);
