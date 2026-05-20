import express from "express";
import { z } from "zod";
import { mutateData, nowIso, randomId, readData } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const productsRouter = express.Router();
productsRouter.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().default("General"),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(5)
});

productsRouter.get("/", (req, res) => {
  const products = readData().products
    .filter((item) => item.businessId === req.businessId && !item.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ products });
});

productsRouter.post("/", requireRole("owner", "manager"), (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const now = nowIso();
  const product = { id: randomId("prd"), businessId: req.businessId, ...parsed.data, createdAt: now, updatedAt: now };
  mutateData((draft) => {
    if (draft.products.some((item) => item.businessId === req.businessId && item.sku === product.sku && !item.deletedAt)) {
      throw new Error("SKU already exists");
    }
    draft.products.push(product);
  });
  res.status(201).json({ product });
});

productsRouter.put("/:id", requireRole("owner", "manager"), (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  let updated;
  mutateData((draft) => {
    const product = draft.products.find((item) => item.id === req.params.id && item.businessId === req.businessId && !item.deletedAt);
    if (!product) return;
    Object.assign(product, parsed.data, { updatedAt: nowIso() });
    updated = product;
  });
  if (!updated) return res.status(404).json({ error: "Product not found" });
  res.json({ product: updated });
});

productsRouter.delete("/:id", requireRole("owner", "manager"), (req, res) => {
  mutateData((draft) => {
    const product = draft.products.find((item) => item.id === req.params.id && item.businessId === req.businessId);
    if (product) Object.assign(product, { deletedAt: nowIso(), updatedAt: nowIso() });
  });
  res.status(204).end();
});
