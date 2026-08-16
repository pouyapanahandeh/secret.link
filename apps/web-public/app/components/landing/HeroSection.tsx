import { Link } from "@remix-run/react";

function SecretNotes() {
  const notes = [
    { from: "anonymous", text: "I’ve been meaning to tell you…", tag: "05:00", locked: false },
    { from: "a friend", text: "You were right about that night.", tag: "01 tap", locked: false },
    { from: "anonymous", text: "Don’t screenshot this.", tag: "hold to open", locked: true },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted">inbox://you</span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">3 unread</span>
      </div>
      <ul className="divide-y divide-border">
        {notes.map((note) => (
          <li key={note.text} className="px-4 py-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
                @{note.from}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-accent">{note.tag}</span>
            </div>
            <p
              className={`text-[15px] sm:text-base font-medium leading-snug tracking-[-0.02em] ${
                note.locked ? "blur-[6px] select-none text-text-muted" : "text-text"
              }`}
            >
              {note.text}
            </p>
            {note.locked && (
              <p className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-accent">
                tap to reveal · then gone
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-24">
      <div className="absolute -top-24 right-[-20%] w-[70vw] h-[70vw] max-w-[640px] max-h-[640px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-5">
              Anonymous inbox · burns after one read
            </p>
            <h1 className="font-extrabold tracking-[-0.05em] leading-[0.92] text-[3.25rem] sm:text-7xl lg:text-[5.5rem]">
              Say what you
              <br />
              <span className="font-display font-bold tracking-normal text-accent text-[3.6rem] sm:text-8xl lg:text-[6.5rem] leading-[0.85]">
                really mean
              </span>
            </h1>
            <p className="mt-6 text-base sm:text-lg leading-relaxed text-text-muted max-w-md">
              Get your anonymous inbox. Friends send secrets that self-destruct after one read.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center min-h-12 w-full sm:w-auto rounded-full bg-accent px-8 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
              >
                Get your @handle
              </Link>
              <Link
                to="/send"
                className="inline-flex items-center justify-center min-h-12 w-full sm:w-auto rounded-full border border-text/20 px-8 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-colors"
              >
                Send a secret
              </Link>
            </div>
            <p className="mt-4 text-[11px] font-medium tracking-wide uppercase text-text-muted">
              Free forever · No email required · 100% encrypted
            </p>
          </div>

          <div className="pb-2 sm:pb-4">
            <SecretNotes />
          </div>
        </div>
      </div>
    </section>
  );
}
