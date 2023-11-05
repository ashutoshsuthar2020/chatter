FROM node:19.7.0 AS base
WORKDIR /
COPY package* .
RUN npm install

FROM base AS development
COPY . .
CMD ["npm","run", "dev"]

FROM base AS production
COPY . .
CMD ["npm","run", "start"]

EXPOSE 3000