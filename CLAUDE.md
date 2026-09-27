# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Arxdomotica** is a Home Assistant Supervisor add-on that lets non-technical end clients self-manage their own smart-home setup without touching Home Assistant's native admin UI or YAML. Repo is structured as a Home Assistant *add-on repository* (`repository.yaml` at root) containing one add-on so far, `arxdomotica/`.

Capabilities (see `docs/discovery.md` for the researched API details each of these depends on):
- A simplified client dashboard served through Home Assistant's ingress.
- Creating/managing non-admin Home Assistant users for each client.
- Editing Alarmo settings (arm/disarm schedules, user codes) via Alarmo's `alarmo/users` and `alarmo/automations` **WebSocket** commands (Alarmo has no HA services for user CRUD — see `docs/discovery.md` §5).
- A guided Zigbee pairing wizard via Zigbee2MQTT's `bridge/*` MQTT topics.

**Important architecture note**: Home Assistant's ingress does NOT expose which HA user is viewing an add-on (no identity headers) — see `docs/discovery.md` §1. The add-on must implement its own login (validating the client's HA credentials against HA's Auth API) rather than trusting ingress for identity.

Stack: Node.js/Express backend (`arxdomotica/server`, TypeScript) + React/Vite frontend (`arxdomotica/web`, TypeScript), packaged as a Supervisor add-on (`arxdomotica/Dockerfile` + `build.yaml` + `config.yaml`).

## Commands

```bash
# backend
cd arxdomotica/server && npm install && npm run dev    # tsx watch
cd arxdomotica/server && npm run build                  # tsc -> dist/

# frontend
cd arxdomotica/web && npm install && npm run dev        # vite dev server
cd arxdomotica/web && npm run build                      # vite build -> dist/
```

There is no real Home Assistant instance to test against in this dev environment (no Docker available) — API assumptions from `docs/discovery.md` are unverified until deployed to a real Supervisor install.

## Architecture

- `arxdomotica/server/src/index.ts` — Express entrypoint; serves the built `web/dist` as static files and exposes `/api/*` routes (Alarmo, Zigbee2MQTT — being built out phase by phase per the implementation plan).
- `arxdomotica/server/src/ha/authApi.ts` — HA's public Auth API (login only, stable across versions).
- `arxdomotica/server/src/ha/adminApi.ts` — internal/undocumented HA WebSocket admin API (user creation only; see `docs/discovery.md` §4/§7 for the verification caveat).
- `arxdomotica/server/src/invites/store.ts` + `server/src/routes/auth.ts` — single-use invite-link onboarding: a client with no HA account yet gets a link from the installer (`?invite=<code>`), served on the add-on's **direct port** (not just ingress, which requires an existing HA login — see `docs/discovery.md` §1/§7) to set up their own non-admin account.
- `arxdomotica/server/src/ha/socket.ts` — shared Home Assistant Core WebSocket connection (admin-token authenticated); both `ha/adminApi.ts` and `alarmo/api.ts` send commands over it.
- `arxdomotica/server/src/alarmo/api.ts` + `server/src/routes/alarmo.ts` — Alarmo integration: arm/disarm/skip_delay via the real (public) `call_service` command; user codes and arm/disarm schedules via Alarmo's custom `alarmo/users`/`alarmo/automations` WS commands (unverified shape — `docs/discovery.md` §5). All routes require an existing session (`middleware/requireAuth.ts`).
- `arxdomotica/server/src/zigbee/mqttClient.ts` + `server/src/routes/zigbee.ts` — Zigbee2MQTT pairing: MQTT client subscribed to `bridge/devices`/`bridge/event`, permit-join and device rename over `bridge/request/*` (all confirmed — `docs/discovery.md` §6). `/api/zigbee/events` streams bridge events to the frontend over Server-Sent Events for the live pairing wizard (`web/src/ZigbeeWizard.tsx`).
- `arxdomotica/web` — client UI; must use relative asset paths (`vite.config.ts` sets `base: "./"`) because ingress serves the app behind a dynamic path prefix.
- `arxdomotica/run.sh` — container entrypoint (via Bashio); reads add-on options (`ha_admin_token`, MQTT connection options) from `/data/options.json` and exports them as env vars for the Node process.
- `docs/discovery.md` — authoritative record of researched/confirmed API behavior (HA ingress, HA WebSocket auth, Alarmo WebSocket commands, Zigbee2MQTT MQTT topics). Treat anything marked "à vérifier en live" there as unconfirmed; don't assume a different shape without re-checking.
