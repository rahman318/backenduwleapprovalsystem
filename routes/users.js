// backend/routes/users.js
import express from "express";
import User from "../models/users.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import { auth } from "../middleware/authMiddleware.js"; // Sementara kita remove auth

const router = express.Router();

// ✅ Register user (public sementara, nanti boleh protect dengan auth)
router.post("/register", async (req, res) => {
  try {
    console.log("📩 Register Request Body:", req.body);

    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    console.log("🔑 Password hashed:", hashed);

    // Save user
    const user = await User.create({
      username: name, // frontend hantar 'name', backend simpan sebagai 'username'
      email,
      password: hashed,
      role,
      department,
    });

    console.log("✅ User created:", user);

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Login
router.post("/login", async (req, res) => {
  try {
    console.log("📩 Login Request Body:", req.body);

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    console.log("🔍 User found:", user);

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log("🔑 Password match:", match);

    if (!match) {
      console.log("❌ Wrong password");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );
    console.log("🎫 JWT generated:", token);

    res.json({ token, userId: user._id, username: user.username, role: user.role });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get approvers
router.get("/approvers", async (req, res) => {
  try {
    console.log("📩 Approvers request received");

    const approvers = await User.find({ role: "approver" }).select("username email role");
    console.log("✅ Approvers found:", approvers);

    res.json(approvers);
  } catch (err) {
    console.error("❌ Approvers error:", err.message);
    res.status(500).json({ message: err.message });
  }
});


export default router;
