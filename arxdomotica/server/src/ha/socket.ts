import WebSocket from "ws";

// Shared Home Assistant Core WebSocket connection (ws://.../api/websocket),
// authenticated with the admin-scoped token. Used by both adminApi.ts (user
// creation) and alarmo/api.ts (Alarmo's custom_component WS commands run on
// this same Core socket, alongside the public `call_service` command).

const HA_URL = process.env.HA_URL ?? "http://homeassistant:8123";
const ADMIN_TOKEN = process.env.HA_ADMIN_TOKEN ?? process.env.SUPERVISOR_TOKEN ?? "";

interface WsResult {
  id: number;
  type: string;
  success?: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

class HaSocket {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, (msg: WsResult) => void>();
  private ready: Promise<void>;

  constructor() {
    this.ready = this.connect();
  }

  private connect(): Promise<void> {
    const wsUrl = `${HA_URL.replace(/^http/, "ws")}/api/websocket`;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as WsResult & { type: string };
        if (msg.type === "auth_required") {
          this.ws!.send(JSON.stringify({ type: "auth", access_token: ADMIN_TOKEN }));
        } else if (msg.type === "auth_ok") {
          resolve();
        } else if (msg.type === "auth_invalid") {
          reject(new Error("Jeton admin Home Assistant invalide"));
        } else if (msg.id && this.pending.has(msg.id)) {
          this.pending.get(msg.id)!(msg);
          this.pending.delete(msg.id);
        }
      });
      this.ws.on("error", reject);
    });
  }

  async send<T = unknown>(command: Record<string, unknown>): Promise<T> {
    if (!ADMIN_TOKEN) {
      throw new Error("Aucun jeton admin Home Assistant configuré (option 'ha_admin_token').");
    }
    await this.ready;
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, (msg) => {
        if (msg.success === false) {
          reject(new Error(msg.error?.message ?? "Commande Home Assistant échouée"));
        } else {
          resolve(msg.result as T);
        }
      });
      this.ws!.send(JSON.stringify({ id, ...command }));
    });
  }
}

let socket: HaSocket | null = null;
export function getHaSocket(): HaSocket {
  if (!socket) socket = new HaSocket();
  return socket;
}
