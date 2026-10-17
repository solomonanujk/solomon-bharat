# Solomon Bharat API: the same Express server Render runs, packaged for Cloudflare Containers
# (or any Docker host). Migrations run on start, as Render's build step did.
FROM public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=4000 NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
