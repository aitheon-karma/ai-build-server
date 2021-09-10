# will build and put all code to /opt/app
# a Node.js application container
FROM node:12-alpine

ENV LANG C.UTF-8

RUN mkdir -p /opt/app
WORKDIR /opt/app

# copy for faster install
RUN apk --no-cache add curl-dev g++ make python krb5-libs \
    && rm -rf node_modules/nodegit \
    && BUILD_ONLY=true npm install nodegit \
    && apk del g++ make python
