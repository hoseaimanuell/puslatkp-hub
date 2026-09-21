# ===== Servis be (Express) =====
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
