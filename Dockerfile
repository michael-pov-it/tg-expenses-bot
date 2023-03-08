# Use an official node image as the base image
FROM node:19-alpine

# Update NPM
# RUN npm install -g npm@9.6.0

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the dependencies
RUN npm install --no-audit

# Copy the rest of the files to the container
COPY . .

EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
