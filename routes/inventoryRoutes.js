// routes/inventoryRoutes.js
import express from "express";
import {
  createItem,
  getItems,
  updateItem,
  deleteItem
} from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/", getItems);
router.post("/", createItem);
router.put("/:id", updateItem);
router.delete("/:id", deleteItem);

export default router;