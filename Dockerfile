# Multi-stage Dockerfile for ServiceDesk Full-Stack Application

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for server
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy built backend and frontend assets
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=frontend-builder /app/dist ./public

EXPOSE 5000

CMD ["node", "server/dist/server.js"]
