import express from "express";
import { z } from "zod";
import { mutateData, nowIso, randomId } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const syncRouter = express.Router();
syncRouter.use(requireAuth);

syncRouter.post("/", async (req, res) => {
  const parsed = z.object({
    events: z.array(z.object({
      type: z.string(),
      payload: z.unknown()
    })).default([])
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await mutateData((draft) => {
    for (const event of parsed.data.events) {
      draft.syncEvents.push({
        id: randomId("syn"),
        businessId: req.businessId,
        userId: req.user.id,
        type: event.type,
        payload: event.payload,
        createdAt: nowIso()
      });
    }
  });
  res.json({ accepted: parsed.data.events.length });
});
