FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm (or use npm)
RUN npm install -g pnpm

# Copy workspace config and package.json files
COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/crypto/package.json packages/crypto/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma Client
WORKDIR /app/backend
RUN npx prisma generate --schema=../prisma/schema.prisma

# Build shared packages
WORKDIR /app/packages/crypto
RUN pnpm run build
WORKDIR /app/packages/types
RUN pnpm run build
WORKDIR /app/packages/config
RUN pnpm run build

# Build server
WORKDIR /app/backend
RUN npx tsc

EXPOSE 4000
CMD ["pnpm", "start"]
