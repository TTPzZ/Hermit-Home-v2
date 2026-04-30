FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY services/mqtt-worker ./services/mqtt-worker

RUN npm ci
RUN npm --prefix packages/shared-types run build
RUN npm --prefix services/mqtt-worker run build

EXPOSE 10000

CMD ["npm", "--prefix", "services/mqtt-worker", "run", "start"]
