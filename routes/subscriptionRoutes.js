import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/subscription", async (req, res) => {
  console.log("====================================");
  console.log("🔥 HIT SAVE SUBSCRIPTION ROUTE");
  console.log("📅 TIME:", new Date().toISOString());

  console.log("📥 HEADERS:", req.headers);
  console.log("📦 BODY RAW:", req.body);

  const { userId, subscription } = req.body || {};

  console.log("👤 USER ID:", userId);
  console.log("🔔 SUBSCRIPTION:", subscription);

  if (!userId) {
    console.log("❌ ERROR: userId missing");
  }

  if (!subscription) {
    console.log("❌ ERROR: subscription missing");
  }

  try {
    console.log("💾 TRYING TO SAVE INTO MONGODB...");

    const saved = await Subscription.create({
      userId,
      subscription,
    });

    console.log("✅ SUCCESS SAVED TO DB:");
    console.log(saved);

    console.log("====================================");

    res.status(200).json({
      message: "Saved successfully",
      data: saved,
    });
  } catch (err) {
    console.log("💀 MONGODB ERROR:");
    console.log(err);
    console.log("====================================");

    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
