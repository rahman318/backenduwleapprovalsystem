import multer from "multer";
import fs from "fs";
import path from "path";
import supabase from "./supabase.js"; // supabase client kita

// ⚡ Multer tetap guna temp folder sementara sebelum upload
const tempDir = "temp_uploads/";
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Multer storage (simpan sementara)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const finalName = uniqueSuffix + path.extname(file.originalname);
    console.log(`✅ Temp file disimpan sebagai: ${finalName}`);
    cb(null, finalName);
  },
});

// Filter file sama macam korang
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype.startsWith("image/")
  ) {
    console.log(`📂 Upload diterima: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } else {
    console.error(`❌ Upload ditolak: ${file.originalname} (${file.mimetype})`);
    cb(new Error("File type not supported"), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// 🔹 Middleware function untuk upload ke Supabase
export const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const { path: tempPath, originalname } = req.file;
    const fileData = fs.readFileSync(tempPath);

    // Upload ke Supabase Storage
    const { data, error } = await supabase.storage
      .from("eapproval_uploads") // bucket name
      .upload(originalname, fileData, { upsert: true });

    if (error) throw error;

    // Hapus temp file
    fs.unlinkSync(tempPath);

    // Generate public URL
    const { publicUrl } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(originalname);

    // Masukkan URL dalam req supaya controller boleh simpan ke MongoDB/email
    req.fileUrl = publicUrl;

    console.log(`✅ File uploaded ke Supabase: ${publicUrl}`);
    next();
  } catch (err) {
    console.error("❌ Supabase upload failed:", err.message);
    res.status(500).send("Upload failed");
  }
};

export default upload;
