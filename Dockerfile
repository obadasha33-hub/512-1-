FROM node:22-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

COPY . .

RUN npx next build

RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

EXPOSE 3000

COPY start.sh ./
RUN chmod +x ./start.sh

ENV NODE_ENV=production

CMD ["./start.sh"]
