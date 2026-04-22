# syntax=docker/dockerfile:1
# Monorepo build: pnpm + turbo, then `pnpm deploy` for a pruned runtime tree + SvelteKit adapter-node output.
FROM node:24-alpine AS builder
RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

# Cache dependency install when lockfile / package manifests change
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/client/package.json apps/client/
COPY packages/game-logic/package.json packages/game-logic/
COPY packages/contracts/package.json packages/contracts/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec turbo run build --filter=capstone
RUN mkdir -p /deploy \
	&& pnpm deploy --filter=capstone --prod --legacy /deploy \
	&& cp -r /app/apps/client/build /deploy/build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /deploy/ ./
EXPOSE 3000
CMD ["node", "build/index.js"]
