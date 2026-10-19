import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SkinMotif } from "../theme/skin-motif";
import { ThemePicker } from "../theme/theme-picker";
import { Wordmark } from "../theme/wordmark";
import { PhoneDockTarget } from "../controller/phone-dock";
import { ConnectionDot } from "../net/ConnectionDot";
import "./phone-shell.css";

export function PhoneShell({
  nickname,
  connection,
  held = false,
  scrollKey,
  immersive = false,
  children,
}: {
  nickname?: string;
  connection: "connecting" | "open" | "closed" | "idle";
  held?: boolean;
  scrollKey?: string;
  immersive?: boolean;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockNode, setDockNode] = useState<HTMLDivElement | null>(null);

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
      const active = document.activeElement;
      if (
        inset > 0 &&
        active instanceof HTMLElement &&
        scrollRef.current?.contains(active)
      ) {
        active.scrollIntoView({ block: "nearest" });
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
      <div className="phone-shell" data-immersive={immersive || undefined}>
        <div className="skin-ground" aria-hidden="true">
          <SkinMotif />
        </div>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20 focus:rounded-full focus:bg-highlight focus:px-4 focus:py-3 focus:font-bold focus:text-highlight-foreground"
        >
          Skip to content
        </a>
        <header className="phone-bar">
          <Wordmark />
          <div className="flex min-w-0 items-center gap-2">
            {nickname ? (
              <p className="max-w-40 truncate text-base font-bold">{nickname}</p>
            ) : null}
            <ConnectionDot connection={connection} />
            <ThemePicker />
          </div>
        </header>
        <main id="content" ref={scrollRef} className="phone-scroll">
          {children}
        </main>
        <div ref={dockRef} className="phone-dock" />
      </div>
    </PhoneDockTarget>
  );
}
