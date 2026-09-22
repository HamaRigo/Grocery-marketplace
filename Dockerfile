FROM node:20-alpine
WORKDIR /app

# bcrypt needs native build tools on Alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci
COPY . .

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/main.ts"]
