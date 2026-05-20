import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_PATH || "./data/pos-inc.json";
const resolvedPath = path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const emptyData = {
  businesses: [],
  users: [],
  products: [],
  customers: [],
  sales: [],
  saleItems: [],
  syncEvents: []
};

if (!fs.existsSync(resolvedPath)) {
  fs.writeFileSync(resolvedPath, JSON.stringify(emptyData, null, 2));
}

export function readData() {
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return { ...emptyData, ...parsed };
}

export function writeData(data) {
  fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2));
}

export function mutateData(mutator) {
  const data = readData();
  const result = mutator(data);
  writeData(data);
  return result;
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
