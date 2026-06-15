# frontend/v1/Dockerfile
# Multi-stage: build com Node, runtime com nginx sem privilégios (porta 8080).

FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest AS build
# /opt/app-root/src pertence ao usuário 1001 (não-root) na imagem UBI.
WORKDIR /opt/app-root/src
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /opt/app-root/src/dist /usr/share/nginx/html
EXPOSE 8080
