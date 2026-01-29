import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const uploadFileToSupabase = async (file) => {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.originalname}`;

  // pakai buffer terus
  const { data, error } = await supabase.storage
    .from("eapproval_uploads")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { publicUrl } = supabase
    .storage
    .from("eapproval_uploads")
    .getPublicUrl(fileName);

  console.log("🔥 Supabase URL:", publicUrl);  // debug

  return publicUrl;
};

