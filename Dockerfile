FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
USER node
ENV NODE_ENV=production
CMD ["node","server.mjs"]
