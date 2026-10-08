import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(process.argv[2] || "dist/client");
const manifest = JSON.parse(await readFile("public/data/book-manifest.json", "utf8"));
const shell = await readFile(path.join(output, "index.html"), "utf8");

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

for (const metadata of manifest.chapters) {
  const chapter = JSON.parse(await readFile(`public/data/chapters/${metadata.slug}.json`, "utf8"));
  const title = `${metadata.title}｜${manifest.title}`;
  const description = metadata.summary || `${manifest.title}：${metadata.title}`;
  const staticArticle = `<article class="static-chapter" data-static-fallback><p class="static-kicker">${escapeHtml(metadata.part)}</p><h1>${escapeHtml(metadata.title)}</h1>${chapter.html}</article>`;
  const page = shell
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace('<div id="root">', `<div id="root">${staticArticle}`);
  const directory = path.join(output, "chapters", metadata.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), page, "utf8");
}

await mkdir(path.join(output, "optics/migrate"), { recursive: true });
await writeFile(path.join(output, "optics/migrate/index.html"), shell);
const redirects = [
  "/optics/migrate /optics/migrate/ 301",
  "/optics/migrate/ /optics/migrate/index.html 200",
  "/optics https://optical-lab-feiyang.pages.dev/ 301",
  "/optics/tutorial https://optical-lab-feiyang.pages.dev/ 301",
  "/optics/tutorial/ https://optical-lab-feiyang.pages.dev/ 301",
  "/optics/designer https://optical-lab-feiyang.pages.dev/designer/ 301",
  "/optics/designer/* https://optical-lab-feiyang.pages.dev/designer/:splat 301",
  "/optics/* https://optical-lab-feiyang.pages.dev/:splat 301",
  "/training/optical-bench https://optical-lab-feiyang.pages.dev/ 301",
  "/training/optical-bench/* https://optical-lab-feiyang.pages.dev/:splat 301",
  "/design/optical-bench https://optical-lab-feiyang.pages.dev/designer/ 301",
  "/design/optical-bench/* https://optical-lab-feiyang.pages.dev/designer/:splat 301",
];
await writeFile(path.join(output, "_redirects"), redirects.join("\n") + "\n");
await writeFile(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`Created ${manifest.chapters.length} chapter pages; optical laboratory routes redirect to the independent project.`);
