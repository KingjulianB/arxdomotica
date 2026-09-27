import { Router } from "express";
import "express-session";
import { InvalidCredentialsError, loginWithPassword } from "../ha/authApi.js";
import { createNonAdminUser } from "../ha/adminApi.js";
import { consumeInvite, createInvite, isInviteValid } from "../invites/store.js";

declare module "express-session" {
  interface SessionData {
    haAccessToken?: string;
    haRefreshToken?: string;
    username?: string;
  }
}

export const authRouter = Router();

authRouter.get("/invite/:code/valid", (req, res) => {
  res.json({ valid: isInviteValid(req.params.code) });
});

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
    return;
  }
  try {
    const tokens = await loginWithPassword(username, password);
    req.session.haAccessToken = tokens.accessToken;
    req.session.haRefreshToken = tokens.refreshToken;
    req.session.username = username;
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }
    console.error(err);
    res.status(502).json({ error: "Connexion à Home Assistant impossible." });
  }
});

authRouter.post("/register", async (req, res) => {
  const { inviteCode, name, username, password } = req.body ?? {};
  if (!inviteCode || !name || !username || !password) {
    res.status(400).json({ error: "Tous les champs sont requis." });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    return;
  }
  if (!consumeInvite(inviteCode)) {
    res.status(403).json({ error: "Lien d'invitation invalide ou déjà utilisé." });
    return;
  }
  try {
    await createNonAdminUser({ name, username, password });
    const tokens = await loginWithPassword(username, password);
    req.session.haAccessToken = tokens.accessToken;
    req.session.haRefreshToken = tokens.refreshToken;
    req.session.username = username;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Création du compte impossible. Contactez votre installateur." });
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get("/me", (req, res) => {
  res.json({ username: req.session.username ?? null });
});

// Installer-only: generates an invite link. Protected by the same admin
// token configured in the add-on options (shared-secret check — adequate for
// an MVP used by a single installer; revisit in the Phase 7 hardening pass).
authRouter.post("/admin/invites", (req, res) => {
  const providedToken = req.header("x-admin-token");
  if (!providedToken || providedToken !== process.env.HA_ADMIN_TOKEN) {
    res.status(401).json({ error: "Jeton admin invalide." });
    return;
  }
  const invite = createInvite(req.body?.note);
  res.json({ code: invite.code });
});
