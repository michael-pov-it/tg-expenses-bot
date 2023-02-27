# Use an official node image as the base image
FROM node:alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the dependencies
RUN npm install -g npm@9.5.0 && npm i

# Copy the rest of the files to the container
COPY . .

# Set the environment variables
# ENV NODE_ENV=DEV
# ENV BOT_TOKEN=5477850762:AAHFh8b7sZv_cFlWOyrf_D_AsKco8FPS5pE
# ENV DB_HOST=mouse.db.elephantsql.com
# ENV DB_PORT=5432
# ENV DB_NAME=fedlampx
# ENV DB_USERNAME=fedlampx
# ENV DB_PASSWORD=C5YepWlZuelgb6Xr_UTF3FcN83Jpj5rX
# ENV CURRENCY=EUR

# Start the bot
CMD ["npm", "start"]
