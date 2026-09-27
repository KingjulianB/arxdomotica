# Phase 0 — Discovery findings

No Docker was available in this environment, so this replaces a live HA-instance
spike with documentation/source research. Findings marked "à vérifier en live"
must be confirmed against a real Home Assistant + Alarmo + Zigbee2MQTT instance
before the corresponding code ships.

## 1. Ingress does NOT expose viewer identity

Confirmed negative: official ingress docs only document `X-Ingress-Path`; no
`X-Remote-User-*` header exists. The Supervisor does not tell an ingressed
add-on which HA user is viewing it.

**Architecture impact**: the add-on needs its **own login screen** where the
client enters their existing Home Assistant credentials; the backend validates
those credentials against HA's Auth API and establishes its own session. It
cannot trust ingress alone for identity.

Sources: https://developers.home-assistant.io/docs/add-ons/presentation/,
https://community.home-assistant.io/t/hassio-ingress-header-for-user-name-exist/202291

## 2. `homeassistant_api` / `hassio_api` → SUPERVISOR_TOKEN

Confirmed: grants `SUPERVISOR_TOKEN` for Core REST (`http://supervisor/core/api/`)
and WebSocket (`ws://supervisor/core/websocket`). **Not confirmed**: whether
this token is admin-equivalent for user-management WS commands
(`config/auth/*`). Treat as unconfirmed — the `ha_admin_token` option already
in `config.yaml` (an installer-supplied admin Long-Lived Access Token) is the
safe fallback and should be the default path until verified live.

Source: https://developers.home-assistant.io/docs/add-ons/communication/

## 3. MQTT service discovery (`services: mqtt:want`)

Confirmed in principle (Bashio: `bashio::services mqtt "host"/"username"/"password"`)
but the exact env var names available to a plain Node.js process (not through
Bashio) are not guaranteed. `run.sh` must call Bashio to read the MQTT service
values and explicitly export them for the Node process (see `run.sh`), rather
than assuming Node sees them natively — **verify env var names land correctly
on first real deploy**.

Source: https://developers.home-assistant.io/docs/add-ons/communication/

## 4. HA user management — undocumented internal API

`config/auth/*` WebSocket commands are not part of the public documented API
(only used internally by the HA frontend). Field names and stability across
HA versions are **not confirmed** — flag as a standing maintenance risk, not
just a one-time verification. Add a startup HA-version check and fail loudly
if the expected commands don't respond as expected, rather than silently
breaking.

Source: https://developers.home-assistant.io/docs/api/websocket/

## 5. Alarmo — CORRECTS THE ORIGINAL PLAN

There is **no** `alarmo.add_user` / `alarmo.edit_user` / `alarmo.delete_user`
service. The real `services.yaml` only exposes: `arm`, `disarm`, `skip_delay`,
`enable_user`, `disable_user`.

User CRUD (create/edit/delete/code/permissions) goes through a **custom
WebSocket command** `alarmo/users`:
- presence of `user_id` = edit, absence = create, `remove: true` = delete
- fields: `user_id`, `name`, `code`, `old_code`, `enabled`, `can_arm`,
  `can_disarm`, `is_override_code`, `area_limit`

Schedules ("horaires") go through **another custom WebSocket command**
`alarmo/automations` (`automation_id`, `name`, `type`, `triggers`, `actions`,
`enabled`) — the exact shape of a time-based trigger was **not confirmed**
from the source excerpt retrieved and needs live verification. No explicit
`require_admin` guard was spotted on these commands, but that is not a
reliable negative (partial source read) — do not assume no-admin-required
without live confirmation.

**Phase 4 must be rewritten to speak Alarmo's WebSocket API**, exactly like
Alarmo's own Lovelace card does — not to call nonexistent HA services.

Implemented in `server/src/alarmo/api.ts`: the 5 real services (`arm`,
`disarm`, `skip_delay`, `enable_user`, `disable_user`) go through the
**public, documented** `call_service` WS command — low risk. User CRUD/codes
and schedules go through `alarmo/users`/`alarmo/automations` — clearly marked
UNVERIFIED in that file; confirm on first real deploy before trusting them.

Sources: https://github.com/nielsfaber/alarmo/blob/main/custom_components/alarmo/services.yaml,
https://github.com/nielsfaber/alarmo/blob/main/custom_components/alarmo/websockets.py

## 6. Zigbee2MQTT bridge API — confirmed, high confidence

- Enable pairing: publish `bridge/request/permit_join` with
  `{"time": <seconds>, "transaction": <optional>}`; response on
  `bridge/response/permit_join`.
- Device list: retained topic `bridge/devices` — IEEE address, friendly_name,
  network address, `interview_state`
  (`PENDING`/`IN_PROGRESS`/`SUCCESSFUL`/`FAILED`), type, endpoints/clusters,
  definition (model/vendor/exposes).
- Live events: `bridge/event`, payload `{"type": "...", "data": {...}}` with
  types `device_joined`, `device_interview`, `device_leave`, `device_announce`.
- Rename: publish `bridge/request/device/rename` with
  `{"from": "<id or friendly_name>", "to": "<new name>"}`, or
  `{"last": true, "to": "..."}` to rename the most recently joined device.

Source: https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html

## 7. Onboarding a client with no HA account yet

Because ingress access requires an existing HA login (§1), a client with no
account can't reach the ingress panel at all. Resolution:

- The add-on is also exposed on a **direct port** (`config.yaml` → `ports`/`webui`,
  port 8099), reachable without any prior HA session.
- Account creation is gated by a **single-use invite code** the installer
  generates (`POST /api/admin/invites`, protected by the configured
  `ha_admin_token` as a shared secret) and hands to the client as a link
  (`https://<host>:8099/?invite=<code>`). Without a valid invite, only the
  login form is shown — this avoids an open self-registration endpoint on the
  client's home network.
- **Login** (existing account) uses HA's public, documented Auth API
  (`/auth/login_flow` → `/auth/login_flow/:id` → `/auth/token`, see
  `server/src/ha/authApi.ts`) — stable across HA versions.
- **Registration** (new account) uses the admin-token-backed internal WS API
  (`server/src/ha/adminApi.ts`) to create the user, then immediately performs
  the same public login to establish a session — the higher-risk, unconfirmed
  part is scoped to this one path only.

## Standing items to verify on first real HA deployment

- Real privilege level of `SUPERVISOR_TOKEN` against `config/auth/*`.
- Exact schema of `config/auth/create` / `config/auth_provider/homeassistant/create`.
- Exact shape of a time-based trigger in `alarmo/automations`, and whether
  `alarmo/users`/`alarmo/automations` actually require admin.
- Exact MQTT env var names landing in the Node process via `run.sh`/Bashio.
- Whether HA's Auth API (`/auth/login_flow`, `/auth/token`) accepts the
  add-on's own URL as `client_id`/`redirect_uri` without a registered OAuth
  application (it's a server-to-server call, not a browser redirect).
