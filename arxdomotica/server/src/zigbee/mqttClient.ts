import mqtt, { MqttClient } from "mqtt";

// Zigbee2MQTT bridge MQTT API — CONFIRMED, high confidence
// (docs/discovery.md §6, https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html).

const MQTT_HOST = process.env.MQTT_HOST ?? "";
const MQTT_PORT = Number(process.env.MQTT_PORT ?? 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;

export interface ZigbeeDevice {
  ieee_address: string;
  friendly_name: string;
  type: string;
  interview_state?: "PENDING" | "IN_PROGRESS" | "SUCCESSFUL" | "FAILED";
  definition?: { model?: string; vendor?: string; description?: string } | null;
}

export interface BridgeEvent {
  type: string;
  data: Record<string, unknown>;
}

let client: MqttClient | null = null;
let latestDevices: ZigbeeDevice[] = [];
const eventListeners = new Set<(event: BridgeEvent) => void>();

function getClient(): MqttClient {
  if (client) return client;
  if (!MQTT_HOST) {
    throw new Error("Aucun broker MQTT configuré (option 'mqtt_host' ou service MQTT).");
  }
  client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });
  client.on("connect", () => {
    client!.subscribe("zigbee2mqtt/bridge/devices");
    client!.subscribe("zigbee2mqtt/bridge/event");
  });
  client.on("message", (topic, payload) => {
    try {
      if (topic === "zigbee2mqtt/bridge/devices") {
        latestDevices = JSON.parse(payload.toString());
      } else if (topic === "zigbee2mqtt/bridge/event") {
        const event = JSON.parse(payload.toString()) as BridgeEvent;
        for (const listener of eventListeners) listener(event);
      }
    } catch {
      // Malformed/partial payload — ignore this message, keep the connection.
    }
  });
  return client;
}

export function getDevices(): ZigbeeDevice[] {
  getClient();
  return latestDevices;
}

export function onBridgeEvent(listener: (event: BridgeEvent) => void): () => void {
  getClient();
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function permitJoin(seconds: number): void {
  getClient().publish("zigbee2mqtt/bridge/request/permit_join", JSON.stringify({ time: seconds }));
}

export function renameDevice(from: string, to: string): void {
  getClient().publish("zigbee2mqtt/bridge/request/device/rename", JSON.stringify({ from, to }));
}
