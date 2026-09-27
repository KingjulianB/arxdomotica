#!/usr/bin/env bashio

bashio::log.info "Démarrage de l'add-on Arxdomotica..."

export HA_URL=$(bashio::config 'ha_url')
export HA_ADMIN_TOKEN=$(bashio::config 'ha_admin_token')
export MQTT_HOST=$(bashio::config 'mqtt_host')
export MQTT_PORT=$(bashio::config 'mqtt_port')
export MQTT_USERNAME=$(bashio::config 'mqtt_username')
export MQTT_PASSWORD=$(bashio::config 'mqtt_password')
export INGRESS_PORT=8099
export ARX_DATA_DIR=/data

cd /app/server
exec node dist/index.js
