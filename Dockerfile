FROM node:10-alpine

# Installs latest Chromium (71) package.
RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
      bash \
      git \
      openssh \
      chromium@edge \
      harfbuzz@edge \
      nss@edge

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Puppeteer v1.9.0 works with Chromium 71.
RUN yarn add puppeteer@1.9.0

WORKDIR /usr/src/app

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

# RUN ln -s /usr/lib/chromium/chromium-launcher.sh /usr/bin/google-chrome
# RUN ln -s /usr/lib/chromium/chromium-launcher.sh /usr/bin/google-chrome-stable
# RUN ln -s /usr/lib/chromium/chromium-launcher.sh /usr/bin/chrome

# Run everything after as non-privileged user.
USER pptruser

RUN git config --global url."https://github.com/".insteadOf git@github.com:
RUN git config --global url."https://".insteadOf git://

ENV NODE_ENV production

COPY package*.json ./
RUN npm install
ADD config ./config
ADD src ./src

CMD ["npm", "start", "--"]
