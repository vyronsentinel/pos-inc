import bcrypt from "bcryptjs";
import express from "express";
import { z } from "zod";
import { mutateData, nowIso, randomId, readData } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usersRouter = express.Router();
usersRouter.use(requireAuth);

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["owner", "manager", "cashier"])
});

usersRouter.get("/", requireRole("owner", "manager"), (req, res) => {
  const users = readData().users
    .filter((item) => item.businessId === req.businessId)
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ users });
});

usersRouter.post("/", requireRole("owner"), (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const now = nowIso();
  const user = {
    id: randomId("usr"),
    businessId: req.businessId,
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: bcrypt.hashSync(parsed.data.password, 12),
    role: parsed.data.role,
    active: true,
    createdAt: now,
    updatedAt: now
  };
  mutateData((draft) => draft.users.push(user));
  res.status(201).json({ user: publicUser(user) });
});

usersRouter.patch("/:id", requireRole("owner"), (req, res) => {
  const parsed = z.object({ active: z.boolean().optional(), role: z.enum(["owner", "manager", "cashier"]).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  let updated;
  mutateData((draft) => {
    const user = draft.users.find((item) => item.id === req.params.id && item.businessId === req.businessId);
    if (!user) return;
    Object.assign(user, parsed.data, { updatedAt: nowIso() });
    updated = publicUser(user);
  });
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json({ user: updated });
});

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
