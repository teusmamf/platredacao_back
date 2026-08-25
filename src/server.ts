import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { essaysRouter } from "./routes/essays.js";
import { paymentsRouter } from "./routes/payments.js";
import { meRouter } from "./routes/me.js";
import { themesRouter } from "./routes/themes.js";

const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/essays", essaysRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/me", meRouter);
app.use("/api/themes", themesRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

app.listen(env.port, () => {
  console.log(`platredacao backend listening on port ${env.port}`);
});
