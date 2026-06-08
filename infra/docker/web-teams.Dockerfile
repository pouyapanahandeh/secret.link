# --- Build stage ---
FROM node:22-slim AS builder

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY packages/ui/ ./packages/ui/
COPY packages/ui-teams/ ./packages/ui-teams/
COPY packages/schemas/ ./packages/schemas/
COPY packages/config-tsconfig/ ./packages/config-tsconfig/
COPY packages/config-tailwind/ ./packages/config-tailwind/
COPY apps/web-teams/ ./apps/web-teams/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@secretlink/web-teams...

# --- Production stage ---
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=builder /app/apps/web-teams/build ./build
COPY --from=builder /app/apps/web-teams/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node_modules/.bin/remix-serve", "build/server/index.js"]
