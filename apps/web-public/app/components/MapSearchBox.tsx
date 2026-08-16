import { useEffect, useRef, useState } from "react";
import { searchLocations, type GeocodeResult } from "../lib/geocode";

interface MapSearchBoxProps {
  onSelect: (coords: { lat: number; lng: number }, label: string) => void;
}

export function MapSearchBox({ onSelect }: MapSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchLocations(q);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFocused(false);
        setResults([]);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function pick(r: GeocodeResult) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onSelect({ lat, lng }, r.display_name);
    setQuery(r.display_name);
    setResults([]);
    setFocused(false);
  }

  const showDropdown = focused && query.trim().length >= 3;
  const showEmpty = showDropdown && !searching && results.length === 0;

  return (
    <div className="relative z-20">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="Search a place…"
        aria-label="Search a place"
        className="w-full rounded-full bg-surface-raised/95 backdrop-blur-xl border border-border shadow-lg pl-9 pr-9 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
      />
      {searching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1.5 z-30 border border-border bg-surface-raised shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, idx) => (
            <button
              key={`${r.lat}-${r.lon}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2.5 text-xs text-text hover:bg-accent/10 border-b border-border/30 last:border-b-0"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
      {showEmpty && (
        <p className="absolute left-0 right-0 mt-1.5 z-30 border border-border bg-surface-raised shadow-lg px-3 py-2.5 text-xs text-text-muted">
          No places found
        </p>
      )}
    </div>
  );
}
