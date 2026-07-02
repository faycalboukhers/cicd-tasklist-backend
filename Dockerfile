# Build stage: compile TypeScript and generate the Prisma client
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies but keep the generated Prisma client
RUN npm prune --omit=dev

# Runtime stage: minimal image with only what is needed to run
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001
USER node
CMD ["node", "dist/server.js"]
