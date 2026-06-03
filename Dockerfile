FROM node:22-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

# Remove standalone output for production server (standalone mode conflicts with custom programmatic server.js)
RUN node -e "const fs = require('fs'); let c = fs.readFileSync('next.config.ts', 'utf8'); c = c.replace('output: \"standalone\",', ''); fs.writeFileSync('next.config.ts', c);"

# Force fresh file copy every build (always re-runs because it always changes)
COPY . .

# CACHEBUST: every build re-runs this so the layer below always invalidates
RUN echo "build-$(date +%s)-$(shuf -i 1000-9999 -n 1)" > /tmp/build-id

# Clear any cached .next from previous layers to force a full rebuild
RUN rm -rf .next

# CACHEBUST2: always invalidate this layer
RUN echo "build-$(date +%s)-$(shuf -i 1000-9999 -n 1)" > /tmp/build-id2
RUN npx next build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
