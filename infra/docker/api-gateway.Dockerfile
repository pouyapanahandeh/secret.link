# --- Build stage ---
FROM node:22-slim AS builder

RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy relevant packages
COPY packages/core/ ./packages/core/
COPY packages/schemas/ ./packages/schemas/
COPY packages/db/ ./packages/db/
COPY packages/telemetry/ ./packages/telemetry/
COPY packages/config-tsconfig/ ./packages/config-tsconfig/
COPY apps/api-gateway/ ./apps/api-gateway/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@secretlink/api-gateway...

# --- Production stage ---
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=builder /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/apps/api-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["dist/index.js"]
