#!/bin/sh
mkdir -p /etc/nginx/certs
if [ ! -f /etc/nginx/certs/server.crt ]; then
    echo "No SSL certificate found. Generating self-signed certificate for 10.101.53.7..."
    openssl req -x509 -newkey rsa:2048 -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt -sha256 -days 3650 -nodes -subj "/CN=10.101.53.7"
fi
exec nginx -g "daemon off;"
