# Stage 1: Build static React bundle
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install all development + runtime dependencies
RUN npm ci

COPY . .

# Inject build arguments into compilation environment for Vite bundling
ARG VITE_API_URL
ARG VITE_RAZORPAY_KEY_ID

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID

# Build Vite static bundle assets (output goes to dist/)
RUN npm run build

# Stage 2: Nginx server container to serve static assets
FROM nginx:1.25-alpine

# Copy compiled assets from builder
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom Nginx configuration to support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose Nginx server port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
