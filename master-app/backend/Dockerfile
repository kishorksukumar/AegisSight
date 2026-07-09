FROM node:20-alpine

# Install docker-cli to communicate with docker.sock
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure data dir exists
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "server.js"]
