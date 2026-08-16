import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { PwaInstallBanner } from "./components/PwaInstallBanner";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/secretlink.png" },
  { rel: "icon", type: "image/png", sizes: "16x16", href: "/secretlink.png" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/secretlink.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800;900&display=swap",
  },
];

const themeScript = `
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  })();
`;

const swScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
`;

// Structured data (JSON-LD) so search and generative engines understand the
// site entity. This is the "GEO" surface — stable, machine-readable facts.
const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Secretlink.life",
      url: "https://secretlink.life",
      logo: "https://secretlink.life/secretlink.png",
    },
    {
      "@type": "WebSite",
      name: "Secretlink.life",
      url: "https://secretlink.life",
      description:
        "The private social layer. Send secrets that self-destruct, share anonymously, and connect without a trace.",
    },
  ],
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#facc15" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <Meta />
        <Links />
      </head>
      <body className="bg-surface text-text font-sans antialiased transition-colors duration-300">
        <Outlet />
        <PwaInstallBanner />
        <ScrollRestoration />
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.status === 404
      ? "The page you're looking for doesn't exist."
      : error.data?.message || message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-surface text-text font-sans antialiased min-h-screen flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-4xl font-bold text-accent mb-4">{title}</h1>
          <p className="text-text-muted mb-6">{message}</p>
          <a href="/" className="text-accent underline hover:no-underline">
            Go home
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
