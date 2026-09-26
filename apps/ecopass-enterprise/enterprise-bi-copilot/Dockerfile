# ==============================================================================
# Enterprise BI Copilot & MCP Server (Port 3011)
# Node.js, TypeScript, MCP Protocol Server for Executive Analytics
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app ./

ENV PORT=3011
ENV NODE_ENV=production

EXPOSE 3011

CMD ["node", "apps/agent-server/dist/src/server.js"]
