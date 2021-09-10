#!/bin/bash

kubectl port-forward svc/ai-rabbitmq 5672:5672 --namespace=ai-rabbitmq