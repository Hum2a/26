import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon, type IconifyIcon } from "@iconify/react/dist/offline";
import gamepad from "@iconify-icons/lucide/gamepad-2";
import trophy from "@iconify-icons/lucide/trophy";
import ghost from "@iconify-icons/lucide/ghost";
import camera from "@iconify-icons/lucide/camera";
import { SkinMotif } from "../theme/skin-motif";
import { ThemePicker } from "../theme/theme-picker";
import { Wordmark } from "../theme/wordmark";
import { PhoneDockTarget } from "../controller/phone-dock";
import { ConnectionDot } from "../net/ConnectionDot";
import { LiquidGround } from "../ui/liquid-ground";
import "./phone-shell.css";

export type PhoneTab = "play" | "ranks" | "troll" | "snap";

export const phoneTabs: readonly {
  id: PhoneTab;
  label: string;
  icon: IconifyIcon;
}[] = [
  { id: "play", label: "Play", icon: gamepad },
  { id: "ranks", label: "Ranks", icon: trophy },
  { id: "troll", label: "Troll", icon: ghost },
  { id: "snap", label: "Snap", icon: camera },
];

export type PhoneTabs = {
  active: PhoneTab;
  onChange: (tab: PhoneTab) => void;
  /** A short badge per tab, such as "1" for a ready troll. */
  badges?: Partial<Record<PhoneTab, string>>;
  pages: Record<Exclude<PhoneTab, "play">, ReactNode>;
};

/**
 * The guest phone frame: a glass top bar, the current page and, when `tabs` is
 * given, an app-style tab bar. `children` is always the Play page, so the
 * admin phone preview can render the same frame without tabs.
 */
export function PhoneShell({
  nickname,
  connection,
  held = false,
  scrollKey,
  immersive = false,
  timer,
  menu,
  overlays,
  tabs,
  children,
}: {
  nickname?: string;
  connection: "connecting" | "open" | "closed" | "idle";
  held?: boolean;
  scrollKey?: string;
  immersive?: boolean;
  timer?: ReactNode;
  /** Replaces the default theme button with a personal menu. */
  menu?: ReactNode;
  /** Shown above every page: incoming trolls and notices. */
  overlays?: ReactNode;
  tabs?: PhoneTabs;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockNode, setDockNode] = useState<HTMLDivElement | null>(null);
  const active = tabs?.active ?? "play";

  useLayoutEffect(() => {
    setDockNode(dockRef.current);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("phone-lock");
    body.classList.add("phone-lock");
    return () => {
      root.classList.remove("phone-lock");
      body.classList.remove("phone-lock");
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return () => {};
    }
    const view = viewport;
    const root = document.documentElement;
    function sync() {
      const inset = Math.max(0, window.innerHeight - view.height - view.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
      const focused = document.activeElement;
      if (inset > 0 && focused instanceof HTMLElement) {
        const page = focused.closest(".phone-scroll");
        if (page) focused.scrollIntoView({ block: "nearest" });
      }
    }
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo?.({
      top: 0,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [scrollKey]);

  return (
    <PhoneDockTarget node={dockNode} held={held}>
      <div
        className="phone-shell"
        data-immersive={immersive || undefined}
        data-tabbed={tabs ? "" : undefined}
        data-tab={active}
      >
        <div className="skin-ground" aria-hidden="true">
          <LiquidGround />
          <SkinMotif />
        </div>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-highlight focus:px-4 focus:py-3 focus:font-bold focus:text-highlight-foreground"
        >
          Skip to content
        </a>
        <header className="phone-bar glass-bar">
          <Wordmark />
          {timer ? <div className="phone-bar-timer">{timer}</div> : null}
          <div className="phone-bar-end">
            {nickname && !menu ? (
              <p className="max-w-36 truncate text-base font-bold">{nickname}</p>
            ) : null}
            <ConnectionDot connection={connection} />
            {menu ?? <ThemePicker />}
          </div>
        </header>
        {overlays}
        <div className="phone-pages">
          <main
            id={active === "play" ? "content" : undefined}
            ref={scrollRef}
            className="phone-scroll phone-page"
            data-active={active === "play" || undefined}
            inert={active !== "play" || undefined}
            aria-hidden={active !== "play" || undefined}
          >
            {children}
          </main>
          {tabs
            ? (["ranks", "troll", "snap"] as const).map((id) => (
                <section
                  key={id}
                  id={active === id ? "content" : undefined}
                  className="phone-scroll phone-page"
                  data-page={id}
                  data-active={active === id || undefined}
                  inert={active !== id || undefined}
                  aria-hidden={active !== id || undefined}
                  aria-label={phoneTabs.find((tab) => tab.id === id)?.label}
                >
                  {tabs.pages[id]}
                </section>
              ))
            : null}
        </div>
        <div
          ref={dockRef}
          className="phone-dock glass-bar"
          inert={active !== "play" || undefined}
        />
        {tabs ? <PhoneTabBar tabs={tabs} /> : null}
      </div>
    </PhoneDockTarget>
  );
}

function PhoneTabBar({ tabs }: { tabs: PhoneTabs }) {
  const reduce = useReducedMotion();
  return (
    <nav className="phone-tabbar glass-bar" aria-label="Game sections">
      {phoneTabs.map((tab) => {
        const selected = tabs.active === tab.id;
        const badge = tabs.badges?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            className="phone-tab"
            aria-current={selected ? "page" : undefined}
            onClick={() => tabs.onChange(tab.id)}
          >
            {selected ? (
              <motion.span
                layoutId="phone-tab-pill"
                className="phone-tab-pill"
                aria-hidden="true"
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 520, damping: 38 }
                }
              />
            ) : null}
            <span className="phone-tab-icon" aria-hidden="true">
              <Icon icon={tab.icon} />
              {badge ? (
                <motion.span
                  key={badge}
                  className="phone-tab-badge"
                  initial={{ scale: reduce ? 1 : 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduce
                      ? { duration: 0.12 }
                      : { type: "spring", stiffness: 600, damping: 22 }
                  }
                >
                  {badge}
                </motion.span>
              ) : null}
            </span>
            <span className="phone-tab-label">
              {tab.label}
              {badge ? <span className="sr-only"> ({badge} new)</span> : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
