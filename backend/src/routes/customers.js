import express from "express";
import { z } from "zod";
import { mutateData, nowIso, randomId, readData } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const customersRouter = express.Router();
customersRouter.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().default(""),
  email: z.string().default("")
});

customersRouter.get("/", (req, res) => {
  const customers = readData().customers
    .filter((item) => item.businessId === req.businessId && !item.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ customers });
});

customersRouter.post("/", (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const now = nowIso();
  const customer = { id: randomId("cus"), businessId: req.businessId, visits: 0, totalSpent: 0, ...parsed.data, createdAt: now, updatedAt: now };
  mutateData((draft) => draft.customers.push(customer));
  res.status(201).json({ customer });
});

customersRouter.put("/:id", (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  let updated;
  mutateData((draft) => {
    const customer = draft.customers.find((item) => item.id === req.params.id && item.businessId === req.businessId && !item.deletedAt);
    if (!customer) return;
    Object.assign(customer, parsed.data, { updatedAt: nowIso() });
    updated = customer;
  });
  if (!updated) return res.status(404).json({ error: "Customer not found" });
  res.json({ customer: updated });
});

customersRouter.delete("/:id", (req, res) => {
  mutateData((draft) => {
    const customer = draft.customers.find((item) => item.id === req.params.id && item.businessId === req.businessId);
    if (customer) Object.assign(customer, { deletedAt: nowIso(), updatedAt: nowIso() });
  });
  res.status(204).end();
});
