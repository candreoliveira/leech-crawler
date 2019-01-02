#!/bin/bash

echo "Iniciando dump..."

S3_PATH=$(sh -c "echo $S3_OUTPUT_PATH")

psql \
    --host=$DB_HOST \
    --port=$DB_PORT \
    --username=$DB_USER \
    --dbname=$DB_NAME \
    --command="$COMMAND" \
    | gzip \
    | aws s3 cp - $S3_PATH

echo "Dump finalizado!"
echo "Arquivo salvo em ${S3_PATH}"