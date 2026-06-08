# ADR-001: Koa over Express/Fastify for API Gateway

## Status
Accepted

## Context
We need an HTTP framework for the API gateway that aligns with our functional programming style.

## Decision
Use **Koa 2** with TypeScript.

## Rationale
- Koa's middleware model is `(ctx, next) => Promise<void>` — composable async functions
- Minimal footprint, no bundled middleware
- Native async/await (no callback-style like Express)
- Pairs cleanly with Zod validation and functional composition
- High throughput (better than Express, slightly below Fastify)

## Consequences
- Must install middleware separately (@koa/router, koa-bodyparser, etc.)
- Smaller ecosystem than Express, but sufficient for our needs
- If hot-path benchmarks demand it, Fastify can be introduced for specific routes later
