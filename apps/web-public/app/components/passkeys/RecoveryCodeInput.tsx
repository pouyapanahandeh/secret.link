import { useRef, type KeyboardEvent } from "react";
import { extractRecoveryCode } from "@secretlink/core/user/schemas";

const SLOT_COUNT = 8;
const FORMATTED_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/i;

function compactFromRaw(raw: string): string {
  const extracted = extractRecoveryCode(raw);
  if (FORMATTED_RE.test(extracted)) {
    return extracted.replace("-", "").toUpperCase();
  }
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SLOT_COUNT);
}

function emitValue(slots: string[]): string {
  const compact = slots.join("");
  if (compact.length === SLOT_COUNT) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return compact;
}

export function RecoveryCodeInput({
  id = "recovery-code",
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => compactFromRaw(value)[i] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function focusAt(index: number) {
    const el = refs.current[Math.max(0, Math.min(SLOT_COUNT - 1, index))];
    el?.focus();
    el?.select();
  }

  function handleChange(index: number, raw: string) {
    const extracted = extractRecoveryCode(raw);
    if (FORMATTED_RE.test(extracted)) {
      onChange(extracted.toUpperCase());
      focusAt(SLOT_COUNT - 1);
      return;
    }

    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length === 0) {
      const next = [...slots];
      next[index] = "";
      onChange(emitValue(next));
      return;
    }

    if (cleaned.length === 1) {
      const next = [...slots];
      next[index] = cleaned;
      onChange(emitValue(next));
      if (index < SLOT_COUNT - 1) focusAt(index + 1);
      return;
    }

    const next = [...slots];
    for (let i = 0; i < cleaned.length && index + i < SLOT_COUNT; i++) {
      next[index + i] = cleaned[i]!;
    }
    onChange(emitValue(next));
    focusAt(Math.min(index + cleaned.length, SLOT_COUNT) - 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !event.currentTarget.value && index > 0) {
      event.preventDefault();
      const next = [...slots];
      next[index - 1] = "";
      onChange(emitValue(next));
      focusAt(index - 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusAt(SLOT_COUNT - 1);
    }
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label="Recovery code">
      {slots.map((char, index) => (
        <span key={index} className="contents">
          {index === 4 && (
            <span className="font-mono text-text-muted select-none px-0.5" aria-hidden>
              -
            </span>
          )}
          <input
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={index === 0 ? id : undefined}
            value={char}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            type="text"
            inputMode="text"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Recovery code character ${index + 1} of ${SLOT_COUNT}`}
            className="h-12 min-w-0 flex-1 max-w-[2.75rem] rounded-lg bg-surface-raised border border-border text-center font-mono text-sm sm:text-base font-semibold uppercase text-text caret-accent focus:outline-none focus:border-accent"
          />
        </span>
      ))}
    </div>
  );
}
