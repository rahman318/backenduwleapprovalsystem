// backend/routes/requestRoutes.js
import express from "express";
import upload from "../Middleware/upload.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import Request from "../models/Requests.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";

import {
  createRequest,
  getRequests,
  approveLevel,
  rejectLevel,
  downloadGenericPDF,
  downloadPurchasePDF,
  deleteRequestById, // ✅ TAMBAH NI
} from "../controllers/requestController.js";

const router = express.Router();

// ================== CREATE ==================
router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  (req, res, next) => {
    try {
      let payload = req.body;
      if (req.file && req.body.data) {
        payload = JSON.parse(req.body.data);
      }
      req.parsedData = payload;
      next();
    } catch (err) {
      return res.status(400).json({ message: "Data JSON tak valid" });
    }
  },
  createRequest
);

// ================== DELETE ==================
router.delete("/:id", authMiddleware, deleteRequestById);

// ================== GET ALL ==================
router.get("/", authMiddleware, getRequests);

// ================== APPROVAL ==================
router.put("/approve-level/:id", authMiddleware, approveLevel);
router.put("/reject-level/:id", authMiddleware, rejectLevel);

// ================== PDF ==================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // ✅ pastikan logo ada
    const logoPath = path.resolve("backend/logo.png");
    if (!fs.existsSync(logoPath)) {
      console.warn("⚠ Logo tak jumpa di path:", logoPath);
    }

    // 🔥 FIX: convert Uint8Array → Buffer
    const pdfBytes = await generatePDFWithLogo(id);
    const pdfBuffer = Buffer.from(pdfBytes);

    // ✅ explicit headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Permohonan_${id}.pdf`
    );

    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF generate error:", err);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
});


export default router;



