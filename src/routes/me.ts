import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, has_access, created_at")
    .eq("id", req.user!.id)
    .single();

  if (error || !data) return res.status(404).json({ error: "Profile not found" });
  res.json(data);
});
