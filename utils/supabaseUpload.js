import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const uploadFileToSupabase = async (file) => {
  console.log("🚀 uploadFileToSupabase called");
  
  if (!file) {
    console.warn("⚠️ No file received!");
    return null;
  }

  console.log("✅ File info:", {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    bufferLength: file.buffer?.length || 0,
  });

  const fileName = `${Date.now()}_${file.originalname}`;
  console.log("📝 Generated fileName:", fileName);

  try {
    const { data, error } = await supabase.storage
      .from("eapproval_uploads")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Supabase upload success, data:", data);

    const { publicUrl, error: publicError } = supabase
      .storage
      .from("eapproval_uploads")
      .getPublicUrl(fileName);

    if (publicError) {
      console.error("❌ Supabase getPublicUrl error:", publicError);
      throw new Error(publicError.message);
    }

    console.log("🔥 Supabase public URL:", publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("❌ Exception in uploadFileToSupabase:", err);
    return null;
  }
};
