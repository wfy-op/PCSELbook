import { access } from "node:fs/promises";
import { watch } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const siteRoot = path.resolve(".");
const sourceRoot = path.dirname(siteRoot);
const npmCli = process.env.npm_execpath;
const viteCli = path.join(siteRoot, "node_modules", "vite", "bin", "vite.js");
const watchedDirectories = ["chapters", "frontmatter", "figures", "assets"].map((entry) => path.join(sourceRoot, entry));
const watchedFiles = ["main.tex", "preamble.tex", "notation.tex", "refs.bib"].map((entry) => path.join(sourceRoot, entry));
const watchedExtensions = new Set([".tex", ".bib", ".png", ".jpg", ".jpeg", ".webp"]);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: siteRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

if (!npmCli) throw new Error("npm_execpath is unavailable; start this watcher with npm run dev.");
await run(process.execPath, [npmCli, "run", "sync:book"]);

const vite = spawn(process.execPath, [viteCli, "--host", "127.0.0.1"], { cwd: siteRoot, stdio: "inherit" });
const watchers = [];
let timer;
let syncing = false;
let queued = false;

async function synchronize() {
  if (syncing) {
    queued = true;
    return;
  }
  syncing = true;
  try {
    console.log("Book source changed; synchronizing the local knowledge site…");
    await run(process.execPath, [npmCli, "run", "sync:book"]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  } finally {
    syncing = false;
    if (queued) {
      queued = false;
      void synchronize();
    }
  }
}

function scheduleSynchronization() {
  clearTimeout(timer);
  timer = setTimeout(() => void synchronize(), 800);
}

for (const directory of watchedDirectories) {
  if (!await exists(directory)) continue;
  watchers.push(watch(directory, { recursive: true }, (_event, filename) => {
    if (filename && watchedExtensions.has(path.extname(filename).toLowerCase())) scheduleSynchronization();
  }));
}
for (const file of watchedFiles) {
  if (!await exists(file)) continue;
  watchers.push(watch(file, scheduleSynchronization));
}

function close() {
  clearTimeout(timer);
  watchers.forEach((watcher) => watcher.close());
  if (!vite.killed) vite.kill();
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
vite.once("error", (error) => {
  close();
  throw error;
});
vite.once("exit", (code) => {
  close();
  process.exitCode = code ?? 1;
});
