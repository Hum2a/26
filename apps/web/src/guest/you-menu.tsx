import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PlayerAvatar } from "../ui/player-avatar";

/** The guest's own corner: their name, theme, phone transfer and help. */
export function YouMenu({
  playerId,
  nickname,
  faceSrc,
  children,
}: {
  playerId: string;
  nickname: string;
  /** This guest's profile photo, or null for initials. */
  faceSrc?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      // Theme picker panels portal outside; let them keep the menu open.
      if (
        target instanceof Node &&
        !root.current?.contains(target) &&
        !(target instanceof Element && target.closest("[data-theme-panel], dialog"))
      ) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="you-menu" ref={root}>
      <button
        type="button"
        className="you-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`You: ${nickname}`}
        onClick={() => setOpen((value) => !value)}
      >
        <PlayerAvatar
          playerId={playerId}
          nickname={nickname}
          faceSrc={faceSrc}
          size="sm"
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            className="you-menu-panel glass"
            role="dialog"
            aria-label="You"
            initial={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.96 }}
            transition={
              reduce
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 480, damping: 34 }
            }
          >
            <div className="you-menu-who">
              <PlayerAvatar
                playerId={playerId}
                nickname={nickname}
                faceSrc={faceSrc}
                size="lg"
              />
              <div className="min-w-0">
                <p className="entry-eyebrow">Playing as</p>
                <p className="you-menu-name">{nickname}</p>
              </div>
            </div>
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
