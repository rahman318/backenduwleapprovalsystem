import express from "express";
import {
  registerUser,
  getUsers,
  getStaff,
  getApprovers,
  getTechnicians,
  deleteUser, // 🟢 Tambah import deleteUser
} from "../controllers/userController.js";
import authMiddleware from "../Middleware/authMiddleware.js"; // ✅ pastikan file ni wujud

const router = express.Router();

// 🧩 Routes sedia ada
router.post("/register", registerUser);
router.get("/", getUsers);
router.get("/staff", getStaff);
router.get("/approvers", getApprovers);
router.get("/technicians", getTechnicians);

// 🧩 Maklumat user semasa (guna token)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak dijumpai" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ Ralat semasa ambil maklumat user:", err);
    res.status(500).json({ message: "Ralat pelayan" });
  }
});

// 🗑️ DELETE user (Admin sahaja)
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    // pastikan hanya admin boleh padam
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak. Admin sahaja boleh padam user." });
    }

    await deleteUser(req, res);
  } catch (error) {
    console.error("❌ Ralat delete user:", error);
    res.status(500).json({ message: "Ralat semasa padam user" });
  }
});


export default router;
