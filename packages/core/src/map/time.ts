/** Human-readable time remaining until a map story expires. */
export function mapTimeRemaining(expiresAt: string, now: Date = new Date()): string {
  if (!expiresAt) return "Unknown";
  const normalized = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const ms = new Date(normalized).getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}
