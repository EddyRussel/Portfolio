import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({ status: "ok", postgres: "up", redis: "up" });
  } catch (err) {
    res.status(503).json({ status: "error", message: String(err) });
  }
});
