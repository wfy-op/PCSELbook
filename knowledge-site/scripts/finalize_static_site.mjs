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

const siteOrigin = "https://pcsel-knowledge-site.pages.dev";
const opticsDescription = "从教程与光路实训到自由设计，在同一光学实验室组合器件、分析光束与探测支路，并保存可复算的工程。";
const tutorialDescription = "光学实验室教程与实训：本科生光路搭建课程、交互透镜组合与组内光泵案例。";
const designerDescription = "光学实验室自由设计：组合透镜、光阑、反射镜与半透半反镜，设计直轴及二维折转分光光路，分析焦面和探测支路并保存工程。";
const opticalTools = [
  { route: "optics", canonicalRoute: "optics", title: "光学实验室", description: opticsDescription },
  { route: "optics/tutorial", canonicalRoute: "optics/tutorial", title: "教程与实训｜光学实验室", description: tutorialDescription },
  { route: "optics/designer", canonicalRoute: "optics/designer", title: "自由设计｜光学实验室", description: designerDescription },
  { route: "training/optical-bench", canonicalRoute: "optics/tutorial", title: "教程与实训｜光学实验室", description: tutorialDescription },
  { route: "design/optical-bench", canonicalRoute: "optics/designer", title: "自由设计｜光学实验室", description: designerDescription },
];
for (const tool of opticalTools) {
  const title = `${tool.title}｜PCSELbook`;
  const canonicalUrl = `${siteOrigin}/${tool.canonicalRoute}/`;
  const canonicalMetadata = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}">`;
  const page = shell
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(tool.description)}">`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(tool.description)}">`)
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/gi, "")
    .replace("</head>", `${canonicalMetadata}</head>`)
    .replace('<div id="root">', `<div id="root"><noscript><h1>${escapeHtml(tool.title)}</h1><p>请启用 JavaScript 使用光学实验室。</p><a href="/optics/tutorial/">教程与实训</a> · <a href="/optics/designer/">自由设计</a> · <a href="/">返回教材</a></noscript>`);
  const directory = path.join(output, tool.route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), page, 'utf8');
}
await writeFile(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
console.log(`Created ${manifest.chapters.length} independently addressable chapter pages.`);
console.log(`Created ${opticalTools.length} optical laboratory pages, including compatible legacy routes.`);
