import express from "express";
import {
  getTicker,
  addTicker,
  deleteTicker,
} from "../controllers/tickerController.js";

const router = express.Router();

router.get("/", getTicker);
router.post("/", addTicker);
router.delete("/:id", deleteTicker);

export default router;