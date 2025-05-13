# syntax=docker/dockerfile:1

# --- Stage 1: Builder ---
# Use a Node.js version matching your environment (e.g., 20)
FROM node:20 AS builder
WORKDIR /app

# Enable Corepack to manage Yarn version specified in package.json
RUN corepack enable

# Install build tools and system dependencies needed for native modules like 'canvas'
# Note: python-is-python3 ensures 'python' command maps to python3
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev python3 pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Set environment for build stage (can include dev dependencies)
ENV NODE_ENV=development

# Copy the entire monorepo source code FIRST
# This includes package.json, yarn.lock, .yarn, .yarnrc.yml, tsconfig files, etc.
COPY . .

# Install ALL monorepo dependencies AFTER copying all code
# Use --immutable to ensure lockfile consistency
RUN yarn install --immutable

# Build the specific server application
# !!! Make sure '@flamedeck/flamechart-server' is the correct project name for NX build !!!
RUN yarn nx build @flamedeck/flamechart-server

# --- DIAGNOSTIC STEP: Check start of bundled output ---
RUN echo "--- Start of Bundled index.js ---" && head -n 50 /app/apps/flamechart-server/dist/index.js && echo "--- End of Bundled index.js ---"
# --- END DIAGNOSTIC STEP ---


# --- Stage 2: Runner ---
# Use a slim image for the final stage
FROM node:20-slim
WORKDIR /app

# Enable Corepack in the runner stage too
RUN corepack enable

# Install fontconfig and a default font for node-canvas text rendering
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y fontconfig fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy the entire node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy ONLY the built server app from the builder stage
# Using the outputPath specified in project.json
COPY --from=builder /app/apps/flamechart-server/dist ./apps/flamechart-server/dist

# Update CMD to use the correct path based on project.json
CMD ["node", "apps/flamechart-server/dist/index.js"]

EXPOSE 3000
