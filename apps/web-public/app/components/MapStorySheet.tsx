import { useEffect, useState, useRef } from "react";
import { Link } from "@remix-run/react";
import { mapTimeRemaining } from "@secretlink/core";
import { getApiBase } from "../lib/api.client";
import { REPORT_REASONS } from "../lib/map-constants";
import type { MapSecret } from "../lib/map-types";

interface MapStorySheetProps {
  secret: MapSecret;
  onClose: () => void;
  onViewUserStories?: (handle: string) => void;
}

export function MapStorySheet({ secret, onClose, onViewUserStories }: MapStorySheetProps) {
  const [revealed, setRevealed] = useState(false);
  const [current, setCurrent] = useState<MapSecret>(secret);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCurrent(secret);
    setRevealed(false);
    setRevealError(null);
    setCountdown(null);
    setReportOpen(false);
    setReportResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [secret.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleReveal() {
    setRevealLoading(true);
    setRevealError(null);
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map/${current.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "limit_reached") {
          setCurrent({ ...current, _limitReached: true, _limitMessage: data.message });
          setRevealed(true);
          return;
        }
        setRevealError("Could not reveal this story. It may have expired.");
        return;
      }
      const { decryptMapReveal } = await import("../lib/crypto");
      const plaintext = await decryptMapReveal(data);
      setCurrent({ ...current, ...data, message: plaintext });
      setRevealed(true);
      if (data.revealMode === "timer") {
        const secs = data.revealTimerSeconds ?? 30;
        setCountdown(secs);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              onClose();
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      setRevealError("Something went wrong. Please try again.");
    } finally {
      setRevealLoading(false);
    }
  }

  async function submitReport() {
    setReportSubmitting(true);
    setReportResult(null);
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map/${current.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportResult(data?.error ? String(data.error) : "Could not send report.");
        return;
      }
      setReportResult("Thanks. Your report was submitted.");
      setReportDetails("");
      setReportOpen(false);
    } catch {
      setReportResult("Could not send report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[9000] bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Story details"
        className="fixed z-[9001] left-1/2 -translate-x-1/2 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-surface border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-text-muted hover:text-text text-lg" aria-label="Close">
          ×
        </button>

        {!revealed ? (
          <div className="text-center py-4">
            <span className="text-4xl block mb-3">{current.emoji}</span>
            <p className="text-sm text-text-muted mb-1">
              {current.handle ? `@${current.handle} shared a story` : "Someone shared a story"}
            </p>
            {(current.locationName || current.cityName) && (
              <p className="text-xs text-text-muted mb-1">
                {current.locationName || current.cityName}
              </p>
            )}
            <p className="text-xs text-text-muted mb-2">{mapTimeRemaining(current.expiresAt)}</p>
            <p className="text-xs text-text-muted mb-4">
              {current.revealMode === "clicks"
                ? `${current.clickCount}/${current.maxClicks} reveals used`
                : `Disappears ${current.revealTimerSeconds}s after reveal`}
            </p>
            {revealError && <p className="text-xs text-red-400 mb-3">{revealError}</p>}
            <button
              onClick={handleReveal}
              disabled={revealLoading}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all disabled:opacity-50"
            >
              {revealLoading ? "Revealing…" : "Tap to reveal"}
            </button>
          </div>
        ) : current._limitReached ? (
          <div className="text-center py-6">
            <span className="text-4xl block mb-3">🚫</span>
            <p className="text-sm text-text font-medium">{current._limitMessage || "This story has reached its reveal limit."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {countdown !== null && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / (current.revealTimerSeconds || 30)) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-accent font-mono">{countdown}s</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <span className="text-2xl">{current.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm leading-relaxed break-words whitespace-pre-wrap">{current.message}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {current.handle && (
                    <>
                      <Link to={`/${current.handle}`} className="text-xs text-accent">@{current.handle}</Link>
                      {onViewUserStories && (
                        <button type="button" onClick={() => onViewUserStories(current.handle!)} className="text-xs text-accent underline">
                          View all stories
                        </button>
                      )}
                    </>
                  )}
                  <span className="text-xs text-text-muted">{mapTimeRemaining(current.expiresAt)}</span>
                </div>
              </div>
            </div>
            {current.mediaPath && (
              <div>
                {(current.mediaType ?? "").startsWith("image/") ? (
                  <img
                    src={`${getApiBase()}/v1/secrets/blob/${current.mediaPath}`}
                    alt="Story attachment"
                    className="max-w-full max-h-64 rounded-xl border border-border"
                  />
                ) : (current.mediaType ?? "").startsWith("video/") ? (
                  <video
                    src={`${getApiBase()}/v1/secrets/blob/${current.mediaPath}`}
                    controls
                    className="max-w-full max-h-64 rounded-xl border border-border"
                  />
                ) : null}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border/70">
          <button type="button" onClick={() => { setReportOpen((v) => !v); setReportResult(null); }} className="text-xs text-red-300 hover:text-red-200">
            Report this story
          </button>
          {reportOpen && (
            <div className="mt-3 space-y-2">
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Tell us what is wrong (optional)"
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-red-400/30"
              />
              <button
                type="button"
                onClick={submitReport}
                disabled={reportSubmitting}
                className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {reportSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          )}
          {reportResult && <p className="mt-2 text-xs text-text-muted">{reportResult}</p>}
        </div>
      </div>
    </>
  );
}
