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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS - versi selamat
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL,
      "https://uwleapprovalsystem.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/generated_pdfs", express.static(path.join(__dirname, "generated_pdfs")));

// API routes
app.use("/api/users", usersRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testEmailRoutes);

// React build
app.use(express.static(path.join(__dirname, "dist")));

// ✅ Reset Password SPA route (WAJIB)
app.get("/reset-password/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

// ✅ Universal React fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

// Mongo
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
