import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
const shell = await readFile('dist/index.html', 'utf8');
for (const route of ['tutorial', 'designer', 'optics', 'optics/tutorial', 'optics/designer', 'training/optical-bench', 'design/optical-bench']) {
  await mkdir(`dist/${route}`, { recursive: true });
  const canonical = route.includes('design') ? 'designer/' : '';
  await writeFile(`dist/${route}/index.html`, shell.replace('</head>', `<link rel="canonical" href="https://optical-lab-feiyang.pages.dev/${canonical}"></head>`));
}
await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\n');
let files = 0, bytes = 0;
async function audit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'outputs', '.git', '.wrangler', 'data', 'figures', 'book'].includes(entry.name)) throw new Error(`Unexpected deployment directory: ${target}`);
      await audit(target);
    } else {
      const size = (await stat(target)).size;
      if (size > 25 * 1024 ** 2 || /\.(?:log|map|py|tsx?|zip)$/.test(entry.name)) throw new Error(`Unexpected deployment artifact: ${target}`);
      files++; bytes += size;
    }
  }
}
await audit('dist');
await mkdir('outputs/optics-workbench', { recursive: true });
await writeFile('outputs/optics-workbench/payload-audit.json', JSON.stringify({ status: 'pass', files, bytes }, null, 2));
console.log(`Standalone payload verified: ${files} files, ${(bytes / 1024 ** 2).toFixed(2)} MiB.`);
