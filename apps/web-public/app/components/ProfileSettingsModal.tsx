import { useEffect, useRef, useState } from "react";

interface ProfileSettingsModalProps {
  handle: string;
  acceptsSecrets: boolean;
  saving?: boolean;
  onSave: (acceptsSecrets: boolean) => void;
  onClose: () => void;
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.036 12.322a1 1 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.98 8.223A10.477 10.477 0 002.036 11.678a1 1 0 000 .644C3.423 16.49 7.36 19.5 12 19.5c1.32 0 2.585-.243 3.752-.688M6.228 6.228A10.45 10.45 0 0112 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .644 10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.243L9.88 9.88"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileSettingsModal({
  handle,
  acceptsSecrets,
  saving = false,
  onSave,
  onClose,
}: ProfileSettingsModalProps) {
  const [accepts, setAccepts] = useState(acceptsSecrets);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccepts(acceptsSecrets);
  }, [acceptsSecrets]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into the sheet for keyboard/screen-reader users.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dirty = accepts !== acceptsSecrets;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out]" aria-hidden="true" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile settings"
        tabIndex={-1}
        className="relative z-10 w-full sm:max-w-md max-h-[92vh] bg-surface border-t border-border/40 sm:border sm:mb-6 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col outline-none animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/80" />
        </div>

        <div className="px-6 pt-2 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text tracking-tight">Settings</h2>
              <p className="text-sm text-text-muted mt-0.5">@{handle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-raised border border-border text-text-muted hover:text-text flex items-center justify-center text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 pb-8 overflow-y-auto flex-1 space-y-5">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-2">
              Privacy
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={accepts}
              aria-label="Secret box"
              onClick={() => setAccepts((v) => !v)}
              className="w-full flex items-center justify-between gap-4 rounded-2xl bg-surface-raised border border-border/60 px-4 py-3.5 text-left transition-colors hover:border-accent/40"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">Secret box</span>
                <span className="block text-xs text-text-muted mt-1 leading-relaxed">
                  {accepts
                    ? "People can send you anonymous secrets from your profile."
                    : "Hidden — visitors can't send you secrets from your profile."}
                </span>
              </span>

              {/* Icon toggle: the thumb holds an eye / eye-off icon that swaps on toggle. */}
              <span
                className={`relative shrink-0 h-7 w-12 rounded-full transition-colors ${
                  accepts ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform ${
                    accepts ? "translate-x-[22px] text-accent" : "translate-x-0.5 text-text-muted"
                  }`}
                >
                  {accepts ? <EyeIcon /> : <EyeOffIcon />}
                </span>
              </span>
            </button>
          </section>

          <button
            type="button"
            onClick={() => onSave(accepts)}
            disabled={saving || !dirty}
            className="w-full rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
