import express from "express";
import { mutateData, nowIso } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const paypalRouter = express.Router();

const paypalBaseUrl = (process.env.PAYPAL_ENVIRONMENT || "sandbox") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const paymentLinks = {
  starter: process.env.PAYPAL_STARTER_PAYMENT_LINK,
  pro: process.env.PAYPAL_PRO_PAYMENT_LINK,
  business: process.env.PAYPAL_BUSINESS_PAYMENT_LINK
};

const planIds = {
  starter: process.env.PAYPAL_STARTER_PLAN_ID,
  pro: process.env.PAYPAL_PRO_PLAN_ID,
  business: process.env.PAYPAL_BUSINESS_PLAN_ID
};

paypalRouter.get("/status", requireAuth, (_req, res) => {
  res.json({
    environment: process.env.PAYPAL_ENVIRONMENT || "sandbox",
    configured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    hasPlanIds: {
      starter: Boolean(planIds.starter),
      pro: Boolean(planIds.pro),
      business: Boolean(planIds.business)
    },
    hasPaymentLinks: {
      starter: Boolean(paymentLinks.starter),
      pro: Boolean(paymentLinks.pro),
      business: Boolean(paymentLinks.business)
    }
  });
});

paypalRouter.post("/checkout-link", requireAuth, (req, res) => {
  const plan = req.body?.plan || req.business.plan || "pro";
  const planId = planIds[plan];
  if (planId) {
    return res.json({
      plan,
      mode: "subscription",
      createSubscriptionEndpoint: "/api/paypal/create-subscription"
    });
  }
  const paymentLink = paymentLinks[plan];
  if (!paymentLink) return res.status(400).json({ error: `Missing PayPal payment link for ${plan}` });
  res.json({ plan, mode: "payment_link", paymentLink });
});

paypalRouter.post("/create-subscription", requireAuth, async (req, res) => {
  const plan = req.body?.plan || req.business.plan || "pro";
  const planId = planIds[plan];
  if (!planId) return res.status(400).json({ error: `Missing PayPal subscription plan ID for ${plan}. Payment links cannot auto-charge after a 14-day trial.` });

    const rawFrontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
    const frontendUrl = rawFrontendUrl.endsWith("/") ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;

    try {
      const accessToken = await getPayPalAccessToken();
      const response = await fetch(`${paypalBaseUrl}/v1/billing/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: req.businessId,
          application_context: {
            brand_name: "POS inc",
            user_action: "SUBSCRIBE_NOW",
            return_url: `${frontendUrl}/?paypal=success`,
            cancel_url: `${frontendUrl}/?paypal=cancel`
          }
        })
      });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json(payload);
    const approveLink = payload.links?.find((link) => link.rel === "approve")?.href;
    res.json({ plan, subscription: payload, approveLink });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

paypalRouter.post("/mock-activate", requireAuth, async (req, res) => {
  await mutateData((draft) => {
    const business = draft.businesses.find((item) => item.id === req.businessId);
    if (business) Object.assign(business, { subscriptionStatus: "active", updatedAt: nowIso() });
  });
  res.json({ ok: true });
});

paypalRouter.post("/webhook", express.json({ type: "*/*" }), async (req, res) => {
  // TODO: verify PayPal webhook signature before trusting events in production.
  const eventType = req.body?.event_type;
  const resource = req.body?.resource;

  if (["BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"].includes(eventType)) {
    const businessId = resource?.custom_id;
    if (businessId) {
      await mutateData((draft) => {
        const business = draft.businesses.find((item) => item.id === businessId);
        if (business) Object.assign(business, { subscriptionStatus: "active", updatedAt: nowIso() });
      });
    }
  }

  if (["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED"].includes(eventType)) {
    const businessId = resource?.custom_id;
    if (businessId) {
      await mutateData((draft) => {
        const business = draft.businesses.find((item) => item.id === businessId);
        if (business) Object.assign(business, { subscriptionStatus: "canceled", updatedAt: nowIso() });
      });
    }
  }

  res.json({ received: true });
});

async function getPayPalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal client ID and secret are not configured");
  }
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Could not get PayPal access token");
  return payload.access_token;
}
