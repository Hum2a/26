import { createContext } from "react";

/**
 * Page-wide gags (upside down, mirrored, jelly, Comic Sans) bend the whole page.
 * Inside a preview they bend this element instead, so the troller's own phone
 * stays upright while they look.
 */
export const TrollPageScope = createContext<{ current: HTMLElement | null } | null>(
  null,
);
