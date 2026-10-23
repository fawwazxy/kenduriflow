# KenduriFlow, real system. Put it behind https (your host or a reverse proxy) and keep /app/data on a volume.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 TRUST_PROXY=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Events, people and daily backups live here. Mount a volume so they survive updates.
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
USER node
CMD ["node", "server.js"]
