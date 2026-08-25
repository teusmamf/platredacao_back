import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAccess } from "../middleware/requireAccess.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const themesRouter = Router();

themesRouter.get("/", requireAuth, requireAccess, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("essay_themes")
    .select("id, title, description, motivational_texts")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to load themes" });
  res.json(data);
});
