/** Public Ed / Humza photos. Paths match the authored media in the party pack. */
export const edOrHumzaPhotoCredit = "Photo supplied by Humza (private use)";

const avatar = { width: 512, height: 512 } as const;
const portrait = { width: 675, height: 900 } as const;

export const edOrHumzaPhotos = {
  ed: {
    avatar: {
      src: "/assets/questions/ed-or-humza/ed.webp",
      alt: "Ed",
      ...avatar,
    },
    portrait: {
      src: "/assets/questions/ed-or-humza/ed-portrait.webp",
      alt: "Ed",
      ...portrait,
    },
  },
  humza: {
    avatar: {
      src: "/assets/questions/ed-or-humza/humza.webp",
      alt: "Humza",
      ...avatar,
    },
    portrait: {
      src: "/assets/questions/ed-or-humza/humza-portrait.webp",
      alt: "Humza",
      ...portrait,
    },
  },
} as const;

export type EdOrHumzaPerson = keyof typeof edOrHumzaPhotos;

export function isEdOrHumzaPerson(id: string): id is EdOrHumzaPerson {
  return id === "ed" || id === "humza";
}

/** Avatars on the phone; portraits as well on the projector. */
export function edOrHumzaPreloadPaths(surface: "phone" | "stage" = "phone"): string[] {
  const avatars = [edOrHumzaPhotos.ed.avatar.src, edOrHumzaPhotos.humza.avatar.src];
  if (surface === "stage") {
    return [
      ...avatars,
      edOrHumzaPhotos.ed.portrait.src,
      edOrHumzaPhotos.humza.portrait.src,
    ];
  }
  return avatars;
}
