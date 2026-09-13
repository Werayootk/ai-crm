# syntax=docker/dockerfile:1
# build จาก root ของ repo:  docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:4000 .

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --filter @ai-crm/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
# rewrites ของ Next (/api/* → API) ถูกคำนวณตอน build → ต้องรู้ URL ของ API ตั้งแต่ขั้นนี้
ARG API_URL
ENV API_URL=${API_URL} NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ai-crm/web build

# runtime: เฉพาะ output แบบ standalone (server.js + node_modules เท่าที่ใช้จริง)
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
