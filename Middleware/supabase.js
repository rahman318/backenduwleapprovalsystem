import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve("./.env") });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("❌ SUPABASE credentials missing in .env");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ✅ MIDDLEWARE UNTUK UPLOAD + DAPATKAN PUBLIC URL
export const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next(); // kalau takde file, skip

  try {
    const { path: tempPath, originalname, mimetype } = req.file;
    const fileData = fs.readFileSync(tempPath);

    // Guna nama unik supaya tak overwrite
    const fileName = `${Date.now()}-${originalname}`;

    // 1️⃣ Upload ke Supabase Storage
    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(fileName, fileData, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) throw error;

    // 2️⃣ Padam file sementara dari server
    fs.unlinkSync(tempPath);

    // 3️⃣ Dapatkan PUBLIC URL
    const { data: publicUrlData } = supabase.storage
      .from("eapproval_uploads")
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to generate public URL");
    }

    // 4️⃣ Simpan URL dalam request untuk controller guna
    req.fileUrl = publicUrlData.publicUrl;

    console.log("✅ Supabase Upload Success:", req.fileUrl);

    next();
  } catch (err) {
    console.error("❌ Supabase Upload Error:", err.message);
    return res.status(500).json({ message: "File upload failed" });
  }
};

export default supabase;
