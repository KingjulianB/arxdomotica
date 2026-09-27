import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getDevices, onBridgeEvent, permitJoin, renameDevice } from "../zigbee/mqttClient.js";

export const zigbeeRouter = Router();
zigbeeRouter.use(requireAuth);

function handleError(res: import("express").Response, err: unknown) {
  console.error(err);
  res.status(502).json({ error: "MQTT / Zigbee2MQTT indisponible." });
}

zigbeeRouter.get("/devices", (_req, res) => {
  try {
    res.json(getDevices());
  } catch (err) {
    handleError(res, err);
  }
});

zigbeeRouter.post("/permit-join", (req, res) => {
  const seconds = Number(req.body?.seconds ?? 120);
  try {
    permitJoin(seconds);
    res.json({ ok: true, seconds });
  } catch (err) {
    handleError(res, err);
  }
});

zigbeeRouter.post("/devices/:ieee/rename", (req, res) => {
  const { name } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "Le nom est requis." });
    return;
  }
  try {
    renameDevice(req.params.ieee, name);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// Server-Sent Events stream of bridge events (device_joined, device_interview,
// device_leave, device_announce) so the pairing wizard can show live progress
// without polling.
zigbeeRouter.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = onBridgeEvent((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    unsubscribe();
  });
});
