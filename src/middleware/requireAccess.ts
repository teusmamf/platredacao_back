import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export async function requireAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("has_access")
    .eq("id", req.user.id)
    .single();

  if (error || !data?.has_access) {
    return res.status(403).json({ error: "Access not active. Complete checkout to continue." });
  }

  next();
}
