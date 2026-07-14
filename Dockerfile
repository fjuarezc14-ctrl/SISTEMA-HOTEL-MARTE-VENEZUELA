# Stage 1: Build frontend React app
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve using Express backend
FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
# Copy compiled frontend assets to backend public directory
COPY --from=frontend-builder /app/dist ./public

EXPOSE 3010
ENV NODE_ENV=production
ENV PORT=3010
ENV DB_PATH=/app/data/hotel.db

RUN mkdir -p /app/data

CMD ["node", "server.js"]
