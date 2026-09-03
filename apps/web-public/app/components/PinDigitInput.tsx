import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

function digitsOnly(raw: string, max: number): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

export function PinDigitInput({
  id = "pin",
  value,
  onChange,
  length = 4,
  autoFocus = false,
  masked = true,
  ariaLabel = "PIN",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  masked?: boolean;
  ariaLabel?: string;
}) {
  const slots = Array.from({ length }, (_, i) => digitsOnly(value, length)[i] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function focusAt(index: number) {
    const el = refs.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  }

  function handleChange(index: number, raw: string) {
    const cleaned = digitsOnly(raw, length);
    if (cleaned.length === 0) {
      const next = [...slots];
      next[index] = "";
      onChange(next.join(""));
      return;
    }
    if (cleaned.length === 1) {
      const next = [...slots];
      next[index] = cleaned;
      onChange(next.join(""));
      if (index < length - 1) focusAt(index + 1);
      return;
    }
    const next = [...slots];
    for (let i = 0; i < cleaned.length && index + i < length; i++) {
      next[index + i] = cleaned[i]!;
    }
    onChange(next.join(""));
    focusAt(Math.min(index + cleaned.length, length) - 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !event.currentTarget.value && index > 0) {
      event.preventDefault();
      const next = [...slots];
      next[index - 1] = "";
      onChange(next.join(""));
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
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = digitsOnly(event.clipboardData.getData("text"), length);
    if (!pasted) return;
    event.preventDefault();
    const next = [...slots];
    for (let i = 0; i < pasted.length && index + i < length; i++) {
      next[index + i] = pasted[i]!;
    }
    onChange(next.join(""));
    focusAt(Math.min(index + pasted.length, length) - 1);
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label={ariaLabel}>
      {slots.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={index === 0 ? id : undefined}
          value={char}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus && index === 0}
          maxLength={length}
          enterKeyHint={index === length - 1 ? "done" : "next"}
          aria-label={`${ariaLabel} digit ${index + 1} of ${length}`}
          className={`h-12 min-w-0 flex-1 max-w-[2.75rem] sm:h-14 sm:max-w-[3rem] rounded-xl bg-surface border border-border text-center font-mono text-lg font-semibold text-text caret-accent focus:outline-none focus:border-accent transition-colors ${
            masked ? "[-webkit-text-security:disc]" : ""
          }`}
        />
      ))}
    </div>
  );
}
