import { getHaSocket } from "../ha/socket.js";

// CONFIRMED (custom_components/alarmo/services.yaml): the only real Alarmo HA
// services. Called via the public `call_service` WS command.
export type AlarmoAction = "arm" | "disarm" | "skip_delay" | "enable_user" | "disable_user";

export async function callAlarmoService(
  action: AlarmoAction,
  serviceData: Record<string, unknown> = {}
): Promise<void> {
  const sock = getHaSocket();
  await sock.send({
    type: "call_service",
    domain: "alarmo",
    service: action,
    service_data: serviceData,
  });
}

// UNVERIFIED custom WS commands (docs/discovery.md §5) — Alarmo's own
// Lovelace card uses these; they are not part of HA's public WS API, so field
// names and any admin-requirement need live confirmation before shipping.

export interface AlarmoUser {
  user_id?: string;
  name: string;
  code?: string;
  old_code?: string;
  enabled?: boolean;
  can_arm?: boolean;
  can_disarm?: boolean;
  is_override_code?: boolean;
  area_limit?: string[];
}

export function getUsers(): Promise<AlarmoUser[]> {
  return getHaSocket().send<AlarmoUser[]>({ type: "alarmo/users" });
}

export function saveUser(user: AlarmoUser): Promise<void> {
  return getHaSocket().send({ type: "alarmo/users", ...user });
}

export function deleteUser(userId: string): Promise<void> {
  return getHaSocket().send({ type: "alarmo/users", user_id: userId, remove: true });
}

export interface AlarmoAutomation {
  automation_id?: string;
  name: string;
  type?: string;
  triggers: unknown[];
  actions: unknown[];
  enabled?: boolean;
}

export function getAutomations(): Promise<AlarmoAutomation[]> {
  return getHaSocket().send<AlarmoAutomation[]>({ type: "alarmo/automations" });
}

export function saveAutomation(automation: AlarmoAutomation): Promise<void> {
  return getHaSocket().send({ type: "alarmo/automations", ...automation });
}

export function deleteAutomation(automationId: string): Promise<void> {
  return getHaSocket().send({
    type: "alarmo/automations",
    automation_id: automationId,
    remove: true,
  });
}

// Higher-level helper: a simple weekly time-based arm/disarm schedule entry
// built on saveAutomation(). The exact trigger/action shape is a best guess
// pending live verification (docs/discovery.md §5/§7) — confirm it actually
// arms/disarms as expected on a real install before relying on it.
export interface ScheduleEntry {
  automation_id?: string;
  name: string;
  time: string; // "HH:MM"
  weekdays: string[]; // e.g. ["mon", "tue", ...]
  mode: "arm" | "disarm";
  armMode?: string; // e.g. "away", "home" — only used when mode === "arm"
}

export function saveSchedule(entry: ScheduleEntry): Promise<void> {
  return saveAutomation({
    automation_id: entry.automation_id,
    name: entry.name,
    type: "schedule",
    enabled: true,
    triggers: [{ platform: "time", at: entry.time, weekday: entry.weekdays }],
    actions: [
      entry.mode === "arm"
        ? { service: "alarmo.arm", data: { mode: entry.armMode ?? "away" } }
        : { service: "alarmo.disarm", data: {} },
    ],
  });
}
