import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

// Save new subscription
router.post("/save-subscription", async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    // check duplicate subscription
    const exist = await Subscription.findOne({ "subscription.endpoint": subscription.endpoint });
    if (exist) return res.status(200).json({ success: true, message: "Already subscribed" });

    const newSub = new Subscription({ subscription, userId });
    await newSub.save();

    res.status(200).json({ success: true, message: "Subscription saved" });
  } catch (err) {
    console.error("Save subscription error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;