import { mpPayment, mpPreference } from "../lib/mercadopago.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { env } from "../config/env.js";

const PRODUCT_PRICE_BRL = 39.9;
const PRODUCT_TITLE = "Redação Nota Mil - Correção ENEM 2026";

// Mercado Pago rejeita auto_return quando o domínio de back_urls.success não é
// resolvível publicamente (ex.: localhost) — em dev local, omitimos auto_return
// e o comprador volta pelo botão exibido na página do MP em vez do redirect automático.
const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.frontendUrl);

export async function createCheckoutPreference(params: { userId: string; email: string | null }) {
  const { userId, email } = params;

  const preference = await mpPreference.create({
    body: {
      items: [
        {
          id: "redacao-nota-mil-correcao",
          title: PRODUCT_TITLE,
          quantity: 1,
          unit_price: PRODUCT_PRICE_BRL,
          currency_id: "BRL",
        },
      ],
      payer: email ? { email } : undefined,
      external_reference: userId,
      back_urls: {
        success: `${env.frontendUrl}/checkout/sucesso`,
        pending: `${env.frontendUrl}/checkout/pendente`,
        failure: `${env.frontendUrl}/checkout`,
      },
      ...(isLocalFrontend ? {} : { auto_return: "approved" as const }),
      notification_url: env.backendPublicUrl ? `${env.backendPublicUrl}/api/payments/webhook` : undefined,
    },
  });

  return { initPoint: preference.init_point };
}

export async function handlePaymentNotification(paymentId: string) {
  const payment = await mpPayment.get({ id: paymentId });

  const userId = payment.external_reference;
  if (!userId) {
    throw new Error(`Payment ${paymentId} has no external_reference (user id)`);
  }

  await supabaseAdmin.from("payments").upsert(
    {
      external_id: String(payment.id),
      user_id: userId,
      provider: "mercadopago",
      status: payment.status ?? "unknown",
      amount: payment.transaction_amount ?? null,
      raw_payload: payment as unknown as Record<string, unknown>,
    },
    { onConflict: "external_id" }
  );

  if (payment.status === "approved") {
    await supabaseAdmin.from("profiles").update({ has_access: true }).eq("id", userId);
  }

  return { userId, status: payment.status };
}
