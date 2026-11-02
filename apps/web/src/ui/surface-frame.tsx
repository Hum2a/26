import { type ReactNode } from "react";
import { NavLink } from "react-router";
import { EXAMPLE_GAME_ID } from "../example-game";
import { SkinMotif } from "../theme/skin-motif";
import { LiquidGround } from "./liquid-ground";
import { ThemePicker } from "../theme/theme-picker";
import { Wordmark } from "../theme/wordmark";

const surfaces = [
  { to: "/join", label: "Join", id: "guest" },
  { to: "/host", label: "Stage", id: "stage" },
  { to: "/admin", label: "Admin", id: "admin" },
  { to: `/r/${EXAMPLE_GAME_ID}`, label: "Results", id: "results" },
] as const;

export type SurfaceId = (typeof surfaces)[number]["id"];

export function SurfaceFrame({
  current,
  title,
  lede,
  size = "phone",
  children,
}: {
  current?: SurfaceId;
  title: string;
  lede: string;
  size?: "phone" | "stage";
  children: ReactNode;
}) {
  const width = size === "stage" ? "max-w-6xl" : "max-w-xl";
  const titleClass =
    size === "stage"
      ? "font-display text-6xl leading-none text-highlight"
      : "font-display text-5xl leading-none text-highlight";

  return (
    <div
      data-size={size}
      className={`surface-frame relative max-w-full overflow-x-clip ${size === "stage" ? "min-h-full" : "min-h-dvh"} bg-background text-foreground`}
    >
      <div className="skin-ground" aria-hidden="true">
        <LiquidGround />
        <SkinMotif />
      </div>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20 focus:rounded-full focus:bg-highlight focus:px-4 focus:py-3 focus:font-bold focus:text-highlight-foreground"
      >
        Skip to content
      </a>
      <header className="relative z-20 max-w-full border-b border-line">
        <div
          className={`${width} mx-auto flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-4 pl-[max(1.25rem,env(safe-area-inset-left))]`}
        >
          <Wordmark />
          <nav aria-label="Surfaces" className="max-w-full">
            <ul className="flex max-w-full flex-wrap gap-2">
              {surfaces.map((surface) => (
                <li key={surface.id}>
                  <NavLink
                    to={surface.to}
                    aria-current={surface.id === current ? "page" : undefined}
                    className={({ isActive }) =>
                      `skin-control inline-flex min-h-12 items-center px-4 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground"
                      }`
                    }
                  >
                    {surface.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <ThemePicker />
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="content"
        className={`relative z-10 ${width} mx-auto grid min-w-0 gap-6 pt-8 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] motion-rise`}
      >
        <header className="grid gap-3">
          <p className="text-sm font-bold tracking-[0.18em] text-muted uppercase">
            Development shell
          </p>
          <h1 className={titleClass}>{title}</h1>
          <p
            className={
              size === "stage"
                ? "max-w-3xl text-2xl leading-snug"
                : "text-lg leading-relaxed"
            }
          >
            {lede}
          </p>
        </header>
        {children}
      </main>
    </div>
  );
}
