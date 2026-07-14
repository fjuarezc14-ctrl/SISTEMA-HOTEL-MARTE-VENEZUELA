FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3010

ENV PORT=3010
ENV NODE_ENV=development

CMD ["npm", "run", "dev"]
