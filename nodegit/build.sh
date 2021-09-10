#!/bin/bash

set -ex
set -a

REGISTRY="890606282206.dkr.ecr.eu-west-1.amazonaws.com"

CURRENT_DIR="${PWD##*/}"
IMAGE_NAME="alpine-nodegit"
# if [[ -z "${LATEST_VERSION}" ]]; then
#   LATEST_VERSION=$(aws ecr list-images --repository-name $IMAGE_NAME \
#   | jq '.imageIds|map(.imageTag)|.[]|strings' \
#   | sort -rV \
#   | head -1)
#   VERSION=$(echo $VERSION | tr -d \")
# fi

# VERSION="${LATEST_VERSION:-1.0.0}"
# VERSION=$(echo $VERSION | tr -d \")
# COMMAND_PREFIX="../node_modules/@aitheon/core-server"

# INCREASE=${1:-m}

# TAG="$(${COMMAND_PREFIX}/increment_version.sh -${INCREASE} ${VERSION})"

FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${TAG}"

# login to docker registery
aws ecr get-login-password | docker login --username AWS --password-stdin $REGISTRY

# library build
# ${COMMAND_PREFIX}/generate-rest.sh

# docker build -t ${IMAGE_NAME} .
docker build -t ${IMAGE_NAME} .
# docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:${TAG}
docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest
docker push ${REGISTRY}/${IMAGE_NAME}:latest
# docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
