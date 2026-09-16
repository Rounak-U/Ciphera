FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace setup
COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/crypto/package.json packages/crypto/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build shared packages
WORKDIR /app/packages/crypto
RUN npm run build

# Build Next.js
WORKDIR /app/frontend
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
