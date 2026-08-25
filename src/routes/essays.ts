import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAccess } from "../middleware/requireAccess.js";
import { supabaseAdmin, ESSAY_IMAGES_BUCKET } from "../lib/supabaseAdmin.js";
import { transcribeHandwrittenEssay } from "../services/ocrService.js";
import { correctEssay } from "../services/essayCorrectionService.js";

export const essaysRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

essaysRouter.use(requireAuth, requireAccess);

essaysRouter.post("/extract-text", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Missing image file (field name: image)" });
  }

  const userId = req.user!.id;
  const extension = req.file.mimetype.split("/")[1] ?? "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;

  try {
    const [text, uploadResult] = await Promise.all([
      transcribeHandwrittenEssay({ buffer: req.file.buffer, mimeType: req.file.mimetype }),
      supabaseAdmin.storage
        .from(ESSAY_IMAGES_BUCKET)
        .upload(path, req.file.buffer, { contentType: req.file.mimetype }),
    ]);

    if (uploadResult.error) throw uploadResult.error;

    const { data: publicUrl } = supabaseAdmin.storage.from(ESSAY_IMAGES_BUCKET).getPublicUrl(path);

    res.json({ text, imageUrl: publicUrl.publicUrl });
  } catch (err) {
    console.error("extract-text failed", err);
    res.status(502).json({ error: "Failed to transcribe image. Try a clearer photo." });
  }
});

const createEssaySchema = z.object({
  themeId: z.string().uuid().nullable().optional(),
  themeTitle: z.string().min(3),
  themeDescription: z.string().nullable().optional(),
  essayText: z.string().min(200, "Texto muito curto para uma redação"),
  inputType: z.enum(["text", "image"]),
  imageUrl: z.string().url().nullable().optional(),
});

essaysRouter.post("/", async (req, res) => {
  const parsed = createEssaySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { themeId, themeTitle, themeDescription, essayText, inputType, imageUrl } = parsed.data;
  const userId = req.user!.id;

  const { data: essay, error: insertError } = await supabaseAdmin
    .from("essays")
    .insert({
      user_id: userId,
      theme_id: themeId ?? null,
      input_type: inputType,
      image_url: imageUrl ?? null,
      submitted_text: essayText,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !essay) {
    console.error("Failed to insert essay", insertError);
    return res.status(500).json({ error: "Failed to save essay" });
  }

  try {
    const correction = await correctEssay({
      themeTitle,
      themeDescription,
      essayText,
    });

    const { error: correctionError } = await supabaseAdmin.from("essay_corrections").insert({
      essay_id: essay.id,
      total_score: correction.totalScore,
      competencies: correction.competencies,
      general_feedback: correction.generalFeedback,
      highlights: correction.highlights,
      next_steps: correction.nextSteps,
      corrected_essay: correction.correctedEssay,
    });

    if (correctionError) throw correctionError;

    await supabaseAdmin.from("essays").update({ status: "corrected" }).eq("id", essay.id);

    res.status(201).json({
      essayId: essay.id,
      totalScore: correction.totalScore,
      competencies: correction.competencies,
      generalFeedback: correction.generalFeedback,
      highlights: correction.highlights,
      nextSteps: correction.nextSteps,
      correctedEssay: correction.correctedEssay,
    });
  } catch (err) {
    console.error("Correction failed", err);
    await supabaseAdmin.from("essays").update({ status: "error" }).eq("id", essay.id);
    res.status(502).json({ error: "Failed to correct essay. Please try again." });
  }
});

essaysRouter.get("/", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("essays")
    .select("id, theme_id, input_type, status, created_at, essay_corrections(total_score)")
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list essays", error);
    return res.status(500).json({ error: "Failed to load essays" });
  }
  res.json(data);
});

essaysRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("essays")
    .select("*, essay_corrections(*), essay_themes(title, description)")
    .eq("id", req.params.id)
    .eq("user_id", req.user!.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Essay not found" });
  }
  res.json(data);
});
