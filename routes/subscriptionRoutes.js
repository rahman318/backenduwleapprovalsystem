import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/save", async (req, res) => {
  try {
    console.log("📥 Incoming subscription body:", req.body); // <-- tambah log sini

    const subscription = req.body;
    if (!subscription) return res.status(400).json({ msg: "No subscription sent" });

    // Save subscription ke DB
    const subDoc = new Subscription({ subscription });
    await subDoc.save();

    console.log("✅ Subscription saved to DB:", subDoc._id);

    res.status(201).json({ msg: "Subscription saved" });
  } catch (err) {
    console.error("❌ Save subscription error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

export default router;
