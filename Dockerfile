# EVIL — immagine per Fly.io (o qualunque host Docker)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
# patch di sicurezza Debian (perl, pcre2, ...) a ogni build; poi si ripulisce la cache apt
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
# il sito genera alcuni file all'avvio (menu, dizionari) e scrive cache e upload: l'utente node deve poter scrivere
RUN mkdir -p /app/uploads /app/logs /data && chown -R node:node /app/uploads /app/logs /data /app/html /app/js /app/css
USER node
EXPOSE 8080
CMD ["node", "js/server.js"]
