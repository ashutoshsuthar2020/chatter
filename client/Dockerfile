FROM node:19.7.0
RUN mkdir app
WORKDIR /app
COPY package*.json ./

# RUN npm install

COPY . .

EXPOSE 8000

CMD ["npm","run", "start"]