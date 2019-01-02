FROM node:10-alpine

RUN apk update && apk upgrade && \
  apk add --no-cache bash git openssh

RUN git config --global url."https://github.com/".insteadOf git@github.com:
RUN git config --global url."https://".insteadOf git://

ENV NODE_ENV production
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
ADD config ./config
ADD src ./src

CMD ["npm", "start", "--"]
