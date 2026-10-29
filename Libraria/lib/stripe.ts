import Stripe from "stripe";

export function getStripe() {
  const apiKey = process.env.STRIPE_API_SECRET_KEY;
  if (!apiKey) throw new Error("Stripe is not configured.");
  return new Stripe(apiKey, {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  });
}
