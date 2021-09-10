# will build and put all code to /opt/app
# a Node.js application container
FROM 890606282206.dkr.ecr.eu-west-1.amazonaws.com/alpine-nodegit as builder

# install curl
RUN apk update && apk add \
    curl bash openssh \
    && rm -rf /var/cache/apk/*

ENV LANG C.UTF-8

# add a simple script that can auto-detect the appropriate JAVA_HOME value
# based on whether the JDK or only the JRE is installed
RUN { \
    echo '#!/bin/sh'; \
    echo 'set -e'; \
    echo; \
    echo 'dirname "$(dirname "$(readlink -f "$(which javac || which java)")")"'; \
    } > /usr/local/bin/docker-java-home \
    && chmod +x /usr/local/bin/docker-java-home
ENV JAVA_HOME /usr/lib/jvm/java-1.8-openjdk
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin

ENV JAVA_VERSION 8u212

ENV LIB_GENERATE_USE_NPM true

RUN set -x \
    && apk add --no-cache \
    openjdk8 \
    && [ "$JAVA_HOME" = "$(docker-java-home)" ]

# RUN npm install @openapitools/openapi-generator-cli@cli-3.3.4 -g
COPY openapi-generator-cli.jar /opt/openapi-generator-cli.jar

RUN mkdir -p /opt/app
WORKDIR /opt/app

ARG NPM_TOKEN
ARG NPM_PROJECTS_TOKEN
ARG NPM_CLIENT_LIB_NAME
ARG NPM_IGNORE_PUBLISH

COPY .npmrc /opt/app/.npmrc
COPY .npmrc /opt/app/client/.npmrc

# copy for faster install
COPY package.json /opt/app/package.json
# COPY package-lock.json /opt/app/package-lock.json
RUN npm install

COPY client/package.json /opt/app/client/package.json
COPY client/package-lock.json /opt/app/client/package-lock.json
RUN cd client && npm install && cd ..

# Copy all code
COPY . /opt/app
RUN npm run server:build
RUN node_modules/@aitheon/core-server/generate-rest.sh

RUN npm run client:lib
RUN node_modules/@aitheon/core-server/publish-lib.sh
RUN npm run client:build:prod

RUN rm -rf .npmrc client/node_modules


# a Node.js application container
FROM node:10-alpine

RUN apk update && apk add \
    curl bash openssh \
    git build-base libgit2-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /opt/app

COPY --from=builder /opt/app /opt/app

# Expose API port to the outside
EXPOSE 3000

CMD ["npm", "start"]
