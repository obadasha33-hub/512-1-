FROM node:22-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Force rebuild: invalidate all subsequent cache layers
ARG CACHEBUST
RUN echo "Cache bust at: $CACHEBUST"

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

COPY . .

# Remove standalone output for production server (standalone mode conflicts with custom programmatic server.js)
RUN node -e "const fs = require('fs'); let c = fs.readFileSync('next.config.ts', 'utf8'); c = c.replace('output: \"standalone\",', ''); fs.writeFileSync('next.config.ts', c);"

# CACHEBUST: force fresh build to pick up CMD changes
RUN echo "rebuild-$(date +%s)" > /tmp/build-id

RUN npx next build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
