import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
  useRef,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { Link, type LinkProps } from "react-router";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight";

function buttonClasses(
  variant: "primary" | "secondary" | "danger",
  className: string,
) {
  const tone =
    variant === "primary"
      ? "bg-accent text-accent-foreground"
      : variant === "danger"
        ? "border border-highlight bg-highlight text-highlight-foreground"
        : "border border-line bg-background text-foreground";
  return `motion-press skin-control inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 px-5 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${tone} ${className}`;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: LinkProps & { variant?: "primary" | "secondary" | "danger" }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...props} />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  label: string;
  hint: string;
};

export function TextField({ label, hint, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={fieldId} className="text-lg font-bold">
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={hintId}
        // Without w-full/min-w-0 an input keeps its intrinsic width and
        // overflows 320px phones.
        className={`skin-field min-h-12 w-full min-w-0 border border-line bg-background px-4 text-lg text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
        {...props}
      />
      <p id={hintId} className="text-base leading-snug text-muted">
        {hint}
      </p>
    </div>
  );
}

export function Panel({
  title,
  children,
  display = "phone",
}: {
  title: string;
  children: ReactNode;
  display?: "phone" | "stage";
}) {
  const reduced = useReducedMotion();
  const heading =
    display === "stage"
      ? "font-display text-5xl leading-none text-highlight"
      : "font-display text-3xl text-highlight";
  return (
    <motion.section
      className="skin-panel border border-line bg-surface px-5 py-5"
      initial={{ opacity: reduced ? 0.9 : 0.75 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.2, 0, 0, 1] }}
    >
      <h2 className={heading}>{title}</h2>
      <div className="mt-3 text-lg leading-relaxed">{children}</div>
    </motion.section>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.p
      initial={{ opacity: 0.75 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.2, ease: [0.2, 0, 0, 1] }}
      role="status"
      className="skin-status bg-highlight px-4 py-3 text-lg leading-snug font-bold text-highlight-foreground"
    >
      {children}
    </motion.p>
  );
}

export function CountdownLayout({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div
      className="skin-panel border border-line bg-surface px-6 py-10 text-center"
      aria-label={label}
    >
      <p className="text-sm font-bold tracking-[0.18em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-3 font-display text-stage leading-none text-highlight">
        {value}
      </p>
      <p className="mt-5 text-2xl leading-snug">{note}</p>
    </div>
  );
}

export function Dialog({
  title,
  triggerLabel,
  triggerVariant = "primary",
  children,
}: {
  title: string;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  return (
    <>
      <Button
        variant={triggerVariant}
        ref={triggerRef}
        onClick={() => {
          dialogRef.current?.showModal();
        }}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="border border-line bg-surface text-surface-foreground"
        onClose={() => {
          triggerRef.current?.focus();
        }}
      >
        <h2 id={titleId} className="font-display text-4xl text-highlight">
          {title}
        </h2>
        <div className="mt-4 text-lg leading-relaxed">{children}</div>
        <form method="dialog" className="mt-6">
          <Button variant="secondary" autoFocus>
            Close
          </Button>
        </form>
      </dialog>
    </>
  );
}

/** Controlled confirmation on the same native dialog/focus system as Dialog. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmTone = "primary",
  disabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmTone?: "primary" | "danger";
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="admin-confirm border border-line bg-surface text-surface-foreground"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        returnFocus.current?.focus();
        if (open) onClose();
      }}
    >
      <h2 id={titleId} className="font-display text-3xl">
        {title}
      </h2>
      <div id={descriptionId} className="my-5 leading-relaxed">
        {children}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" autoFocus onClick={onClose}>
          Cancel
        </Button>
        <Button variant={confirmTone} disabled={disabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

export function Disclosure({
  title,
  children,
  keepMounted = false,
}: {
  title: string;
  children: ReactNode;
  /** Preserve unfinished form fields, without loading closed previews by default. */
  keepMounted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div className="admin-disclosure">
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {title} {open ? "−" : "+"}
      </Button>
      {keepMounted ? (
        <DisclosureContent id={id} reduced={reduced} open={open} persistent>
          {children}
        </DisclosureContent>
      ) : (
        <AnimatePresence initial={false}>
          {open ? (
            <DisclosureContent id={id} reduced={reduced} open key="contents">
              {children}
            </DisclosureContent>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  );
}

function DisclosureContent({
  id,
  reduced,
  open,
  persistent = false,
  children,
}: {
  id: string;
  reduced: boolean | null;
  open: boolean;
  persistent?: boolean;
  children: ReactNode;
}) {
  const present = useIsPresent();
  const active = open && present;
  return (
    <motion.div
      id={id}
      inert={!active}
      aria-hidden={!active || undefined}
      initial={persistent ? false : { opacity: 0, height: reduced ? "auto" : 0 }}
      animate={{ opacity: active ? 1 : 0, height: active ? "auto" : 0 }}
      exit={{ opacity: 0, height: reduced ? "auto" : 0 }}
      transition={{ duration: reduced ? 0.12 : 0.18, ease: "easeOut" }}
      className="admin-disclosure-content"
    >
      {children}
    </motion.div>
  );
}
