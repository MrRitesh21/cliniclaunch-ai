# Optimized Dockerfile for WhatsApp Baileys Gateway Service on Render Free Plan
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8080
ENV AUTH_DIR=/app/auth
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 8080

CMD ["npx", "tsx", "--max-old-space-size=384", "index.ts"]
