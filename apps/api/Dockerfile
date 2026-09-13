# syntax=docker/dockerfile:1
# build จาก root ของ repo:  docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
# openssl: Prisma schema engine (migrate) บน alpine / corepack: ใช้ pnpm ตาม packageManager ใน package.json
# COREPACK_HOME ที่ใช้ร่วมกัน → user `node` ตอน runtime เรียก pnpm (pre-deploy) ได้โดยไม่ต้องดาวน์โหลดใหม่
ENV COREPACK_HOME=/usr/local/share/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# store / cache ของ pnpm อยู่ใน cache mount → ไม่ติดไปกับ image (~850MB) และ build ซ้ำเร็วขึ้น
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --filter @ai-crm/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @ai-crm/api db:generate && pnpm --filter @ai-crm/api build

# เก็บ dev dependency ไว้ใน image เพราะ Railway pre-deploy ใช้ prisma CLI รัน migrate (และ seed ครั้งแรก)
# production next step: แยก image สำหรับ migrate ออก แล้วให้ runtime เหลือแค่ dist + prod deps
FROM build AS runtime
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
