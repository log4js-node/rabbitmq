#!/usr/bin/env bash
docker run -d -p 5672:5672 --hostname rabbitmq --name rabbitmq rabbitmq:alpine
sleep 10
DEBUG='*' node integration.js

docker stop rabbitmq && docker rm rabbitmq
