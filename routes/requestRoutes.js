// backend/routes/requestRoutes.js
import express from "express";
import multer from "multer";
import authMiddleware from "../Middleware/authMiddleware.js";
import Request from "../models/Requests.js";
import { generatePDFWithLogo } from "../utils/generatePDFFromDB.js";
import supabase from "../Middleware/supabase.js";

import {
  createRequest,
  getRequests,
  approveLevel,
  rejectLevel,
  deleteRequestById,
} from "../controllers/requestController.js";

const router = express.Router();

// ================== Multer Memory Storage ==================
const storage = multer.memoryStorage(); // semua file simpan di RAM
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("File type not supported"), false);
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ================== Upload to Supabase Middleware ==================
export const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next(); // skip kalau tiada file

  try {
    const fileBuffer = req.file.buffer;
    const filename = Date.now() + "-" + req.file.originalname;

    // Upload ke Supabase
    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(filename, fileBuffer, { upsert: true });

    if (error) throw error;

    const { publicUrl } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(filename);

    req.fileUrl = publicUrl;
    console.log(`✅ File uploaded ke Supabase: ${publicUrl}`);
    next();
  } catch (err) {
    console.error("❌ Supabase upload failed:", err.message);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

// ================== CREATE REQUEST ==================
router.post(
  "/",
  authMiddleware,
  upload.single("file"),  // multer memory storage
  uploadToSupabase,       // upload ke Supabase
  (req, res, next) => {
    try {
      let payload = req.body;
      if (req.body.data) payload = JSON.parse(req.body.data);

      // attach file URL jika ada
      if (req.fileUrl) payload.fileUrl = req.fileUrl;

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

// ================== PDF GENERATE ==================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const logoPath = path.resolve("backend/logo.png");
    if (!fs.existsSync(logoPath)) console.warn("⚠ Logo tak jumpa di path:", logoPath);

    const pdfBytes = await generatePDFWithLogo(id);
    const pdfBuffer = Buffer.from(pdfBytes);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Permohonan_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF generate error:", err);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
});

export default router;
