export type PasskeyRow = {
  id: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PasskeyList({
  passkeys,
  removingId,
  onRemove,
}: {
  passkeys: PasskeyRow[];
  removingId?: string | null;
  onRemove: (id: string) => void;
}) {
  if (passkeys.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No passkey yet. Add one so you can sign back in on this device.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {passkeys.map((pk, index) => (
        <li
          key={pk.id}
          className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-surface-raised px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Passkey {index + 1}</p>
            <p className="text-xs text-text-muted mt-0.5">
              Added {formatWhen(pk.createdAt)}
              {pk.lastUsedAt ? ` · Last used ${formatWhen(pk.lastUsedAt)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(pk.id)}
            disabled={removingId === pk.id}
            className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {removingId === pk.id ? "Removing…" : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}
