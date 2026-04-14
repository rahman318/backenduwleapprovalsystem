import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/save-subscription", async (req, res) => {
  console.log("====================================");
  console.log("🔥 HIT SAVE SUBSCRIPTION ROUTE");
  console.log("📅 TIME:", new Date().toISOString());

  try {
    const { userId, role, deviceId, subscription } = req.body || {};

    console.log("👤 USER ID:", userId);
    console.log("🎭 ROLE:", role);
    console.log("📱 DEVICE ID:", deviceId);
    console.log("🔔 SUBSCRIPTION:", subscription);

    // ❌ VALIDATION
    if (!userId || !role || !deviceId || !subscription) {
      console.log("❌ Missing required fields");

      return res.status(400).json({
        error: "userId, role, deviceId, subscription required"
      });
    }

    console.log("💾 UPSERTING INTO MONGODB...");

    // 🔥 PRO FIX: UPSERT (NO DUPLICATE)
    const saved = await Subscription.findOneAndUpdate(
      { userId, role, deviceId },
      {
        userId,
        role,
        deviceId,
        subscription
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log("✅ SAVED SUCCESS:");
    console.log(saved);

    console.log("====================================");

    res.status(200).json({
      message: "Subscription saved successfully",
      data: saved
    });

  } catch (err) {
    console.log("💀 MONGODB ERROR:");
    console.log(err.message);

    console.log("====================================");

    res.status(500).json({
      error: err.message
    });
  }
});

export default router;
