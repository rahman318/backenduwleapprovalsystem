// backend/routes/requestRoutes.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import authMiddleware from "../Middleware/authMiddleware.js";
import supabase from "../Middleware/supabase.js"; // supabase client
import Request from "../models/Requests.js";
import {
  createRequest,
  getRequests,
  approveLevel,
  rejectLevel,
  deleteRequestById,
} from "../controllers/requestController.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";

const router = express.Router();

// ================== MULTER ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // simpan sementara sebelum upload ke Supabase
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ================== Middleware: Upload ke Supabase ==================
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const tempPath = req.file.path; // path file dari multer diskStorage
    const originalname = req.file.originalname;

    const fileBuffer = fs.readFileSync(tempPath);

    // ✅ Buat nama file unik
    const filePath = `requests/${Date.now()}-${originalname}`;

    // ✅ Upload ke Supabase
    const uploadRes = await supabase.storage
      .from("eapproval_uploads") // pastikan bucket ni wujud
      .upload(filePath, fileBuffer, {
        contentType: req.file.mimetype,
      });

    console.log("📦 UPLOAD RESPONSE SUPABASE:", uploadRes);

    if (uploadRes.error) {
      throw uploadRes.error;
    }

    // ✅ Delete file temp dari server
    fs.unlinkSync(tempPath);

    // ✅ Dapatkan public URL
    const { data } = supabase.storage
      .from("attachments")
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    req.fileUrl = publicUrl;

    console.log("✅ File uploaded ke Supabase:", publicUrl);

    next();
  } catch (err) {
    console.error("❌ Supabase upload failed:", err.message);
    res.status(500).json({ message: "Upload failed" });
  }
};

// ================== CREATE REQUEST ==================
router.post(
  "/",
  authMiddleware,
  upload.single("file"), // multer dulu parse file
  uploadToSupabase,      // baru upload ke Supabase
  (req, res, next) => {
    try {
      let payload = req.body;
      if (req.body.data) payload = JSON.parse(req.body.data);

      // attach fileUrl jika ada
      if (req.fileUrl) payload.fileUrl = req.fileUrl;

      req.parsedData = payload;
      next();
    } catch (err) {
      return res.status(400).json({ message: "Data JSON tak valid" });
    }
  },
  createRequest
);

// ================== DELETE REQUEST ==================
router.delete("/:id", authMiddleware, deleteRequestById);

// ================== GET ALL REQUESTS ==================
router.get("/", authMiddleware, getRequests);

// ================== APPROVAL ==================
router.put("/approve-level/:id", authMiddleware, approveLevel);
router.put("/reject-level/:id", authMiddleware, rejectLevel);

// ================== PDF GENERATION ==================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const logoPath = path.resolve("backend/logo.png");
    if (!fs.existsSync(logoPath)) {
      console.warn("⚠ Logo tak jumpa di path:", logoPath);
    }

    // Generate PDF dengan safety check
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



