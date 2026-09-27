# Changelog

## 0.1.0

- Scaffold initial de l'add-on (packaging, backend Express, frontend React placeholder).
- Onboarding client : lien d'invitation à usage unique, création de compte HA non-admin, connexion via l'API Auth publique HA.
- Intégration Alarmo : arm/disarm/skip_delay (services HA confirmés), gestion des codes utilisateurs et des horaires d'armement/désarmement (commandes WebSocket Alarmo, à vérifier en conditions réelles).
- Assistant d'appairage Zigbee2MQTT : activation du mode appairage, suivi en direct (Server-Sent Events), renommage guidé, sans notion de MQTT/Zigbee côté client.
- Interface Alarme : armer/désarmer, gestion des codes utilisateurs, gestion des horaires d'armement/désarmement.
