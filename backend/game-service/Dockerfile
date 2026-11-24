# Game Service - WebSocket Server
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose WebSocket port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]