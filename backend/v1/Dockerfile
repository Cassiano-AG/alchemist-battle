# backend/v1/Dockerfile
# UBI mínima da Red Hat: roda como usuário não-root (1001) por padrão,
# compatível com a SCC "restricted-v2" do OpenShift.
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
