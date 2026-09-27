import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Persisted under Home Assistant's add-on data volume (/data) so invites
// survive add-on restarts/updates.
const DATA_DIR = process.env.ARX_DATA_DIR ?? path.join(process.cwd(), "data");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

interface Invite {
  code: string;
  createdAt: string;
  usedAt: string | null;
  note?: string;
}

function loadInvites(): Invite[] {
  if (!existsSync(INVITES_FILE)) return [];
  return JSON.parse(readFileSync(INVITES_FILE, "utf-8")) as Invite[];
}

function saveInvites(invites: Invite[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(INVITES_FILE, JSON.stringify(invites, null, 2));
}

export function createInvite(note?: string): Invite {
  const invites = loadInvites();
  const invite: Invite = {
    code: randomBytes(9).toString("base64url"),
    createdAt: new Date().toISOString(),
    usedAt: null,
    note,
  };
  invites.push(invite);
  saveInvites(invites);
  return invite;
}

export function isInviteValid(code: string): boolean {
  return loadInvites().some((invite) => invite.code === code && !invite.usedAt);
}

export function consumeInvite(code: string): boolean {
  const invites = loadInvites();
  const invite = invites.find((i) => i.code === code && !i.usedAt);
  if (!invite) return false;
  invite.usedAt = new Date().toISOString();
  saveInvites(invites);
  return true;
}
