# ADR-002: Remix with Vite for SSR Web Apps

## Status
Accepted

## Context
Both web apps need server-side rendering for SEO and AI-search retrievability.

## Decision
Use **Remix v2 with Vite** for both `web-public` and `web-teams`.

## Rationale
- Full SSR out of the box — critical for LLM crawler indexing
- Vite provides fast HMR and build times
- Works cleanly inside Turborepo monorepo
- Progressive enhancement — forms work without JS
- Shared design system via internal packages

## Consequences
- Two Remix apps share packages but have independent routing/theming
- Cloud Run hosts each as a separate container for independent scaling
- Capacitor wraps these same apps for mobile
