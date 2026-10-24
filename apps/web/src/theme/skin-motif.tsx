import { Icon } from "@iconify/react/dist/offline";
import card from "@iconify-icons/lucide/credit-card";
import mask from "@iconify-icons/lucide/drama";
import mic from "@iconify-icons/lucide/mic";
import star from "@iconify-icons/lucide/star";
import sun from "@iconify-icons/lucide/sun";
import utensils from "@iconify-icons/lucide/utensils";
import nissan from "@iconify-icons/simple-icons/nissan";
import toyota from "@iconify-icons/simple-icons/toyota";
import type { IconifyIcon } from "@iconify/types";
import { memo, type CSSProperties } from "react";

const motifIcons = {
  nissan,
  toyota,
  sun,
  card,
  mic,
  star,
  utensils,
  mask,
} as const satisfies Record<string, IconifyIcon>;

const copies = [0, 1, 2, 3, 4, 5];

/**
 * Pieces for the deep scene: CSS turns them into bars, stars, beams or cubes.
 * Each has fixed pseudo-random position, size and timing variables, so a
 * scene can scatter them without a rule per piece.
 */
const scenePieces = Array.from({ length: 24 }, (_, index) => ({
  "--i": index,
  "--x": `${(index * 37 + 11) % 100}%`,
  "--y": `${(index * 61 + 7) % 100}%`,
  "--s": ((index * 13) % 7) / 6,
  "--d": `${((index * 29) % 50) / 10}s`,
  "--r": `${(index * 47) % 360}deg`,
})) as CSSProperties[];

export const SkinMotif = memo(function SkinMotif() {
  return (
    <>
      <div className="deep-scene" aria-hidden="true">
        {scenePieces.map((style, index) => (
          <i key={index} style={style} />
        ))}
      </div>
      {Object.entries(motifIcons).map(([name, icon]) => (
        <div key={name} className={`motif motif-${name}`}>
          {copies.map((copy) => (
            <Icon key={copy} icon={icon} className={`motif-copy motif-copy-${copy}`} />
          ))}
        </div>
      ))}
    </>
  );
});
