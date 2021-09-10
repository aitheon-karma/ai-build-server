#!/bin/bash

NAMESPACE="${PWD##*/}"
kubectl port-forward svc/git-server 2222 --namespace=$NAMESPACE
