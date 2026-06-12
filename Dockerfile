FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Default: run the monolith. Override CMD for individual services.
CMD ["npx", "tsx", "src/main.ts"]
