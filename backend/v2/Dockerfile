# backend/v2/Dockerfile
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest

WORKDIR /opt/app-root/src

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080
USER 1001

CMD ["node", "src/server.js"]
