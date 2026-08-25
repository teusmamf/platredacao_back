import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { env } from "../config/env.js";

const client = new MercadoPagoConfig({ accessToken: env.mpAccessToken });

export const mpPreference = new Preference(client);
export const mpPayment = new Payment(client);
