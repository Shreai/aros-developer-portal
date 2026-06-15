FROM node:22-alpine

WORKDIR /app/portal

COPY portal/package*.json ./
RUN npm ci

COPY portal ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5442

EXPOSE 5442

CMD ["node", "server.mjs"]
