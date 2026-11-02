import type { ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SkinMotif } from "../theme/skin-motif";
import { ThemePicker } from "../theme/theme-picker";
import { Wordmark } from "../theme/wordmark";
import "./entry.css";
import { StatusMessage } from "./primitives";

export function EntryFrame({
  children,
  navigation,
  wide = false,
  full = false,
}: {
  children: ReactNode;
  navigation?: ReactNode;
  wide?: boolean;
  /** Use the whole window width, with no cap. For desktop tools like admin. */
  full?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={`entry-frame ${wide ? "entry-wide" : ""} ${full ? "entry-full" : ""}`}
    >
      <div className="skin-ground" aria-hidden="true">
        <SkinMotif />
      </div>
      <a className="entry-skip" href="#content">
        Skip to content
      </a>
      <header className="entry-bar">
        <Link to="/" aria-label="26 home" className="entry-brand">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="entry-nav">
          {navigation}
          <ThemePicker />
        </nav>
      </header>
      <motion.main
        id="content"
        className="entry-main"
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.main>
      <footer className="entry-footer">
        <span>A birthday. A room full of opinions.</span>
        <span>26 · Play individually, celebrate together.</span>
      </footer>
    </div>
  );
}

export function EntryHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="entry-heading">
      <p className="entry-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

export function EntryNotice({ message }: { message: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="entry-notice"
          layout={!reduced}
          className="entry-feedback"
          style={{ overflow: "hidden" }}
          initial={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }
          }
          animate={
            reduced
              ? { opacity: 1 }
              : { opacity: 1, height: "auto", marginTop: 20, marginBottom: 20 }
          }
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }
          }
          transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        >
          <motion.div
            key={message}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
          >
            <StatusMessage>{message}</StatusMessage>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
