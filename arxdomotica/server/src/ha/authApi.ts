// Public, documented Home Assistant Auth API (https://developers.home-assistant.io/docs/auth_api/)
// Used for LOGIN only — this is the same flow HA's own frontend/mobile app use,
// so it's stable across HA versions. Do NOT use this for account creation.

const HA_URL = process.env.HA_URL ?? "http://homeassistant:8123";
// NOTE: exact client_id/redirect_uri validation strictness by HA's auth
// component is not confirmed from this dev environment — verify against a
// real instance (see docs/discovery.md). Using the add-on's own URL as the
// client_id is the documented convention for first-party-style clients.
const CLIENT_ID = process.env.ARX_CLIENT_ID ?? `${HA_URL}/`;
const REDIRECT_URI = CLIENT_ID;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Identifiants Home Assistant invalides");
    this.name = "InvalidCredentialsError";
  }
}

export interface HaTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function loginWithPassword(username: string, password: string): Promise<HaTokens> {
  const flowRes = await fetch(`${HA_URL}/auth/login_flow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      handler: ["homeassistant", null],
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!flowRes.ok) {
    throw new Error(`Échec du démarrage du flux de connexion HA (${flowRes.status})`);
  }
  const flow = (await flowRes.json()) as { flow_id: string };

  const stepRes = await fetch(`${HA_URL}/auth/login_flow/${flow.flow_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, username, password }),
  });
  const step = (await stepRes.json()) as { type: string; result?: string };
  if (step.type !== "create_entry" || !step.result) {
    throw new InvalidCredentialsError();
  }

  const tokenRes = await fetch(`${HA_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: step.result,
      client_id: CLIENT_ID,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Échec de l'échange du jeton HA (${tokenRes.status})`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
  };
}
