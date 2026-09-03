import { Link, useLocation } from "@remix-run/react";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Chrome for the native app shell (`apps/mobile-public`): a fixed app bar and a
 * bottom tab bar instead of the site's marketing nav and footer.
 *
 * The app bar stays `fixed` because routes offset their content to clear the
 * site nav; swapping in a static header would leave a gap on every screen.
 */
export function AppShell({
  children,
  isLoggedIn = false,
  immersive = false,
}: {
  children: React.ReactNode;
  isLoggedIn?: boolean;
  /** Full-height screens (a chat room) keep the app bar but drop the tabs. */
  immersive?: boolean;
}) {
  return (
    <main
      className={`${immersive ? "h-dvh overflow-hidden" : "min-h-dvh"} bg-surface text-text`}
    >
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-surface/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to={isLoggedIn ? "/dashboard" : "/send"} className="flex items-center gap-2">
            <img src="/secretlink.png" alt="" className="h-7 w-7" />
            <span className="text-base font-extrabold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {immersive ? (
        children
      ) : (
        <div className="pb-[calc(4.75rem+env(safe-area-inset-bottom))]">{children}</div>
      )}

      {!immersive && <AppTabBar isLoggedIn={isLoggedIn} />}
    </main>
  );
}

function AppTabBar({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { pathname, search } = useLocation();
  const here = `${pathname}${search}`;

  const tabs = [
    { to: "/send", label: "Send", icon: <SendIcon /> },
    { to: "/send?tab=chat", label: "Chat", icon: <ChatIcon /> },
    isLoggedIn
      ? { to: "/dashboard", label: "Inbox", icon: <InboxIcon /> }
      : { to: "/login", label: "Log in", icon: <PersonIcon /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-surface/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          // "/send?tab=chat" must not also light up the plain "/send" tab.
          const active = tab.to.includes("?")
            ? here === tab.to
            : pathname === tab.to && !search.includes("tab=chat");

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                active ? "text-accent" : "text-text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const iconProps = {
  className: "h-6 w-6",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
} as const;

function SendIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12 3.27 4.36a.5.5 0 0 1 .67-.62l16.5 7.8a.5.5 0 0 1 0 .92l-16.5 7.8a.5.5 0 0 1-.67-.62L6 12Zm0 0h6"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10.5h8M8 14h5m-8.5 6.5 2.6-2.1A2 2 0 0 1 8.4 18H18a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 18 5H6a2.5 2.5 0 0 0-2.5 2.5v13Z"
      />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 13.5h4l1.2 2.2a1 1 0 0 0 .88.52h4.84a1 1 0 0 0 .88-.52l1.2-2.2h4M3.5 13.5l2.3-7.2A2 2 0 0 1 7.7 5h8.6a2 2 0 0 1 1.9 1.3l2.3 7.2v3.9a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1v-3.9Z"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 0c-3.6 0-6.5 2.4-6.5 5.3 0 .7.6 1.2 1.3 1.2h10.4c.7 0 1.3-.5 1.3-1.2 0-2.9-2.9-5.3-6.5-5.3Z"
      />
    </svg>
  );
}
