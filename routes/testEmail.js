import express from "express";
import { sendEmail } from "../utils/emailService.js";

const router = express.Router();

router.get("/test-email", async (req, res) => {
  try {
    await sendEmail("frozenluv27@gmail.com", "Test Emel", "<h3>Testing emel bosskurrr 🔥</h3>");
    res.send("✅ Emel test dah dihantar bosskurrr!");
  } catch (err) {
    res.status(500).send("❌ Ralat hantar emel: " + err.message);
  }
});


export default router;
