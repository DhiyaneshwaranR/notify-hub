# Use Node.js LTS version
FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy root package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build backend
RUN npm run build:backend

# Create templates directory and copy templates
RUN mkdir -p /usr/src/app/backend/dist/templates && \
    cp -r /usr/src/app/backend/src/templates/* /usr/src/app/backend/dist/templates/

# Remove development dependencies and clear npm cache
RUN npm prune --production && npm cache clean --force

# Clean up build dependencies
RUN apk del python3 make g++

# Expose API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Start the backend application
WORKDIR /usr/src/app/backend
CMD ["node", "dist/index.js"]