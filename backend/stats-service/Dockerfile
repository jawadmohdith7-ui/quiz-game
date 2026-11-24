FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY server.js ./server.js
EXPOSE 3012
CMD ["npm", "start"]