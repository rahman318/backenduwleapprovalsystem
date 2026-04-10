import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/save-subscription", async (req, res) => {
  try {
    console.log("🔥 API HIT SAVE SUBSCRIPTION");
    console.log("📦 FULL BODY:", req.body);

    const { userId, subscription } = req.body;

    console.log("👤 userId:", userId);
    console.log("📡 subscription:", subscription);

    if (!userId || !subscription) {
      console.log("❌ Missing data");
      return res.status(400).json({ msg: "Missing userId or subscription" });
    }

    const subDoc = await Subscription.findOneAndUpdate(
      { userId },
      { subscription },
      { upsert: true, new: true }
    );

    console.log("✅ SAVED DOC:", subDoc);

    res.status(201).json({ msg: "Subscription saved", data: subDoc });

  } catch (err) {
    console.error("❌ ERROR SAVE SUB:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

export default router;
