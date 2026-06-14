import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
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
    href: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Inter:wght@400;500;600;700&display=swap",
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

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#facc15" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
