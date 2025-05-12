# syntax=docker/dockerfile:1

# --- Stage 1: Builder ---
# Use a Node.js version matching your environment (e.g., 20)
FROM node:20 AS builder
WORKDIR /app

# Enable Corepack to manage Yarn version specified in package.json
RUN corepack enable

# Set environment for build stage (can include dev dependencies)
ENV NODE_ENV=development

# Copy root dependency definition files & Yarn binary cache
COPY package.json yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY tsconfig.base.json ./

# Install ALL monorepo dependencies using the Yarn version managed by Corepack
RUN yarn install --immutable # --immutable is recommended for CI/Docker with Yarn Berry

# Copy the entire monorepo source code
COPY . .

# Build the specific server application
# !!! Make sure '@flamedeck/flamechart-server' is the correct project name for NX build !!!
RUN yarn nx build @flamedeck/flamechart-server


# --- Stage 2: Runner ---
# Use a slim image for the final stage
FROM node:20-slim
WORKDIR /app

# Enable Corepack in the runner stage too
RUN corepack enable

ENV NODE_ENV=production

# Copy root dependency files for production install & Yarn binary cache
COPY package.json yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn

# Install ONLY production dependencies for the entire workspace
# Using the Yarn version managed by Corepack
RUN yarn workspaces focus --all --production # Yarn Berry command to install prod deps for workspaces

# Copy ONLY the built server app from the builder stage
# !!! Verify this path matches your actual build output location !!!
COPY --from=builder /app/apps/flamechart-server/dist ./apps/flamechart-server/dist

# !!! Verify this path is the correct entry point for your built server !!!
CMD ["node", "apps/flamechart-server/dist/main.js"]

EXPOSE 3000
