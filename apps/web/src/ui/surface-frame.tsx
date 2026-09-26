import { type ReactNode } from "react";
import { NavLink } from "react-router";
import { EXAMPLE_GAME_ID } from "../example-game";
import { ThemePicker } from "../theme/theme-picker";

const surfaces = [
  { to: "/", label: "Guest", id: "guest" },
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
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20 focus:rounded-full focus:bg-highlight focus:px-4 focus:py-3 focus:font-bold focus:text-highlight-foreground"
      >
        Skip to content
      </a>
      <header className="relative z-20 border-b border-line">
        <div
          className={`${width} mx-auto flex flex-wrap items-center justify-between gap-4 px-5 py-4`}
        >
          <p className="font-display text-3xl text-accent">26</p>
          <nav aria-label="Surfaces">
            <ul className="flex flex-wrap gap-2">
              {surfaces.map((surface) => (
                <li key={surface.id}>
                  <NavLink
                    to={surface.to}
                    aria-current={surface.id === current ? "page" : undefined}
                    className={({ isActive }) =>
                      `inline-flex min-h-12 items-center rounded-full px-4 text-base font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
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
        className={`${width} mx-auto grid gap-6 px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] motion-rise`}
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
