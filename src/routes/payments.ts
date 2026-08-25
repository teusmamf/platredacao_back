import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createCheckoutPreference, handlePaymentNotification } from "../services/paymentService.js";

export const paymentsRouter = Router();

paymentsRouter.post("/create-preference", requireAuth, async (req, res) => {
  try {
    const { initPoint } = await createCheckoutPreference({
      userId: req.user!.id,
      email: req.user!.email,
    });
    res.json({ initPoint });
  } catch (err) {
    console.error("Failed to create MP preference", err);
    res.status(502).json({ error: "Failed to start checkout" });
  }
});

// Mercado Pago webhook — no auth (MP calls this directly). Verify by fetching the
// payment from MP's API using the id received, rather than trusting the payload body.
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id ?? req.query["data.id"];
    const type = req.body?.type ?? req.query.type;

    if (type !== "payment" || !paymentId) {
      return res.status(200).send("ignored");
    }

    await handlePaymentNotification(String(paymentId));
    res.status(200).send("ok");
  } catch (err) {
    console.error("Failed to process MP webhook", err);
    res.status(500).send("error");
  }
});
