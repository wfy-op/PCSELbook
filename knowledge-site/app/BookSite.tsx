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

type PartGroup = { part: string; kicker: string; front: boolean; chapters: ChapterMetadata[] };

const READING_PROGRESS_KEY = "pcsel-reading-progress-v1";
const LAB_URL = "https://optical-lab-feiyang.pages.dev/";
const SEARCH_LIMIT = 60;
const PART_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

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

function ArrowIcon({ direction }: { direction: "left" | "right" | "up" }) {
  return <svg className={`arrow-${direction}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg>;
}

function ExternalIcon() {
  return <svg className="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" /></svg>;
}

function chapterLabel(item: Pick<ChapterMetadata, "chapterNumber" | "navLabel">) {
  return item.chapterNumber ? `第 ${item.chapterNumber} 章` : item.navLabel;
}

function chapterRange(chapters: ChapterMetadata[]) {
  const numbers = chapters.map((item) => item.chapterNumber).filter((value): value is number => value !== null);
  if (!numbers.length) return "";
  const first = Math.min(...numbers);
  const last = Math.max(...numbers);
  return first === last ? `第 ${first} 章` : `第 ${first}–${last} 章`;
}

function groupParts(chapters: ChapterMetadata[]): PartGroup[] {
  const groups = new Map<string, ChapterMetadata[]>();
  for (const item of chapters) groups.set(item.part, [...(groups.get(item.part) ?? []), item]);
  let numbered = 0;
  return [...groups.entries()].map(([part, items]) => {
    const front = items.every((item) => item.chapterNumber === null);
    const kicker = front ? "" : part.startsWith("附录") ? "附录" : `第${PART_NUMERALS[numbered] ?? numbered + 1}部分`;
    if (!front && !part.startsWith("附录")) numbered += 1;
    return { part, kicker, front, chapters: items };
  });
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
  const [showBackToTop, setShowBackToTop] = useState(false);
  const compact = useCompactLayout();
  const contentRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
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

  // Reading progress bar and back-to-top visibility follow the reading pane scroll.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = pane.scrollHeight - pane.clientHeight;
      const ratio = range > 0 ? Math.min(1, Math.max(0, pane.scrollTop / range)) : 0;
      progressRef.current?.style.setProperty("transform", `scaleX(${ratio})`);
      setShowBackToTop(pane.scrollTop > pane.clientHeight * 1.2);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      pane.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [book, chapter, activeSlug, chapterLoading]);

  // Keep the current chapter and section visible inside the sidebar without moving the page.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || (compact && !menuOpen)) return;
    const item = nav.querySelector<HTMLElement>(".nav-sections button.active") ?? nav.querySelector<HTMLElement>(".nav-chapter[aria-current='page']");
    if (!item) return;
    const navBox = nav.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    if (itemBox.top < navBox.top + 40 || itemBox.bottom > navBox.bottom - 40) {
      nav.scrollTop += itemBox.top - navBox.top - nav.clientHeight * 0.3;
    }
  }, [activeSlug, activeHeading, chapter, compact, menuOpen]);

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

  const groupedChapters = useMemo(() => groupParts(book?.chapters ?? []), [book]);

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
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN")).slice(0, SEARCH_LIMIT);
  }, [query, searchIndex]);

  useEffect(() => {
    resultsRef.current?.querySelector<HTMLElement>("button.selected")?.scrollIntoView({ block: "nearest" });
  }, [selectedResult]);

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
  const frontMatter = groupedChapters.filter((group) => group.front).flatMap((group) => group.chapters);
  const mainParts = groupedChapters.filter((group) => !group.front);
  const reading = activeSlug !== "home";

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
          <button className="brand-button" onClick={() => navigateTo("home")}>
            <span className="brand-mark" aria-hidden="true">PC</span>
            <span className="brand-text"><span className="brand-kicker">PCSEL 知识站</span><strong>{book.title}</strong></span>
          </button>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="关闭目录"><CloseIcon /></button>
        </div>
        <button className="sidebar-search" onClick={openSearch}><SearchIcon /><span>搜索全书</span><kbd>Ctrl K</kbd></button>
        <nav ref={navRef} className="book-nav" aria-label="全书目录">
          <button className={`nav-home ${activeSlug === "home" ? "active" : ""}`} onClick={() => navigateTo("home")} aria-current={activeSlug === "home" ? "page" : undefined}>阅读总览</button>
          {groupedChapters.map((group) => <section className="nav-part" key={group.part} aria-label={group.part}>
            <h2>{group.kicker && <span className="nav-part-kicker">{group.kicker}</span>}<span>{group.part}</span></h2>
            {group.chapters.map((item) => <div className="nav-chapter-block" key={item.slug}>
              <button className={`nav-chapter ${activeSlug === item.slug ? "active" : ""}`} onClick={() => navigateTo(item.slug)} aria-current={activeSlug === item.slug ? "page" : undefined}>
                <span className="nav-number">{item.navLabel}</span><span className="nav-title">{item.title}</span>
              </button>
              {activeSlug === item.slug && item.headings.length > 0 && <div className="nav-sections">
                {item.headings.filter((heading) => heading.level <= 3).map((heading) => <button key={heading.id} className={`${heading.level === 3 ? "nav-subsection" : ""} ${activeHeading === heading.id ? "active" : ""}`} onClick={() => navigateTo(item.slug, heading.id)}>{heading.title}</button>)}
              </div>}
            </div>)}
          </section>)}
        </nav>
        <div className="sidebar-footer">
          <a className="sidebar-link" href={LAB_URL}><span>光学实验室</span><ExternalIcon /></a>
          <a className="sidebar-link" href="/book.pdf" target="_blank" rel="noreferrer"><span>下载 PDF</span><small>{book.stats.pdfPages} 页</small></a>
        </div>
      </aside>

      <main ref={paneRef} id="main-content" className="reading-pane" tabIndex={-1}>
        {reading && <div className="reading-progress" aria-hidden="true"><div ref={progressRef} /></div>}
        {activeSlug === "home" ? <article className="home-view">
          <section className="home-hero" aria-labelledby="home-title">
            <div className="home-copy">
              <span className="eyebrow">PCSEL 知识站 · {book.edition}</span>
              <h1 id="home-title">{book.title}</h1>
              <p className="pcsel-full-name">光子晶体面发射激光器<span lang="en">Photonic-Crystal Surface-Emitting Laser</span></p>
              <p className="home-lead">从周期介质中的 Maxwell 方程出发，贯通 Bloch 理论、能带、对称性、BIC、耦合波理论、数值仿真与真实器件物理。</p>
              <div className="home-actions">
                {savedChapter && readingProgress
                  ? <button className="primary" onClick={() => navigateTo(savedChapter.slug, "", readingProgress)}>继续阅读 · {chapterLabel(savedChapter)}</button>
                  : <button className="primary" onClick={() => navigateTo(firstChapter.slug)}>从第 1 章开始</button>}
                {savedChapter && <button onClick={() => navigateTo(firstChapter.slug)}>从第 1 章开始</button>}
                <a href="/book.pdf" target="_blank" rel="noreferrer">打开 {book.stats.pdfPages} 页 PDF</a>
              </div>
              {savedChapter && <p className="reading-progress-note">本机已记录阅读位置：{savedChapter.title}{savedHeading ? ` · ${savedHeading.title}` : ""}</p>}
            </div>
            <figure className="cover-stage"><div className="cover-frame"><img src="/cover.webp" width="780" height="503" fetchPriority="high" alt="PCSEL 器件结构示意图" /></div><figcaption><span>DEVICE CONCEPT</span><span>有源区与表面出光结构</span></figcaption></figure>
          </section>

          <dl className="pcsel-name-parts" aria-label="PCSEL 名称拆解">
            <div><dt><abbr>PC</abbr>Photonic Crystal</dt><dd>光子晶体：周期结构让面内传播的光相互耦合，形成反馈。</dd></div>
            <div><dt><abbr>SE</abbr>Surface-Emitting</dt><dd>面发射：光从芯片表面输出，而不是从侧边端面输出。</dd></div>
            <div><dt><abbr>L</abbr>Laser</dt><dd>激光器：有源区提供增益，补偿损耗后形成激光振荡。</dd></div>
          </dl>

          <dl className="book-stats" aria-label="书稿规模">
            <div><dt>{book.stats.chapters}</dt><dd>章</dd></div>
            <div><dt>{book.stats.figures}</dt><dd>幅图</dd></div>
            <div><dt>{book.stats.tables}</dt><dd>张表</dd></div>
            <div><dt>{book.stats.displayEquations}</dt><dd>组行间公式</dd></div>
          </dl>

          <section className="book-structure" aria-labelledby="structure-title">
            <header className="section-heading">
              <h2 id="structure-title">全书结构</h2>
              <p>从开放周期系统的电磁学出发，经降阶理论与数值方法进入器件物理，最后落到可复核的仿真工作流。</p>
              {frontMatter.length > 0 && <div className="front-links" aria-label="前置内容">{frontMatter.map((item) => <button key={item.slug} onClick={() => navigateTo(item.slug)}>{item.title}</button>)}</div>}
            </header>
            <div className="structure-grid">
              {mainParts.map((group) => <section className="structure-part" key={group.part} aria-label={group.part}>
                <header><span className="structure-kicker">{group.kicker}</span><h3>{group.part}</h3><span className="structure-range">{chapterRange(group.chapters)}</span></header>
                <ol>{group.chapters.map((item) => <li key={item.slug}><button onClick={() => navigateTo(item.slug)}><span>{item.chapterNumber ?? item.navLabel}</span>{item.title}</button></li>)}</ol>
              </section>)}
            </div>
          </section>

          <section className="lab-entry" aria-labelledby="lab-entry-title">
            <div className="lab-entry-copy">
              <span className="eyebrow">OPTICS LAB</span>
              <h2 id="lab-entry-title">光学实验室</h2>
              <p>从教程与光路实训开始，在同一实验室自由设计。组合透镜、光阑、反射镜与分光镜，分析光束、焦面和探测支路，并保存可复算的工程。</p>
            </div>
            <div className="lab-entry-actions"><a className="primary" href={LAB_URL}>教程与实训</a><a href={`${LAB_URL}designer/`}>自由设计<ExternalIcon /></a></div>
          </section>
        </article> : chapterLoading ? <section className="content-state" aria-live="polite"><div className="loading-mark">PCSEL</div><p>正在加载本章…</p></section> : chapterError ? <section className="content-state" role="alert"><h1>本章暂时无法显示</h1><p>{chapterError}</p><button onClick={() => window.location.reload()}>重新加载本章</button></section> : chapter && activeMetadata ? <article className="chapter-view" ref={contentRef}>
          <header className="chapter-header">
            <nav className="breadcrumbs" aria-label="当前位置"><button onClick={() => navigateTo("home")}>首页</button><span aria-hidden="true">/</span><span>{chapter.part}</span></nav>
            <span className="chapter-index">{chapterLabel(chapter)}</span>
            <h1>{chapter.title}</h1>
            <div className="chapter-meta">
              {chapter.headings.length > 0 && <span>{chapter.headings.filter((heading) => heading.level === 2).length} 节</span>}
              <span>源稿更新 {chapter.sourceUpdated}</span>
              <a href="/book.pdf" target="_blank" rel="noreferrer">对照 PDF</a>
            </div>
          </header>
          <ChapterBody html={chapter.html} />
          <nav className="chapter-pagination" aria-label="章节翻页">{previous ? <button onClick={() => navigateTo(previous.slug)}><ArrowIcon direction="left" /><span><small>上一篇 · {chapterLabel(previous)}</small>{previous.title}</span></button> : <span />}{next ? <button className="next" onClick={() => navigateTo(next.slug)}><span><small>下一篇 · {chapterLabel(next)}</small>{next.title}</span><ArrowIcon direction="right" /></button> : <span />}</nav>
        </article> : null}
      </main>

      {reading && <button className={`back-to-top ${showBackToTop ? "visible" : ""}`} onClick={() => paneRef.current?.scrollTo({ top: 0, behavior: "smooth" })} aria-label="回到本章开头" tabIndex={showBackToTop ? 0 : -1} aria-hidden={!showBackToTop}><ArrowIcon direction="up" /></button>}
    </div>

    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <button className="search-backdrop" onClick={() => setSearchOpen(false)} aria-label="关闭搜索" />
      <section ref={searchPanelRef} className="search-panel"><h2 id="search-title" className="visually-hidden">搜索全书</h2><div className="search-input-wrap"><SearchIcon /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedResult(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setSelectedResult((value) => Math.min(searchResults.length - 1, value + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setSelectedResult((value) => Math.max(0, value - 1)); }
        if (event.key === "Enter" && searchResults[selectedResult]) { const result = searchResults[selectedResult]; navigateTo(result.slug, result.heading?.id); }
      }} placeholder="搜索概念、公式、方法或章节…" aria-label="搜索关键词" aria-controls="search-results" /><button onClick={() => setSearchOpen(false)} aria-label="关闭搜索">ESC</button></div>
        <div ref={resultsRef} id="search-results" className="search-results" aria-live="polite">{searchError ? <div className="search-empty" role="alert"><strong>搜索不可用</strong><span>{searchError}</span></div> : !searchIndex ? <div className="search-empty"><strong>正在加载全文索引…</strong></div> : !query.trim() ? <div className="search-empty"><strong>全文检索</strong><span>支持中文单字、英文缩写、概念、公式和章节名。</span></div> : searchResults.length ? searchResults.map((result, index) => <button key={`${result.slug}-${result.heading?.id ?? "chapter"}`} className={selectedResult === index ? "selected" : ""} onMouseEnter={() => setSelectedResult(index)} onClick={() => navigateTo(result.slug, result.heading?.id)}><span className="result-part">{result.part}</span><strong><Highlight text={result.heading?.title ?? result.title} query={query.trim()} /></strong>{result.heading && <small>{result.title}</small>}<p><Highlight text={result.snippet} query={query.trim()} /></p></button>) : <div className="search-empty"><strong>没有找到匹配内容</strong><span>尝试缩短关键词或使用英文缩写。</span></div>}</div>
        <footer className="search-footer"><span><kbd>↑</kbd><kbd>↓</kbd>选择</span><span><kbd>Enter</kbd>打开</span><span><kbd>Esc</kbd>关闭</span>{query.trim() && searchIndex ? <span className="search-count">{searchResults.length >= SEARCH_LIMIT ? `显示前 ${SEARCH_LIMIT} 条` : `${searchResults.length} 条结果`}</span> : null}</footer>
      </section>
    </div>}
  </>;
}
