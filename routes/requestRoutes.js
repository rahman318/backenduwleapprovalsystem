// backend/routes/requestRoutes.js
import express from "express";
import upload from "../Middleware/upload.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import Request from "../models/Requests.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";
import supabase from "../Middleware/supabase.js"; // supabase client
import fs from "fs";
import path from "path";

import {
  createRequest,
  getRequests,
  approveLevel,
  rejectLevel,
  deleteRequestById,
} from "../controllers/requestController.js";

const router = express.Router();

// ================== Middleware: Upload ke Supabase ==================
export const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next(); // kalau tiada file, skip

  try {
    const { path: tempPath, originalname } = req.file;
    const fileData = fs.readFileSync(tempPath);

    // Upload ke Supabase
    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(originalname, fileData, { upsert: true });

    if (error) throw error;

    // Delete temp file
    fs.unlinkSync(tempPath);

    // Generate public URL
    const { publicUrl } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(originalname);

    // Attach URL ke request supaya controller boleh simpan ke MongoDB
    req.fileUrl = publicUrl;
    console.log(`✅ File uploaded ke Supabase: ${publicUrl}`);

    next();
  } catch (err) {
    console.error("❌ Supabase upload failed:", err.message);
    res.status(500).json({ message: "Upload failed" });
  }
};

// ================== CREATE ==================
router.post(
  "/",
  authMiddleware,
  upload.single("file"),   // multer temp upload
  uploadToSupabase,        // upload ke Supabase
  (req, res, next) => {
    try {
      let payload = req.body;
      if (req.body.data) {
        payload = JSON.parse(req.body.data);
      }

      // Jika file ada, attach URL ke payload
      if (req.fileUrl) {
        payload.fileUrl = req.fileUrl;
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

    const logoPath = path.resolve("backend/logo.png");
    if (!fs.existsSync(logoPath)) {
      console.warn("⚠ Logo tak jumpa di path:", logoPath);
    }

    const pdfBytes = await generatePDFWithLogo(id);
    const pdfBuffer = Buffer.from(pdfBytes);

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

