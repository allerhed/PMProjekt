# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Add .mjs MIME type (not in default nginx mime.types, needed for pdfjs worker)
RUN sed -i 's|application/javascript.*js;|application/javascript js mjs;|' /etc/nginx/mime.types

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
