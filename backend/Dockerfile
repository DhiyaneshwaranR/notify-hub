FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript
RUN npm run build

# Start the application
CMD ["npm", "run", "dev"]

# Expose the port the app runs on
EXPOSE 4000