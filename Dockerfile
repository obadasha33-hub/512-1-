FROM node:22-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

COPY . .

# CACHEBUST: force fresh build to pick up CMD changes
RUN echo "rebuild-$(date +%s)" > /tmp/build-id

RUN npx next build

RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
