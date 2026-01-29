import { createClient } from '@supabase/supabase-js';
import JobOrder from './models/JobOrder.js'; // model MongoDB

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadFileAndSaveToMongo(jobId, file) {
  try {
    // 1️⃣ Upload file ke Supabase
    const filePath = `uploads/${file.originalname}`; // ikut nama fail
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) throw uploadError;

    // 2️⃣ Ambil public URL selepas upload
    const { data: publicUrlData } = supabase
      .storage
      .from('uploads')
      .getPublicUrl(uploadData.path);

    const fileUrl = publicUrlData.publicUrl; // <-- URL sebenar

    console.log('File uploaded, URL:', fileUrl);

    // 3️⃣ Simpan URL ke MongoDB
    await JobOrder.updateOne(
      { _id: jobId },
      { $set: { "file.url": fileUrl } }
    );

    console.log('MongoDB updated with file URL!');
  } catch (err) {
    console.error('Error uploading file or saving URL:', err);
  }
}
