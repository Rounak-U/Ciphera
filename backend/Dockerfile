FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm (or use npm)
RUN npm install -g pnpm

# Copy workspace config and package.json files
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/crypto/package.json packages/crypto/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma Client
WORKDIR /app/apps/server
RUN npx prisma generate --schema=../../prisma/schema.prisma

# Build shared packages
WORKDIR /app/packages/crypto
RUN npm run build
WORKDIR /app/packages/types
RUN npm run build
WORKDIR /app/packages/config
RUN npm run build

# Build server
WORKDIR /app/apps/server
RUN npx tsc

EXPOSE 4000
CMD ["npm", "start"]
