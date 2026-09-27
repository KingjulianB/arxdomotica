import { getHaSocket } from "./socket.js";

// UNVERIFIED: config/auth/* and config/auth_provider/homeassistant/* are
// internal, undocumented Home Assistant frontend commands (see
// docs/discovery.md §4). Command names/fields below are the best-known shape
// but MUST be confirmed against a real HA instance before this is trusted in
// production — wrap callers so a failure here surfaces clearly rather than
// silently creating a broken account.

export interface CreateNonAdminUserInput {
  name: string;
  username: string;
  password: string;
}

export async function createNonAdminUser(
  input: CreateNonAdminUserInput
): Promise<{ userId: string }> {
  const sock = getHaSocket();

  // Step 1: create the user record. group_ids intentionally omits any admin
  // group so this can never produce an administrator account.
  const created = await sock.send<{ user: { id: string } }>({
    type: "config/auth/create",
    name: input.name,
    group_ids: ["system-users"],
  });

  // Step 2: attach a username/password credential via the local
  // "homeassistant" auth provider so the user can log in.
  await sock.send({
    type: "config/auth_provider/homeassistant/create",
    user_id: created.user.id,
    username: input.username,
    password: input.password,
  });

  return { userId: created.user.id };
}
