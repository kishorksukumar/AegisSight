FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure data dir is writable by non-root user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["node", "server.js"]
