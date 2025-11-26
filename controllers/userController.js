import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

// ✅ Register new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body; // ✅ tambah department

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      department,  // ✅ simpan department
    });

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
        department: user.department, // ✅ return department juga
      },
      token,
    });
  } catch (err) {
    console.error("❌ Error registerUser:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Error getUsers:", err);
    res.status(500).json({ message: "Gagal fetch semua users", error: err.message });
  }
};

// ✅ Get all staff
export const getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "staff" }).sort({ name: 1 });
    res.status(200).json(staff);
  } catch (err) {
    console.error("❌ Error getStaff:", err);
    res.status(500).json({ message: "Gagal fetch staff", error: err.message });
  }
};

// ✅ Get all approvers
export const getApprovers = async (req, res) => {
  try {
    const approvers = await User.find({ role: "approver" }).sort({ name: 1 });
    res.status(200).json(approvers);
  } catch (err) {
    console.error("❌ Error getApprovers:", err);
    res.status(500).json({ message: "Gagal fetch approvers", error: err.message });
  }
};

// 🗑️ DELETE User (Admin sahaja)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak dijumpai" });
    }
    res.status(200).json({ message: "User berjaya dipadam" });
  } catch (err) {
    console.error("❌ Error deleteUser:", err.message);
    res.status(500).json({ message: "Gagal padam user" });
  }

};
