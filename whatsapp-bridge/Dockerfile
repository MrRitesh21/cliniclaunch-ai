# Dockerfile for WhatsApp Baileys Gateway Service
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package.json ./
RUN npm install --production

COPY index.js ./

ENV PORT=8080
ENV AUTH_DIR=/data/auth

EXPOSE 8080

CMD ["node", "index.js"]
