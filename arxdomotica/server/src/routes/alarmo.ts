import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  callAlarmoService,
  deleteAutomation,
  deleteUser,
  getAutomations,
  getUsers,
  saveSchedule,
  saveUser,
} from "../alarmo/api.js";

export const alarmoRouter = Router();
alarmoRouter.use(requireAuth);

function handleError(res: import("express").Response, err: unknown) {
  console.error(err);
  res.status(502).json({ error: "Communication avec Alarmo impossible." });
}

// Confirmed, low-risk actions (real HA services — see alarmo/api.ts).
alarmoRouter.post("/arm", async (req, res) => {
  try {
    await callAlarmoService("arm", { mode: req.body?.mode ?? "away" });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

alarmoRouter.post("/disarm", async (req, res) => {
  try {
    await callAlarmoService("disarm", {});
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// Users / codes ("mot de passe" de l'alarme) — UNVERIFIED WS commands, see
// docs/discovery.md §5.
alarmoRouter.get("/users", async (_req, res) => {
  try {
    res.json(await getUsers());
  } catch (err) {
    handleError(res, err);
  }
});

alarmoRouter.post("/users", async (req, res) => {
  const { user_id, name, code, old_code, can_arm, can_disarm } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "Le nom est requis." });
    return;
  }
  try {
    await saveUser({ user_id, name, code, old_code, can_arm, can_disarm });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

alarmoRouter.delete("/users/:id", async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// Horaires d'armement/désarmement — UNVERIFIED WS commands, see
// docs/discovery.md §5/§7.
alarmoRouter.get("/schedule", async (_req, res) => {
  try {
    const automations = await getAutomations();
    res.json(automations.filter((a) => a.type === "schedule"));
  } catch (err) {
    handleError(res, err);
  }
});

alarmoRouter.post("/schedule", async (req, res) => {
  const { automation_id, name, time, weekdays, mode, armMode } = req.body ?? {};
  if (!name || !time || !Array.isArray(weekdays) || !mode) {
    res.status(400).json({ error: "Nom, heure, jours et mode sont requis." });
    return;
  }
  try {
    await saveSchedule({ automation_id, name, time, weekdays, mode, armMode });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

alarmoRouter.delete("/schedule/:id", async (req, res) => {
  try {
    await deleteAutomation(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});
