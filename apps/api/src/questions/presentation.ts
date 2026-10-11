import { customPresentationIds } from "@26/shared";

/** Presentations a released question may name. Custom designs are listed in `@26/shared`. */
export const supportedPresentations = ["standard", ...customPresentationIds] as const;

export type SupportedPresentation = (typeof supportedPresentations)[number];

export function isSupportedPresentation(id: string): id is SupportedPresentation {
  return (supportedPresentations as readonly string[]).includes(id);
}
