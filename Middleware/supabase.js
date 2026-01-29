// backend/middleware/supabase.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Pastikan .env load dulu sebelum createClient
dotenv.config({ path: path.resolve("./.env") });

// Debug sementara
console.log("✅ SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("✅ SUPABASE_SERVICE_KEY:", process.env.SUPABASE_SERVICE_KEY?.slice(0,5) + "...");

// Throw error kalau missing
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("❌ SUPABASE_URL or SUPABASE_SERVICE_KEY missing!");
}

// Buat Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default supabase;
