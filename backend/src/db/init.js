import { initDb, readData, writeData } from "../db.js";

await initDb();
await writeData(await readData());
console.log("POS inc database initialized.");
