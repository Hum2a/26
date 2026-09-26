import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { activeThemeId, applyTheme } from "./install";
import { themeCategories, themes, type ThemeId } from "./themes";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight";

const chipEase = "duration-200 ease-[cubic-bezier(0.2,0,0,1)]";

function compactThemeName(name: string): string {
  const [lead, detail] = name.split(" — ");
  if (detail) {
    if (lead.length <= 18) {
      return lead;
    }
    return detail.length <= 22 ? detail : lead;
  }
  const clause = name.split(", ")[0];
  if (clause && clause.length < name.length && clause.length <= 22) {
    return clause;
  }
  return name;
}

function themeListLabel(name: string, names: readonly string[]): string {
  const label = compactThemeName(name);
  const shared = names.filter((entry) => compactThemeName(entry) === label).length > 1;
  if (!shared) {
    return label;
  }
  const detail = name.split(" — ")[1];
  if (detail) {
    return detail.replace(/^but /i, "");
  }
  const remainder = name.split(", ").slice(1).join(", ").replace(/^but /i, "");
  return remainder || name;
}

function CategoryIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {categoryGlyph(id)}
    </svg>
  );
}

function categoryGlyph(id: string) {
  switch (id) {
    case "basic":
      return <circle cx="8" cy="8" r="5.25" />;
    case "personal-26":
      return (
        <>
          <circle cx="8" cy="5.2" r="2" />
          <path d="M3.6 13.2c.7-2.3 2.3-3.4 4.4-3.4s3.7 1.1 4.4 3.4" />
        </>
      );
    case "quiz":
      return (
        <>
          <circle cx="8" cy="8" r="5.25" />
          <path d="M6.3 6.4a1.8 1.8 0 0 1 3.2 1.2c0 .9-.7 1.3-1.3 1.7-.3.2-.4.4-.4.8" />
          <circle cx="8" cy="11.5" r="0.45" fill="currentColor" stroke="none" />
        </>
      );
    case "atmosphere":
      return <path d="M9.8 2.6a4.7 4.7 0 1 0 3 8.2 4 4 0 1 1-3-8.2z" />;
    case "light":
      return (
        <>
          <circle cx="8" cy="8" r="2.3" />
          <path d="M8 2.2v1.5M8 12.3v1.5M2.2 8h1.5M12.3 8h1.5M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1" />
        </>
      );
    case "the-night":
      return <path d="M8 2.2 9.2 5.5l3.5.3-2.7 2.2.8 3.4L8 9.7l-2.8 1.7.8-3.4-2.7-2.2 3.5-.3z" />;
    case "persona":
      return (
        <>
          <path d="M2.6 8.4c0-3 2.3-5.1 5.4-5.1s5.4 2.1 5.4 5.1-1.2 4.4-5.4 5.1c-4.2-.7-5.4-2.4-5.4-5.1z" />
          <circle cx="6.1" cy="8" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="9.9" cy="8" r="0.7" fill="currentColor" stroke="none" />
        </>
      );
    case "games":
      return (
        <>
          <rect x="2.2" y="5" width="11.6" height="6.4" rx="2.2" />
          <path d="M5 8.2h2.2M6.1 7.1v2.2" />
          <circle cx="10.3" cy="7.6" r="0.45" fill="currentColor" stroke="none" />
          <circle cx="11.7" cy="8.8" r="0.45" fill="currentColor" stroke="none" />
        </>
      );
    case "anime":
      return <path d="M8 1.8 9.1 5.4l3.6.4L10 8.2l.9 3.5L8 9.8l-2.9 1.9.9-3.5-2.7-2.4 3.6-.4z" />;
    case "everyday":
      return (
        <>
          <path d="M3.8 4.2h6.6v4.2a3 3 0 0 1-3 3H6.8a3 3 0 0 1-3-3z" />
          <path d="M10.4 5.1h1.3a1.6 1.6 0 0 1 0 3.2h-1.3M4.8 13.4h6.2" />
        </>
      );
    case "cars":
      return (
        <>
          <path d="M2.4 9.2 4.1 6.4h5.6l1.8 2.8" />
          <path d="M2.2 9.2h11.6v2.6H2.2z" />
          <circle cx="4.6" cy="11.8" r="1.05" />
          <circle cx="11.2" cy="11.8" r="1.05" />
        </>
      );
    case "school":
      return (
        <>
          <path d="M8 2.8 2.4 5.8 8 8.8l5.6-3z" />
          <path d="M4.4 7.1v2.7c1.1 1 2.3 1.5 3.6 1.5s2.5-.5 3.6-1.5V7.1" />
          <path d="M13.6 6v3.6" />
        </>
      );
    case "work":
      return (
        <>
          <rect x="2.4" y="5.6" width="11.2" height="7.2" rx="1.4" />
          <path d="M6 5.6V4.3A1.2 1.2 0 0 1 7.2 3.1h1.6A1.2 1.2 0 0 1 10 4.3v1.3" />
        </>
      );
    case "musicians":
      return (
        <>
          <path d="M6.4 12.4V3.6l6.2-1.3v6.4" />
          <circle cx="5" cy="12.2" r="1.6" />
          <circle cx="11.2" cy="9.4" r="1.6" />
        </>
      );
    default:
      return (
        <>
          <path d="M3 5.2h6.2M9.2 5.2 7.8 3.8M9.2 5.2 7.8 6.6" />
          <path d="M13 10.8H6.8M6.8 10.8l1.4 1.4M6.8 10.8l1.4-1.4" />
        </>
      );
  }
}

function categoryIndexFor(themeId: ThemeId) {
  const index = themeCategories.findIndex((category) =>
    (category.themes as readonly ThemeId[]).includes(themeId),
  );
  return index === -1 ? 0 : index;
}

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(activeThemeId);
  const [activeCategory, setActiveCategory] = useState(() =>
    categoryIndexFor(activeThemeId()),
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [anchor, setAnchor] = useState({ top: 72, left: 16 });
  const reduceMotion = usePrefersReducedMotion();

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const width = Math.min(352, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.right - width),
      window.innerWidth - width - 16,
    );
    setAnchor({ top: rect.bottom + 8, left });
  }

  function revealSelectedTheme(index: number) {
    const list = scrollerRef.current?.querySelector<HTMLElement>(
      `#theme-panel-${themeCategories[index].id} ul`,
    );
    const selected = list?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!list || !selected) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    if (selectedRect.top < listRect.top || selectedRect.bottom > listRect.bottom) {
      list.scrollTop += selectedRect.top - listRect.top;
    }
  }

  function scrollToCategory(index: number, behavior: ScrollBehavior) {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    setActiveCategory(index);
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior });
    requestAnimationFrame(() => revealSelectedTheme(index));
  }

  function openPicker() {
    const themeId = activeThemeId();
    setCurrent(themeId);
    setActiveCategory(categoryIndexFor(themeId));
    place();
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const index = categoryIndexFor(activeThemeId());
      setActiveCategory(index);
      scroller?.scrollTo({ left: index * scroller.clientWidth, behavior: "auto" });
      revealSelectedTheme(index);
      dialogRef.current?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePicker();
      }
    }
    function onResize() {
      place();
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function onScrollerScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) {
      return;
    }
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    const next = Math.min(themeCategories.length - 1, Math.max(0, index));
    if (next !== activeCategory) {
      setActiveCategory(next);
    }
  }

  function choose(themeId: ThemeId) {
    applyTheme(themeId);
    setCurrent(themeId);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Theme, ${themes[current].name}`}
        className={`motion-press skin-control inline-flex min-h-12 touch-manipulation items-center px-4 text-base font-bold ${focusRing} ${
          open ? "bg-accent text-accent-foreground" : "text-foreground"
        }`}
        onClick={() => (open ? closePicker() : openPicker())}
      >
        Theme
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="theme-picker"
            ref={dialogRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="skin-panel fixed z-40 flex max-h-[calc(100dvh-5.5rem)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto overscroll-y-contain border border-line bg-surface p-3 text-surface-foreground shadow-lg outline-none [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
            style={{ top: anchor.top, left: anchor.left }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 34 }
            }
          >
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 id={titleId} className="font-display text-2xl text-highlight">
                Themes
              </h2>
              <button
                type="button"
                className={`motion-press min-h-11 rounded-full px-3 text-base font-bold transition-colors duration-150 ${focusRing}`}
                onClick={closePicker}
              >
                Close
              </button>
            </div>
            <div
              role="tablist"
              aria-label="Theme categories"
              className="grid grid-cols-2 gap-0.5"
            >
              {themeCategories.map((category, index) => {
                const selected = index === activeCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    id={`theme-tab-${category.id}`}
                    aria-selected={selected}
                    aria-controls={`theme-panel-${category.id}`}
                    tabIndex={selected ? 0 : -1}
                    className={`motion-press flex h-9 items-center gap-1.5 rounded-full px-2.5 text-left text-[0.7rem] font-semibold leading-tight transition-colors ${chipEase} ${focusRing} ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted hover:bg-background hover:text-foreground"
                    }`}
                    onClick={() =>
                      scrollToCategory(index, reduceMotion ? "auto" : "smooth")
                    }
                    onKeyDown={(event) => {
                      const step =
                        event.key === "ArrowRight"
                          ? 1
                          : event.key === "ArrowLeft"
                            ? -1
                            : event.key === "ArrowDown"
                              ? 2
                              : event.key === "ArrowUp"
                                ? -2
                                : 0;
                      if (step === 0) {
                        return;
                      }
                      event.preventDefault();
                      const next =
                        (index + step + themeCategories.length) % themeCategories.length;
                      scrollToCategory(next, reduceMotion ? "auto" : "smooth");
                      requestAnimationFrame(() => {
                        document
                          .getElementById(`theme-tab-${themeCategories[next].id}`)
                          ?.focus();
                      });
                    }}
                  >
                    <CategoryIcon id={category.id} />
                    <span className="min-w-0 flex-1 line-clamp-2">{category.name}</span>
                  </button>
                );
              })}
            </div>
            <div
              ref={scrollerRef}
              className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
              onScroll={onScrollerScroll}
            >
              {themeCategories.map((category, index) => (
                <div
                  key={category.id}
                  role="tabpanel"
                  id={`theme-panel-${category.id}`}
                  aria-labelledby={`theme-tab-${category.id}`}
                  aria-hidden={index === activeCategory ? undefined : true}
                  className="w-full min-w-full shrink-0 snap-start"
                >
                  <ul className="grid max-h-56 grid-cols-2 content-start gap-1 overflow-y-auto overscroll-y-contain rounded-2xl bg-background p-1.5 [overflow-anchor:none] [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]">
                    {category.themes.map((themeId) => {
                      const theme = themes[themeId];
                      const selected = themeId === current;
                      const names = category.themes.map((id) => themes[id].name);
                      const label = themeListLabel(theme.name, names);
                      return (
                        <li key={themeId}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={theme.name}
                            title={theme.name}
                            tabIndex={index === activeCategory ? 0 : -1}
                            className={`motion-press flex h-11 w-full touch-manipulation items-center gap-2 rounded-lg px-1.5 text-left text-xs font-bold transition-[color,background-color,box-shadow] ${chipEase} ${focusRing} ${
                              selected
                                ? "bg-surface text-highlight shadow-[inset_0_0_0_1px_var(--highlight)]"
                                : "text-foreground hover:bg-surface"
                            }`}
                            onClick={() => choose(themeId)}
                          >
                            <span
                              className="flex h-7 w-3.5 shrink-0 overflow-hidden rounded-md"
                              aria-hidden="true"
                            >
                              <span className="flex w-full flex-col">
                                <span
                                  className="min-h-0 flex-1"
                                  style={{ background: theme.colors.background }}
                                />
                                <span
                                  className="min-h-0 flex-1"
                                  style={{ background: theme.colors.accent }}
                                />
                                <span
                                  className="min-h-0 flex-1"
                                  style={{ background: theme.colors.highlight }}
                                />
                              </span>
                            </span>
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              {themes[current].name} selected. Choose a category, then a theme.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {open ? (
        <button
          type="button"
          aria-label="Close themes"
          className="fixed inset-0 z-30 cursor-default"
          onClick={closePicker}
        />
      ) : null}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onChange() {
      setReduce(media.matches);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
