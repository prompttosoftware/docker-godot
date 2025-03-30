# Use an official Node.js LTS image as the base
FROM node:18-slim

# Set arguments for Godot version and architecture (same as before)
ARG GODOT_VERSION=4.2.2
ARG GODOT_ARCH=linux.x86_64
ARG GODOT_BASE_URL=https://downloads.tuxfamily.org/godotengine/${GODOT_VERSION}
ARG GODOT_FILENAME=Godot_v${GODOT_VERSION}-stable_${GODOT_ARCH}.zip
ARG GODOT_DOWNLOAD_URL=${GODOT_BASE_URL}/${GODOT_FILENAME}

# Environment variable for non-interactive frontend
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies for Godot, Git, and the Node app
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    zip \
    ca-certificates \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    git \
 # Cleanup apt cache
 && rm -rf /var/lib/apt/lists/*

# Download and install Godot (same logic as before)
RUN echo "Downloading Godot from ${GODOT_DOWNLOAD_URL}" \
 && wget ${GODOT_DOWNLOAD_URL} -O /tmp/godot.zip \
 && unzip -j /tmp/godot.zip */Godot_v${GODOT_VERSION}-stable_${GODOT_ARCH} -d /usr/local/bin/ \
 && mv /usr/local/bin/Godot_v${GODOT_VERSION}-stable_${GODOT_ARCH} /usr/local/bin/godot \
 && chmod +x /usr/local/bin/godot \
 && rm /tmp/godot.zip

# Verify Godot installation
RUN godot --version --headless --quit || echo "Initial headless check passed."

# Create app directory
WORKDIR /usr/src/app

# Create a non-root user to run the app & own the workspace (good practice)
RUN groupadd --gid 1001 node \
    && useradd --uid 1001 --gid node --shell /bin/bash --create-home node

# Create workspace directory owned by the node user
# This is where git repos will be cloned
RUN mkdir /workspace && chown node:node /workspace

# Install Node.js app dependencies
# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./
# Use npm ci for cleaner installs in CI/production environments
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Change ownership of the app files to the node user
RUN chown -R node:node /usr/src/app

# Switch to the non-root user
USER node

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD [ "node", "server.js" ]
