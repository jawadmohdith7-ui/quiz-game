# Catalog Service - Express HTTP Server
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Expose HTTP port
EXPOSE 3001

# Start the server
CMD ["node", "src/server.js"]