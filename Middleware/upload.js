import multer from "multer";
import path from "path";
import fs from "fs";

// Pastikan folder uploads wujud
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Setup storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // folder simpan file
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const finalName = uniqueSuffix + path.extname(file.originalname);
    console.log(`✅ File disimpan sebagai: ${finalName}`);
    cb(null, finalName);
  },
});

// Filter file
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

// Instance multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

// ✅ Export default
export default upload;