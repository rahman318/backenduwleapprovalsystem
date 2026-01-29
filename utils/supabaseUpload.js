import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const uploadFileToSupabase = async (file) => {
  const fileBuffer = fs.readFileSync(file.path);
  const fileName = `${Date.now()}_${file.originalname}`;

  const { data, error } = await supabase.storage
    .from("e-approval-files") // nama bucket
    .upload(fileName, fileBuffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { publicUrl, error: publicError } = supabase
    .storage.from("e-approval-files")
    .getPublicUrl(fileName);

  if (publicError) throw new Error(publicError.message);

  return publicUrl;
};