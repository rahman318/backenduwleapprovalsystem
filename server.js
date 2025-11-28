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

// 🧠 Dapatkan __dirname dalam ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 🧱 MIDDLEWARE
// ==========================
app.use(
  cors({
    origin: process.env.CLIENT_URL, // ✅ React dev URL
    credentials: true,
  })
);

app.use(
  cors({
    origin: "https://uwleapprovalsystem.onrender.com", // frontend boss
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

app.use(express.json({ limit: "10mb" })); // untuk parse JSON besar
app.use(express.urlencoded({ extended: true })); // untuk form data

// ✅ Serve static folder (uploads, images, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/generated_pdfs", express.static(path.join(__dirname, "generated_pdfs")));

// ==========================
// 🚀 ROUTES
// ==========================
app.use("/api/users", usersRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testEmailRoutes);

// ==========================
// ⚙️ DATABASE CONNECTION
// ==========================
const MONGO_URI = "mongodb+srv://rahman:rahman123@cluster0.xkonlz1.mongodb.net/eapproval?retryWrites=true&w=majority"

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




