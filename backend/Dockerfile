# Stage 1: Install production dependencies only
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies cleanly
RUN npm ci --only=production

# Stage 2: Minimalist production runtime container
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy production node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Set production configurations
ENV NODE_ENV=production
ENV PORT=5050

# Expose API gateway gateway port
EXPOSE 5050

# Utilize Alpine non-root node user for container hardiness
USER node

# Start Express gateway
CMD ["npm", "start"]
