# EVIL — immagine per Fly.io (o qualunque host Docker)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# cartelle scrivibili per cache e upload temporanei; il processo non gira come root
RUN mkdir -p /app/uploads /app/logs /data && chown -R node:node /app/uploads /app/logs /data
USER node
EXPOSE 8080
CMD ["node", "js/server.js"]
