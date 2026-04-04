FROM node:22-alpine AS builder

WORKDIR /workspace/frontend

COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json

RUN npm ci

COPY frontend ./
COPY shared ../shared

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
