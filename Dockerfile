# ===== Satu layanan untuk hosting gratis (Render, Koyeb, dll.) =====
# Berisi frontend (Next.js) + backend (Express). Browser hanya bicara ke satu alamat; /api diteruskan ke backend di dalam kontainer.
# Database MySQL TIDAK ada di sini (pakai database cloud). Lihat docs/08-hosting-gratis.md.
FROM node:22-alpine AS fe-build
WORKDIR /app
COPY fe/package*.json ./
RUN npm ci
COPY fe/ .
ENV NEXT_PUBLIC_API_URL=/api API_PROXY=http://127.0.0.1:4000 NEXT_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY be/package*.json ./be/
RUN cd be && npm ci --omit=dev
COPY be/src ./be/src
COPY be/scripts ./be/scripts
COPY database ./database
COPY --from=fe-build /app/.next/standalone ./fe
COPY --from=fe-build /app/.next/static ./fe/.next/static
COPY --from=fe-build /app/public ./fe/public
COPY start.sh ./start.sh
RUN tr -d '\r' < start.sh > start.fixed && mv start.fixed start.sh && chmod +x start.sh && mkdir -p /app/be/storage && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["./start.sh"]
