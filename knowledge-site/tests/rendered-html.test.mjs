import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const manifestPath = new URL("../public/data/book-manifest.json", import.meta.url);
const chaptersDirectory = new URL("../public/data/chapters/", import.meta.url);
const outputDirectory = new URL("../dist/client/", import.meta.url);

async function loadSiteData() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const chapters = await Promise.all(manifest.chapters.map(async (metadata) => JSON.parse(await readFile(new URL(`${metadata.slug}.json`, chaptersDirectory), "utf8"))));
  return { manifest, chapters, html: chapters.map((chapter) => chapter.html).join("\n") };
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return nested.flat();
}

test("vertical tutorial code retains executable text, indentation and operators", async () => {
  const { chapters } = await loadSiteData();
  const chapter = chapters.find((entry) => entry.slug === "ch16-epitaxial-optical-structure");
  const source = await readFile(new URL("../../chapters/ch16_epitaxial_optical_structure.tex", import.meta.url), "utf8");
  const snippet = source.match(/\\begin\{lstlisting\}\[language=Python[^\]]*\]\r?\n([\s\S]*?)\\end\{lstlisting\}/)[1].trim();
  const rendered = chapter.html.match(/<pre class="source-code"><code class="language-python">([\s\S]*?)<\/code><\/pre>/)[1];
  const decoded = rendered.replace(/&#10;/g, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  assert.equal(decoded.trim().replace(/\r\n/g, "\n"), snippet.replace(/\r\n/g, "\n"));
  assert.doesNotMatch(chapter.html, /lstlisting\[|ch:blochch:method-compare/);
});

test("all formulas are build-time rendered to accessible KaTeX HTML", async () => {
  const { manifest, html } = await loadSiteData();
  const formulaCount = manifest.stats.displayEquations + manifest.stats.inlineEquations;
  const rendered = html.match(/class="katex(?:-display)?"/g) ?? [];
  assert.ok(manifest.stats.displayEquations > 500);
  assert.ok(manifest.stats.inlineEquations > 3_000);
  assert.ok(rendered.length >= formulaCount, `expected at least ${formulaCount} KaTeX roots, found ${rendered.length}`);
  assert.doesNotMatch(html, /class="math-source"/);
  assert.doesNotMatch(html, /katex-error/);
  assert.match(html, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/);
});

test("the site uses a compact self-hosted Noto Sans SC variable-font subset", async () => {
  const sourceFont = new URL("../public/fonts/noto-sans-sc-pcsel.woff2", import.meta.url);
  const builtFont = new URL("../dist/client/fonts/noto-sans-sc-pcsel.woff2", import.meta.url);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const font = await readFile(sourceFont);
  assert.equal(font.subarray(0, 4).toString(), "wOF2");
  assert.ok(font.length > 200_000 && font.length < 1_000_000, `unexpected subset size: ${font.length}`);
  assert.match(css, /font-family: "PCSEL Noto Sans SC"/);
  assert.match(css, /font-weight: 100 900/);
  assert.doesNotMatch(css, /Source Han Serif|Noto Serif|Songti|STSong/);
  await access(builtFont);
});

test("figures are independent source-rendered WebP assets", async () => {
  const { manifest, html } = await loadSiteData();
  const figureManifest = JSON.parse(await readFile(new URL("../public/figures/manifest.json", import.meta.url), "utf8"));
  const generatedFigureSource = await readFile(new URL("../outputs/figure-render/all_figures.tex", import.meta.url), "utf8");
  const files = [...html.matchAll(/src="\/figures\/([^"]+\.webp)"/g)].map((match) => match[1]);
  assert.ok(manifest.stats.figures > 70);
  assert.equal(files.length, manifest.stats.figures);
  assert.equal(new Set(files).size, manifest.stats.figures);
  assert.doesNotMatch(html, /page-previews|PDF\s*截图|figure-fallback/);
  const captions = Object.values(figureManifest.figures).map((figure) => figure.caption).join("\n");
  assert.doesNotMatch(captions, /i̧te|\\cite|cite\{/i, "figure caption metadata leaked citation syntax");
  const figureIndex = (await loadSiteData()).chapters.find((chapter) => chapter.slug === "figure-index").html;
  assert.equal((figureIndex.match(/href="\/figures\//g) ?? []).length, manifest.stats.figures);
  assert.doesNotMatch(generatedFigureSource, /^\s*\[[!htbpH]+\]/m, "figure placement option leaked into standalone rendering");
  assert.doesNotMatch(generatedFigureSource, /\\(?:begin|end)\{figure\*?\}|\\caption\b|\\label\b/);
  await Promise.all(files.map(async (file) => {
    const figurePath = new URL(`../public/figures/${file}`, import.meta.url);
    await access(figurePath);
    const signature = (await readFile(figurePath)).subarray(0, 12);
    assert.equal(signature.subarray(0, 4).toString(), "RIFF");
    assert.equal(signature.subarray(8, 12).toString(), "WEBP");
  }));
});

test("all sidebar headings and internal cross references resolve", async () => {
  const { chapters, html } = await loadSiteData();
  const anchors = new Map(chapters.map((chapter) => [chapter.slug, new Set(chapter.anchors)]));
  for (const chapter of chapters) {
    for (const heading of chapter.headings) {
      assert.ok(anchors.get(chapter.slug)?.has(heading.id), `sidebar heading is absent from anchors: ${chapter.slug}#${heading.id}`);
      assert.ok(chapter.html.includes(`id="${heading.id}"`), `sidebar heading is absent from HTML: ${chapter.slug}#${heading.id}`);
    }
  }
  const links = [...html.matchAll(/href="\/chapters\/([^/]+)\/#([^"]+)"/g)];
  const missing = links.filter((match) => !anchors.get(match[1])?.has(match[2])).map((match) => `${match[1]}#${match[2]}`);
  assert.ok(links.length > 350, `expected more than 350 internal links, found ${links.length}`);
  assert.deepEqual([...new Set(missing)].slice(0, 20), []);
  assert.doesNotMatch(html, /class="broken-reference"/);
});

test("bibliography links are complete and clean", async () => {
  const { manifest, chapters, html } = await loadSiteData();
  assert.ok(manifest.stats.references > 75);
  assert.equal((html.match(/id="ref-[^"]+"/g) ?? []).length, manifest.stats.references);
  assert.doesNotMatch(html, /\bcite\{|\bjoannopoulos2008\b(?!")/);
  const bibliographyHtml = chapters.find((chapter) => chapter.slug === "references").html;
  assert.doesNotMatch(bibliographyHtml, /\\(?:&#x27;|&quot;|,)/);
});

test("tables contain semantic cells without leaked LaTeX column specifications", async () => {
  const { manifest, html } = await loadSiteData();
  assert.ok(manifest.stats.tables > 50);
  assert.equal((html.match(/<table class="book-table"/g) ?? []).length, manifest.stats.tables);
  assert.doesNotMatch(html, /\\(?:toprule|midrule|bottomrule|begin\{(?:tabularx?|longtable)|end\{(?:tabularx?|longtable))/);
  assert.doesNotMatch(html, /(?:^|>)[^<]*(?:p\{[\d.]+\\textwidth|@\{\})[^<]*(?:<|$)/m);
  assert.match(html, /<table class="book-table"[^>]*>[\s\S]*?<th/);
});

test("manifest numbering and statistics are derived from current sources", async () => {
  const { manifest, chapters, html } = await loadSiteData();
  const numbered = manifest.chapters.filter((chapter) => chapter.chapterNumber !== null).map((chapter) => chapter.chapterNumber);
  assert.ok(manifest.stats.pdfPages > 400);
  assert.ok(manifest.stats.chapters > 25);
  assert.equal(manifest.stats.contentUnits, manifest.chapters.length);
  assert.equal(manifest.stats.contentUnits, chapters.length);
  assert.equal(manifest.stats.chapters, numbered.length);
  assert.deepEqual(numbered, Array.from({ length: numbered.length }, (_, index) => index + 1));
  assert.equal(manifest.stats.displayEquations, (html.match(/class="math-block"/g) ?? []).length);
  assert.equal(manifest.stats.inlineEquations, (html.match(/class="math-inline"/g) ?? []).length);
  assert.equal(chapters.find((chapter) => chapter.slug === "ch03-maxwell-periodic-media").chapterNumber, 3);
  assert.equal(chapters.find((chapter) => chapter.slug === "preface").chapterNumber, null);
  assert.ok(chapters.some((chapter) => chapter.slug === "figure-index"));
  assert.match(chapters.find((chapter) => chapter.slug === "ch14-fdtd-fem-for-pcsel").html, /FDTD[\s\S]*FEM/);
});

test("search index follows the current manifest and retains searchable source text", async () => {
  const { manifest } = await loadSiteData();
  const index = JSON.parse(await readFile(new URL("../public/data/search-index.json", import.meta.url), "utf8"));
  assert.equal(index.length, manifest.stats.contentUnits);
  assert.ok(index.some((chapter) => chapter.slug === "preface"));
  assert.ok(index.some((chapter) => chapter.slug === "ch28-glossary-symbols"));
  assert.ok(index.some((chapter) => chapter.text.includes("阈")));
  assert.ok(index.some((chapter) => chapter.text.includes("Maxwell")));
  assert.doesNotMatch(index.map((chapter) => chapter.text).join(" "), /\\begin\{|\\frac\{|\\label\{/);
});

test("reading progress is device-local and same-chapter navigation scrolls explicitly", async () => {
  const source = await readFile(new URL("../app/BookSite.tsx", import.meta.url), "utf8");
  assert.match(source, /pcsel-reading-progress-v1/);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /scrollTop: Math\.max/);
  assert.match(source, /window\.addEventListener\("pagehide"/);
  assert.match(source, /if \(slug === activeSlug\) scrollWithinChapter\(heading\)/);
  assert.match(source, /target\.scrollIntoView/);
});

test("book synchronization and deployment cleanup are part of the standard workflow", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["sync:book"], /compile:book.*generate:figures.*generate:book.*generate:font.*prerender_math/);
  assert.match(packageJson.scripts.build, /sync:book|prepare:content/);
  assert.match(packageJson.scripts.build, /optimize:deploy.*audit:deploy/);
  assert.match(packageJson.scripts["deploy:pages"], /check.*audit:deploy.*wrangler pages deploy/);
});

test("production export has independent chapter routes and a compact clean payload", async () => {
  const { manifest } = await loadSiteData();
  const index = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  assert.match(index, /PCSEL 理论、仿真与器件物理导论/);
  assert.doesNotMatch(index, /cdn\.jsdelivr\.net|MathJax-script|book-data\.json/);
  await access(new URL("../dist/client/data/book-manifest.json", import.meta.url));
  await access(new URL("../dist/client/_headers", import.meta.url));
  for (const chapter of manifest.chapters) {
    const page = await readFile(new URL(`../dist/client/chapters/${chapter.slug}/index.html`, import.meta.url), "utf8");
    assert.match(page, new RegExp(`<title>${chapter.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(page, /data-static-fallback/);
  }
  const outputFiles = await walk(outputDirectory);
  const relativeFiles = outputFiles.map((file) => decodeURIComponent(file.pathname));
  assert.ok(outputFiles.length < 200, `deployment contains ${outputFiles.length} files`);
  assert.ok(relativeFiles.every((file) => !/[.](?:ttf|woff|map)$/i.test(file)), "legacy or debugging files remain in deployment");
  assert.ok(relativeFiles.every((file) => !file.endsWith("/figures/manifest.json")), "build-only figure manifest remains in deployment");
  assert.ok(relativeFiles.every((file) => !["/file.svg", "/globe.svg", "/window.svg"].some((suffix) => file.endsWith(suffix))), "starter icons remain in deployment");
});
