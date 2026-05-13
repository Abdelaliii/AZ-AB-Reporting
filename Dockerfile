# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build the frontend
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/orders.db
ENV JWT_SECRET=change-me-in-production

# Copy only necessary files
COPY package*.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copy the built frontend and the server code
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./

# Create directory for persistent database
RUN mkdir -p /app/data

# Expose the application port
EXPOSE 3000

# Start the application using tsx to run the TypeScript server file
CMD ["tsx", "server.ts"]
