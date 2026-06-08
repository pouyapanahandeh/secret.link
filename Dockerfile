FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/web-teams/ ./apps/web-teams/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@secretlink/web-teams

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/web-teams
CMD ["pnpm", "start"]
