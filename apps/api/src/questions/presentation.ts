/** Presentations a released question may name. Custom layouts register here later. */
export const supportedPresentations = ["standard"] as const;

export type SupportedPresentation = (typeof supportedPresentations)[number];

export function isSupportedPresentation(id: string): id is SupportedPresentation {
  return (supportedPresentations as readonly string[]).includes(id);
}
