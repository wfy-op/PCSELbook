import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";

type Heading = { id: string; title: string; level: number };

type ChapterMetadata = {
  order: number;
  chapterNumber: number | null;
  navLabel: string;
  slug: string;
  part: string;
  title: string;
  sourceUpdated: string;
  headings: Heading[];
  anchors: string[];
  summary: string;
};

type Chapter = ChapterMetadata & { html: string };

type BookManifest = {
  title: string;
  author: string;
  edition: string;
  generatedAt: string;
  stats: {
    pdfPages: number;
    chapters: number;
    contentUnits: number;
    figures: number;
    tables: number;
    displayEquations: number;
    inlineEquations: number;
    references: number;
  };
  chapters: ChapterMetadata[];
};

type SearchSection = { id: string; title: string; text: string };
type SearchChapter = { slug: string; part: string; title: string; text: string; sections: SearchSection[] };
type SearchResult = SearchChapter & { heading?: SearchSection; snippet: string; score: number };

type ReadingProgress = {
  version: 1;
  slug: string;
  heading: string;
  scrollTop: number;
  updatedAt: string;
};

const READING_PROGRESS_KEY = "pcsel-reading-progress-v1";

function readReadingProgress(): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(READING_PROGRESS_KEY);
    if (!value) return null;
    const progress = JSON.parse(value) as Partial<ReadingProgress>;
    if (progress.version !== 1 || typeof progress.slug !== "string" || typeof progress.heading !== "string" || typeof progress.scrollTop !== "number" || typeof progress.updatedAt !== "string") return null;
    return { version: 1, slug: progress.slug, heading: progress.heading, scrollTop: Math.max(0, progress.scrollTop), updatedAt: progress.updatedAt };
  } catch {
    return null;
  }
}

function storeReadingProgress(progress: ReadingProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Reading remains fully functional when browser storage is unavailable.
  }
}

function clearReadingProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(READING_PROGRESS_KEY);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

const ChapterBody = memo(function ChapterBody({ html }: { html: string }) {
  return <div className="chapter-body" dangerouslySetInnerHTML={{ __html: html }} />;
});

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.2 4.2" /></svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return <svg className={direction === "right" ? "arrow-right" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg>;
}

function routeFromLocation(chapters: ChapterMetadata[]) {
  const pathMatch = window.location.pathname.match(/^\/chapters\/([^/]+)\/?$/);
  if (pathMatch && chapters.some((chapter) => chapter.slug === decodeURIComponent(pathMatch[1]))) {
    return { slug: decodeURIComponent(pathMatch[1]), heading: decodeURIComponent(window.location.hash.slice(1)) };
  }
  const legacyHash = decodeURIComponent(window.location.hash.slice(1));
  const legacyChapter = chapters.find((chapter) => chapter.slug === legacyHash);
  if (legacyChapter) return { slug: legacyChapter.slug, heading: "" };
  const chapterByHeading = chapters.find((chapter) => chapter.anchors.includes(legacyHash));
  if (chapterByHeading) return { slug: chapterByHeading.slug, heading: legacyHash };
  return { slug: "home", heading: "" };
}

function snippetAround(text: string, query: string) {
  const normalized = text.toLocaleLowerCase("zh-CN");
  const needle = query.toLocaleLowerCase("zh-CN");
  const index = normalized.indexOf(needle);
  if (index < 0) return text.slice(0, 116);
  const start = Math.max(0, index - 46);
  const end = Math.min(text.length, index + query.length + 74);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase("zh-CN").indexOf(query.toLocaleLowerCase("zh-CN"));
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 980px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 980px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}

export function BookSite() {
  const [book, setBook] = useState<BookManifest | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeSlug, setActiveSlug] = useState("home");
  const [activeHeading, setActiveHeading] = useState("");
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState<SearchChapter[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selectedResult, setSelectedResult] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(() => readReadingProgress());
  const compact = useCompactLayout();
  const contentRef = useRef<HTMLElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const pendingRestoreRef = useRef<ReadingProgress | null>(null);

  const loadManifest = useCallback(() => {
    fetch("/data/book-manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<BookManifest>;
      })
      .then((payload) => {
        setBook(payload);
        const route = routeFromLocation(payload.chapters);
        const savedProgress = readReadingProgress();
        if (savedProgress && payload.chapters.some((item) => item.slug === savedProgress.slug)) {
          setReadingProgress(savedProgress);
          if (route.slug === savedProgress.slug && !route.heading) pendingRestoreRef.current = savedProgress;
        } else if (savedProgress) {
          clearReadingProgress();
          setReadingProgress(null);
        }
        setActiveSlug(route.slug);
        setActiveHeading(route.heading);
      })
      .catch(() => setLoadError("知识站目录加载失败，请检查本地服务后重试。"));
  }, []);

  useEffect(loadManifest, [loadManifest]);

  useEffect(() => {
    if (!book) return;
    const syncRoute = () => {
      const route = routeFromLocation(book.chapters);
      setActiveSlug(route.slug);
      setActiveHeading(route.heading);
      setMenuOpen(false);
    };
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, [book]);

  const scrollWithinChapter = useCallback((heading = "", behavior: ScrollBehavior = "smooth") => {
    window.requestAnimationFrame(() => {
      const target = heading ? document.getElementById(heading) : null;
      const pane = document.querySelector<HTMLElement>(".reading-pane");
      if (target) target.scrollIntoView({ behavior, block: "start" });
      else pane?.scrollTo({ top: 0, behavior });
    });
  }, []);

  const navigateTo = useCallback((slug: string, heading = "", restoreProgress: ReadingProgress | null = null) => {
    const url = slug === "home" ? "/" : `/chapters/${encodeURIComponent(slug)}/`;
    window.history.pushState({}, "", `${url}${heading ? `#${encodeURIComponent(heading)}` : ""}`);
    pendingRestoreRef.current = restoreProgress;
    if (slug === activeSlug) scrollWithinChapter(heading);
    setActiveSlug(slug);
    setActiveHeading(heading);
    setSearchOpen(false);
    setMenuOpen(false);
  }, [activeSlug, scrollWithinChapter]);

  useEffect(() => {
    if (!book) return;
    if (activeSlug === "home") {
      document.title = book.title;
      document.querySelector(".reading-pane")?.scrollTo({ top: 0 });
      return;
    }
    const metadata = book.chapters.find((item) => item.slug === activeSlug);
    if (!metadata) return;
    const controller = new AbortController();
    setChapterLoading(true);
    setChapterError("");
    fetch(`/data/chapters/${encodeURIComponent(activeSlug)}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Chapter>;
      })
      .then((payload) => {
        setChapter(payload);
        setChapterLoading(false);
        document.title = `${payload.title}｜${book.title}`;
        window.requestAnimationFrame(() => {
          const requestedHeading = decodeURIComponent(window.location.hash.slice(1));
          const target = requestedHeading ? document.getElementById(requestedHeading) : null;
          const pane = document.querySelector<HTMLElement>(".reading-pane");
          const savedProgress = pendingRestoreRef.current?.slug === activeSlug ? pendingRestoreRef.current : null;
          pendingRestoreRef.current = null;
          if (target) target.scrollIntoView({ block: "start" });
          else if (savedProgress) pane?.scrollTo({ top: savedProgress.scrollTop });
          else pane?.scrollTo({ top: 0 });
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setChapterLoading(false);
        setChapterError("本章内容加载失败，请重试。若持续失败，请检查 data/chapters 目录是否完整。");
      });
    return () => controller.abort();
  }, [activeSlug, book]);

  useEffect(() => {
    if (!chapter || !contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveHeading(visible.target.id);
    }, { root: document.querySelector(".reading-pane"), rootMargin: "-8% 0px -78% 0px", threshold: [0, 1] });
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [chapter]);

  useEffect(() => {
    if (!chapter || chapter.slug !== activeSlug || activeSlug === "home") return;
    const pane = document.querySelector<HTMLElement>(".reading-pane");
    if (!pane) return;
    let timer: number | undefined;
    const persist = (updateInterface: boolean) => {
      const nextProgress: ReadingProgress = {
        version: 1,
        slug: activeSlug,
        heading: activeHeading,
        scrollTop: Math.max(0, Math.round(pane.scrollTop)),
        updatedAt: new Date().toISOString(),
      };
      storeReadingProgress(nextProgress);
      if (updateInterface) setReadingProgress(nextProgress);
    };
    const schedulePersist = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => persist(true), 350);
    };
    const persistBeforeLeaving = () => persist(false);
    pane.addEventListener("scroll", schedulePersist, { passive: true });
    window.addEventListener("pagehide", persistBeforeLeaving);
    schedulePersist();
    return () => {
      window.clearTimeout(timer);
      pane.removeEventListener("scroll", schedulePersist);
      window.removeEventListener("pagehide", persistBeforeLeaving);
      persistBeforeLeaving();
    };
  }, [activeHeading, activeSlug, chapter]);

  const openSearch = useCallback(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    setSearchOpen(true);
    if (!searchIndex && !searchError) {
      fetch("/data/search-index.json")
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<SearchChapter[]>;
        })
        .then(setSearchIndex)
        .catch(() => setSearchError("搜索索引加载失败，请重试。"));
    }
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [searchError, searchIndex]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".site-shell");
    shell?.toggleAttribute("inert", searchOpen);
    if (!searchOpen) previousFocus.current?.focus();
    return () => shell?.removeAttribute("inert");
  }, [searchOpen]);

  useEffect(() => {
    sidebarRef.current?.toggleAttribute("inert", compact && !menuOpen);
    sidebarRef.current?.setAttribute("aria-hidden", String(compact && !menuOpen));
    if (compact && menuOpen) window.setTimeout(() => sidebarRef.current?.querySelector<HTMLElement>("button")?.focus(), 0);
    if (compact && !menuOpen) menuButtonRef.current?.focus();
  }, [book, compact, menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
      if (event.key === "Tab" && searchOpen && searchPanelRef.current) {
        const controls = Array.from(searchPanelRef.current.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]:not([tabindex='-1'])"));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch, searchOpen]);

  const groupedChapters = useMemo(() => {
    const groups = new Map<string, ChapterMetadata[]>();
    for (const item of book?.chapters ?? []) groups.set(item.part, [...(groups.get(item.part) ?? []), item]);
    return [...groups.entries()].map(([part, chapters]) => ({ part, chapters }));
  }, [book]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const cleanQuery = query.trim();
    if (!searchIndex || !cleanQuery) return [];
    const needle = cleanQuery.toLocaleLowerCase("zh-CN");
    const results: SearchResult[] = [];
    for (const item of searchIndex) {
      const titleMatch = item.title.toLocaleLowerCase("zh-CN").includes(needle);
      const matchingSections = item.sections.filter((section) => section.title.toLocaleLowerCase("zh-CN").includes(needle) || section.text.toLocaleLowerCase("zh-CN").includes(needle));
      if (titleMatch || (!matchingSections.length && item.text.toLocaleLowerCase("zh-CN").includes(needle))) {
        results.push({ ...item, snippet: snippetAround(item.text, cleanQuery), score: titleMatch ? 120 : 30 });
      }
      for (const section of matchingSections) {
        const headingMatch = section.title.toLocaleLowerCase("zh-CN").includes(needle);
        results.push({ ...item, heading: section, snippet: snippetAround(section.text, cleanQuery), score: headingMatch ? 90 : 50 });
      }
    }
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN")).slice(0, 60);
  }, [query, searchIndex]);

  if (!book) {
    return <main className="loading-screen"><div className="loading-mark">PCSEL</div>{loadError ? <><p role="alert">{loadError}</p><button onClick={loadManifest}>重新加载</button></> : <p>正在载入知识结构…</p>}</main>;
  }

  const activeMetadata = book.chapters.find((item) => item.slug === activeSlug) ?? null;
  const activeIndex = activeMetadata ? book.chapters.findIndex((item) => item.slug === activeSlug) : -1;
  const previous = activeIndex > 0 ? book.chapters[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < book.chapters.length - 1 ? book.chapters[activeIndex + 1] : null;
  const firstChapter = book.chapters.find((item) => item.chapterNumber === 1) ?? book.chapters[0];
  const savedChapter = readingProgress ? book.chapters.find((item) => item.slug === readingProgress.slug) ?? null : null;
  const savedHeading = savedChapter && readingProgress?.heading ? savedChapter.headings.find((item) => item.id === readingProgress.heading) ?? null : null;

  return <>
    <a className="skip-link" href="#main-content">跳到正文</a>
    <div className="site-shell">
      <header className="mobile-header">
        <button ref={menuButtonRef} className="icon-button" onClick={() => setMenuOpen(true)} aria-label="打开目录" aria-controls="book-sidebar" aria-expanded={menuOpen}><MenuIcon /></button>
        <button className="mobile-brand" onClick={() => navigateTo("home")}>PCSEL 知识站</button>
        <button className="icon-button" onClick={openSearch} aria-label="搜索全书"><SearchIcon /></button>
      </header>

      {menuOpen && <button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="关闭目录" />}
      <aside ref={sidebarRef} id="book-sidebar" className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <button onClick={() => navigateTo("home")}><span className="brand-kicker">PHOTONIC CRYSTAL</span><strong>{book.title}</strong></button>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="关闭目录"><CloseIcon /></button>
        </div>
        <button className="sidebar-search" onClick={openSearch}><SearchIcon /><span>搜索全书</span><kbd>Ctrl K</kbd></button>
        <nav className="book-nav" aria-label="全书目录">
          <button className={`nav-home ${activeSlug === "home" ? "active" : ""}`} onClick={() => navigateTo("home")}>阅读总览</button>
          <section className="nav-part" aria-label="光学实验室">
            <h2>LAB · 光学实验室</h2>
            <a className="nav-chapter" href="/optics/"><span>↗</span>光学实验室</a>
          </section>
          {groupedChapters.map((group, partIndex) => <section className="nav-part" key={group.part}>
            <h2>PART {String(partIndex).padStart(2, "0")} · {group.part}</h2>
            {group.chapters.map((item) => <div className="nav-chapter-block" key={item.slug}>
              <button className={`nav-chapter ${activeSlug === item.slug ? "active" : ""}`} onClick={() => navigateTo(item.slug)} title={item.title} aria-current={activeSlug === item.slug ? "page" : undefined}>
                <span>{item.navLabel}</span>{item.title}
              </button>
              {activeSlug === item.slug && item.headings.length > 0 && <div className="nav-sections">
                {item.headings.filter((heading) => heading.level <= 3).map((heading) => <button key={heading.id} className={`${heading.level === 3 ? "nav-subsection" : ""} ${activeHeading === heading.id ? "active" : ""}`} onClick={() => navigateTo(item.slug, heading.id)}>{heading.title}</button>)}
              </div>}
            </div>)}
          </section>)}
        </nav>
        <div className="sidebar-footer"><span>{book.stats.pdfPages} 页 · {book.stats.figures} 图 · {book.stats.displayEquations} 组公式</span><a href="/book.pdf" target="_blank" rel="noreferrer">下载原书 PDF</a></div>
      </aside>

      <main id="main-content" className="reading-pane" tabIndex={-1}>
        {activeSlug === "home" ? <article className="home-view">
          <div className="home-copy"><span className="eyebrow">PCSEL KNOWLEDGE BASE · {book.edition}</span><h1>{book.title}</h1>
            <p className="pcsel-full-name">光子晶体面发射激光器</p>
            <dl className="pcsel-name-parts" aria-label="PCSEL 名称拆解">
              <div><dt>PC · Photonic Crystal</dt><dd>光子晶体：周期结构让面内传播的光相互耦合，形成反馈。</dd></div>
              <div><dt>SE · Surface-Emitting</dt><dd>面发射：光从芯片表面输出，而不是从侧边端面输出。</dd></div>
              <div><dt>L · Laser</dt><dd>激光器：有源区提供增益，补偿损耗后形成激光振荡。</dd></div>
            </dl>
            <p className="home-lead">从周期介质中的 Maxwell 方程出发，贯通 Bloch 理论、能带、对称性、BIC、耦合波理论、数值仿真与真实器件物理。</p>
            <div className="home-actions">{savedChapter && readingProgress ? <button onClick={() => navigateTo(savedChapter.slug, "", readingProgress)}>继续阅读 · {savedChapter.chapterNumber ? `第 ${savedChapter.chapterNumber} 章` : savedChapter.navLabel}</button> : <button onClick={() => navigateTo(firstChapter.slug)}>从第一章开始</button>}{savedChapter && <button className="secondary" onClick={() => navigateTo(firstChapter.slug)}>从第一章开始</button>}<a href="/book.pdf" target="_blank" rel="noreferrer">打开 {book.stats.pdfPages} 页原书</a></div>
            {savedChapter && <p className="reading-progress-note">本机已自动记录：{savedChapter.title}{savedHeading ? ` · ${savedHeading.title}` : ""}</p>}
            <dl className="book-stats"><div><dt>{book.stats.chapters}</dt><dd>正式章节</dd></div><div><dt>{book.stats.figures}</dt><dd>书稿图形</dd></div><div><dt>{book.stats.tables}</dt><dd>数据表格</dd></div><div><dt>{book.stats.displayEquations}</dt><dd>行间公式</dd></div></dl>
          </div>
          <figure className="cover-stage"><div className="cover-halo" /><div className="cover-frame"><img src="/cover.webp" width="780" height="503" fetchPriority="high" alt="PCSEL 器件结构示意图" /></div><figcaption><span>DEVICE CONCEPT</span><span>有源区与表面出光结构</span></figcaption></figure>
          <section aria-labelledby="optics-entry-title" style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px 32px", border: "1px solid #cbdce7", borderRadius: 12, padding: "26px 28px", background: "#f2f8fb" }}>
            <div style={{ flex: "1 1 260px" }}>
              <span className="eyebrow" style={{ marginBottom: 9 }}>OPTICS LAB · 光学实验室</span>
              <h2 id="optics-entry-title" style={{ margin: "0 0 10px", fontSize: 23, lineHeight: 1.4 }}>光学实验室</h2>
              <p style={{ margin: 0, color: "#596470", fontSize: 14, lineHeight: 1.8 }}>从教程与光路实训开始，在同一实验室自由设计。组合透镜、光阑、反射镜与分光镜，分析光束、焦面和探测支路，并保存可复算的工程。</p>
            </div>
            <div className="home-actions" style={{ marginTop: 0 }}><a href="/optics/tutorial/">教程与实训</a><a href="/optics/designer/">自由设计 <span aria-hidden="true" style={{ marginLeft: 12 }}>↗</span></a></div>
          </section>
          <section className="home-map" aria-label="全书学习路径"><div><span>01</span><h2>从物理图像开始</h2><p>建立开放周期系统、半导体有源腔和真实器件三重视角。</p></div><div><span>02</span><h2>把理论交给数值方法</h2><p>明确 CWT、PWEM、RCWA、FDTD 与 FEM 各自回答什么问题。</p></div><div><span>03</span><h2>最终回到可制造器件</h2><p>用热、电、光耦合和不确定性分析检验设计结论。</p></div></section>
        </article> : chapterLoading ? <section className="content-state" aria-live="polite"><div className="loading-mark">PCSEL</div><p>正在加载本章…</p></section> : chapterError ? <section className="content-state" role="alert"><h1>本章暂时无法显示</h1><p>{chapterError}</p><button onClick={() => window.location.reload()}>重新加载本章</button></section> : chapter && activeMetadata ? <article className="chapter-view" ref={contentRef}>
          <header className="chapter-header"><div className="breadcrumbs"><button onClick={() => navigateTo("home")}>首页</button><span>/</span><span>{chapter.part}</span></div><span className="chapter-index">{chapter.chapterNumber ? `CHAPTER ${String(chapter.chapterNumber).padStart(2, "0")}` : chapter.navLabel}</span><h1>{chapter.title}</h1><div className="chapter-meta"><span>{chapter.headings.length} 个主题</span><span>内容更新：{chapter.sourceUpdated}</span><a href="/book.pdf" target="_blank" rel="noreferrer">对照原书</a></div></header>
          <ChapterBody html={chapter.html} />
          <nav className="chapter-pagination" aria-label="章节翻页">{previous ? <button onClick={() => navigateTo(previous.slug)}><ArrowIcon direction="left" /><span><small>上一篇</small>{previous.title}</span></button> : <span />}{next ? <button className="next" onClick={() => navigateTo(next.slug)}><span><small>下一篇</small>{next.title}</span><ArrowIcon direction="right" /></button> : <span />}</nav>
        </article> : null}
      </main>
    </div>

    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <button className="search-backdrop" onClick={() => setSearchOpen(false)} aria-label="关闭搜索" />
      <section ref={searchPanelRef} className="search-panel"><h2 id="search-title" className="visually-hidden">搜索全书</h2><div className="search-input-wrap"><SearchIcon /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedResult(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setSelectedResult((value) => Math.min(searchResults.length - 1, value + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setSelectedResult((value) => Math.max(0, value - 1)); }
        if (event.key === "Enter" && searchResults[selectedResult]) { const result = searchResults[selectedResult]; navigateTo(result.slug, result.heading?.id); }
      }} placeholder="搜索概念、公式、方法或章节…" aria-label="搜索关键词" aria-controls="search-results" /><button onClick={() => setSearchOpen(false)} aria-label="关闭搜索">ESC</button></div>
        <div id="search-results" className="search-results" aria-live="polite">{searchError ? <div className="search-empty" role="alert"><strong>搜索不可用</strong><span>{searchError}</span></div> : !searchIndex ? <div className="search-empty"><strong>正在加载全文索引…</strong></div> : !query.trim() ? <div className="search-empty"><strong>全文检索</strong><span>支持中文单字、英文缩写、概念、公式和章节名。</span></div> : searchResults.length ? searchResults.map((result, index) => <button key={`${result.slug}-${result.heading?.id ?? "chapter"}`} className={selectedResult === index ? "selected" : ""} onMouseEnter={() => setSelectedResult(index)} onClick={() => navigateTo(result.slug, result.heading?.id)}><span className="result-part">{result.part}</span><strong><Highlight text={result.heading?.title ?? result.title} query={query.trim()} /></strong>{result.heading && <small>{result.title}</small>}<p><Highlight text={result.snippet} query={query.trim()} /></p></button>) : <div className="search-empty"><strong>没有找到匹配内容</strong><span>尝试缩短关键词或使用英文缩写。</span></div>}</div>
      </section>
    </div>}
  </>;
}
