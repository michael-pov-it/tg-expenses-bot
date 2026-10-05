FROM node:19-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.js ./
COPY commands/ ./commands/

EXPOSE 3000

# Provide credentials at runtime, never in the image.
CMD ["npm", "start"]
