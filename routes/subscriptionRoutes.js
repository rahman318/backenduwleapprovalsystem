import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/save-subscription", async (req, res) => {
  try {
    console.log("📥 Incoming subscription body:", req.body);

    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ msg: "Missing userId or subscription" });
    }

    const subDoc = await Subscription.findOneAndUpdate(
      { userId },
      { subscription },
      { upsert: true, new: true }
    );

    console.log("✅ Subscription saved/updated:", subDoc._id);

    res.status(201).json({ msg: "Subscription saved", data: subDoc });
  } catch (err) {
    console.error("❌ Save subscription error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

export default router;
