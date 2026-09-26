import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { activeThemeId, applyTheme } from "./install";
import { themeCategories, themes, type ThemeId } from "./themes";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight";

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
        className={`motion-press inline-flex min-h-12 touch-manipulation items-center rounded-full px-4 text-base font-bold transition-colors duration-150 ${focusRing} ${
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
            className="fixed z-40 flex max-h-[calc(100dvh-5.5rem)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto overscroll-y-contain rounded-3xl border border-line bg-surface p-3 text-surface-foreground shadow-lg outline-none [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
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
              className="flex flex-wrap gap-2"
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
                    className={`motion-press min-h-11 shrink-0 rounded-full px-3 text-sm font-bold transition-colors duration-150 ${focusRing} ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-foreground"
                    }`}
                    onClick={() =>
                      scrollToCategory(index, reduceMotion ? "auto" : "smooth")
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                        return;
                      }
                      event.preventDefault();
                      const direction = event.key === "ArrowRight" ? 1 : -1;
                      const next =
                        (index + direction + themeCategories.length) %
                        themeCategories.length;
                      scrollToCategory(next, reduceMotion ? "auto" : "smooth");
                      requestAnimationFrame(() => {
                        document
                          .getElementById(`theme-tab-${themeCategories[next].id}`)
                          ?.focus();
                      });
                    }}
                  >
                    {category.name}
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
                  <ul className="grid max-h-60 gap-2 overflow-y-auto overscroll-y-contain pr-1 [overflow-anchor:none] [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]">
                    {category.themes.map((themeId) => {
                      const theme = themes[themeId];
                      const selected = themeId === current;
                      return (
                        <li key={themeId}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            tabIndex={index === activeCategory ? 0 : -1}
                            className={`motion-press flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-2xl border bg-background px-3 text-left text-base font-bold transition-colors duration-150 ${focusRing} ${
                              selected ? "border-highlight" : "border-line"
                            }`}
                            onClick={() => choose(themeId)}
                          >
                            <span className="flex shrink-0 gap-1" aria-hidden="true">
                              <span
                                className="size-4 rounded-full border border-line"
                                style={{ background: theme.colors.background }}
                              />
                              <span
                                className="size-4 rounded-full"
                                style={{ background: theme.colors.accent }}
                              />
                              <span
                                className="size-4 rounded-full"
                                style={{ background: theme.colors.highlight }}
                              />
                            </span>
                            <span className="min-w-0 flex-1">{theme.name}</span>
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
