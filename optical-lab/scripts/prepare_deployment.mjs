/** Required before every authorized release. No network or source-file deletion. */
import { readdir, readFile, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const core = path.join(root, 'app/design/core');
const reportDir = path.join(root, 'outputs/optics-workbench');
const modules = [];
const forbiddenGlobals = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest']);
const calculationFiles = [
  ...(await readdir(core)).filter(n => n.endsWith('.ts')).map(n => path.join(core, n)),
  ...['bench-engine', 'optics', 'lens-system', 'learning-model'].map(n => path.join(root, `app/training/${n}.ts`)),
];
const allowed = new Set(calculationFiles);
for (const file of calculationFiles.sort()) {
  const name = path.relative(root, file);
  const source = ts.createSourceFile(name, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const dependencies = [];
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const dependency = node.moduleSpecifier.text;
      if (!dependency.startsWith('.') || !allowed.has(path.resolve(path.dirname(file), dependency))) throw new Error(`Dependency escapes pure calculation layer: ${name} -> ${dependency}`);
      dependencies.push(dependency);
    }
    if (ts.isIdentifier(node) && forbiddenGlobals.has(node.text)) throw new Error(`Browser/IO dependency in calculation layer: ${name} -> ${node.text}`);
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const dependency of dependencies) await stat(path.resolve(path.dirname(file), dependency));
  modules.push({ name, dependencies });
}
if (!modules.length) throw new Error('Calculation core is missing.');

// Only disposable PDF page previews and obsolete launcher logs. Reports, raw
// specifications, book data, Git history and prior QA evidence are excluded.
const candidates = [];
const temporary = path.join(root, 'tmp/pdfs');
try {
  for (const name of await readdir(temporary)) if (/^page-\d+-\d+\.png$/.test(name)) candidates.push(path.join(temporary, name));
} catch (e) { if (e.code !== 'ENOENT') throw e; }
for (const name of await readdir(root)) if (/^\.devserver\d*\.(out|err)\.log$/.test(name)) {
  const target = path.join(root, name);
  if (Date.now() - (await stat(target)).mtimeMs > 7 * 86400000) candidates.push(target);
}
const checked = [];
for (const target of candidates) {
  const resolved = await realpath(target);
  if (!resolved.startsWith(root) || !(await stat(resolved)).isFile()) throw new Error(`Unsafe cleanup target: ${target}`);
  const relative = path.relative(path.dirname(root), resolved).replaceAll('\\', '/');
  if (execFileSync('git', ['ls-files', '--', relative], { cwd: path.dirname(root), encoding: 'utf8' }).trim()) throw new Error(`Cleanup refuses tracked source: ${relative}`);
  checked.push({ path: resolved, bytes: (await stat(resolved)).size });
}
await mkdir(reportDir, { recursive: true });
const plan = path.join(reportDir, 'deployment-cleanup-plan.json');
await writeFile(plan, JSON.stringify(checked, null, 2), 'utf8');
if (checked.length) {
  if (process.platform !== 'win32') throw new Error('Temporary files require a supported Recycle Bin; no permanent deletion fallback.');
  // Arguments go directly to the process; no shell interpolation of paths.
  const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; foreach ($item in (Get-Content -LiteralPath $env:PCSEL_CLEANUP_PLAN -Raw -Encoding utf8 | ConvertFrom-Json)) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($item.path,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin) }";
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, PCSEL_CLEANUP_PLAN: plan }, stdio: 'inherit' });
}
const report = { checkedAt: new Date().toISOString(), status: 'pass', modules, recycled: checked, bytes: checked.reduce((sum, r) => sum + r.bytes, 0) };
const historyPath = path.join(reportDir, 'deployment-cleanup-history.json');
let history = [];
try { history = JSON.parse(await readFile(historyPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// Keep a durable record when the next preparation finds nothing to recycle.
if (checked.length) history.push(report);
await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
await writeFile(path.join(reportDir, 'deployment-preflight.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`Release preparation passed: ${modules.length} pure calculation modules; ${checked.length} temporary files recycled (${report.bytes} bytes).`);
