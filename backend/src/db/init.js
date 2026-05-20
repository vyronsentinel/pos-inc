import { readData, writeData } from "../db.js";

writeData(readData());
console.log("POS inc JSON database initialized.");
