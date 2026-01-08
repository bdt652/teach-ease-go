# EduCode LMS - Production Build

# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy environment file for Vite build
COPY .env ./

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - use nginx to serve static files
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx configuration inline
RUN echo 'events { worker_connections 1024; } \
http { \
    include /etc/nginx/mime.types; \
    default_type application/octet-stream; \
    \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_proxied expired no-cache no-store private auth; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
    \
    server { \
        listen 80; \
        root /usr/share/nginx/html; \
        index index.html; \
        \
        location / { \
            try_files $uri $uri/ /index.html; \
        } \
        \
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
            expires 1y; \
            add_header Cache-Control "public, immutable"; \
        } \
        \
        location ~ /\. { \
            deny all; \
        } \
        \
        location /health { \
            return 200 "healthy\n"; \
            add_header Content-Type text/plain; \
        } \
    } \
}' > /etc/nginx/nginx.conf

# Create necessary directories for nginx
RUN mkdir -p /var/cache/nginx /var/log/nginx /run/nginx

# Note: Running nginx as root for simplicity in container environment
# In production, consider using proper security measures

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
