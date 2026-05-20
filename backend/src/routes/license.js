import express from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";
import { getPlan } from "../plans.js";
import { addDays } from "../utils.js";

export const licenseRouter = express.Router();

licenseRouter.get("/", requireAuth, (req, res) => {
  const plan = getPlan(req.business.plan);
  const active = req.business.subscriptionStatus === "active" || new Date(req.business.trialEndsAt) > new Date();
  const expiresAt = addDays(new Date(), active ? 14 : 1).toISOString();
  const licenseToken = jwt.sign({
    businessId: req.business.id,
    plan: req.business.plan,
    status: req.business.subscriptionStatus,
    features: plan.features,
    expiresAt
  }, process.env.LICENSE_SECRET, { expiresIn: active ? "14d" : "1d" });

  res.json({
    business: req.business,
    license: { token: licenseToken, features: plan.features, expiresAt, active }
  });
});
