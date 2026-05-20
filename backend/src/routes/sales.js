import express from "express";
import { z } from "zod";
import { mutateData, nowIso, randomId, readData } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const salesRouter = express.Router();
salesRouter.use(requireAuth);

const saleSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentType: z.string().min(1),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  lines: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
    lineTotal: z.number().nonnegative()
  })).min(1)
});

salesRouter.get("/", (req, res) => {
  const data = readData();
  const sales = data.sales
    .filter((item) => item.businessId === req.businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 500)
    .map((sale) => ({ ...sale, lines: data.saleItems.filter((item) => item.saleId === sale.id) }));
  res.json({ sales });
});

salesRouter.post("/", (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;
  const saleId = randomId("sal");
  const now = nowIso();
  let sale;

  try {
    mutateData((draft) => {
      for (const line of input.lines) {
        const product = draft.products.find((item) => item.id === line.productId && item.businessId === req.businessId && !item.deletedAt);
        if (!product) throw new Error(`Product not found: ${line.name}`);
        if (product.stock < line.qty) throw new Error(`Insufficient stock for ${line.name}`);
      }

      sale = {
        id: saleId,
        businessId: req.businessId,
        customerId: input.customerId || null,
        cashierId: req.user.id,
        cashierName: req.user.name,
        paymentType: input.paymentType,
        status: "completed",
        subtotal: input.subtotal,
        discount: input.discount,
        tax: input.tax,
        total: input.total,
        createdAt: now,
        updatedAt: now
      };
      draft.sales.push(sale);

      for (const line of input.lines) {
        draft.saleItems.push({ id: randomId("sit"), saleId, ...line });
        const product = draft.products.find((item) => item.id === line.productId);
        product.stock -= line.qty;
        product.updatedAt = now;
      }

      if (input.customerId) {
        const customer = draft.customers.find((item) => item.id === input.customerId && item.businessId === req.businessId);
        if (customer) {
          customer.visits += 1;
          customer.totalSpent += input.total;
          customer.updatedAt = now;
        }
      }
    });
    res.status(201).json({ sale: { ...sale, lines: input.lines } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

salesRouter.post("/:id/refund", requireRole("owner", "manager"), (req, res) => {
  let refundedSale;
  mutateData((draft) => {
    const sale = draft.sales.find((item) => item.id === req.params.id && item.businessId === req.businessId);
    if (!sale || sale.status === "refunded") return;
    const lines = draft.saleItems.filter((item) => item.saleId === sale.id);
    for (const line of lines) {
      const product = draft.products.find((item) => item.id === line.productId && item.businessId === req.businessId);
      if (product) {
        product.stock += line.qty;
        product.updatedAt = nowIso();
      }
    }
    const customer = draft.customers.find((item) => item.id === sale.customerId && item.businessId === req.businessId);
    if (customer) {
      customer.totalSpent = Math.max(0, customer.totalSpent - sale.total);
      customer.updatedAt = nowIso();
    }
    Object.assign(sale, { status: "refunded", refundedAt: nowIso(), refundedBy: req.user.name, updatedAt: nowIso() });
    refundedSale = { ...sale, lines };
  });
  if (!refundedSale) return res.status(404).json({ error: "Sale not found or already refunded" });
  res.json({ sale: refundedSale });
});
