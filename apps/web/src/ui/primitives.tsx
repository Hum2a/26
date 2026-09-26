import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
  useRef,
} from "react";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const tone =
    variant === "primary"
      ? "bg-accent text-accent-foreground"
      : "border border-line bg-background text-foreground";

  return (
    <button
      type={type}
      className={`motion-press skin-control inline-flex min-h-12 touch-manipulation items-center justify-center px-5 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${tone} ${className}`}
      {...props}
    />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint: string;
};

export function TextField({ label, hint, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="grid gap-2">
      <label htmlFor={fieldId} className="text-lg font-bold">
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={hintId}
        className={`skin-field min-h-12 border border-line bg-background px-4 text-lg text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
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
  const heading =
    display === "stage"
      ? "font-display text-5xl leading-none text-highlight"
      : "font-display text-3xl text-highlight";
  return (
    <section className="skin-panel border border-line bg-surface px-5 py-5">
      <h2 className={heading}>{title}</h2>
      <div className="mt-3 text-lg leading-relaxed">{children}</div>
    </section>
  );
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="skin-status bg-highlight px-4 py-3 text-lg leading-snug font-bold text-highlight-foreground"
    >
      {children}
    </p>
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
  children,
}: {
  title: string;
  triggerLabel: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  return (
    <>
      <Button
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
