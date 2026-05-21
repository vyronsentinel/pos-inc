import jwt from "jsonwebtoken";
import { readData } from "../db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const data = await readData();
    const user = data.users.find((item) => item.id === payload.userId && item.active);
    const business = user ? data.businesses.find((item) => item.id === user.businessId) : null;
    if (!user || !business) return res.status(401).json({ error: "User not found" });
    req.user = user;
    req.business = business;
    req.businessId = business.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permission" });
    next();
  };
}
