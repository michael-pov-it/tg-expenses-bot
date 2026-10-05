FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.js ./
COPY commands/ ./commands/

# Provide credentials at runtime, never in the image.
CMD ["npm", "start"]
