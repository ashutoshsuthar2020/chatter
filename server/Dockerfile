# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 19.x from Nodesource
RUN curl -fsSL https://deb.nodesource.com/setup_19.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs

# Create app directory
RUN mkdir /app
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy all source files
COPY . .

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["bash", "-c", "npm install && npm start"]
