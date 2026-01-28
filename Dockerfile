FROM node:22-alpine

WORKDIR /app

ENV HOME=/home/node

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY server/ ./server/
COPY public/ ./public/

RUN mkdir -p /app/data /home/node/.ssh

EXPOSE 3000

CMD ["node", "server/index.js"]
