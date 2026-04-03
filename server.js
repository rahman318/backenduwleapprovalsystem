import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

import usersRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import testEmailRoutes from "./routes/testEmail.js";
import verifyRoutes from "./routes/verifyRoutes.js";

dotenv.config();

const app = express();

// 🧠 Dapatkan __dirname dalam ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 🧱 MIDDLEWARE
// ==========================
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true); // allow semua origin
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" })); // untuk parse JSON besar
app.use(express.urlencoded({ extended: true })); // untuk form data

// ==========================
// 🚀 ROUTES
// ==========================
app.use("/api/users", usersRoutes);
app.use("/api/requests", requestRoutes);
app.use("/job-orders", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testEmailRoutes);
app.use("/verify", verifyRoutes);

// ==========================
// ⚙️ DATABASE CONNECTION
// ==========================
const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.name}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

connectDB();

// ==========================
// 🖥️ START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));





