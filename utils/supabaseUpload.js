// utils/uploadFileToSupabase.js
import supabase from "../Middleware/supabase.js";
import fs from "fs";

export const uploadFileToSupabase = async (file) => {
  if (!file || !file.path) return null; // ✅ kalau takde file, return null

  const fileBuffer = fs.readFileSync(file.path);
  const fileName = `${Date.now()}_${file.originalname}`;

  const { data, error } = await supabase.storage
    .from("e-approval-files")
    .upload(fileName, fileBuffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data: publicData, error: publicError } = supabase
    .storage.from("e-approval-files")
    .getPublicUrl(fileName);

  if (publicError) throw new Error(publicError.message);

  return publicData.publicUrl;
};