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
import verifyRoutes from "./routes/verifyRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";

dotenv.config();

const app = express();

// ==========================
// 🌐 GLOBAL LOGGER
// ==========================
app.use((req, res, next) => {
  console.log("🌐 GLOBAL HIT:", req.method, req.url);
  next();
});

// ==========================
// 🧠 PATH FIX (__dirname ES MODULE)
// ==========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 🧱 MIDDLEWARE
// ==========================
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ==========================
// 🚀 API ROUTES
// ==========================
app.use("/api/users", usersRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/my-requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testEmailRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/verify", verifyRoutes);
app.use("/api/audit-logs", auditLogRoutes);

// ==========================
// ⚙️ DATABASE
// ==========================
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then((conn) => {
    console.log(`✅ MongoDB connected: ${conn.connection.name}`);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// ==========================
// 🖥️ SERVE REACT BUILD (🔥 IMPORTANT FIX)
// ==========================

// Serve static files from React build
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback (IMPORTANT - must be LAST)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ==========================
// 🚀 START SERVER
// ==========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
