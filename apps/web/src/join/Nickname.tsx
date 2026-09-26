import { useEffect, useId, useRef, useState } from "react";
import { nicknameLimit, readStoredNickname } from "./nickname-storage";

export function NicknameField({
  error = "",
  onEdit,
}: {
  error?: string;
  onEdit?: () => void;
}) {
  const [value, setValue] = useState(() => readStoredNickname());
  const fieldRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  useEffect(() => {
    if (!error) {
      return () => {};
    }
    fieldRef.current?.focus();
    return () => {};
  }, [error]);

  return (
    <div className="grid gap-2">
      <label htmlFor={fieldId} className="text-lg font-bold">
        Nickname
      </label>
      <input
        ref={fieldRef}
        id={fieldId}
        name="nickname"
        autoComplete="nickname"
        required
        maxLength={nicknameLimit}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className="min-h-12 rounded-2xl border border-line bg-background px-4 text-lg text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
        value={value}
        onChange={(event) => {
          setValue(event.target.value.slice(0, nicknameLimit));
          onEdit?.();
        }}
      />
      <p id={hintId} className="text-base leading-snug text-muted">
        {value.length}/{nicknameLimit}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-base font-bold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
