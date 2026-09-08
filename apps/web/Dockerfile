FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs ./
RUN npm install
COPY app ./app
COPY components ./components
COPY lib ./lib
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
