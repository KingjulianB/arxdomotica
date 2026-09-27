import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { alarmoRouter } from "./routes/alarmo.js";
import { zigbeeRouter } from "./routes/zigbee.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.INGRESS_PORT ?? 8099);

app.use(express.json());
app.use(
  session({
    secret: process.env.ARX_SESSION_SECRET ?? "arxdomotica-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/alarmo", alarmoRouter);
app.use("/api/zigbee", zigbeeRouter);

const webDist = path.join(__dirname, "..", "..", "web", "dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(port, () => {
  console.log(`Arxdomotica server listening on port ${port}`);
});
