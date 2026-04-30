FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json turbo.json vercel.json ./
COPY packages ./packages
COPY services/api ./services/api

RUN npm ci
RUN npm --prefix packages/shared-types run build

EXPOSE 3000

CMD ["npm", "--prefix", "services/api", "run", "dev"]
