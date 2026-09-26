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

export function SkinMotif() {
  return (
    <>
      {Object.entries(motifIcons).map(([name, icon]) => (
        <div key={name} className={`motif motif-${name}`}>
          {copies.map((copy) => (
            <Icon key={copy} icon={icon} className={`motif-copy motif-copy-${copy}`} />
          ))}
        </div>
      ))}
    </>
  );
}
