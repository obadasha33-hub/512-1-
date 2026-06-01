FROM node:20-slim AS base

# Install dependencies for native modules
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the Next.js app
RUN npx next build

# Copy static assets into standalone
RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

EXPOSE 3000

# Run our custom server (handles both Next.js HTTP and Socket.IO on same port)
CMD ["node", "server.js"]
