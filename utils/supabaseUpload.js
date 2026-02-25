// utils/uploadFileToSupabase.js
import supabase from "../Middleware/supabase.js";
import fs from "fs";

export const uploadFileToSupabase = async (file) => {
  if (!file) return null;

  const fileBuffer = file.buffer || fs.readFileSync(file.path);
  const fileName = `${Date.now()}_${file.originalname}`;

  const { data, error } = await supabase.storage
    .from("eapproval_uploads")
    .upload(fileName, fileBuffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data: publicData, error: publicError } = supabase
    .storage.from("eapproval-uploads")
    .getPublicUrl(fileName);

  if (publicError) throw new Error(publicError.message);

  return publicData.publicUrl; // 🔥 pastikan ini return
};
