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
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://uwleapprovalsystem.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow Postman / server-to-server
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "CORS policy: Origin not allowed";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

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
app.use(express.static(path.join(__dirname, "/dist")));

// Reset password SPA route (React)
app.get("/reset-password/:token?", (req, res) => res.sendFile(path.join(__dirname, "/dist/index.html")));

// Universal SPA fallback (React)
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "/dist/index.html")));

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




