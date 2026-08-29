import { useState } from "react";

export function RecoveryCodesPanel({
  codes,
  onConfirmed,
  confirmLabel = "Continue",
}: {
  codes: string[];
  onConfirmed?: () => void;
  confirmLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">Save your recovery codes</h3>
        <p className="text-sm text-text-muted mt-1 leading-relaxed">
          If you lose your passkey, enter any one of these codes on the login page. Store them
          somewhere safe. They will not be shown again.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((code) => (
          <li
            key={code}
            className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-center tracking-wider"
          >
            {code}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => void copyAll()}
        className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:border-accent/50 transition-colors"
      >
        {copied ? "Copied" : "Copy all"}
      </button>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-1 rounded border-border text-accent focus:ring-accent"
        />
        <span className="text-sm text-text">I saved these codes in a safe place</span>
      </label>

      {onConfirmed && (
        <button
          type="button"
          onClick={onConfirmed}
          disabled={!saved}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}
