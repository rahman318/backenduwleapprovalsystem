import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import usersRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import testEmailRoutes from "./routes/testEmail.js";

dotenv.config();

const app = express();

// 🧠 ES module: dapatkan __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 🛡️ CORS - versi selamat
// ==========================

app.use(cors({
  origin: true,
  credentials: true
}));

// ==========================
// 🧱 Middleware
// ==========================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/generated_pdfs", express.static(path.join(__dirname, "generated_pdfs")));

// ==========================
// 🚀 API Routes
// ==========================
app.use("/api/users", usersRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testEmailRoutes);

// ==========================
// 🌐 Serve React build
// ==========================

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  if (
    !req.path.startsWith("/api") &&
    !req.path.startsWith("/assets") &&
    !req.path.startsWith("/uploads") &&
    !req.path.startsWith("/generated_pdfs")
  ) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  }
});

// ==========================
// ⚙️ MongoDB Connection
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
// 🖥️ Start Server
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);










