import multer from "multer";
import supabase from "./supabase.js";

// Multer memory storage (tiada file local)
const storage = multer.memoryStorage();

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

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Middleware upload ke Supabase
export const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const fileBuffer = req.file.buffer; // data dalam memory
    const filename = Date.now() + "-" + req.file.originalname;

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
    res.status(500).send("Upload failed");
  }
};

export default upload;
