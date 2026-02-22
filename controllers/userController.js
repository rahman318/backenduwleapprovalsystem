// controllers/userController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ================== REGISTER USER ==================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, department, level } = req.body;

    // check duplicate email
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      department,
    };

    // ✅ simpan level jika approver
    if (role === "approver") {
      userData.level = level || 1; // default level 1
    }

    const user = await User.create(userData);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        level: user.level || "-",
      },
      token,
    });
  } catch (err) {
    console.error("❌ Error registerUser:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ================== GET CURRENT USER ==================
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // assume auth middleware set req.user
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      level: user.level || "-",
    });
  } catch (err) {
    console.error("❌ Error getCurrentUser:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ================== GET ALL USERS ==================
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Error getUsers:", err);
    res.status(500).json({ message: "Gagal fetch semua users", error: err.message });
  }
};

// ================== GET ALL STAFF ==================
export const getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "staff" }).sort({ name: 1 });
    res.status(200).json(staff);
  } catch (err) {
    console.error("❌ Error getStaff:", err);
    res.status(500).json({ message: "Gagal fetch staff", error: err.message });
  }
};

// ================== GET ALL APPROVERS ==================
export const getApprovers = async (req, res) => {
  try {
    const approvers = await User.find({ role: "approver" }).sort({ name: 1 });
    res.status(200).json(approvers);
  } catch (err) {
    console.error("❌ Error getApprovers:", err);
    res.status(500).json({ message: "Gagal fetch approvers", error: err.message });
  }
};

// ================== GET ALL TECHNICIANS ==================
export const getTechnicians = async (req, res) => {
  try {
    const technicians = await User.find({ role: "technician" })
      .select("_id name email department")
      .sort({ name: 1 });

    res.status(200).json(technicians);
  } catch (err) {
    console.error("❌ Error getTechnicians:", err);
    res.status(500).json({ message: "Gagal fetch technicians", error: err.message });
  }
};

// ================== DELETE USER ==================
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User tidak dijumpai" });

    res.status(200).json({ message: "User berjaya dipadam" });
  } catch (err) {
    console.error("❌ Error deleteUser:", err.message);
    res.status(500).json({ message: "Gagal padam user" });
  }
};
