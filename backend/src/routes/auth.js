import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { mutateData, nowIso, randomId, readData } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays } from "../utils.js";

export const authRouter = express.Router();

const registerSchema = z.object({
  businessName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  plan: z.enum(["starter", "pro", "business"]).default("pro")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;
  const data = readData();
  if (data.users.some((user) => user.email === input.email)) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const now = nowIso();
  const businessId = randomId("biz");
  const userId = randomId("usr");

  mutateData((draft) => {
    draft.businesses.push({
      id: businessId,
      name: input.businessName,
      ownerEmail: input.email,
      plan: input.plan,
      subscriptionStatus: "trial",
      trialEndsAt: addDays(new Date(), 14).toISOString(),
      createdAt: now,
      updatedAt: now
    });
    draft.users.push({
      id: userId,
      businessId,
      name: input.ownerName,
      email: input.email,
      passwordHash: bcrypt.hashSync(input.password, 12),
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now
    });
    draft.customers.push({
      id: randomId("cus"),
      businessId,
      name: "Walk-in Customer",
      phone: "",
      email: "",
      visits: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now
    });
  });

  res.status(201).json({
    token: signAccessToken(userId, businessId),
    user: { id: userId, businessId, name: input.ownerName, email: input.email, role: "owner" }
  });
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = readData();
  const user = data.users.find((item) => item.email === parsed.data.email && item.active);
  if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signAccessToken(user.id, user.businessId), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), business: req.business });
});

function signAccessToken(userId, businessId) {
  return jwt.sign({ userId, businessId }, process.env.JWT_SECRET, { expiresIn: "12h" });
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
