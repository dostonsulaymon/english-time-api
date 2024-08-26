# Use the official Node.js image as the base
FROM node:21-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

ARG DATABASE_URL

# Set the environment variables
ENV DATABASE_URL=$DATABASE_URL


# Expose the port the app will run on
EXPOSE 4400

RUN cd /app && npx prisma db push && npx prisma generate 

RUN npm i @nestjs/cli -g 

RUN npm run build

# Start the NestJS application
CMD ["npm", "run", "start:prod"]
