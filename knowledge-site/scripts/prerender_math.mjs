import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import katex from "katex";

const chapterDirectory = path.resolve("public/data/chapters");

const macros = {
  "\\kvec": "\\boldsymbol{k}",
  "\\gvec": "\\boldsymbol{G}",
  "\\rvec": "\\boldsymbol{r}",
  "\\betaslab": "\\beta_{\\mathrm{slab}}",
  "\\betasp": "\\beta_{\\mathrm{sp}}",
  "\\betabloch": "\\beta_{\\mathrm{Bloch}}",
  "\\E": "\\boldsymbol{E}",
  "\\Hf": "\\boldsymbol{H}",
  "\\D": "\\boldsymbol{D}",
  "\\B": "\\boldsymbol{B}",
  "\\J": "\\boldsymbol{J}",
  "\\Jf": "\\boldsymbol{J}",
  "\\p": "\\partial",
  "\\ii": "\\mathrm{i}",
  "\\ee": "\\mathrm{e}",
  "\\dd": "\\mathrm{d}",
  "\\avg": "\\left\\langle #1 \\right\\rangle",
  "\\SI": "#1\\,\\mathrm{#2}",
  "\\SIrange": "#1\\text{--}#2\\,\\mathrm{#3}",
  "\\si": "\\mathrm{#1}",
  "\\per": "/",
  "\\micro": "\\mu",
  "\\nano": "n",
  "\\pico": "p",
  "\\centi": "c",
  "\\milli": "m",
  "\\meter": "m",
  "\\second": "s",
  "\\watt": "W",
  "\\joule": "J",
  "\\kelvin": "K",
  "\\hertz": "Hz",
  "\\volt": "V",
  "\\ampere": "A",
};

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'");
}

let rendered = 0;
const failures = [];
const files = (await readdir(chapterDirectory)).filter((name) => name.endsWith(".json"));

for (const file of files) {
  const filePath = path.join(chapterDirectory, file);
  const chapter = JSON.parse(await readFile(filePath, "utf8"));
  chapter.html = chapter.html.replace(
    /<span class="math-source">(\\\[(?:.|\n)*?\\\]|\\\((?:.|\n)*?\\\))<\/span>/g,
    (source, wrapped) => {
      const displayMode = wrapped.startsWith("\\[");
      const tex = decodeHtml(wrapped.slice(2, -2));
      try {
        rendered += 1;
        return katex.renderToString(tex, {
          displayMode,
          throwOnError: true,
          strict: "ignore",
          output: "htmlAndMathml",
          macros,
        });
      } catch (error) {
        failures.push(`${file}: ${error instanceof Error ? error.message : String(error)} :: ${tex.slice(0, 120)}`);
        return source;
      }
    },
  );
  await writeFile(filePath, `${JSON.stringify(chapter)}\n`, "utf8");
}

if (failures.length) {
  throw new Error(`KaTeX pre-render failed for ${failures.length} formulas:\n${failures.slice(0, 24).join("\n")}`);
}

console.log(`Pre-rendered ${rendered} formulas in ${files.length} content units.`);
