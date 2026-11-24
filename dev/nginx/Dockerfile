# Etapa 1: compilar el frontend
FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/client-vue/package*.json ./
RUN npm ci

COPY frontend/client-vue/ ./
RUN npm run build

# Etapa 2: servir-lo amb nginx
FROM nginx:alpine

COPY dev/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
